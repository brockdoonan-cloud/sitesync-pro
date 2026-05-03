'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculatePrice, money, type PriceLine, type ServiceCode } from '@/lib/pricing'
import { fetchAllRows } from '@/lib/supabase/fetchAll'

type InvoiceRow = {
  id: string
  invoice_number?: string | null
  client_name?: string | null
  customer_name?: string | null
  total?: number | string | null
  amount?: number | string | null
  balance?: number | string | null
  status?: string | null
  invoice_date?: string | null
  service_date?: string | null
  notes?: string | null
}

const demoItems = [
  { invoice: 'DEMO-ORL-001', serviceCode: 'swap' as ServiceCode, project: 'Project Neptune', bin: '61506', miles: 24 },
  { invoice: 'DEMO-ORL-002', serviceCode: 'pickup' as ServiceCode, project: 'Reserve of Twin Lakes', bin: '153596', miles: 28 },
  { invoice: 'DEMO-ORL-003', serviceCode: 'water_removal' as ServiceCode, project: 'HGR Mater Academy', bin: '41848', miles: 34 },
]

function parseLines(notes?: string | null): PriceLine[] {
  if (!notes) return []
  try {
    const parsed = JSON.parse(notes)
    return Array.isArray(parsed.pricingLines) ? parsed.pricingLines : []
  } catch {
    return []
  }
}

function demoInvoices(): InvoiceRow[] {
  return demoItems.map(item => {
    const price = calculatePrice({ serviceCode: item.serviceCode, quantity: 1, miles: item.miles })
    return {
      id: item.invoice,
      invoice_number: item.invoice,
      client_name: 'Demo Customer',
      total: price.total,
      balance: price.total,
      status: 'open',
      invoice_date: '2026-04-29',
      service_date: '2026-04-29',
      notes: JSON.stringify({ projectName: item.project, binNumber: item.bin, pricingLines: price.lines }),
    }
  })
}

export default function CustomerBillingPage() {
  const supabase = useMemo(() => createClient(), [])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      try {
        const rows = await fetchAllRows<InvoiceRow>((from, to) =>
          supabase
            .from('invoices')
            .select('id,invoice_number,client_name,customer_name,total,amount,balance,status,invoice_date,service_date,notes,email,client_email')
            .or(`email.eq.${user?.email || ''},client_email.eq.${user?.email || ''}`)
            .order('invoice_date', { ascending: false })
            .range(from, to)
        )
        setInvoices(rows.length ? rows : demoInvoices())
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Could not load invoices.')
        setInvoices(demoInvoices())
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  const totals = invoices.reduce((acc, invoice) => {
    const total = Number(invoice.total || invoice.amount || 0)
    const balance = Number(invoice.balance || total)
    acc.total += total
    if (invoice.status !== 'paid') acc.balance += balance
    return acc
  }, { total: 0, balance: 0 })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Project Billing</h1>
        <p className="text-slate-400 mt-1">Active invoice totals with line-by-line service, mileage, fuel, and environmental fees.</p>
      </div>

      {message && <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">{message}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sky-300">
          <div className="text-2xl font-bold">{money(totals.total)}</div>
          <div className="text-xs text-slate-500 mt-0.5">Project charges</div>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300">
          <div className="text-2xl font-bold">{money(totals.balance)}</div>
          <div className="text-xs text-slate-500 mt-0.5">Active balance</div>
        </div>
        <div className="rounded-xl border border-slate-600/40 bg-slate-800/50 px-4 py-3 text-white">
          <div className="text-2xl font-bold">{invoices.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Invoices</div>
        </div>
      </div>

      {loading ? (
        <div className="card text-slate-400">Loading billing...</div>
      ) : (
        <div className="space-y-4">
          {invoices.map(invoice => {
            const lines = parseLines(invoice.notes)
            const total = Number(invoice.total || invoice.amount || 0)
            const balance = Number(invoice.balance || total)
            const isOpen = openInvoiceId === invoice.id
            return (
              <section key={invoice.id} className="card overflow-hidden p-0">
                <button
                  type="button"
                  onClick={() => setOpenInvoiceId(isOpen ? null : invoice.id)}
                  className="flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-800/50 sm:flex-row sm:items-start sm:justify-between"
                  aria-expanded={isOpen}
                >
                  <div>
                    <h2 className="font-semibold text-white">{invoice.invoice_number || invoice.id.slice(0, 8)}</h2>
                    <p className="text-xs text-slate-500">{invoice.client_name || invoice.customer_name || 'Customer'} | {invoice.service_date || invoice.invoice_date || 'Date pending'}</p>
                    <p className="mt-1 text-xs text-sky-300">{isOpen ? 'Close invoice breakdown' : 'Open invoice breakdown'}</p>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-xl font-bold text-white">{money(total)}</div>
                    <div className="text-xs text-slate-500 capitalize">{invoice.status || 'open'} | Balance {money(balance)}</div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-700/50 px-5 py-4">
                    {lines.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-xs uppercase tracking-wide text-slate-500">
                            <tr className="border-b border-slate-700/50">
                              <th className="px-3 py-2 text-left">Charge</th>
                              <th className="px-3 py-2 text-right">Qty</th>
                              <th className="px-3 py-2 text-right">Rate</th>
                              <th className="px-3 py-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.map((line, index) => (
                              <tr key={`${line.label}-${index}`} className="border-b border-slate-700/30 last:border-0">
                                <td className="px-3 py-2 text-slate-200">{line.label}</td>
                                <td className="px-3 py-2 text-right text-slate-400">{line.quantity}</td>
                                <td className="px-3 py-2 text-right text-slate-400">{money(line.rate)}</td>
                                <td className="px-3 py-2 text-right text-white">{money(line.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
                        Imported invoice total. Detailed pricing lines will show for invoices created through SiteSync pricing.
                      </div>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
