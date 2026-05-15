import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { captureAppException } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'
import { getClientIp } from '@/lib/request'
import { checkRateLimit, tooManyRequests } from '@/lib/rateLimit'

export const runtime = 'nodejs'

const MAX_FILE_BYTES = 30 * 1024 * 1024
const SUPPORTED_EXTENSIONS = new Set(['docx', 'doc', 'pdf', 'txt', 'text', 'md', 'csv', 'xlsx', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'])

const MIME_BY_EXTENSION: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
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
  heic: 'image/heic',
  heif: 'image/heif',
}

function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === 'object' && 'arrayBuffer' in value && 'name' in value)
}

export async function POST(request: NextRequest) {
  const org = await getCurrentOrg()
  if (!org?.isOperator) {
    return NextResponse.json({ error: 'Operator access is required.' }, { status: 403 })
  }

  try {
    const rate = await checkRateLimit({
      key: `profile-archive:${org.user.id}:${getClientIp(request)}`,
      limit: 60,
      windowSeconds: 60,
      route: '/api/operator/profile-sheets/archive',
      userId: org.user.id,
    })
    if (!rate.allowed) {
      const limited = tooManyRequests(rate.resetAt)
      return NextResponse.json(limited.body, limited.init)
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!isFile(file)) {
      return NextResponse.json({ error: 'Upload a profile sheet, signed agreement, or job document.' }, { status: 400 })
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Profile sheet attachments must be 30 MB or smaller.' }, { status: 413 })
    }

    const fileName = file.name || 'profile-sheet'
    const extension = fileName.split('.').pop()?.toLowerCase()
    if (!extension || !SUPPORTED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: 'Unsupported attachment type. Use PDF, DOC/DOCX, XLSX, TXT/CSV, JPG, PNG, WEBP, or HEIC.' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
    const filePath = `${org.organizationId || 'unscoped'}/${Date.now()}-${safeFileName}`
    const contentType = file.type || MIME_BY_EXTENSION[extension] || 'application/octet-stream'
    const supabase = await createClient()
    const upload = await supabase.storage
      .from('profile-sheets')
      .upload(filePath, Buffer.from(buffer), {
        contentType,
        upsert: false,
      })

    if (upload.error) {
      return NextResponse.json({ error: upload.error.message }, { status: 500 })
    }

    return NextResponse.json({
      fileName,
      filePath: upload.data.path,
      contentType,
      size: file.size,
    })
  } catch (error) {
    captureAppException(error, { route: '/api/operator/profile-sheets/archive', organizationId: org.organizationId, userId: org.user.id })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not archive this profile sheet.' }, { status: 500 })
  }
}
