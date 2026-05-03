'use client'

import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import { validateWorkbookFile } from '@/lib/files/workbook'

type ImportRow = {
  id: string
  sheet: string
  binNumber: string
  accountName: string
  projectName: string
  address: string
  reportDate: string | null
  lat?: number
  lng?: number
  operation: string
  status: string
  binType: string
  comments: string
}

type ImportStats = {
  clientsCreated: number
  clientsReused: number
  jobsitesCreated: number
  jobsitesReused: number
  equipmentCreated: number
  equipmentUpdated: number
  servicesCreated: number
  servicesSkipped: number
}

const FLORIDA_DEMO_ADDRESSES = [
  '255 S Orange Ave, Orlando, FL 32801',
  '400 W Church St, Orlando, FL 32801',
  '655 W Church St, Orlando, FL 32805',
  '9801 International Dr, Orlando, FL 32819',
  '1 Jeff Fuqua Blvd, Orlando, FL 32827',
  '701 Front St, Celebration, FL 34747',
  '200 E Robinson St, Orlando, FL 32801',
  '6000 Universal Blvd, Orlando, FL 32819',
  '1180 Seven Seas Dr, Lake Buena Vista, FL 32830',
  '100 N Woodland Blvd, DeLand, FL 32720',
  '301 W 13th St, Sanford, FL 32771',
  '951 Market Promenade Ave, Lake Mary, FL 32746',
  '14111 Shoreside Way, Winter Garden, FL 34787',
  '6900 Tavistock Lakes Blvd, Orlando, FL 32827',
  '7007 Sea World Dr, Orlando, FL 32821',
  '1500 Masters Blvd, ChampionsGate, FL 33896',
  '101 Adventure Ct, Davenport, FL 33837',
  '4012 Central Florida Pkwy, Orlando, FL 32837',
  '260 N Tubb St, Oakland, FL 34760',
  '201 E Pine St, Orlando, FL 32801',
]

const FLORIDA_DEMO_COORDS: Record<string, { lat: number; lng: number }> = {
  '255 S Orange Ave, Orlando, FL 32801': { lat: 28.5384, lng: -81.3789 },
  '400 W Church St, Orlando, FL 32801': { lat: 28.5406, lng: -81.3839 },
  '655 W Church St, Orlando, FL 32805': { lat: 28.5409, lng: -81.3911 },
  '9801 International Dr, Orlando, FL 32819': { lat: 28.4239, lng: -81.4697 },
  '1 Jeff Fuqua Blvd, Orlando, FL 32827': { lat: 28.4312, lng: -81.3081 },
  '701 Front St, Celebration, FL 34747': { lat: 28.3185, lng: -81.5418 },
  '200 E Robinson St, Orlando, FL 32801': { lat: 28.5451, lng: -81.3751 },
  '6000 Universal Blvd, Orlando, FL 32819': { lat: 28.4720, lng: -81.4678 },
  '1180 Seven Seas Dr, Lake Buena Vista, FL 32830': { lat: 28.4177, lng: -81.5812 },
  '100 N Woodland Blvd, DeLand, FL 32720': { lat: 29.0283, lng: -81.3031 },
  '301 W 13th St, Sanford, FL 32771': { lat: 28.8006, lng: -81.2744 },
  '951 Market Promenade Ave, Lake Mary, FL 32746': { lat: 28.7850, lng: -81.3576 },
  '14111 Shoreside Way, Winter Garden, FL 34787': { lat: 28.4616, lng: -81.6148 },
  '6900 Tavistock Lakes Blvd, Orlando, FL 32827': { lat: 28.3720, lng: -81.2787 },
  '7007 Sea World Dr, Orlando, FL 32821': { lat: 28.4114, lng: -81.4615 },
  '1500 Masters Blvd, ChampionsGate, FL 33896': { lat: 28.2616, lng: -81.6237 },
  '101 Adventure Ct, Davenport, FL 33837': { lat: 28.1614, lng: -81.6087 },
  '4012 Central Florida Pkwy, Orlando, FL 32837': { lat: 28.4016, lng: -81.4295 },
  '260 N Tubb St, Oakland, FL 34760': { lat: 28.5566, lng: -81.6317 },
  '201 E Pine St, Orlando, FL 32801': { lat: 28.5415, lng: -81.3760 },
}

function clean(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeHeader(value: unknown) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function deterministicAddress(accountName: string, projectName: string, binNumber: string) {
  const seed = `${accountName}|${projectName}|${binNumber}`
  const score = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return FLORIDA_DEMO_ADDRESSES[score % FLORIDA_DEMO_ADDRESSES.length]
}

function reportBaseDate(fileName: string) {
  const match = fileName.match(/(\d{1,2})[.\-_](\d{1,2})[.\-_](\d{4})/)
  if (!match) return null
  const [, month, day, year] = match
  return { month: Number(month), day: Number(day), year: Number(year) }
}

function sheetReportDate(fileName: string, sheetName: string) {
  const base = reportBaseDate(fileName)
  const day = Number(sheetName.match(/\d{1,2}/)?.[0])
  if (!base || !day || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(base.year, base.month - 1, day))
  return date.toISOString().slice(0, 10)
}

function detectOperation(row: Record<string, unknown>) {
  const pairs = [
    ['deliver', 'delivery'],
    ['pickup', 'pickup'],
    ['waterremoval', 'water_removal'],
    ['relocate', 'relocate'],
  ] as const
  return pairs.find(([key]) => clean(row[key]).toLowerCase().startsWith('x'))?.[1] || 'active'
}

function statusForOperation(operation: string) {
  if (operation === 'pickup') return 'available'
  if (operation === 'water_removal') return 'maintenance'
  if (operation === 'relocate') return 'deployed'
  return 'deployed'
}

function equipmentType(value: string) {
  const lower = value.toLowerCase()
  if (lower.includes('wash')) return 'washout'
  if (lower.includes('slurry')) return 'slurry'
  if (lower.includes('porta')) return 'porta_potty'
  if (lower.includes('dump')) return 'dumpster'
  if (lower.includes('tank')) return 'tank'
  return 'other'
}

function serviceType(operation: string) {
  if (operation === 'pickup') return 'removal'
  if (operation === 'water_removal') return 'pump_out'
  if (operation === 'delivery') return 'delivery'
  return 'other'
}

function serviceStatus(operation: string) {
  return operation === 'pickup' ? 'completed' : 'confirmed'
}

function isAddressLike(value: string) {
  return /\d+ .+,\s*[A-Z]{2}\s*\d{5}/i.test(value) || /\d+ .+(street|st|road|rd|ave|avenue|blvd|drive|dr|lane|ln)/i.test(value)
}

function parseWorkbook(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file.'))
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'array' })
        const parsed: ImportRow[] = []
        const addressByProject = new Map<string, string>()

        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName]
          const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
          const headerIndex = rows.findIndex(row => row.map(normalizeHeader).includes('bin'))
          if (headerIndex === -1) return

          const headers = rows[headerIndex].map(normalizeHeader)
          const headerMap = headers.reduce<Record<string, number>>((map, header, index) => {
            if (header) map[header] = index
            return map
          }, {})

          const binIndex = headerMap.bin
          const accountIndex = headerMap.accountname ?? headerMap.customername
          const projectIndex = headerMap.projectname ?? headerMap.projectnameaddress
          const addressIndex = headerMap.address ?? headerMap.jobsiteaddress ?? headerMap.serviceaddress ?? headerMap.projectaddress ?? headerMap.location
          if (binIndex === undefined || accountIndex === undefined || projectIndex === undefined) return

          rows.slice(headerIndex + 1).forEach((values, index) => {
            const binNumber = clean(values[binIndex])
            const accountName = clean(values[accountIndex])
            const projectName = clean(values[projectIndex])
            if (!binNumber || !accountName || !projectName) return

            const row: Record<string, unknown> = Object.fromEntries(headers.map((header, idx) => [header, values[idx]]))
            const operation = detectOperation(row)
            const explicitAddress = addressIndex !== undefined ? clean(values[addressIndex]) : ''
            const projectAddress = isAddressLike(explicitAddress) ? explicitAddress : isAddressLike(projectName) ? projectName : ''
            const projectKey = `${accountName}|${projectName}`.toLowerCase()
            if (projectAddress) addressByProject.set(projectKey, projectAddress)
            if (!addressByProject.has(projectKey)) addressByProject.set(projectKey, deterministicAddress(accountName, projectName, binNumber))
            const address = addressByProject.get(projectKey) || projectAddress
            const coords = FLORIDA_DEMO_COORDS[address]
            const reportDate = sheetReportDate(file.name, sheetName)

            parsed.push({
              id: `${sheetName}-${index}-${binNumber}`,
              sheet: sheetName,
              binNumber,
              accountName,
              projectName,
              address,
              reportDate,
              lat: coords?.lat,
              lng: coords?.lng,
              operation,
              status: statusForOperation(operation),
              binType: equipmentType(clean(row.bintype)),
              comments: clean(row.comments),
            })
          })
        })

        resolve(parsed)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not parse workbook.'))
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

function uniqueBy<T>(rows: T[], key: (row: T) => string) {
  const seen = new Set<string>()
  return rows.filter(row => {
    const value = key(row)
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

function normalizedKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function chunks<T>(values: T[], size = 500) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}

const emptyStats: ImportStats = {
  clientsCreated: 0,
  clientsReused: 0,
  jobsitesCreated: 0,
  jobsitesReused: 0,
  equipmentCreated: 0,
  equipmentUpdated: 0,
  servicesCreated: 0,
  servicesSkipped: 0,
}

export default function BulkImportPage() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [importing, setImporting] = useState(false)
  const [report, setReport] = useState<string[]>([])
  const [stats, setStats] = useState<ImportStats | null>(null)

  const clients = useMemo(() => uniqueBy(rows, row => row.accountName.toLowerCase()), [rows])
  const jobsites = useMemo(() => uniqueBy(rows, row => `${row.accountName}|${row.projectName}|${row.address}`.toLowerCase()), [rows])
  const equipment = useMemo(() => uniqueBy(rows, row => row.binNumber), [rows])
  const serviceRows = rows

  const handleFile = async (file?: File) => {
    if (!file) return
    setError('')
    setMessage('')
    setReport([])
    setStats(null)
    setFileName(file.name)
    try {
      validateWorkbookFile(file)
      const parsed = await parseWorkbook(file)
      if (parsed.length === 0) throw new Error('No importable bin rows were found.')
      setRows(parsed)
      setMessage(`Parsed ${parsed.length} rows. Demo Florida addresses were added where the file did not include active jobsite addresses.`)
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Could not parse file.')
    }
  }

  const importRows = async () => {
    setImporting(true)
    setError('')
    setReport([])
    const notes: string[] = []
    const nextStats = { ...emptyStats }

    const clientIdByName = new Map<string, string>()
    const jobsiteIdByKey = new Map<string, string>()

    try {
      const checks = await Promise.all([
        supabase.from('clients').select('id,company_name').limit(1),
        supabase.from('jobsites').select('id,address').limit(1),
        supabase.from('equipment').select('id,bin_number,container_number,status,location,jobsite_id').limit(1),
        supabase.from('service_requests').select('id,service_type,jobsite_address,preferred_date,bin_number').limit(1),
        supabase.from('daily_operation_events').select('id,event_date,bin_number').limit(1),
      ])
      const failedCheck = checks.find(check => check.error)
      if (failedCheck?.error) {
        throw new Error(`Database repair is not applied yet: ${failedCheck.error.message}. Run supabase/repair_import_schema.sql in Supabase SQL Editor, then retry import.`)
      }

      const [existingClients, existingJobsites, existingEquipment, existingServices] = await Promise.all([
        fetchAllRows<any>((from, to) => supabase.from('clients').select('id,company_name').range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from('jobsites').select('id,name,address,client_id').range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from('equipment').select('id,bin_number,container_number').range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from('service_requests').select('id,bin_number,jobsite_address,preferred_date,notes').range(from, to)),
      ])

      existingClients.forEach(client => {
        if (client.company_name) clientIdByName.set(normalizedKey(client.company_name), client.id)
      })

      const newClients = clients
        .filter(row => !clientIdByName.has(normalizedKey(row.accountName)))
        .map(row => ({ company_name: row.accountName, status: 'active' }))

      nextStats.clientsReused = clients.length - newClients.length
      for (const batch of chunks(newClients)) {
        const { data, error: err } = await supabase.from('clients').insert(batch).select('id,company_name')
        if (err) notes.push(`Clients: ${err.message}`)
        else nextStats.clientsCreated += data?.length || batch.length
        ;(data || []).forEach((client: any) => clientIdByName.set(normalizedKey(client.company_name), client.id))
      }

      existingJobsites.forEach(site => {
        const key = `${site.client_id || ''}|${normalizedKey(site.name || '')}|${normalizedKey(site.address || '')}`
        jobsiteIdByKey.set(key, site.id)
      })

      const newJobsites = jobsites.flatMap(row => {
        const clientId = clientIdByName.get(normalizedKey(row.accountName)) || null
        const key = `${clientId || ''}|${normalizedKey(row.projectName)}|${normalizedKey(row.address)}`
        if (jobsiteIdByKey.has(key)) {
          nextStats.jobsitesReused++
          return []
        }
        return [{
          name: row.projectName,
          address: row.address,
          city: 'Orlando',
          state: 'FL',
          client_id: clientId,
          status: 'active',
          lat: row.lat ?? null,
          lng: row.lng ?? null,
        }]
      })

      for (const batch of chunks(newJobsites)) {
        const { data, error: err } = await supabase.from('jobsites').insert(batch).select('id,name,address,client_id')
        if (err) notes.push(`Jobsites: ${err.message}`)
        else nextStats.jobsitesCreated += data?.length || batch.length
        ;(data || []).forEach((site: any) => {
          const key = `${site.client_id || ''}|${normalizedKey(site.name || '')}|${normalizedKey(site.address || '')}`
          jobsiteIdByKey.set(key, site.id)
        })
      }

      const equipmentIdByBin = new Map<string, string>()
      existingEquipment.forEach(item => {
        if (item.bin_number) equipmentIdByBin.set(normalizedKey(item.bin_number), item.id)
        if (item.container_number) equipmentIdByBin.set(normalizedKey(item.container_number), item.id)
      })

      const equipmentToInsert: any[] = []
      const equipmentToUpdate: { id: string; payload: any; binNumber: string }[] = []
      const reversedRows = [...rows].reverse()
      equipment.forEach(row => {
        const latest = reversedRows.find(item => item.binNumber === row.binNumber) || row
        const clientId = clientIdByName.get(normalizedKey(latest.accountName)) || null
        const jobsiteKey = `${clientId || ''}|${normalizedKey(latest.projectName)}|${normalizedKey(latest.address)}`
        const jobsiteId = jobsiteIdByKey.get(jobsiteKey) || null
        const payload = {
          container_number: latest.binNumber,
          bin_number: latest.binNumber,
          type: latest.binType,
          status: latest.status,
          location: latest.address,
          current_client_id: clientId,
          client_id: clientId,
          current_jobsite_id: latest.operation === 'pickup' ? null : jobsiteId,
          jobsite_id: latest.operation === 'pickup' ? null : jobsiteId,
          last_serviced_at: new Date().toISOString(),
          last_service_date: new Date().toISOString().slice(0, 10),
        }
        const existingId = equipmentIdByBin.get(normalizedKey(latest.binNumber))
        if (existingId) equipmentToUpdate.push({ id: existingId, payload, binNumber: latest.binNumber })
        else equipmentToInsert.push(payload)
      })

      for (const batch of chunks(equipmentToInsert)) {
        const { error: err } = await supabase.from('equipment').insert(batch)
        if (err) notes.push(`Equipment batch: ${err.message}`)
        else nextStats.equipmentCreated += batch.length
      }

      for (const item of equipmentToUpdate) {
        const { error: err } = await supabase.from('equipment').update(item.payload).eq('id', item.id)
        if (err) notes.push(`Bin ${item.binNumber}: ${err.message}`)
        else nextStats.equipmentUpdated++
      }

      const serviceKeys = new Set<string>()
      existingServices.forEach(service => {
        serviceKeys.add(`${normalizedKey(service.bin_number || '')}|${normalizedKey(service.jobsite_address || '')}|${service.preferred_date || ''}`)
        const project = String(service.notes || '').split('\n')[0] || ''
        if (project) serviceKeys.add(`${normalizedKey(service.bin_number || '')}|${normalizedKey(project)}|`)
      })

      const servicesToInsert = serviceRows.flatMap(row => {
        const datedKey = `${normalizedKey(row.binNumber)}|${normalizedKey(row.address)}|${row.reportDate || ''}`
        const projectKey = `${normalizedKey(row.binNumber)}|${normalizedKey(`${row.accountName} - ${row.projectName}`)}|`
        if (serviceKeys.has(datedKey) || (!row.reportDate && serviceKeys.has(projectKey))) {
          nextStats.servicesSkipped++
          return []
        }
        serviceKeys.add(datedKey)
        serviceKeys.add(projectKey)
        const clientId = clientIdByName.get(normalizedKey(row.accountName)) || null
        const jobsiteId = jobsiteIdByKey.get(`${clientId || ''}|${normalizedKey(row.projectName)}|${normalizedKey(row.address)}`) || null
        return [{
          client_id: clientId,
          jobsite_id: jobsiteId,
          status: serviceStatus(row.operation),
          service_type: serviceType(row.operation),
          jobsite_address: row.address,
          service_address: row.address,
          preferred_date: row.reportDate,
          scheduled_date: row.reportDate,
          bin_number: row.binNumber,
          priority: row.operation === 'water_removal' ? 'high' : 'normal',
          notes: `${row.accountName} - ${row.projectName}\nBin #${row.binNumber}\nType: ${row.binType}\nSource: ${fileName || 'bulk import'} sheet ${row.sheet}${row.comments ? `\n${row.comments}` : ''}`,
        }]
      })

      for (const batch of chunks(servicesToInsert)) {
        const { error: err } = await supabase.from('service_requests').insert(batch)
        if (err) notes.push(`Service batch: ${err.message}`)
        else nextStats.servicesCreated += batch.length
      }

      const dailyRows = rows.filter(row => row.reportDate).map(row => ({
        event_date: row.reportDate,
        source_file: fileName || 'bulk import',
        source_sheet: row.sheet,
        client_name: row.accountName,
        project_name: row.projectName,
        bin_number: row.binNumber,
        operation: row.operation,
        bin_type: row.binType,
        comments: row.comments || null,
        audit_hash: `${row.reportDate}|${row.sheet}|${row.binNumber}|${row.accountName}|${row.projectName}|${row.operation}`,
      }))
      if (dailyRows.length > 0) {
        const sourceFile = fileName || 'bulk import'
        const dailyDates = Array.from(new Set(dailyRows.map(row => row.event_date).filter(Boolean)))
        if (dailyDates.length > 0) {
          await supabase.from('daily_operation_events').delete().eq('source_file', sourceFile).in('event_date', dailyDates)
        }
        for (const batch of chunks(dailyRows)) {
          const { error: dailyError } = await supabase.from('daily_operation_events').insert(batch)
          if (dailyError) notes.push(`Daily report trace: ${dailyError.message}`)
        }
      }

      setReport(notes)
      setStats(nextStats)
      setMessage(notes.length ? `Import completed with ${notes.length} row warnings. Records that passed validation were saved.` : 'Import completed without warnings.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Bulk Office Import</h1>
        <p className="text-slate-400 mt-1">Drag in Orlando-style Excel reports to onboard hundreds of bins, jobsites, customers, and active services at once.</p>
      </div>

      <label
        onDragOver={event => event.preventDefault()}
        onDrop={event => { event.preventDefault(); handleFile(event.dataTransfer.files[0]) }}
        className="block rounded-2xl border border-dashed border-sky-500/40 bg-sky-500/10 px-6 py-10 text-center cursor-pointer hover:border-sky-400 transition-colors"
      >
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={event => handleFile(event.target.files?.[0])} />
        <div className="text-lg font-semibold text-white">Drop an Excel report here</div>
        <div className="text-sm text-slate-400 mt-2">Supports files like 4.14.2026 Orlando Report.xlsx. Missing addresses get demo Florida jobsites automatically.</div>
        <div className="text-xs text-slate-500 mt-2">If imports show schema or profiles recursion warnings, run supabase/repair_import_schema.sql once in Supabase SQL Editor.</div>
        {fileName && <div className="text-sky-300 text-sm mt-4">{fileName}</div>}
      </label>

      {(message || error) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>{error || message}</div>}

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              ['Rows', rows.length],
              ['Clients', clients.length],
              ['Jobsites', jobsites.length],
              ['Bins', equipment.length],
              ['Service Records', serviceRows.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3">
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="card overflow-hidden p-0">
            <div className="flex items-center justify-between gap-4 border-b border-slate-700/50 px-4 py-3">
              <div>
                <h2 className="font-semibold text-white">Preview</h2>
                <p className="text-xs text-slate-500">First 25 rows. Demo addresses are ready for map pins.</p>
              </div>
              <button onClick={importRows} disabled={importing} className="btn-primary px-4 py-2">{importing ? 'Importing...' : 'Import All'}</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-700/50">
                    <th className="px-4 py-3 text-left">Bin</th>
                    <th className="px-4 py-3 text-left">Client</th>
                    <th className="px-4 py-3 text-left">Project</th>
                    <th className="px-4 py-3 text-left">Address</th>
                    <th className="px-4 py-3 text-left">Operation</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 25).map(row => (
                    <tr key={row.id} className="border-b border-slate-700/30 last:border-0">
                      <td className="px-4 py-3 font-mono text-white">{row.binNumber}</td>
                      <td className="px-4 py-3 text-slate-300">{row.accountName}</td>
                      <td className="px-4 py-3 text-slate-300">{row.projectName}</td>
                      <td className="px-4 py-3 text-slate-400">{row.address}</td>
                      <td className="px-4 py-3 text-sky-300 capitalize">{row.operation.replace(/_/g, ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {report.length > 0 && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
              <h3 className="font-semibold text-yellow-200">Import warnings</h3>
              <div className="mt-2 max-h-60 overflow-auto space-y-1 text-xs text-yellow-100/80">
                {report.map((item, index) => <div key={`${item}-${index}`}>{item}</div>)}
              </div>
            </div>
          )}

          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ['Clients', `${stats.clientsCreated} new / ${stats.clientsReused} reused`],
                ['Jobsites', `${stats.jobsitesCreated} new / ${stats.jobsitesReused} reused`],
                ['Equipment', `${stats.equipmentCreated} new / ${stats.equipmentUpdated} updated`],
                ['Services', `${stats.servicesCreated} new / ${stats.servicesSkipped} skipped`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3">
                  <div className="text-sm font-semibold text-white">{value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
