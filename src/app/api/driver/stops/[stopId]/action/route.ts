import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { billingEventTypeForStop, etaFromMinutes, firstBinNumber, stopSwapPlan } from '@/lib/dispatch/lifecycle'
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

async function findDriverBillingEvent(supabase: any, stopId: string) {
  const { data } = await supabase
    .from('billing_events')
    .select('id')
    .eq('source_file', 'driver_route_closeout')
    .contains('payload', { route_stop_id: stopId })
    .limit(1)
    .maybeSingle()
  return data || null
}

async function findOrCreateJobsite(supabase: any, organizationId: string, name?: string | null, address?: string | null) {
  const cleanName = name?.trim() || ''
  const cleanAddress = address?.trim() || ''
  if (!cleanName && !cleanAddress) return null

  if (cleanAddress) {
    const { data } = await supabase
      .from('jobsites')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('address', cleanAddress)
      .limit(1)
      .maybeSingle()
    if (data?.id) return data.id
  }

  if (cleanName) {
    const { data } = await supabase
      .from('jobsites')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('name', cleanName)
      .limit(1)
      .maybeSingle()
    if (data?.id) return data.id
  }

  const { data: created, error } = await supabase
    .from('jobsites')
    .insert({
      organization_id: organizationId,
      name: cleanName || cleanAddress,
      address: cleanAddress || cleanName,
      status: 'active',
    })
    .select('id')
    .single()

  if (error) throw error
  return created.id
}

async function updateEquipmentByBin(supabase: any, organizationId: string, binNumber: string | null, values: Record<string, unknown>) {
  if (!binNumber) return null
  const { data, error } = await supabase
    .from('equipment')
    .update(values)
    .eq('bin_number', binNumber)
    .eq('organization_id', organizationId)
    .select('id,bin_number,status,location,jobsite_id')
    .maybeSingle()

  if (error) throw error
  return data || null
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
      const plan = stopSwapPlan(stop, body)
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

      await updateEquipmentByBin(supabase, stop.organization_id, plan.deliveryBin, {
        status: 'in_transit',
        location: `On truck to ${stop.address || 'route stop'}`,
        jobsite_id: null,
        last_serviced_at: new Date().toISOString(),
      })

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
      if ((stop.status || '').toLowerCase() === 'cancelled') {
        return NextResponse.json({ error: 'Cancelled stops cannot be completed. Reopen or recreate the stop first.' }, { status: 409 })
      }

      if ((stop.status || '').toLowerCase() === 'completed') {
        const nextStop = stop.route_id ? await nextOpenStop(supabase, stop.route_id) : null
        await supabase
          .from('driver_routes')
          .update({
            current_stop_id: nextStop?.id || null,
            status: nextStop ? 'in_progress' : 'ready_to_close',
          })
          .eq('id', stop.route_id)
        return NextResponse.json({ stop, nextStop, billingAlreadyRecorded: Boolean(await findDriverBillingEvent(supabase, stopId)) })
      }

      const now = new Date().toISOString()
      const plan = stopSwapPlan(stop, body)
      const fallbackBinNumber = firstBinNumber(stop)
      const pickupBin = plan.pickupBin || fallbackBinNumber
      const deliveryBin = plan.deliveryBin
      const stopType = String(stop.stop_type || '').toLowerCase()
      const dropoffLocation = plan.dropoffAddress || plan.dropoffJobsite
      const deliveryLocation = body?.final_location ? String(body.final_location) : stop.address || 'Completed route stop'
      let dropoffJobsiteId: string | null = null

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

      if (deliveryBin) {
        await updateEquipmentByBin(supabase, stop.organization_id, deliveryBin, {
          status: 'deployed',
          location: deliveryLocation,
          jobsite_id: stop.jobsite_id || null,
          last_serviced_at: now,
        })
      }

      if (pickupBin && pickupBin !== deliveryBin) {
        if (dropoffLocation) {
          dropoffJobsiteId = await findOrCreateJobsite(supabase, stop.organization_id, plan.dropoffJobsite, plan.dropoffAddress)
          await updateEquipmentByBin(supabase, stop.organization_id, pickupBin, {
            status: 'deployed',
            location: dropoffLocation,
            jobsite_id: dropoffJobsiteId,
            last_serviced_at: now,
          })
        } else if (stopType.includes('pickup') || stopType.includes('removal') || deliveryBin) {
          await updateEquipmentByBin(supabase, stop.organization_id, pickupBin, {
            status: 'available',
            location: plan.landfill || 'Returned from route',
            jobsite_id: null,
            last_serviced_at: now,
          })
        } else {
          await updateEquipmentByBin(supabase, stop.organization_id, pickupBin, {
            status: 'deployed',
            location: deliveryLocation,
            jobsite_id: stop.jobsite_id || null,
            last_serviced_at: now,
          })
        }
      }

      if (stop.service_request_id) {
        await supabase
          .from('service_requests')
          .update({
            status: 'completed',
            completed_at: now,
            route_stop_id: stopId,
            eta_at: null,
            notes: [
              stop.notes,
              `Driver closeout: delivered ${deliveryBin ? `bin #${deliveryBin}` : 'assigned bin'} and picked up ${pickupBin ? `bin #${pickupBin}` : 'assigned bin'}.`,
              dropoffLocation ? `Pickup bin final dropoff: ${dropoffLocation}.` : '',
              body?.proof_notes ? `Driver proof: ${body.proof_notes}` : '',
            ].filter(Boolean).join('\n'),
          })
          .eq('id', stop.service_request_id)
      }

      const existingBillingEvent = await findDriverBillingEvent(supabase, stopId)
      if (!existingBillingEvent) {
        await supabase.from('billing_events').insert({
          organization_id: stop.organization_id,
          event_date: now.slice(0, 10),
          event_type: billingEventTypeForStop(stop.stop_type),
          source_file: 'driver_route_closeout',
          project_name: stop.address || null,
          bin_number: deliveryBin || pickupBin,
          payload: {
            route_id: stop.route_id,
            route_stop_id: stopId,
            service_request_id: stop.service_request_id,
            stop_type: stop.stop_type,
            pickup_bin_number: pickupBin,
            delivery_bin_number: deliveryBin,
            landfill: plan.landfill,
            dropoff_jobsite: plan.dropoffJobsite,
            dropoff_jobsite_id: dropoffJobsiteId,
            dropoff_address: plan.dropoffAddress,
            proof_notes: body?.proof_notes || null,
            completed_by_user_id: org.user.id,
            completed_at: now,
          },
        })
      }

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
