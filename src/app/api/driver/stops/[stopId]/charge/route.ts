import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { captureAppException } from '@/lib/monitoring/sentry'
import { logAuditEvent } from '@/lib/audit/log'
import { getClientIp } from '@/lib/request'
import { checkRateLimit, tooManyRequests } from '@/lib/rateLimit'

type Params = { params: Promise<{ stopId: string }> }

const MAX_PHOTO_BYTES = 15 * 1024 * 1024
const chargeSchema = z.object({
  charge_type: z.string().min(2).max(80),
  amount: z.coerce.number().min(0).max(50000),
  note: z.string().max(1000).optional().default(''),
})

function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === 'object' && 'arrayBuffer' in value && 'name' in value)
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-')
}

async function insertWithFallbacks(supabase: any, payloads: Record<string, unknown>[]) {
  let lastError: any = null
  for (const payload of payloads) {
    const { data, error } = await supabase.from('billing_events').insert(payload).select('*').single()
    if (!error) return { data, error: null }
    lastError = error
  }
  return { data: null, error: lastError }
}

export async function POST(request: NextRequest, { params }: Params) {
  const org = await getCurrentOrg()
  if (!org) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!org.isOperator && !org.isDriver) return NextResponse.json({ error: 'Driver/operator access required.' }, { status: 403 })

  const { stopId } = await params
  const supabase = createAdminClient() || await createClient()
  const { data: stop, error: stopError } = await supabase
    .from('route_stops')
    .select('*')
    .eq('id', stopId)
    .single()

  if (stopError || !stop) return NextResponse.json({ error: 'Stop not found.' }, { status: 404 })
  if (!org.isSuperAdmin && stop.organization_id !== org.organizationId) {
    return NextResponse.json({ error: 'Stop is outside your organization.' }, { status: 403 })
  }
  if (org.isDriver) {
    const { data: driver } = await supabase.from('drivers').select('id,truck_id').eq('user_id', org.user.id).eq('active', true).maybeSingle()
    const { data: route } = await supabase.from('driver_routes').select('driver_profile_id,truck_id').eq('id', stop.route_id).maybeSingle()
    if (!driver || !route || (route.driver_profile_id && route.driver_profile_id !== driver.id) || (route.truck_id && route.truck_id !== driver.truck_id)) {
      return NextResponse.json({ error: 'This stop is not assigned to your truck.' }, { status: 403 })
    }
  }

  try {
    const rate = await checkRateLimit({
      key: `driver-charge:${org.user.id}:${getClientIp(request)}`,
      limit: 60,
      windowSeconds: 60,
      route: '/api/driver/stops/[stopId]/charge',
      userId: org.user.id,
    })
    if (!rate.allowed) {
      const limited = tooManyRequests(rate.resetAt)
      return NextResponse.json(limited.body, limited.init)
    }

    const formData = await request.formData()
    const parsed = chargeSchema.safeParse({
      charge_type: formData.get('charge_type'),
      amount: formData.get('amount'),
      note: formData.get('note') || '',
    })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid charge.' }, { status: 400 })
    }

    const photo = formData.get('photo')
    if (!isFile(photo)) return NextResponse.json({ error: 'Photo evidence is required.' }, { status: 400 })
    if (photo.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'Photos must be 15 MB or smaller.' }, { status: 413 })
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(photo.type || '')) {
      return NextResponse.json({ error: 'Use JPG, PNG, WEBP, or HEIC photos.' }, { status: 400 })
    }

    const extension = photo.name.split('.').pop()?.toLowerCase() || (photo.type.split('/')[1] || 'jpg')
    const filePath = `${stop.organization_id}/${stopId}/${Date.now()}-${safeName(photo.name || `stop-photo.${extension}`)}`
    const buffer = Buffer.from(await photo.arrayBuffer())
    const upload = await supabase.storage.from('stop-photos').upload(filePath, buffer, {
      contentType: photo.type,
      upsert: false,
    })
    if (upload.error) throw upload.error

    const now = new Date().toISOString()
    const payload = {
      route_id: stop.route_id,
      route_stop_id: stopId,
      service_request_id: stop.service_request_id,
      charge_type: parsed.data.charge_type,
      amount: parsed.data.amount,
      note: parsed.data.note,
      photo_url: upload.data.path,
      driver_id: org.user.id,
      created_at: now,
    }
    const fullPayload = {
      organization_id: stop.organization_id,
      client_id: stop.client_id || null,
      job_id: stop.job_id || null,
      route_stop_id: stopId,
      event_date: now.slice(0, 10),
      event_type: 'additional_charge',
      charge_type: parsed.data.charge_type,
      amount: parsed.data.amount,
      note: parsed.data.note,
      photo_url: upload.data.path,
      driver_id: org.user.id,
      status: 'pending_review',
      source_file: 'driver_photo_charge',
      project_name: stop.address || null,
      bin_number: stop.bin_number || stop.bin_numbers?.[0] || null,
      payload,
    }
    const compatibilityPayload = {
      organization_id: stop.organization_id,
      event_date: now.slice(0, 10),
      event_type: 'additional_charge',
      source_file: 'driver_photo_charge',
      project_name: stop.address || null,
      bin_number: stop.bin_number || stop.bin_numbers?.[0] || null,
      payload,
    }
    const result = await insertWithFallbacks(supabase, [fullPayload, compatibilityPayload])
    if (result.error) throw result.error

    await logAuditEvent({
      userId: org.user.id,
      orgId: stop.organization_id,
      action: 'create',
      resourceType: 'billing_event',
      resourceId: result.data?.id || stopId,
      afterState: result.data || payload,
      request,
    })

    return NextResponse.json({ billingEvent: result.data, photoPath: upload.data.path })
  } catch (error) {
    captureAppException(error, { route: '/api/driver/stops/[stopId]/charge', organizationId: stop.organization_id, userId: org.user.id })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not add this charge.' }, { status: 500 })
  }
}
