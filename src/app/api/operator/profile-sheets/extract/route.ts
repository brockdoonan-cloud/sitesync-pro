import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { extractDocxText, extractImageText, extractPdfText, extractPlainText, extractProfileSheetTerms, extractXlsxText } from '@/lib/billing/profileSheet'
import { captureAppException } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'
import { getClientIp } from '@/lib/request'
import { checkRateLimit, tooManyRequests } from '@/lib/rateLimit'

export const runtime = 'nodejs'

const MAX_FILE_BYTES = 30 * 1024 * 1024
const SUPPORTED_EXTENSIONS = new Set(['docx', 'pdf', 'txt', 'text', 'md', 'csv', 'xlsx', 'jpg', 'jpeg', 'png', 'webp'])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp'])

const MIME_BY_EXTENSION: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  txt: 'text/plain',
  text: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === 'object' && 'arrayBuffer' in value && 'name' in value)
}

async function extractTextForFile(buffer: ArrayBuffer, extension: string, mediaType: string, fileName: string) {
  if (extension === 'docx') return extractDocxText(buffer)
  if (extension === 'pdf') return extractPdfText(buffer, fileName)
  if (extension === 'xlsx') return extractXlsxText(buffer)
  if (IMAGE_EXTENSIONS.has(extension)) return extractImageText(buffer, mediaType, fileName)
  return extractPlainText(buffer)
}

export async function POST(request: NextRequest) {
  const org = await getCurrentOrg()
  if (!org?.isOperator) {
    return NextResponse.json({ error: 'Operator access is required.' }, { status: 403 })
  }

  try {
    const rate = await checkRateLimit({
      key: `profile-extract:${org.user.id}:${getClientIp(request)}`,
      limit: 60,
      windowSeconds: 60,
      route: '/api/operator/profile-sheets/extract',
      userId: org.user.id,
    })
    if (!rate.allowed) {
      const limited = tooManyRequests(rate.resetAt)
      return NextResponse.json(limited.body, limited.init)
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!isFile(file)) {
      return NextResponse.json({ error: 'Upload a customer profile sheet or signed agreement file.' }, { status: 400 })
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Profile sheets must be 30 MB or smaller.' }, { status: 413 })
    }

    const fileName = file.name || 'profile-sheet'
    const extension = fileName.split('.').pop()?.toLowerCase()

    if (extension === 'doc') {
      return NextResponse.json({
        error: 'Legacy .doc files cannot be safely read in the browser importer. Save it as PDF or DOCX, then upload again.',
      }, { status: 400 })
    }

    if (!extension || !SUPPORTED_EXTENSIONS.has(extension)) {
      return NextResponse.json({
        error: 'Unsupported file type. Upload DOCX, PDF, XLSX, TXT, CSV, JPG, PNG, or WEBP profile sheets.',
      }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const contentType = file.type || MIME_BY_EXTENSION[extension] || 'application/octet-stream'
    const text = await extractTextForFile(buffer, extension, contentType, fileName)
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
        contentType,
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
    const message = error instanceof Error ? error.message : 'Could not extract the profile sheet.'
    const status = /needs OCR|unsupported|No readable text|too large/i.test(message) ? 422 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
