import 'server-only'

export const ACTIVE_STOP_STATUSES = ['planned', 'scheduled', 'en_route', 'arrived', 'in_progress']

export function etaFromMinutes(minutes?: unknown) {
  const safeMinutes = Math.max(5, Math.min(24 * 60, Number(minutes) || 45))
  return new Date(Date.now() + safeMinutes * 60_000).toISOString()
}

export function normalizeStopStatus(status?: string | null) {
  return (status || 'planned').toLowerCase()
}

export function isStopOpen(status?: string | null) {
  return ACTIVE_STOP_STATUSES.includes(normalizeStopStatus(status))
}

export function firstBinNumber(row: { bin_numbers?: string[] | null; bin_number?: string | null }) {
  return row.bin_number || row.bin_numbers?.find(Boolean) || null
}

export function noteField(notes: string | null | undefined, label: string) {
  return notes?.match(new RegExp(`${label}:\\s*([^.\\n]+)`, 'i'))?.[1]?.trim() || null
}

export function stopSwapPlan(stop: any, body?: any) {
  const pickupBin = String(
    body?.pickup_bin_number ||
    stop?.pickup_bin_number ||
    noteField(stop?.notes, 'Pickup bin') ||
    stop?.bin_number ||
    stop?.bin_numbers?.[0] ||
    ''
  ).trim()
  const deliveryBin = String(
    body?.delivery_bin_number ||
    stop?.delivery_bin_number ||
    noteField(stop?.notes, 'Delivery bin') ||
    noteField(stop?.notes, 'Dropoff bin') ||
    stop?.bin_numbers?.[1] ||
    ''
  ).trim()

  return {
    pickupBin: pickupBin || null,
    deliveryBin: deliveryBin || null,
    landfill: String(body?.landfill || noteField(stop?.notes, 'Landfill') || '').trim() || null,
    dropoffJobsite: String(body?.dropoff_jobsite || noteField(stop?.notes, 'Next jobsite') || '').trim() || null,
    dropoffAddress: String(body?.dropoff_address || noteField(stop?.notes, 'Dropoff address') || '').trim() || null,
  }
}

export function billingEventTypeForStop(stopType?: string | null) {
  const type = (stopType || 'service').toLowerCase()
  if (type.includes('swap')) return 'swap_completed'
  if (type.includes('pickup') || type.includes('removal')) return 'pickup_completed'
  if (type.includes('delivery')) return 'delivery_completed'
  return 'service_completed'
}
