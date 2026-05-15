import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/log'
import { captureAppException } from '@/lib/monitoring/sentry'
import { etaFromMinutes, stopSwapPlan } from '@/lib/dispatch/lifecycle'
import { getClientIp } from '@/lib/request'
import { checkRateLimit, tooManyRequests } from '@/lib/rateLimit'

type Params = { params: Promise<{ routeId: string }> }

function canAccessRoute(org: Awaited<ReturnType<typeof getCurrentOrg>>, route: any) {
  if (!org) return false
  return org.isSuperAdmin || route.organization_id === org.organizationId
}

async function markDeliveryBinInTransit(supabase: any, organizationId: string, stop: any) {
  const plan = stopSwapPlan(stop)
  if (!plan.deliveryBin) return
  await supabase
    .from('equipment')
    .update({
      status: 'in_transit',
      location: `On truck to ${stop.address || 'route stop'}`,
      jobsite_id: null,
      last_serviced_at: new Date().toISOString(),
    })
    .eq('bin_number', plan.deliveryBin)
    .eq('organization_id', organizationId)
}

export async function POST(request: NextRequest, { params }: Params) {
  const org = await getCurrentOrg()
  if (!org) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!org.isOperator && !org.isDriver) return NextResponse.json({ error: 'Driver/operator access required.' }, { status: 403 })

  const { routeId } = await params
  const body = await request.json().catch(() => ({}))
  const action = String(body?.action || '').toLowerCase()
  const supabase = createAdminClient() || await createClient()

  const rate = await checkRateLimit({
    key: `driver-route-action:${org.user.id}:${getClientIp(request)}`,
    limit: 60,
    windowSeconds: 60,
    route: '/api/driver/routes/[routeId]/action',
    userId: org.user.id,
  })
  if (!rate.allowed) {
    const limited = tooManyRequests(rate.resetAt)
    return NextResponse.json(limited.body, limited.init)
  }

  const { data: route, error: routeError } = await supabase
    .from('driver_routes')
    .select('*')
    .eq('id', routeId)
    .single()

  if (routeError || !route) return NextResponse.json({ error: 'Route not found.' }, { status: 404 })
  if (!canAccessRoute(org, route)) return NextResponse.json({ error: 'Route is outside your organization.' }, { status: 403 })
  if (org.isDriver) {
    const { data: driver } = await supabase.from('drivers').select('id,truck_id').eq('user_id', org.user.id).eq('active', true).maybeSingle()
    if (!driver || (route.driver_profile_id && route.driver_profile_id !== driver.id) || (route.truck_id && route.truck_id !== driver.truck_id)) {
      return NextResponse.json({ error: 'This route is not assigned to your truck.' }, { status: 403 })
    }
    const { data: shift } = await supabase.from('driver_shifts').select('id').eq('driver_id', driver.id).is('clocked_out_at', null).maybeSingle()
    if (!shift && (action === 'open' || action === 'start')) {
      return NextResponse.json({ error: 'Clock in before opening your route.' }, { status: 409 })
    }
  }

  try {
    if (action === 'open' || action === 'start') {
      const { data: nextStop } = await supabase
        .from('route_stops')
        .select('*')
        .eq('route_id', routeId)
        .in('status', ['planned', 'scheduled'])
        .order('stop_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      const eta = etaFromMinutes(body?.eta_minutes)
      const { data: updatedRoute, error } = await supabase
        .from('driver_routes')
        .update({
          status: 'in_progress',
          opened_at: route.opened_at || new Date().toISOString(),
          closed_at: null,
          current_stop_id: nextStop?.id || route.current_stop_id || null,
          last_eta_at: eta,
          driver_notes: body?.notes ? String(body.notes) : route.driver_notes || null,
        })
        .eq('id', routeId)
        .select('*')
        .single()

      if (error) throw error

      if (nextStop) {
        await supabase
          .from('route_stops')
          .update({ status: 'en_route', started_at: new Date().toISOString(), eta, eta_minutes: Number(body?.eta_minutes) || 45 })
          .eq('id', nextStop.id)
        await markDeliveryBinInTransit(supabase, route.organization_id, nextStop)
        if (nextStop.service_request_id) {
          await supabase
            .from('service_requests')
            .update({
              status: 'en_route',
              dispatched_at: new Date().toISOString(),
              eta_at: eta,
              route_stop_id: nextStop.id,
            })
            .eq('id', nextStop.service_request_id)
        }
      }

      await logAuditEvent({
        userId: org.user.id,
        orgId: route.organization_id,
        action: 'open_route',
        resourceType: 'driver_route',
        resourceId: routeId,
        beforeState: route,
        afterState: updatedRoute,
        request,
      })
      return NextResponse.json({ route: updatedRoute, currentStop: nextStop || null })
    }

    if (action === 'close' || action === 'complete') {
      const { data: openStops } = await supabase
        .from('route_stops')
        .select('id,status')
        .eq('route_id', routeId)
        .in('status', ['planned', 'scheduled', 'en_route', 'arrived', 'in_progress'])

      if ((openStops || []).length > 0 && !body?.force) {
        return NextResponse.json({ error: 'Complete or cancel all stops before closing this route.' }, { status: 409 })
      }

      const { data: updatedRoute, error } = await supabase
        .from('driver_routes')
        .update({
          status: 'completed',
          closed_at: new Date().toISOString(),
          current_stop_id: null,
          driver_notes: body?.notes ? [route.driver_notes, String(body.notes)].filter(Boolean).join('\n') : route.driver_notes || null,
        })
        .eq('id', routeId)
        .select('*')
        .single()

      if (error) throw error

      await logAuditEvent({
        userId: org.user.id,
        orgId: route.organization_id,
        action: 'close_route',
        resourceType: 'driver_route',
        resourceId: routeId,
        beforeState: route,
        afterState: updatedRoute,
        request,
      })
      return NextResponse.json({ route: updatedRoute })
    }

    return NextResponse.json({ error: 'Unknown route action.' }, { status: 400 })
  } catch (error: any) {
    captureAppException(error, { route: '/api/driver/routes/[routeId]/action', organizationId: route.organization_id, userId: org.user.id })
    return NextResponse.json({ error: error?.message || 'Route action failed.' }, { status: 500 })
  }
}
