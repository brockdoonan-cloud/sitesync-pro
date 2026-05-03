import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyQuoteReceived } from '@/lib/notifications'
import { logAuditEvent } from '@/lib/audit/log'
import { checkRateLimit, tooManyRequests } from '@/lib/rateLimit'
import { getClientIp } from '@/lib/request'
import { captureAppException } from '@/lib/monitoring/sentry'

const requiredFields = ['name', 'email', 'city', 'zip', 'equipment_type', 'job_type']

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rate = await checkRateLimit({
    key: `quote-submit:${ip}`,
    limit: 5,
    windowSeconds: 60 * 60,
    route: '/api/quote-requests',
  })
  if (!rate.allowed) {
    const limited = tooManyRequests(rate.resetAt)
    return NextResponse.json(limited.body, limited.init)
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  for (const field of requiredFields) {
    if (!String(body[field] || '').trim()) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 })
    }
  }

  const accessToken = crypto.randomUUID()
  const notes = [body.address ? `Exact address: ${body.address}` : '', body.notes || '']
    .filter(Boolean)
    .join('\n\n')

  const payload = {
    access_token: accessToken,
    name: String(body.name).trim(),
    email: String(body.email).trim(),
    phone: body.phone ? String(body.phone).trim() : null,
    city: String(body.city).trim(),
    zip: String(body.zip).trim(),
    equipment_type: String(body.equipment_type).trim(),
    dumpster_size: body.dumpster_size ? String(body.dumpster_size).trim() : null,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    duration_days: body.duration_days || null,
    job_type: String(body.job_type).trim(),
    notes: notes || null,
    status: 'open',
  }

  const admin = createAdminClient()
  const supabase = admin || createClient()

  const query = supabase.from('quote_requests').insert(payload)
  const result = admin
    ? await query.select('*').single()
    : await query.then((value: any) => ({ ...value, data: { ...payload, id: null, created_at: new Date().toISOString() } }))

  if (result.error) {
    captureAppException(result.error, { route: '/api/quote-requests' })
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  await notifyQuoteReceived(result.data)
  await logAuditEvent({
    action: 'create',
    resourceType: 'quote_request',
    resourceId: result.data?.id,
    afterState: result.data,
    request,
  })

  return NextResponse.json({ request: result.data })
}
