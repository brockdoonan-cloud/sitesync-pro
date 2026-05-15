import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/rateLimit'
import { getClientIp } from '@/lib/request'
import { captureAppException } from '@/lib/monitoring/sentry'

const shiftSchema = z.object({
  action: z.enum(['clock_in', 'clock_out']),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
})

function gps(lat?: number, lng?: number, latColumn = 'clock_in_lat', lngColumn = 'clock_in_lng') {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {}
  return { [latColumn]: lat, [lngColumn]: lng }
}

export async function GET() {
  const org = await getCurrentOrg()
  if (!org?.isDriver && !org?.isOperator && !org?.isSuperAdmin) {
    return NextResponse.json({ error: 'Driver access is required.' }, { status: 403 })
  }

  const supabase = createAdminClient() || await createClient()
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('id,organization_id,truck_id,full_name,phone,active,trucks(id,truck_number,driver_name,status)')
    .eq('user_id', org.user.id)
    .eq('active', true)
    .maybeSingle()

  if (driverError) return NextResponse.json({ error: driverError.message }, { status: 500 })
  if (!driver) return NextResponse.json({ driver: null, shift: null })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { data: shift } = await supabase
    .from('driver_shifts')
    .select('*')
    .eq('driver_id', driver.id)
    .gte('clocked_in_at', today.toISOString())
    .order('clocked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ driver, shift: shift || null })
}

export async function POST(request: NextRequest) {
  const org = await getCurrentOrg()
  if (!org?.isDriver && !org?.isOperator && !org?.isSuperAdmin) {
    return NextResponse.json({ error: 'Driver access is required.' }, { status: 403 })
  }

  const rate = await checkRateLimit({
    key: `driver-shifts:${org.user.id}:${getClientIp(request)}`,
    limit: 30,
    windowSeconds: 60,
    route: '/api/driver/shifts',
    userId: org.user.id,
  })
  if (!rate.allowed) {
    const limited = tooManyRequests(rate.resetAt)
    return NextResponse.json(limited.body, limited.init)
  }

  const body = await request.json().catch(() => null)
  const parsed = shiftSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid shift action.' }, { status: 400 })

  const supabase = createAdminClient() || await createClient()

  try {
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id,organization_id,truck_id,active')
      .eq('user_id', org.user.id)
      .eq('active', true)
      .maybeSingle()

    if (driverError) throw driverError
    if (!driver) return NextResponse.json({ error: 'No active driver profile is linked to this login.' }, { status: 404 })
    if (!driver.truck_id) return NextResponse.json({ error: 'Assign a truck to this driver first.' }, { status: 409 })

    const { data: openShift } = await supabase
      .from('driver_shifts')
      .select('*')
      .eq('driver_id', driver.id)
      .is('clocked_out_at', null)
      .order('clocked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (parsed.data.action === 'clock_in') {
      if (openShift) return NextResponse.json({ shift: openShift })
      const { data: shift, error } = await supabase
        .from('driver_shifts')
        .insert({
          driver_id: driver.id,
          organization_id: driver.organization_id,
          truck_id: driver.truck_id,
          clocked_in_at: new Date().toISOString(),
          ...gps(parsed.data.lat, parsed.data.lng),
        })
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({ shift })
    }

    if (!openShift) return NextResponse.json({ error: 'No open shift to clock out.' }, { status: 409 })
    const { data: shift, error } = await supabase
      .from('driver_shifts')
      .update({
        clocked_out_at: new Date().toISOString(),
        ...gps(parsed.data.lat, parsed.data.lng, 'clock_out_lat', 'clock_out_lng'),
      })
      .eq('id', openShift.id)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ shift })
  } catch (error) {
    captureAppException(error, { route: '/api/driver/shifts', userId: org.user.id, organizationId: org.organizationId })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update shift.' }, { status: 500 })
  }
}
