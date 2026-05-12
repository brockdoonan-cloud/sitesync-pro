import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureAppException } from '@/lib/monitoring/sentry'
import { getCustomerClientIds } from '@/lib/customer/access'

const activeStatuses = ['pending', 'dispatch_ready', 'scheduled', 'confirmed', 'dispatched', 'en_route', 'arrived', 'in_progress', 'completed']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const admin = createAdminClient() || supabase
  try {
    const clientIds = await getCustomerClientIds(supabase, user)
    const requestFilter = clientIds.length
      ? `customer_id.eq.${user.id},client_id.in.(${clientIds.join(',')})`
      : `customer_id.eq.${user.id}`
    const { data: requests, error } = await admin
      .from('service_requests')
      .select('*')
      .or(requestFilter)
      .in('status', activeStatuses)
      .order('created_at', { ascending: false })

    if (error) throw error

    const requestIds = (requests || []).map((request: any) => request.id)
    const { data: stops } = requestIds.length
      ? await admin
          .from('route_stops')
          .select('*,driver_routes(id,organization_id,truck_id,truck_number,driver_id,driver_name,status,opened_at,closed_at,current_stop_id,last_eta_at)')
          .in('service_request_id', requestIds)
      : { data: [] }

    const truckNumbers = [...new Set((stops || []).map((stop: any) => stop.driver_routes?.truck_number).filter(Boolean))]
    const organizationIds = [...new Set((stops || []).map((stop: any) => stop.driver_routes?.organization_id).filter(Boolean))]
    let locationQuery = truckNumbers.length
      ? admin.from('truck_locations').select('*').in('truck_number', truckNumbers).order('recorded_at', { ascending: false })
      : null
    if (locationQuery && organizationIds.length) locationQuery = locationQuery.in('organization_id', organizationIds)
    const { data: locations } = locationQuery ? await locationQuery : { data: [] }

    const latestByTruck = new Map<string, any>()
    for (const location of locations || []) {
      if (location.truck_number && !latestByTruck.has(location.truck_number)) latestByTruck.set(location.truck_number, location)
    }

    const stopByRequest = new Map<string, any>()
    for (const stop of stops || []) {
      if (!stop.service_request_id) continue
      const existing = stopByRequest.get(stop.service_request_id)
      if (!existing || Number(stop.stop_order || 0) < Number(existing.stop_order || 0)) stopByRequest.set(stop.service_request_id, stop)
    }

    const enriched = (requests || []).map((serviceRequest: any) => {
      const stop = stopByRequest.get(serviceRequest.id) || null
      const route = stop?.driver_routes || null
      return {
        ...serviceRequest,
        route_stop: stop ? { ...stop, driver_routes: undefined } : null,
        driver_route: route,
        truck_location: route?.truck_number ? latestByTruck.get(route.truck_number) || null : null,
      }
    })

    return NextResponse.json({ requests: enriched })
  } catch (error: any) {
    captureAppException(error, { route: '/api/customer/tracking', userId: user.id })
    return NextResponse.json({ error: error?.message || 'Could not load tracking.' }, { status: 500 })
  }
}
