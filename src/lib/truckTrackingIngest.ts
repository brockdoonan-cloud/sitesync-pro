import 'server-only'

import type { NormalizedTruckTrackingRecord } from '@/lib/truckTracking'

type ProviderContext = {
  id: string
  organization_id: string
  provider_name: string
}

export async function saveNormalizedTruckTrackingRecord(
  supabase: any,
  provider: ProviderContext,
  record: NormalizedTruckTrackingRecord
) {
  let truck: any = null

  if (record.externalVehicleId) {
    const { data } = await supabase
      .from('trucks')
      .select('*')
      .eq('organization_id', provider.organization_id)
      .eq('external_vehicle_id', record.externalVehicleId)
      .maybeSingle()
    truck = data || null
  }

  if (!truck) {
    const { data } = await supabase
      .from('trucks')
      .select('*')
      .eq('organization_id', provider.organization_id)
      .eq('truck_number', record.truckNumber)
      .maybeSingle()
    truck = data || null
  }

  const truckPayload = {
    organization_id: provider.organization_id,
    truck_number: record.truckNumber,
    driver_name: record.driverName,
    status: record.status || 'available',
    current_lat: record.lat,
    current_lng: record.lng,
    last_seen_at: record.recordedAt,
    last_seen: record.recordedAt,
    external_vehicle_id: record.externalVehicleId,
    vin: record.vin,
    license_plate: record.licensePlate,
    tracking_provider_id: provider.id,
    tracking_provider_name: provider.provider_name,
    raw_tracking_payload: record.raw,
  }

  const truckResult = truck?.id
    ? await supabase.from('trucks').update(truckPayload).eq('id', truck.id).select('id,truck_number').single()
    : await supabase.from('trucks').insert({ ...truckPayload, capacity: 6 }).select('id,truck_number').single()

  if (truckResult.error) throw truckResult.error

  const { error: locationError } = await supabase.from('truck_locations').insert({
    organization_id: provider.organization_id,
    provider_id: provider.id,
    truck_id: truckResult.data.id,
    truck_number: record.truckNumber,
    external_vehicle_id: record.externalVehicleId,
    lat: record.lat,
    lng: record.lng,
    recorded_at: record.recordedAt,
    speed_mph: record.speedMph,
    heading_degrees: record.headingDegrees,
    ignition: record.ignition,
    status: record.status,
    raw_payload: record.raw,
  })

  if (locationError) throw locationError
  return truckResult.data
}
