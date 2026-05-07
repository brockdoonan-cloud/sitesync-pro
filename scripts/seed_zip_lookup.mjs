import { createClient } from '@supabase/supabase-js'

const DEFAULT_SOURCES = [
  // Free public ZIP/city/state/county dataset. Replace ZIP_LOOKUP_CSV_URL with
  // a USPS/HUD/Census enriched file later if you need postal-route precision.
  'https://raw.githubusercontent.com/scpike/us-state-county-zip/master/geo-data.csv',
]

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const sourceUrl = process.env.ZIP_LOOKUP_CSV_URL || DEFAULT_SOURCES[0]

if (!url || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      if (row.some(value => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell || row.length) {
    row.push(cell)
    if (row.some(value => value.trim())) rows.push(row)
  }

  return rows
}

function keyFor(headers, candidates) {
  const normalized = headers.map(header => header.toLowerCase().replace(/[^a-z0-9]/g, ''))
  for (const candidate of candidates) {
    const needle = candidate.toLowerCase().replace(/[^a-z0-9]/g, '')
    const index = normalized.indexOf(needle)
    if (index >= 0) return headers[index]
  }
  return null
}

function fiveDigitZip(value) {
  const cleaned = String(value || '').replace(/\D/g, '').slice(0, 5)
  return cleaned.length === 5 ? cleaned : null
}

function numeric(value) {
  const parsed = Number(String(value || '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

async function main() {
  console.log(`Downloading ZIP lookup data from ${sourceUrl}`)
  const response = await fetch(sourceUrl)
  if (!response.ok) throw new Error(`ZIP source failed: ${response.status} ${response.statusText}`)

  const text = await response.text()
  const [headers, ...records] = parseCsv(text)
  const headerNames = headers.map(header => header.trim())

  const zipKey = keyFor(headerNames, ['zip', 'zipcode', 'zip_code', 'zcta', 'geoid', 'geoid10'])
  const cityKey = keyFor(headerNames, ['city', 'place', 'name'])
  const stateKey = keyFor(headerNames, ['state_code', 'state', 'stusps'])
  const countyKey = keyFor(headerNames, ['county_name', 'county'])
  const latKey = keyFor(headerNames, ['latitude', 'lat', 'intptlat'])
  const lngKey = keyFor(headerNames, ['longitude', 'lng', 'lon', 'intptlong'])
  const timezoneKey = keyFor(headerNames, ['timezone', 'time_zone', 'tz'])

  if (!zipKey || !stateKey) {
    throw new Error(`ZIP source must contain ZIP and state columns. Headers: ${headerNames.join(', ')}`)
  }

  const rowsByZip = new Map()
  for (const rawRecord of records) {
    const record = Object.fromEntries(headerNames.map((header, index) => [header, rawRecord[index] || '']))
    const zip = fiveDigitZip(record[zipKey])
    const stateCode = String(record[stateKey] || '').trim().toUpperCase().slice(0, 2)

    if (!zip || stateCode.length !== 2) continue
    if (rowsByZip.has(zip)) continue

    rowsByZip.set(zip, {
      zip,
      city: cityKey ? String(record[cityKey] || '').trim() || null : null,
      state_code: stateCode,
      county_name: countyKey ? String(record[countyKey] || '').trim() || null : null,
      latitude: latKey ? numeric(record[latKey]) : null,
      longitude: lngKey ? numeric(record[lngKey]) : null,
      timezone: timezoneKey ? String(record[timezoneKey] || '').trim() || null : null,
    })
  }

  const rows = [...rowsByZip.values()].sort((a, b) => a.zip.localeCompare(b.zip))
  console.log(`Prepared ${rows.length} ZIP rows`)

  for (let index = 0; index < rows.length; index += 1000) {
    const chunk = rows.slice(index, index + 1000)
    const { error } = await supabase
      .from('zip_lookup')
      .upsert(chunk, { onConflict: 'zip' })

    if (error) throw error
    console.log(`Seeded ${Math.min(index + chunk.length, rows.length)} of ${rows.length}`)
  }

  console.log('ZIP lookup seed complete')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
