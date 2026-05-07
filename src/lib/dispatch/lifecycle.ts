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

export function billingEventTypeForStop(stopType?: string | null) {
  const type = (stopType || 'service').toLowerCase()
  if (type.includes('swap')) return 'swap_completed'
  if (type.includes('pickup') || type.includes('removal')) return 'pickup_completed'
  if (type.includes('delivery')) return 'delivery_completed'
  return 'service_completed'
}
