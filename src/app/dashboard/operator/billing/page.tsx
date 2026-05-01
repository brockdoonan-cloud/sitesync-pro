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

const today = new Date().toISOString().slice(0, 10)

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

function parseBillingWorkbook(file: File): Promise<BillingBatch> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read billing file.'))
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'array', cellDates: true })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
        const headerIndex = rows.findIndex(row => row.some(value => clean(value).toLowerCase() === 'type') && row.some(value => clean(value).toLowerCase() === 'amount'))
        if (headerIndex === -1) throw new Error('Could not find Type/Amount billing headers.')

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
  const [selectedDate, setSelectedDate] = useState(today)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [services, setServices] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [batch, setBatch] = useState<BillingBatch | null>(null)
  const [saving, setSaving] = useState(false)
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

  const totals = useMemo(() => {
    const activeRows = invoices.filter(invoice => !['paid', 'void', 'cancelled'].includes(invoice.status || ''))
    return {
      dayRevenue: visibleInvoices.reduce((sum, invoice) => sum + Number(invoice.total || invoice.amount || 0), 0),
      activeBalance: activeRows.reduce((sum, invoice) => sum + Number(invoice.balance || invoice.total || invoice.amount || 0), 0),
      paidTotal: invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + Number(invoice.total || invoice.amount || 0), 0),
      openCount: invoices.filter(invoice => invoice.status !== 'paid').length,
    }
  }, [invoices, visibleInvoices])

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
      setError(err instanceof Error ? err.message : 'Could not parse billing file.')
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

  const exportAuditDay = () => {
    const invoiceRows = visibleInvoices.map(invoice => ({
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
    downloadCsv(`sitesync-audit-${selectedDate}.csv`, [...invoiceRows, ...serviceRows])
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
          <button onClick={exportAuditDay} disabled={!visibleInvoices.length && !visibleServices.length} className="btn-primary px-4 py-2 disabled:opacity-50">Export Day</button>
        </div>
      </div>

      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100/90">
        Audit note: SiteSync can preserve source files, line-level hashes, invoice totals, and service traces. Final tax treatment, retention policy, and IRS response should still be reviewed by your CPA.
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
          { label: 'Service Events', value: visibleServices.length, className: 'bg-green-500/10 text-green-400 border-green-500/20' },
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
          {loading ? <p className="text-slate-400 text-sm">Loading billing records...</p> : visibleInvoices.length > 0 ? visibleInvoices.map(invoice => {
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
