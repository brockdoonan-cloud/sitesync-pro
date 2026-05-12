import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit/log'
import { captureAppException } from '@/lib/monitoring/sentry'
import { getClientIp } from '@/lib/request'
import { checkRateLimit, tooManyRequests } from '@/lib/rateLimit'
import { getCustomerClientIds } from '@/lib/customer/access'

const activeServiceTypes = new Set(['swap', 'removal', 'delivery', 'pump_out', 'emergency'])

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to request service.' }, { status: 401 })

  const rate = await checkRateLimit({
    key: `customer-service:${user.id}:${getClientIp(request)}`,
    limit: 30,
    windowSeconds: 60 * 60,
    route: '/api/customer/service-requests',
    userId: user.id,
  })
  if (!rate.allowed) {
    const limited = tooManyRequests(rate.resetAt)
    return NextResponse.json(limited.body, limited.init)
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const serviceType = clean(body.service_type)
  const jobsiteAddress = clean(body.jobsite_address || body.service_address)
  const binNumber = clean(body.bin_number)
  const preferredDate = clean(body.preferred_date)
  const timePreference = clean(body.time_preference)
  const rawNotes = clean(body.notes)
  const clientId = clean(body.client_id)

  if (!activeServiceTypes.has(serviceType)) {
    return NextResponse.json({ error: 'Choose a valid service type.' }, { status: 400 })
  }
  if (!jobsiteAddress) {
    return NextResponse.json({ error: 'Jobsite address is required.' }, { status: 400 })
  }

  const allowedClientIds = await getCustomerClientIds(supabase, user)
  if (clientId && !allowedClientIds.includes(clientId)) {
    return NextResponse.json({ error: 'This customer account is not linked to that client.' }, { status: 403 })
  }

  const notes = [
    timePreference ? `Preferred time: ${timePreference}.` : '',
    binNumber ? `Pickup bin: ${binNumber}.` : '',
    'Source: Customer Portal.',
    rawNotes,
  ].filter(Boolean).join(' ')

  const payload = {
    customer_id: user.id,
    client_id: clientId || null,
    jobsite_id: clean(body.jobsite_id) || null,
    service_type: serviceType,
    jobsite_address: jobsiteAddress,
    service_address: jobsiteAddress,
    preferred_date: preferredDate || null,
    scheduled_date: preferredDate || null,
    bin_number: binNumber || null,
    priority: serviceType === 'emergency' ? 'emergency' : serviceType === 'swap' ? 'high' : 'normal',
    notes,
    status: 'dispatch_ready',
  }

  const admin = createAdminClient()
  const writer = admin || supabase
  const { data, error } = await writer
    .from('service_requests')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    captureAppException(error, { route: '/api/customer/service-requests', userId: user.id })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditEvent({
    userId: user.id,
    orgId: data?.organization_id,
    action: 'create',
    resourceType: 'service_request',
    resourceId: data?.id,
    afterState: data,
    request,
  })

  return NextResponse.json({ request: data })
}
