import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { billingEventTypeForStop, etaFromMinutes, firstBinNumber } from '@/lib/dispatch/lifecycle'
import { logAuditEvent } from '@/lib/audit/log'
import { captureAppException } from '@/lib/monitoring/sentry'

type Params = { params: Promise<{ stopId: string }> }

function canAccess(org: Awaited<ReturnType<typeof getCurrentOrg>>, row: any) {
  if (!org) return false
  return org.isSuperAdmin || row.organization_id === org.organizationId
}

async function nextOpenStop(supabase: any, routeId: string) {
  const { data } = await supabase
    .from('route_stops')
    .select('*')
    .eq('route_id', routeId)
    .in('status', ['planned', 'scheduled'])
    .order('stop_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data
}

export async function POST(request: NextRequest, { params }: Params) {
  const org = await getCurrentOrg()
  if (!org) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!org.isOperator) return NextResponse.json({ error: 'Driver/operator access required.' }, { status: 403 })

  const { stopId } = await params
  const body = await request.json().catch(() => ({}))
  const action = String(body?.action || '').toLowerCase()
  const supabase = createAdminClient() || await createClient()

  const { data: stop, error: stopError } = await supabase
    .from('route_stops')
    .select('*')
    .eq('id', stopId)
    .single()

  if (stopError || !stop) return NextResponse.json({ error: 'Stop not found.' }, { status: 404 })
  if (!canAccess(org, stop)) return NextResponse.json({ error: 'Stop is outside your organization.' }, { status: 403 })

  try {
    if (action === 'eta' || action === 'en_route') {
      const eta = etaFromMinutes(body?.eta_minutes)
      const { data: updatedStop, error } = await supabase
        .from('route_stops')
        .update({
          status: 'en_route',
          started_at: stop.started_at || new Date().toISOString(),
          eta,
          eta_minutes: Number(body?.eta_minutes) || 45,
          driver_notes: body?.notes ? [stop.driver_notes, String(body.notes)].filter(Boolean).join('\n') : stop.driver_notes || null,
        })
        .eq('id', stopId)
        .select('*')
        .single()
      if (error) throw error

      await supabase.from('driver_routes').update({ status: 'in_progress', current_stop_id: stopId, last_eta_at: eta, opened_at: new Date().toISOString() }).eq('id', stop.route_id)
      if (stop.service_request_id) {
        await supabase
          .from('service_requests')
          .update({ status: 'en_route', dispatched_at: new Date().toISOString(), eta_at: eta, route_stop_id: stopId })
          .eq('id', stop.service_request_id)
      }
      return NextResponse.json({ stop: updatedStop })
    }

    if (action === 'arrived') {
      const { data: updatedStop, error } = await supabase
        .from('route_stops')
        .update({ status: 'arrived', arrived_at: new Date().toISOString() })
        .eq('id', stopId)
        .select('*')
        .single()
      if (error) throw error

      if (stop.service_request_id) {
        await supabase.from('service_requests').update({ status: 'arrived', arrived_at: new Date().toISOString(), route_stop_id: stopId }).eq('id', stop.service_request_id)
      }
      return NextResponse.json({ stop: updatedStop })
    }

    if (action === 'complete') {
      const now = new Date().toISOString()
      const binNumber = firstBinNumber(stop)
      const finalStatus = String(stop.stop_type || '').toLowerCase().includes('pickup') ? 'available' : 'deployed'
      const finalLocation = body?.final_location ? String(body.final_location) : stop.address || 'Completed route stop'

      const { data: updatedStop, error } = await supabase
        .from('route_stops')
        .update({
          status: 'completed',
          completed_at: now,
          proof_notes: body?.proof_notes ? String(body.proof_notes) : stop.proof_notes || null,
          completed_by_user_id: org.user.id,
        })
        .eq('id', stopId)
        .select('*')
        .single()
      if (error) throw error

      if (binNumber) {
        await supabase
          .from('equipment')
          .update({ status: finalStatus, location: finalLocation, last_serviced_at: now })
          .eq('bin_number', binNumber)
          .eq('organization_id', stop.organization_id)
      }

      if (stop.service_request_id) {
        await supabase
          .from('service_requests')
          .update({
            status: 'completed',
            completed_at: now,
            route_stop_id: stopId,
            eta_at: null,
            notes: [stop.notes, body?.proof_notes ? `Driver closeout: ${body.proof_notes}` : 'Driver marked service complete.'].filter(Boolean).join('\n'),
          })
          .eq('id', stop.service_request_id)
      }

      await supabase.from('billing_events').insert({
        organization_id: stop.organization_id,
        event_date: now.slice(0, 10),
        event_type: billingEventTypeForStop(stop.stop_type),
        source_file: 'driver_route_closeout',
        project_name: stop.address || null,
        bin_number: binNumber,
        payload: {
          route_id: stop.route_id,
          route_stop_id: stopId,
          service_request_id: stop.service_request_id,
          stop_type: stop.stop_type,
          proof_notes: body?.proof_notes || null,
        },
      })

      const nextStop = stop.route_id ? await nextOpenStop(supabase, stop.route_id) : null
      await supabase
        .from('driver_routes')
        .update({
          current_stop_id: nextStop?.id || null,
          status: nextStop ? 'in_progress' : 'ready_to_close',
        })
        .eq('id', stop.route_id)

      await logAuditEvent({
        userId: org.user.id,
        orgId: stop.organization_id,
        action: 'complete_route_stop',
        resourceType: 'route_stop',
        resourceId: stopId,
        beforeState: stop,
        afterState: updatedStop,
        request,
      })
      return NextResponse.json({ stop: updatedStop, nextStop })
    }

    if (action === 'cancel') {
      const { data: updatedStop, error } = await supabase
        .from('route_stops')
        .update({ status: 'cancelled', driver_notes: body?.notes ? String(body.notes) : stop.driver_notes || null })
        .eq('id', stopId)
        .select('*')
        .single()
      if (error) throw error
      if (stop.service_request_id) await supabase.from('service_requests').update({ status: 'cancelled' }).eq('id', stop.service_request_id)
      return NextResponse.json({ stop: updatedStop })
    }

    return NextResponse.json({ error: 'Unknown stop action.' }, { status: 400 })
  } catch (error: any) {
    captureAppException(error, { route: '/api/driver/stops/[stopId]/action', organizationId: stop.organization_id, userId: org.user.id })
    return NextResponse.json({ error: error?.message || 'Stop action failed.' }, { status: 500 })
  }
}
