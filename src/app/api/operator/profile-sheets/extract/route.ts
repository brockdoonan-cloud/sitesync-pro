import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { extractDocxText, extractProfileSheetTerms } from '@/lib/billing/profileSheet'
import { captureAppException } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MAX_FILE_BYTES = 25 * 1024 * 1024

function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === 'object' && 'arrayBuffer' in value && 'name' in value)
}

export async function POST(request: NextRequest) {
  const org = await getCurrentOrg()
  if (!org?.isOperator) {
    return NextResponse.json({ error: 'Operator access is required.' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!isFile(file)) {
      return NextResponse.json({ error: 'Upload a DOCX customer profile sheet.' }, { status: 400 })
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Profile sheets must be 25 MB or smaller.' }, { status: 413 })
    }

    const fileName = file.name || 'profile-sheet.docx'
    const extension = fileName.split('.').pop()?.toLowerCase()

    if (extension !== 'docx') {
      return NextResponse.json({
        error: 'DOCX profile sheets are supported today. Save PDFs or legacy DOC files as .docx, then upload again.',
      }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const text = await extractDocxText(buffer)
    if (!text.trim()) {
      return NextResponse.json({ error: 'No readable text was found in this document.' }, { status: 422 })
    }

    const extraction = extractProfileSheetTerms(text, fileName)
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
    const filePath = `${org.organizationId || 'unscoped'}/${Date.now()}-${safeFileName}`
    const supabase = await createClient()
    const upload = await supabase.storage
      .from('profile-sheets')
      .upload(filePath, Buffer.from(buffer), {
        contentType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: false,
      })

    if (upload.error) {
      extraction.warnings.push(`The document was extracted, but the original file was not archived yet: ${upload.error.message}`)
    } else {
      extraction.sourceFilePath = upload.data.path
    }

    return NextResponse.json({ extraction })
  } catch (error) {
    captureAppException(error, { route: '/api/operator/profile-sheets/extract', organizationId: org.organizationId, userId: org.user.id })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not extract the profile sheet.' }, { status: 500 })
  }
}
