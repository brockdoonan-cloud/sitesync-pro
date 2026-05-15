export type EquipmentCategory =
  | 'bin'
  | 'porta_john'
  | 'dumpster'
  | 'scaffold'
  | 'container'
  | 'generator'
  | 'light_tower'
  | 'pump'
  | 'heater'
  | 'fence'
  | 'other'

export type ServiceCategory =
  | 'swap'
  | 'service'
  | 'refuel'
  | 'inspect'
  | 'deliver_only'
  | 'pickup_only'
  | 'relocate'
  | 'emergency'
  | 'other'

export type CaptureField = {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean'
  required?: boolean
  unit?: string
  options?: string[]
}

export type EquipmentTypeSeed = {
  code: string
  label: string
  category: EquipmentCategory
  unit_of_measure: string
  default_monthly_rate?: number | null
  sort_order: number
}

export type ServiceTypeSeed = {
  code: string
  label: string
  category: ServiceCategory
  requires_photo: boolean
  capture_fields: CaptureField[]
  sort_order: number
}

export const DEFAULT_EQUIPMENT_TYPES: EquipmentTypeSeed[] = [
  { code: 'washout_bin', label: 'Washout Bin', category: 'bin', unit_of_measure: 'each', default_monthly_rate: 395, sort_order: 10 },
  { code: 'porta_john', label: 'Portable Toilet', category: 'porta_john', unit_of_measure: 'each', sort_order: 20 },
  { code: 'dumpster', label: 'Dumpster / Roll-off', category: 'dumpster', unit_of_measure: 'cy', sort_order: 30 },
  { code: 'scaffold', label: 'Scaffold Section', category: 'scaffold', unit_of_measure: 'lf', sort_order: 40 },
  { code: 'storage', label: 'Storage Container', category: 'container', unit_of_measure: 'each', sort_order: 50 },
  { code: 'generator', label: 'Generator', category: 'generator', unit_of_measure: 'each', sort_order: 60 },
  { code: 'light_tower', label: 'Light Tower', category: 'light_tower', unit_of_measure: 'each', sort_order: 70 },
  { code: 'pump', label: 'Pump', category: 'pump', unit_of_measure: 'each', sort_order: 80 },
  { code: 'heater', label: 'Heater', category: 'heater', unit_of_measure: 'each', sort_order: 90 },
  { code: 'fence_panel', label: 'Temp Fence Panel', category: 'fence', unit_of_measure: 'lf', sort_order: 100 },
]

export const DEFAULT_SERVICE_TYPES: ServiceTypeSeed[] = [
  {
    code: 'swap',
    label: 'Swap',
    category: 'swap',
    requires_photo: false,
    capture_fields: [
      { key: 'old_unit_id', label: 'Old unit ID', type: 'text' },
      { key: 'new_unit_id', label: 'New unit ID', type: 'text' },
    ],
    sort_order: 10,
  },
  {
    code: 'service',
    label: 'Service / Pump-out',
    category: 'service',
    requires_photo: false,
    capture_fields: [{ key: 'volume_pumped', label: 'Volume pumped', type: 'number', unit: 'gal' }],
    sort_order: 20,
  },
  {
    code: 'refuel',
    label: 'Refuel',
    category: 'refuel',
    requires_photo: false,
    capture_fields: [{ key: 'gallons_added', label: 'Gallons added', type: 'number', unit: 'gal', required: true }],
    sort_order: 30,
  },
  {
    code: 'inspect',
    label: 'Inspect',
    category: 'inspect',
    requires_photo: true,
    capture_fields: [{ key: 'condition', label: 'Condition', type: 'select', options: ['pass', 'needs_repair', 'damaged'] }],
    sort_order: 40,
  },
  { code: 'deliver', label: 'Deliver Only', category: 'deliver_only', requires_photo: true, capture_fields: [], sort_order: 50 },
  { code: 'pickup', label: 'Pick Up Only', category: 'pickup_only', requires_photo: true, capture_fields: [], sort_order: 60 },
  {
    code: 'relocate',
    label: 'Relocate',
    category: 'relocate',
    requires_photo: false,
    capture_fields: [{ key: 'new_location', label: 'New location', type: 'text' }],
    sort_order: 70,
  },
  {
    code: 'emergency',
    label: 'Emergency',
    category: 'emergency',
    requires_photo: true,
    capture_fields: [{ key: 'reason', label: 'Reason', type: 'text', required: true }],
    sort_order: 80,
  },
]

export const EQUIPMENT_TO_SERVICE_CODES: Record<string, string[]> = {
  washout_bin: ['swap', 'service', 'pickup', 'deliver', 'emergency'],
  porta_john: ['service', 'swap', 'deliver', 'pickup', 'emergency'],
  dumpster: ['swap', 'pickup', 'deliver', 'relocate', 'emergency'],
  scaffold: ['inspect', 'deliver', 'pickup', 'relocate', 'emergency'],
  generator: ['refuel', 'inspect', 'deliver', 'pickup', 'emergency'],
  light_tower: ['refuel', 'inspect', 'deliver', 'pickup', 'emergency'],
  pump: ['refuel', 'inspect', 'service', 'deliver', 'pickup', 'emergency'],
  heater: ['refuel', 'inspect', 'deliver', 'pickup', 'emergency'],
  storage: ['deliver', 'pickup', 'relocate', 'emergency'],
  fence_panel: ['inspect', 'deliver', 'pickup', 'relocate', 'emergency'],
}

export function defaultServiceCodesForEquipment(equipmentCodes: string[]) {
  return Array.from(new Set(equipmentCodes.flatMap(code => EQUIPMENT_TO_SERVICE_CODES[code] || []).concat('emergency')))
}

