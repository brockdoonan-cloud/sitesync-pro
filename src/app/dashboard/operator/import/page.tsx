'use client'

import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'

type ImportRow = {
  id: string
  sheet: string
  binNumber: string
  accountName: string
  projectName: string
  address: string
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
          if (binIndex === undefined || accountIndex === undefined || projectIndex === undefined) return

          rows.slice(headerIndex + 1).forEach((values, index) => {
            const binNumber = clean(values[binIndex])
            const accountName = clean(values[accountIndex])
            const projectName = clean(values[projectIndex])
            if (!binNumber || !accountName || !projectName) return

            const row: Record<string, unknown> = Object.fromEntries(headers.map((header, idx) => [header, values[idx]]))
            const operation = detectOperation(row)
            const projectAddress = isAddressLike(projectName) ? projectName : ''
            const projectKey = `${accountName}|${projectName}`.toLowerCase()
            if (projectAddress) addressByProject.set(projectKey, projectAddress)
            if (!addressByProject.has(projectKey)) addressByProject.set(projectKey, deterministicAddress(accountName, projectName, binNumber))
            const address = addressByProject.get(projectKey) || projectAddress

            parsed.push({
              id: `${sheetName}-${index}-${binNumber}`,
              sheet: sheetName,
              binNumber,
              accountName,
              projectName,
              address,
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
        supabase.from('equipment').select('id,bin_number,status,location,jobsite_id').limit(1),
        supabase.from('service_requests').select('id,service_type,jobsite_address,preferred_date').limit(1),
      ])
      const failedCheck = checks.find(check => check.error)
      if (failedCheck?.error) {
        throw new Error(`Database repair is not applied yet: ${failedCheck.error.message}. Run supabase/repair_import_schema.sql in Supabase SQL Editor, then retry import.`)
      }

      for (const row of clients) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .ilike('company_name', row.accountName)
          .limit(1)

        if (existing?.[0]?.id) {
          clientIdByName.set(row.accountName.toLowerCase(), existing[0].id)
          nextStats.clientsReused++
          continue
        }

        const { data, error: err } = await supabase
          .from('clients')
          .insert({ company_name: row.accountName, status: 'active' })
          .select('id')
          .single()
        if (err) notes.push(`Client ${row.accountName}: ${err.message}`)
        else {
          clientIdByName.set(row.accountName.toLowerCase(), data.id)
          nextStats.clientsCreated++
        }
      }

      for (const row of jobsites) {
        const clientId = clientIdByName.get(row.accountName.toLowerCase()) || null
        const { data: existing } = await supabase
          .from('jobsites')
          .select('id')
          .ilike('name', row.projectName)
          .ilike('address', row.address)
          .limit(1)

        if (existing?.[0]?.id) {
          jobsiteIdByKey.set(`${row.accountName}|${row.projectName}|${row.address}`.toLowerCase(), existing[0].id)
          nextStats.jobsitesReused++
          continue
        }

        const { data, error: err } = await supabase
          .from('jobsites')
          .insert({ name: row.projectName, address: row.address, city: 'Orlando', state: 'FL', client_id: clientId, status: 'active' })
          .select('id')
          .single()
        if (err) notes.push(`Jobsite ${row.projectName}: ${err.message}`)
        else {
          jobsiteIdByKey.set(`${row.accountName}|${row.projectName}|${row.address}`.toLowerCase(), data.id)
          nextStats.jobsitesCreated++
        }
      }

      for (const row of equipment) {
        const latest = rows.find(item => item.binNumber === row.binNumber) || row
        const clientId = clientIdByName.get(latest.accountName.toLowerCase()) || null
        const jobsiteId = jobsiteIdByKey.get(`${latest.accountName}|${latest.projectName}|${latest.address}`.toLowerCase()) || null
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
        const { data: existing } = await supabase
          .from('equipment')
          .select('id')
          .or(`container_number.eq.${latest.binNumber},bin_number.eq.${latest.binNumber}`)
          .limit(1)
        const wasExisting = Boolean(existing?.[0]?.id)
        const { error: err } = wasExisting
          ? await supabase.from('equipment').update(payload).eq('id', existing[0].id)
          : await supabase.from('equipment').insert(payload)
        if (err) notes.push(`Bin ${latest.binNumber}: ${err.message}`)
        else if (wasExisting) nextStats.equipmentUpdated++
        else nextStats.equipmentCreated++
      }

      for (const row of serviceRows) {
        const { data: existingExact } = await supabase
          .from('service_requests')
          .select('id')
          .eq('bin_number', row.binNumber)
          .eq('jobsite_address', row.address)
          .limit(1)
        const { data: existingByProject } = existingExact?.[0]?.id
          ? { data: existingExact }
          : await supabase
            .from('service_requests')
            .select('id')
            .eq('bin_number', row.binNumber)
            .ilike('notes', `%${row.projectName}%`)
            .limit(1)

        if (existingByProject?.[0]?.id) {
          nextStats.servicesSkipped++
          continue
        }

        const { error: err } = await supabase.from('service_requests').insert({
          client_id: clientIdByName.get(row.accountName.toLowerCase()) || null,
          jobsite_id: jobsiteIdByKey.get(`${row.accountName}|${row.projectName}|${row.address}`.toLowerCase()) || null,
          status: serviceStatus(row.operation),
          service_type: serviceType(row.operation),
          jobsite_address: row.address,
          service_address: row.address,
          preferred_date: null,
          bin_number: row.binNumber,
          priority: row.operation === 'water_removal' ? 'high' : 'normal',
          notes: `${row.accountName} - ${row.projectName}\nBin #${row.binNumber}\nType: ${row.binType}${row.comments ? `\n${row.comments}` : ''}`,
        })
        if (err) notes.push(`Service ${row.binNumber}: ${err.message}`)
        else nextStats.servicesCreated++
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
