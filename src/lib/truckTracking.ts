export type TrackingProviderPreset = {
  key: string
  name: string
  category: string
  connectionTypes: Array<'api' | 'webhook' | 'csv' | 'manual'>
  notes: string
  mapping: TruckTrackingMapping
}

export type TruckTrackingMapping = {
  truckNumber: string
  externalVehicleId: string
  driverName: string
  latitude: string
  longitude: string
  recordedAt: string
  speedMph: string
  headingDegrees: string
  ignition: string
  status: string
  vin: string
  licensePlate: string
}

export type NormalizedTruckTrackingRecord = {
  truckNumber: string
  externalVehicleId?: string | null
  driverName?: string | null
  lat: number
  lng: number
  recordedAt: string
  speedMph?: number | null
  headingDegrees?: number | null
  ignition?: boolean | null
  status?: string | null
  vin?: string | null
  licensePlate?: string | null
  raw: Record<string, unknown>
}

export const DEFAULT_TRUCK_TRACKING_MAPPING: TruckTrackingMapping = {
  truckNumber: 'truck_number,vehicle.name,vehicleName,name,unit,unit_number,asset_name',
  externalVehicleId: 'external_vehicle_id,vehicle.id,vehicleId,asset_id,id',
  driverName: 'driver_name,driver.name,driverName,operator,assigned_driver',
  latitude: 'lat,latitude,position.latitude,gps.latitude,location.lat',
  longitude: 'lng,lon,long,longitude,position.longitude,gps.longitude,location.lng,location.lon',
  recordedAt: 'recorded_at,timestamp,time,updated_at,last_seen_at,event_time',
  speedMph: 'speed_mph,speed,speedMilesPerHour,vehicle.speed',
  headingDegrees: 'heading,heading_degrees,bearing,direction',
  ignition: 'ignition,engine_on,engineOn,is_running',
  status: 'status,state,vehicle.status',
  vin: 'vin,vehicle.vin',
  licensePlate: 'license_plate,plate,vehicle.licensePlate',
}

export const TRACKING_PROVIDER_PRESETS: TrackingProviderPreset[] = [
  {
    key: 'samsara',
    name: 'Samsara',
    category: 'Fleet telematics',
    connectionTypes: ['api', 'webhook', 'csv'],
    notes: 'Supports API/webhook style vehicle GPS exports. Map vehicle ID/name into SiteSync truck numbers.',
    mapping: {
      ...DEFAULT_TRUCK_TRACKING_MAPPING,
      truckNumber: 'name,vehicle.name,vehicleName',
      externalVehicleId: 'id,vehicle.id,vehicleId',
      latitude: 'location.latitude,gps.latitude,latitude',
      longitude: 'location.longitude,gps.longitude,longitude',
      recordedAt: 'location.time,timestamp,updatedAt',
    },
  },
  {
    key: 'geotab',
    name: 'Geotab',
    category: 'Fleet telematics',
    connectionTypes: ['api', 'csv'],
    notes: 'Works with MyGeotab-style device/location exports when columns are mapped.',
    mapping: {
      ...DEFAULT_TRUCK_TRACKING_MAPPING,
      truckNumber: 'name,device.name,vehicle',
      externalVehicleId: 'id,device.id,deviceId',
      latitude: 'latitude,lat',
      longitude: 'longitude,lng,lon',
      recordedAt: 'dateTime,timestamp,recorded_at',
    },
  },
  {
    key: 'verizon-connect',
    name: 'Verizon Connect',
    category: 'Fleet telematics',
    connectionTypes: ['api', 'csv'],
    notes: 'Use CSV/API export fields for vehicle name, location, speed, and timestamp.',
    mapping: DEFAULT_TRUCK_TRACKING_MAPPING,
  },
  {
    key: 'motive',
    name: 'Motive',
    category: 'ELD / fleet tracking',
    connectionTypes: ['api', 'webhook', 'csv'],
    notes: 'Maps vehicle/location payloads from Motive-style exports into SiteSync live trucks.',
    mapping: DEFAULT_TRUCK_TRACKING_MAPPING,
  },
  {
    key: 'azuga',
    name: 'Azuga',
    category: 'Fleet tracking',
    connectionTypes: ['api', 'csv'],
    notes: 'CSV/API imports can be normalized by mapping Azuga vehicle columns to SiteSync fields.',
    mapping: DEFAULT_TRUCK_TRACKING_MAPPING,
  },
  {
    key: 'fleet-complete',
    name: 'Fleet Complete',
    category: 'Fleet tracking',
    connectionTypes: ['api', 'csv'],
    notes: 'Use the generic field mapper for vehicle ID, driver, lat/lng, and last update.',
    mapping: DEFAULT_TRUCK_TRACKING_MAPPING,
  },
  {
    key: 'custom',
    name: 'Other / Custom Provider',
    category: 'Any GPS vendor',
    connectionTypes: ['api', 'webhook', 'csv', 'manual'],
    notes: 'For any tracking company. Paste a sample payload or CSV and map columns once.',
    mapping: DEFAULT_TRUCK_TRACKING_MAPPING,
  },
]

export const TRACKING_FIELD_LABELS: Record<keyof TruckTrackingMapping, string> = {
  truckNumber: 'Truck number',
  externalVehicleId: 'External vehicle ID',
  driverName: 'Driver name',
  latitude: 'Latitude',
  longitude: 'Longitude',
  recordedAt: 'Recorded time',
  speedMph: 'Speed mph',
  headingDegrees: 'Heading degrees',
  ignition: 'Ignition on',
  status: 'Status',
  vin: 'VIN',
  licensePlate: 'License plate',
}

function valueAtPath(record: Record<string, unknown>, path: string): unknown {
  const parts = path.trim().split('.').filter(Boolean)
  let current: unknown = record
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function mappedValue(record: Record<string, unknown>, mappingValue: string): unknown {
  const paths = mappingValue.split(',').map(path => path.trim()).filter(Boolean)
  for (const path of paths) {
    const value = valueAtPath(record, path)
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return undefined
}

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const number = Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(number) ? number : null
}

function toBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'boolean') return value
  const text = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'on', 'running', 'ignition_on'].includes(text)) return true
  if (['false', '0', 'no', 'off', 'stopped', 'ignition_off'].includes(text)) return false
  return null
}

function toIsoDate(value: unknown) {
  if (!value) return new Date().toISOString()
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export function normalizeTruckStatus(value: unknown, ignition?: boolean | null) {
  const text = String(value || '').trim().toLowerCase()
  if (['active', 'moving', 'driving', 'en route', 'en_route', 'in transit'].includes(text)) return 'en_route'
  if (['servicing', 'service', 'on job', 'onsite', 'on_site'].includes(text)) return 'servicing'
  if (['returning', 'return'].includes(text)) return 'returning'
  if (['offline', 'inactive', 'disconnected'].includes(text)) return 'offline'
  if (['available', 'idle', 'parked', 'stopped'].includes(text)) return 'available'
  if (ignition === true) return 'en_route'
  if (ignition === false) return 'available'
  return text || 'available'
}

export function normalizeTrackingRecord(record: Record<string, unknown>, mapping: TruckTrackingMapping): NormalizedTruckTrackingRecord | { error: string } {
  const truckNumber = String(mappedValue(record, mapping.truckNumber) || '').trim()
  const lat = toNumber(mappedValue(record, mapping.latitude))
  const lng = toNumber(mappedValue(record, mapping.longitude))
  const ignition = toBoolean(mappedValue(record, mapping.ignition))

  if (!truckNumber) return { error: 'Missing truck number' }
  if (lat === null || lng === null) return { error: `Missing GPS coordinates for truck ${truckNumber}` }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { error: `Invalid GPS coordinates for truck ${truckNumber}` }

  return {
    truckNumber,
    externalVehicleId: String(mappedValue(record, mapping.externalVehicleId) || '').trim() || null,
    driverName: String(mappedValue(record, mapping.driverName) || '').trim() || null,
    lat,
    lng,
    recordedAt: toIsoDate(mappedValue(record, mapping.recordedAt)),
    speedMph: toNumber(mappedValue(record, mapping.speedMph)),
    headingDegrees: toNumber(mappedValue(record, mapping.headingDegrees)),
    ignition,
    status: normalizeTruckStatus(mappedValue(record, mapping.status), ignition),
    vin: String(mappedValue(record, mapping.vin) || '').trim() || null,
    licensePlate: String(mappedValue(record, mapping.licensePlate) || '').trim() || null,
    raw: record,
  }
}

export function extractTrackingRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(item => item && typeof item === 'object') as Record<string, unknown>[]
  if (!payload || typeof payload !== 'object') return []

  const objectPayload = payload as Record<string, unknown>
  for (const key of ['vehicles', 'vehicleLocations', 'locations', 'events', 'data', 'items', 'records']) {
    const value = objectPayload[key]
    if (Array.isArray(value)) return value.filter(item => item && typeof item === 'object') as Record<string, unknown>[]
  }
  return [objectPayload]
}

export function parseDelimitedRecords(input: string): Record<string, unknown>[] {
  const lines = input.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) return []
  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const parseLine = (line: string) => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index]
      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') {
          current += '"'
          index += 1
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === delimiter && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    cells.push(current.trim())
    return cells
  }

  const headers = parseLine(lines[0]).map(header => header.trim())
  return lines.slice(1).map(line => {
    const cells = parseLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']))
  })
}
