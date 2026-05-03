'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'

type InvoiceRow = {
  id: string
  invoice_number?: string | null
  client_id?: string | null
  client_name?: string | null
  customer_name?: string | null
  email?: string | null
  client_email?: string | null
  total?: number | string | null
  amount?: number | string | null
  balance?: number | string | null
  status?: string | null
  invoice_date?: string | null
  service_date?: string | null
  due_date?: string | null
  created_at?: string | null
  source_file?: string | null
  source_row?: number | null
  audit_hash?: string | null
  notes?: string | null
}

type ServiceRow = {
  id: string
  service_type?: string | null
  jobsite_address?: string | null
  service_address?: string | null
  bin_number?: string | null
  status?: string | null
  preferred_date?: string | null
  scheduled_date?: string | null
  created_at?: string | null
  notes?: string | null
}

type BillingLine = {
  id: string
  clientName: string
  projectName: string
  type: string
  date: string
  invoiceNumber: string
  memo: string
  item: string
  rep: string
  qty: number
  rate: number
  amount: number
  balance: number
  sourceRow: number
  raw: Record<string, unknown>
}

type BillingBatch = {
  fileName: string
  importedAt: string
  lines: BillingLine[]
  totalAmount: number
  endingBalance: number
}

type OperationName = 'delivery' | 'pickup' | 'water_removal' | 'relocate'

type OperationEvent = {
  id: string
  date: string
  binNumber: string
  clientName: string
  projectName: string
  operation: OperationName
  binType: string
  comments: string
  sourceRow: number
}

type DailyReport = {
  date: string
  sourceFile: string
  sourceSheet: string
  totals: Record<OperationName, number>
  events: OperationEvent[]
}

const demoDefaultDate = '2026-04-29'

const DEMO_DAILY_REPORTS: DailyReport[] = [
  {
    date: '2026-04-01',
    sourceFile: '4.29.2026 Orlando Report.xlsx',
    sourceSheet: '1',
    totals: { delivery: 4, pickup: 6, water_removal: 1, relocate: 0 },
    events: [
      { id: 'demo-0401-1', date: '2026-04-01', binNumber: '165905', clientName: 'Titan America', projectName: 'Cocoa', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 5 },
      { id: 'demo-0401-2', date: '2026-04-01', binNumber: '876972', clientName: 'Titan America', projectName: 'Cocoa', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 6 },
      { id: 'demo-0401-3', date: '2026-04-01', binNumber: '154761', clientName: 'Castle', projectName: 'Project Macaw', operation: 'pickup', binType: 'washout', comments: 'standby30', sourceRow: 7 },
      { id: 'demo-0401-4', date: '2026-04-01', binNumber: '32971', clientName: 'Baker', projectName: 'Project Neptune', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 8 },
      { id: 'demo-0401-5', date: '2026-04-01', binNumber: '41848', clientName: 'Baker', projectName: 'Project Neptune', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 9 },
      { id: 'demo-0401-6', date: '2026-04-01', binNumber: 'PW114', clientName: 'PCC', projectName: 'AAA HS', operation: 'water_removal', binType: 'washout', comments: '', sourceRow: 15 },
    ],
  },
  {
    date: '2026-04-02',
    sourceFile: '4.29.2026 Orlando Report.xlsx',
    sourceSheet: '2',
    totals: { delivery: 3, pickup: 3, water_removal: 0, relocate: 0 },
    events: [
      { id: 'demo-0402-1', date: '2026-04-02', binNumber: '160887', clientName: 'Liberty Concrete & Forming', projectName: 'Lawnwood Hospital', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 5 },
      { id: 'demo-0402-2', date: '2026-04-02', binNumber: '876917', clientName: 'WMSS', projectName: 'Walmart 7039', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 6 },
      { id: 'demo-0402-3', date: '2026-04-02', binNumber: '41848', clientName: 'WM', projectName: 'HGR-Mater Academy', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 7 },
      { id: 'demo-0402-4', date: '2026-04-02', binNumber: '60679', clientName: 'WM', projectName: 'HGR-Mater Academy', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 8 },
      { id: 'demo-0402-5', date: '2026-04-02', binNumber: '143287', clientName: 'WM', projectName: 'DHI-Nona West', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 9 },
      { id: 'demo-0402-6', date: '2026-04-02', binNumber: '140713', clientName: 'WM', projectName: 'DHI-Nona West', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 10 },
    ],
  },
  {
    date: '2026-04-03',
    sourceFile: '4.29.2026 Orlando Report.xlsx',
    sourceSheet: '3',
    totals: { delivery: 3, pickup: 2, water_removal: 1, relocate: 0 },
    events: [
      { id: 'demo-0403-1', date: '2026-04-03', binNumber: '140654', clientName: 'Castle', projectName: 'Winter Park Playhouse', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 5 },
      { id: 'demo-0403-2', date: '2026-04-03', binNumber: '32457', clientName: 'Sterling Concrete', projectName: 'Sterling HQ', operation: 'water_removal', binType: 'washout', comments: '', sourceRow: 6 },
      { id: 'demo-0403-3', date: '2026-04-03', binNumber: '154761', clientName: 'Castle', projectName: 'Universal Project 931', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 7 },
      { id: 'demo-0403-4', date: '2026-04-03', binNumber: '154714', clientName: 'Jones', projectName: 'Reserve of Twin Lakes', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 8 },
      { id: 'demo-0403-5', date: '2026-04-03', binNumber: '153596', clientName: 'Jones', projectName: 'Reserve of Twin Lakes', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 9 },
      { id: 'demo-0403-6', date: '2026-04-03', binNumber: '60677', clientName: 'Jones', projectName: 'Reserve of Twin Lakes', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 10 },
    ],
  },
  {
    date: '2026-04-28',
    sourceFile: '4.29.2026 Orlando Report.xlsx',
    sourceSheet: '28',
    totals: { delivery: 10, pickup: 8, water_removal: 1, relocate: 0 },
    events: [
      { id: 'demo-0428-1', date: '2026-04-28', binNumber: '163041', clientName: 'Baker', projectName: 'Project RO', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 5 },
      { id: 'demo-0428-2', date: '2026-04-28', binNumber: '61529', clientName: 'Baker', projectName: 'Project RO', operation: 'pickup', binType: 'washout', comments: 'stand by 1hr', sourceRow: 6 },
      { id: 'demo-0428-3', date: '2026-04-28', binNumber: '41902', clientName: 'Brasfield & Gorrie', projectName: 'Project Ray', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 7 },
      { id: 'demo-0428-4', date: '2026-04-28', binNumber: '165736', clientName: 'Brasfield & Gorrie', projectName: 'Project Ray', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 8 },
      { id: 'demo-0428-5', date: '2026-04-28', binNumber: 'PW109', clientName: 'PCC', projectName: 'Sumter Govt SC', operation: 'water_removal', binType: 'washout', comments: '', sourceRow: 19 },
      { id: 'demo-0428-6', date: '2026-04-28', binNumber: '60711', clientName: 'WM', projectName: 'DHI Nona West', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 22 },
      { id: 'demo-0428-7', date: '2026-04-28', binNumber: '163689', clientName: 'WM', projectName: 'DHI Nona West', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 23 },
    ],
  },
  {
    date: '2026-04-29',
    sourceFile: '4.29.2026 Orlando Report.xlsx',
    sourceSheet: '29',
    totals: { delivery: 14, pickup: 15, water_removal: 0, relocate: 0 },
    events: [
      { id: 'demo-0429-1', date: '2026-04-29', binNumber: '61506', clientName: 'Baker', projectName: 'Project Neptune', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 5 },
      { id: 'demo-0429-2', date: '2026-04-29', binNumber: '41847', clientName: 'Baker', projectName: 'Project Neptune', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 6 },
      { id: 'demo-0429-3', date: '2026-04-29', binNumber: '154761', clientName: 'Jones', projectName: 'Reserve of Twin Lakes', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 7 },
      { id: 'demo-0429-4', date: '2026-04-29', binNumber: '153596', clientName: 'Jones', projectName: 'Reserve of Twin Lakes', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 8 },
      { id: 'demo-0429-5', date: '2026-04-29', binNumber: '61529', clientName: 'Brasfield & Gorrie', projectName: 'AHC Tower H', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 9 },
      { id: 'demo-0429-6', date: '2026-04-29', binNumber: '143288', clientName: 'Brasfield & Gorrie', projectName: 'AHC Tower H', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 10 },
      { id: 'demo-0429-7', date: '2026-04-29', binNumber: '876972', clientName: 'PCL', projectName: 'Project LaBrea', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 11 },
      { id: 'demo-0429-8', date: '2026-04-29', binNumber: '61489', clientName: 'PCL', projectName: 'Project LaBrea', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 12 },
      { id: 'demo-0429-9', date: '2026-04-29', binNumber: '143290', clientName: 'WM', projectName: 'HGR Mater Academy', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 15 },
      { id: 'demo-0429-10', date: '2026-04-29', binNumber: '41848', clientName: 'WM', projectName: 'HGR Mater Academy', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 16 },
      { id: 'demo-0429-11', date: '2026-04-29', binNumber: '876920', clientName: 'The Conlan Co', projectName: 'Beachline 2 & 3', operation: 'delivery', binType: 'washout', comments: '', sourceRow: 30 },
      { id: 'demo-0429-12', date: '2026-04-29', binNumber: '121872', clientName: 'The Conlan Co', projectName: 'Beachline 2 & 3', operation: 'pickup', binType: 'washout', comments: '', sourceRow: 33 },
    ],
  },
]

function money(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function asDateInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function sameDay(value: string | null | undefined, day: string) {
  return asDateInput(value) === day
}

function clean(value: unknown) {
  return String(value ?? '').trim()
}

function headerKey(value: unknown) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function numberValue(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/[$,]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function excelDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const text = clean(value)
  if (!text) return ''
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? text.slice(0, 10) : date.toISOString().slice(0, 10)
}

function statusClass(status?: string | null) {
  if (status === 'paid') return 'bg-green-500/10 text-green-400 border-green-500/30'
  if (status === 'overdue') return 'bg-red-500/10 text-red-400 border-red-500/30'
  if (status === 'open') return 'bg-sky-500/10 text-sky-400 border-sky-500/30'
  return 'bg-slate-700/40 text-slate-400 border-slate-600/40'
}

function hashLine(line: BillingLine) {
  const text = [line.clientName, line.projectName, line.invoiceNumber, line.date, line.memo, line.item, line.qty, line.rate, line.amount, line.balance].join('|')
  let hash = 0
  for (const char of text) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  return `SSP-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`
}

function operationLabel(operation: OperationName) {
  if (operation === 'delivery') return 'Drop / Delivery'
  if (operation === 'pickup') return 'Pickup'
  if (operation === 'water_removal') return 'Water Removal'
  return 'Relocate'
}

function operationClass(operation: OperationName) {
  if (operation === 'delivery') return 'bg-green-500/10 text-green-400 border-green-500/30'
  if (operation === 'pickup') return 'bg-sky-500/10 text-sky-400 border-sky-500/30'
  if (operation === 'water_removal') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
  return 'bg-purple-500/10 text-purple-400 border-purple-500/30'
}

function operationRate(operation: OperationName) {
  if (operation === 'delivery') return 185
  if (operation === 'pickup') return 165
  if (operation === 'water_removal') return 225
  return 145
}

function demoInvoiceRows(events: OperationEvent[]): InvoiceRow[] {
  return events.map(event => {
    const amount = operationRate(event.operation)
    return {
      id: `demo-invoice-${event.id}`,
      invoice_number: `DEMO-${event.date.replace(/-/g, '')}-${event.binNumber}`,
      client_name: event.clientName,
      customer_name: event.clientName,
      total: amount,
      amount,
      balance: amount,
      status: 'open',
      invoice_date: event.date,
      service_date: event.date,
      source_file: 'Demo daily invoice',
      source_row: event.sourceRow,
      audit_hash: hashOperation(event),
      notes: `${operationLabel(event.operation)} for ${event.projectName} bin ${event.binNumber}`,
    }
  })
}

function workbookKind(workbook: XLSX.WorkBook) {
  let hasBillingHeaders = false
  let hasOperationalHeaders = false

  workbook.SheetNames.forEach(sheetName => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '' })
    rows.slice(0, 20).forEach(row => {
      const headers = row.map(headerKey)
      if (headers.includes('type') && headers.includes('amount')) hasBillingHeaders = true
      if (
        headers.some(header => ['bin', 'binnumber', 'container', 'containernumber'].includes(header)) &&
        headers.some(header => ['accountname', 'customername', 'clientname'].includes(header)) &&
        headers.some(header => ['projectname', 'projectnameaddress', 'jobsite', 'jobsitename'].includes(header))
      ) {
        hasOperationalHeaders = true
      }
    })
  })

  if (hasBillingHeaders) return 'billing'
  if (hasOperationalHeaders) return 'operations'
  return 'unknown'
}

function hashOperation(event: OperationEvent) {
  let hash = 0
  const text = [event.date, event.binNumber, event.clientName, event.projectName, event.operation, event.sourceRow].join('|')
  for (const char of text) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  return `OPS-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`
}

function parseBillingWorkbook(file: File): Promise<BillingBatch> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read billing file.'))
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'array', cellDates: true })
        const kind = workbookKind(workbook)
        if (kind === 'operations') {
          throw new Error('This is an Orlando operations report, not a billing export. Use Operator > Bulk Import for bins/jobsites/service activity. Billing accepts the Atlantic Concrete invoice export with Type and Amount columns.')
        }
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
        const headerIndex = rows.findIndex(row => row.some(value => headerKey(value) === 'type') && row.some(value => headerKey(value) === 'amount'))
        if (headerIndex === -1) throw new Error('Could not find Type/Amount billing headers. Drop the Atlantic billing export here, or use Operator > Bulk Import for Orlando operations reports.')

        const headers = rows[headerIndex].map(clean)
        const indexFor = (name: string) => headers.findIndex(header => header.toLowerCase() === name.toLowerCase())
        const idx = {
          type: indexFor('Type'),
          date: indexFor('Date'),
          num: indexFor('Num'),
          memo: indexFor('Memo'),
          item: indexFor('Item'),
          rep: indexFor('Rep'),
          qty: indexFor('Qty'),
          rate: indexFor('Sales Price'),
          amount: indexFor('Amount'),
          balance: indexFor('Balance'),
        }

        let currentClient = ''
        let currentProject = ''
        const lines: BillingLine[] = []

        rows.slice(headerIndex + 1).forEach((row, offset) => {
          const rowNumber = headerIndex + offset + 2
          const first = clean(row[1])
          const project = clean(row[2])
          const type = clean(row[idx.type])

          if (first && !type && !first.toLowerCase().startsWith('total')) currentClient = first
          if (project && !type && !project.toLowerCase().startsWith('total')) currentProject = project
          if (!type || type.toLowerCase().startsWith('total')) return

          const line: BillingLine = {
            id: `${rowNumber}-${clean(row[idx.num])}-${clean(row[idx.memo])}-${clean(row[idx.item])}`,
            clientName: currentClient || 'Unknown client',
            projectName: currentProject || 'Unknown project',
            type,
            date: excelDate(row[idx.date]),
            invoiceNumber: clean(row[idx.num]) || `ROW-${rowNumber}`,
            memo: clean(row[idx.memo]),
            item: clean(row[idx.item]),
            rep: clean(row[idx.rep]),
            qty: numberValue(row[idx.qty]),
            rate: numberValue(row[idx.rate]),
            amount: numberValue(row[idx.amount]),
            balance: numberValue(row[idx.balance]),
            sourceRow: rowNumber,
            raw: Object.fromEntries(headers.map((header, index) => [header || `Column ${index + 1}`, row[index]])),
          }
          lines.push(line)
        })

        resolve({
          fileName: file.name,
          importedAt: new Date().toISOString(),
          lines,
          totalAmount: lines.reduce((sum, line) => sum + line.amount, 0),
          endingBalance: lines.at(-1)?.balance || 0,
        })
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not parse billing workbook.'))
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

function csvEscape(value: unknown) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(name: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(','), ...rows.map(row => headers.map(header => csvEscape(row[header])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export default function BillingPage() {
  const supabase = useMemo(() => createClient(), [])
  const [selectedDate, setSelectedDate] = useState(demoDefaultDate)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [services, setServices] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [batch, setBatch] = useState<BillingBatch | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingDailyReport, setSavingDailyReport] = useState(false)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [{ data: invoiceRows, error: invoiceError }, { data: serviceRows, error: serviceError }] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('service_requests').select('*').order('created_at', { ascending: false }).limit(1000),
    ])
    if (invoiceError) setError(invoiceError.message)
    else if (serviceError) setError(serviceError.message)
    setInvoices((invoiceRows || []) as InvoiceRow[])
    setServices((serviceRows || []) as ServiceRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const visibleInvoices = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return invoices.filter(invoice => {
      const dayMatches = [invoice.invoice_date, invoice.service_date, invoice.created_at].some(value => sameDay(value, selectedDate))
      const text = [invoice.invoice_number, invoice.client_name, invoice.customer_name, invoice.client_id, invoice.notes].join(' ').toLowerCase()
      return dayMatches && (!needle || text.includes(needle))
    })
  }, [invoices, query, selectedDate])

  const visibleServices = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return services.filter(service => {
      const dayMatches = [service.preferred_date, service.scheduled_date, service.created_at].some(value => sameDay(value, selectedDate))
      const text = [service.service_type, service.jobsite_address, service.service_address, service.bin_number, service.notes].join(' ').toLowerCase()
      return dayMatches && (!needle || text.includes(needle))
    })
  }, [query, selectedDate, services])

  const demoReport = useMemo(() => DEMO_DAILY_REPORTS.find(report => report.date === selectedDate), [selectedDate])
  const demoEvents = useMemo(() => demoReport?.events || [], [demoReport])
  const filteredDemoEvents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return demoEvents.filter(event => {
      const text = [event.binNumber, event.clientName, event.projectName, event.operation, event.comments].join(' ').toLowerCase()
      return !needle || text.includes(needle)
    })
  }, [demoEvents, query])
  const visibleDemoInvoices = useMemo(() => demoInvoiceRows(filteredDemoEvents), [filteredDemoEvents])
  const displayInvoices = useMemo(() => (
    visibleInvoices.length > 0 ? visibleInvoices : visibleDemoInvoices
  ), [visibleDemoInvoices, visibleInvoices])
  const realServiceBinSet = useMemo(() => new Set(visibleServices.flatMap(service => [service.bin_number, service.notes?.match(/\b\d{4,}\b/)?.[0]].filter(Boolean) as string[])), [visibleServices])
  const unmatchedDailyEvents = filteredDemoEvents.filter(event => realServiceBinSet.size > 0 && !realServiceBinSet.has(event.binNumber))
  const operationTotals = demoReport?.totals || {
    delivery: visibleServices.filter(service => service.service_type === 'delivery').length,
    pickup: visibleServices.filter(service => service.service_type === 'removal' || service.service_type === 'pickup').length,
    water_removal: visibleServices.filter(service => service.service_type === 'pump_out' || service.service_type === 'water_removal').length,
    relocate: visibleServices.filter(service => service.service_type === 'relocate').length,
  }

  const totals = useMemo(() => {
    const activeRows = invoices.filter(invoice => !['paid', 'void', 'cancelled'].includes(invoice.status || ''))
    return {
      dayRevenue: displayInvoices.reduce((sum, invoice) => sum + Number(invoice.total || invoice.amount || 0), 0),
      activeBalance: activeRows.reduce((sum, invoice) => sum + Number(invoice.balance || invoice.total || invoice.amount || 0), 0),
      paidTotal: invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + Number(invoice.total || invoice.amount || 0), 0),
      openCount: displayInvoices.filter(invoice => invoice.status !== 'paid').length,
      dailyOps: operationTotals.delivery + operationTotals.pickup + operationTotals.water_removal + operationTotals.relocate,
    }
  }, [displayInvoices, invoices, operationTotals.delivery, operationTotals.pickup, operationTotals.relocate, operationTotals.water_removal])

  const billingLinesForDay = useMemo(() => (batch?.lines || []).filter(line => line.date === selectedDate || !selectedDate), [batch, selectedDate])
  const unmatchedBillingLines = useMemo(() => billingLinesForDay.filter(line => {
    const bin = line.memo.match(/\b\d{4,}\b/)?.[0] || line.item.match(/\b\d{4,}\b/)?.[0] || ''
    if (!bin) return false
    return !visibleServices.some(service => service.bin_number === bin || service.notes?.includes(bin))
  }), [billingLinesForDay, visibleServices])

  const handleFile = async (file?: File) => {
    if (!file) return
    setError('')
    setMessage('')
    try {
      const parsed = await parseBillingWorkbook(file)
      setBatch(parsed)
      if (parsed.lines[0]?.date) setSelectedDate(parsed.lines[0].date)
      setMessage(`Parsed ${parsed.lines.length} billing lines from ${file.name}. Review the trace before saving.`)
    } catch (err) {
      setBatch(null)
      const text = err instanceof Error ? err.message : 'Could not parse billing file.'
      if (text.startsWith('This is an Orlando operations report')) {
        setMessage(text)
      } else {
        setError(text)
      }
    }
  }

  const saveBillingBatch = async () => {
    if (!batch || batch.lines.length === 0) return
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const uniqueInvoices = Array.from(new Map(batch.lines.map(line => [line.invoiceNumber, line])).values())
      let saved = 0
      const warnings: string[] = []

      for (const invoice of uniqueInvoices) {
        const invoiceLines = batch.lines.filter(line => line.invoiceNumber === invoice.invoiceNumber)
        const total = invoiceLines.reduce((sum, line) => sum + line.amount, 0)
        const payload = {
          invoice_number: invoice.invoiceNumber,
          client_name: invoice.clientName,
          customer_name: invoice.clientName,
          project_name: invoice.projectName,
          total,
          amount: total,
          balance: invoiceLines.at(-1)?.balance || total,
          status: total <= 0 ? 'paid' : 'open',
          invoice_date: invoice.date || null,
          service_date: invoice.date || null,
          source_file: batch.fileName,
          source_row: invoice.sourceRow,
          audit_hash: hashLine(invoice),
          notes: JSON.stringify({ importedAt: batch.importedAt, lineCount: invoiceLines.length, lines: invoiceLines.map(line => ({ memo: line.memo, item: line.item, qty: line.qty, rate: line.rate, amount: line.amount, balance: line.balance, sourceRow: line.sourceRow })) }),
        }

        const { data: existing } = await supabase.from('invoices').select('id').eq('invoice_number', invoice.invoiceNumber).limit(1)
        const { error: saveError } = existing?.[0]?.id
          ? await supabase.from('invoices').update(payload).eq('id', existing[0].id)
          : await supabase.from('invoices').insert(payload)
        if (saveError) warnings.push(`${invoice.invoiceNumber}: ${saveError.message}`)
        else saved++
      }

      const eventRows = batch.lines.map(line => ({
        event_date: line.date || null,
        event_type: 'billing_line',
        source_file: batch.fileName,
        source_row: line.sourceRow,
        client_name: line.clientName,
        project_name: line.projectName,
        invoice_number: line.invoiceNumber,
        bin_number: line.memo.match(/\b\d{4,}\b/)?.[0] || line.item.match(/\b\d{4,}\b/)?.[0] || null,
        amount: line.amount,
        balance: line.balance,
        audit_hash: hashLine(line),
        payload: line.raw,
      }))
      const { error: traceError } = await supabase.from('billing_events').insert(eventRows)
      if (traceError) warnings.push(`Audit trace: ${traceError.message}`)

      await load()
      setMessage(warnings.length ? `Saved ${saved} invoices with ${warnings.length} warning(s): ${warnings.join(' | ')}` : `Saved ${saved} invoices and ${eventRows.length} audit trace lines.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save billing batch.')
    } finally {
      setSaving(false)
    }
  }

  const saveDailyReport = async () => {
    if (!demoReport || demoEvents.length === 0) return
    setSavingDailyReport(true)
    setError('')
    setMessage('')
    try {
      await supabase
        .from('daily_operation_events')
        .delete()
        .eq('event_date', demoReport.date)
        .eq('source_file', demoReport.sourceFile)

      const payload = demoEvents.map(event => ({
        event_date: event.date,
        source_file: demoReport.sourceFile,
        source_sheet: demoReport.sourceSheet,
        source_row: event.sourceRow,
        client_name: event.clientName,
        project_name: event.projectName,
        bin_number: event.binNumber,
        operation: event.operation,
        bin_type: event.binType,
        comments: event.comments || null,
        audit_hash: hashOperation(event),
      }))
      const { error: saveError } = await supabase.from('daily_operation_events').insert(payload)
      if (saveError) throw saveError
      setMessage(`Saved ${payload.length} daily operation rows for ${demoReport.date}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save daily report. Run the updated Supabase repair SQL first.')
    } finally {
      setSavingDailyReport(false)
    }
  }

  const exportAuditDay = () => {
    const invoiceRows = displayInvoices.map(invoice => ({
      type: 'invoice',
      date: asDateInput(invoice.invoice_date || invoice.service_date || invoice.created_at),
      number: invoice.invoice_number,
      client: invoice.client_name || invoice.customer_name || invoice.client_id,
      amount: invoice.total || invoice.amount,
      balance: invoice.balance,
      status: invoice.status,
      audit_hash: invoice.audit_hash,
      source_file: invoice.source_file,
      source_row: invoice.source_row,
    }))
    const serviceRows = visibleServices.map(service => ({
      type: 'service',
      date: asDateInput(service.preferred_date || service.scheduled_date || service.created_at),
      number: service.id,
      client: '',
      amount: '',
      balance: '',
      status: service.status,
      audit_hash: '',
      source_file: '',
      source_row: '',
      bin: service.bin_number,
      address: service.jobsite_address || service.service_address,
      notes: service.notes,
    }))
    const operationRows = filteredDemoEvents.map(event => ({
      type: 'daily_operation',
      date: event.date,
      number: event.binNumber,
      client: event.clientName,
      project: event.projectName,
      operation: event.operation,
      amount: '',
      balance: '',
      status: operationLabel(event.operation),
      audit_hash: hashOperation(event),
      source_file: demoReport?.sourceFile,
      source_row: event.sourceRow,
      bin: event.binNumber,
      address: event.projectName,
      notes: event.comments,
    }))
    downloadCsv(`sitesync-audit-${selectedDate}.csv`, [...invoiceRows, ...serviceRows, ...operationRows])
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing & Audit Trace</h1>
          <p className="text-slate-400 mt-1">Daily invoice lookup, balance review, source-file traceability, and service reconciliation.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input type="date" className="input w-full sm:w-auto" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} />
          <input className="input w-full sm:w-64" placeholder="Search invoice, client, bin, address..." value={query} onChange={event => setQuery(event.target.value)} />
          <button onClick={load} className="btn-secondary px-4 py-2">Refresh</button>
          <button onClick={exportAuditDay} disabled={!displayInvoices.length && !visibleServices.length && !filteredDemoEvents.length} className="btn-primary px-4 py-2 disabled:opacity-50">Export Day</button>
        </div>
      </div>

      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100/90">
        Audit note: SiteSync can preserve source files, line-level hashes, invoice totals, and service traces. Final tax treatment, retention policy, and IRS response should still be reviewed by your CPA.
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Five-day demo daily reports</div>
            <div className="text-xs text-slate-500">Loaded from the Orlando report workbook for fast audit/demo review.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEMO_DAILY_REPORTS.map(report => (
              <button
                key={report.date}
                type="button"
                onClick={() => setSelectedDate(report.date)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${selectedDate === report.date ? 'border-sky-500/50 bg-sky-500/20 text-sky-200' : 'border-slate-700 text-slate-400 hover:text-white'}`}
              >
                {new Date(`${report.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Day Revenue', value: money(totals.dayRevenue), className: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
          { label: 'Active Balance', value: money(totals.activeBalance), className: 'bg-red-500/10 text-red-400 border-red-500/20' },
          { label: 'Open Invoices', value: totals.openCount, className: 'bg-slate-700/40 text-white border-slate-600/40' },
          { label: 'Daily Ops', value: totals.dailyOps, className: 'bg-green-500/10 text-green-400 border-green-500/20' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border px-4 py-3 ${stat.className}`}>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <label
        onDragOver={event => event.preventDefault()}
        onDrop={event => { event.preventDefault(); handleFile(event.dataTransfer.files[0]) }}
        className="block rounded-2xl border border-dashed border-sky-500/40 bg-sky-500/10 px-6 py-8 text-center cursor-pointer hover:border-sky-400 transition-colors"
      >
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={event => handleFile(event.target.files?.[0])} />
        <div className="text-lg font-semibold text-white">Drop billing export here</div>
        <div className="text-sm text-slate-400 mt-2">Supports reports like Report_from_Atlantic_Concrete_Washout,_Inc.xlsx with Type, Date, Num, Memo, Item, Qty, Sales Price, Amount, and Balance columns.</div>
      </label>

      <section className="card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-white">Daily Operations Report for {selectedDate}</h2>
            <p className="text-xs text-slate-500">
              {demoReport ? `${demoReport.sourceFile} sheet ${demoReport.sourceSheet}` : 'Live service activity only. Choose one of the demo dates above to view Orlando report rows.'}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="grid grid-cols-4 gap-2 text-center">
              {([
                ['Drops', operationTotals.delivery, 'text-green-400'],
                ['Pickups', operationTotals.pickup, 'text-sky-400'],
                ['Water', operationTotals.water_removal, 'text-yellow-400'],
                ['Relocate', operationTotals.relocate, 'text-purple-400'],
              ] as const).map(([label, value, color]) => (
                <div key={label} className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2">
                  <div className={`text-lg font-bold ${color}`}>{value}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
                </div>
              ))}
            </div>
            {demoReport && (
              <button onClick={saveDailyReport} disabled={savingDailyReport} className="btn-secondary px-4 py-2 text-xs">
                {savingDailyReport ? 'Saving...' : 'Save Daily Report'}
              </button>
            )}
          </div>
        </div>

        {filteredDemoEvents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-700/50">
                  <th className="px-3 py-2 text-left">Bin</th>
                  <th className="px-3 py-2 text-left">Company</th>
                  <th className="px-3 py-2 text-left">Project</th>
                  <th className="px-3 py-2 text-left">Operation</th>
                  <th className="px-3 py-2 text-left">Comments</th>
                  <th className="px-3 py-2 text-left">Trace</th>
                </tr>
              </thead>
              <tbody>
                {filteredDemoEvents.map(event => (
                  <tr key={event.id} className="border-b border-slate-700/30 last:border-0">
                    <td className="px-3 py-2 font-mono text-white">{event.binNumber}</td>
                    <td className="px-3 py-2 text-slate-300">{event.clientName}</td>
                    <td className="px-3 py-2 text-slate-300">{event.projectName}</td>
                    <td className="px-3 py-2"><span className={`rounded-full border px-2 py-0.5 text-xs ${operationClass(event.operation)}`}>{operationLabel(event.operation)}</span></td>
                    <td className="px-3 py-2 text-slate-400">{event.comments || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-sky-300">{hashOperation(event)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">No demo daily report rows found for this day.</p>
        )}

        {unmatchedDailyEvents.length > 0 && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
            {unmatchedDailyEvents.length} demo operation row(s) are not matched to live service records yet. Import the daily report into Supabase to reconcile them automatically.
          </div>
        )}
      </section>

      {batch && (
        <div className="card space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-white">Source Trace Preview</h2>
              <p className="text-xs text-slate-500">{batch.fileName} | {batch.lines.length} lines | {money(batch.totalAmount)} total | {money(batch.endingBalance)} ending balance</p>
            </div>
            <button onClick={saveBillingBatch} disabled={saving} className="btn-primary px-4 py-2">{saving ? 'Saving...' : 'Save Billing Trace'}</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-700/50">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Invoice</th>
                  <th className="px-3 py-2 text-left">Client / Project</th>
                  <th className="px-3 py-2 text-left">Memo / Item</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-left">Trace</th>
                </tr>
              </thead>
              <tbody>
                {billingLinesForDay.slice(0, 50).map(line => (
                  <tr key={line.id} className="border-b border-slate-700/30 last:border-0">
                    <td className="px-3 py-2 text-slate-300">{line.date}</td>
                    <td className="px-3 py-2 font-mono text-white">{line.invoiceNumber}</td>
                    <td className="px-3 py-2 text-slate-300">{line.clientName}<div className="text-xs text-slate-500">{line.projectName}</div></td>
                    <td className="px-3 py-2 text-slate-300">{line.memo || line.item}<div className="text-xs text-slate-500">{line.qty} x {money(line.rate)}</div></td>
                    <td className="px-3 py-2 text-right text-white">{money(line.amount)}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{money(line.balance)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-sky-300">{hashLine(line)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unmatchedBillingLines.length > 0 && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
              {unmatchedBillingLines.length} billing line(s) mention bins that are not matched to service activity for {selectedDate}. Review before finalizing.
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="card space-y-3">
          <h2 className="font-semibold text-white">Invoices for {selectedDate}</h2>
          {loading ? <p className="text-slate-400 text-sm">Loading billing records...</p> : displayInvoices.length > 0 ? displayInvoices.map(invoice => {
            const amount = invoice.total || invoice.amount || 0
            const invoiceNumber = invoice.invoice_number || invoice.id.slice(0, 8)
            return (
              <div key={invoice.id} className="rounded-lg bg-slate-700/30 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{invoiceNumber}</div>
                    <div className="text-xs text-slate-500">{invoice.client_name || invoice.customer_name || invoice.client_id || 'Client not linked'}</div>
                    {invoice.source_file && <div className="text-xs text-sky-300 mt-1">{invoice.source_file} row {invoice.source_row || '-'}</div>}
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs capitalize ${statusClass(invoice.status)}`}>{invoice.status || 'draft'}</span>
                    <div className="text-white font-semibold mt-1">{money(amount)}</div>
                  </div>
                </div>
                {invoice.audit_hash && <div className="mt-2 font-mono text-xs text-slate-500">Trace {invoice.audit_hash}</div>}
              </div>
            )
          }) : <p className="text-slate-400 text-sm">No invoices found for this day.</p>}
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold text-white">Service Trace for {selectedDate}</h2>
          {visibleServices.length > 0 ? visibleServices.map(service => (
            <div key={service.id} className="rounded-lg bg-slate-700/30 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-white capitalize">{(service.service_type || 'service').replace(/_/g, ' ')}</div>
                  <div className="text-xs text-slate-500">{service.jobsite_address || service.service_address || 'No address'}</div>
                  {service.bin_number && <div className="text-xs text-sky-300 mt-1">Bin #{service.bin_number}</div>}
                </div>
                <span className="rounded-full border border-slate-600/50 bg-slate-700/40 px-2 py-0.5 text-xs text-slate-300 capitalize">{service.status || 'unknown'}</span>
              </div>
              {service.notes && <div className="text-xs text-slate-400 mt-2">{service.notes}</div>}
            </div>
          )) : <p className="text-slate-400 text-sm">No service activity found for this day.</p>}
        </section>
      </div>
    </div>
  )
}
