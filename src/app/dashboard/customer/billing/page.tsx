'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculatePrice, money, type PriceLine, type ServiceCode } from '@/lib/pricing'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import CustomerAccessLink from '@/components/customer/CustomerAccessLink'

type InvoiceRow = {
  id: string
  client_id?: string | null
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

type BillingEventRow = {
  id: string
  event_date?: string | null
  charge_type?: string | null
  event_type?: string | null
  amount?: number | string | null
  note?: string | null
  photo_url?: string | null
  project_name?: string | null
  bin_number?: string | null
  status?: string | null
}

function relationMissing(error: any) {
  const message = String(error?.message || '')
  return error?.code === '42P01' || /does not exist|schema cache/i.test(message)
}

function invoiceFilter(email: string, clientIds: string[]) {
  const clauses: string[] = []
  const cleanEmail = email.trim().toLowerCase()

  if (cleanEmail) {
    clauses.push(`email.eq.${cleanEmail}`, `client_email.eq.${cleanEmail}`)
  }
  if (clientIds.length) {
    clauses.push(`client_id.in.(${clientIds.join(',')})`)
  }

  return clauses.length ? clauses.join(',') : 'id.is.null'
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
  const [showAccessLink, setShowAccessLink] = useState(false)
  const [charges, setCharges] = useState<BillingEventRow[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      try {
        let linkedClientIds: string[] = []
        if (user?.id) {
          const { data: linkedAccounts, error: linkedError } = await supabase
            .from('customer_accounts')
            .select('client_id')
            .eq('user_id', user.id)
            .eq('status', 'active')

          if (linkedError && !relationMissing(linkedError)) throw linkedError
          linkedClientIds = (linkedAccounts || []).map((row: any) => row.client_id).filter(Boolean)
        }

        const rows = await fetchAllRows<InvoiceRow>((from, to) =>
          {
            const base = supabase
            .from('invoices')
            .select('id,client_id,invoice_number,client_name,customer_name,total,amount,balance,status,invoice_date,service_date,notes,email,client_email')
            return base
            .or(invoiceFilter(user?.email || '', linkedClientIds))
            .order('invoice_date', { ascending: false })
            .range(from, to)
          }
        )
        if (linkedClientIds.length) {
          const { data: chargeRows, error: chargeError } = await supabase
            .from('billing_events')
            .select('id,event_date,charge_type,event_type,amount,note,photo_url,project_name,bin_number,status')
            .in('client_id', linkedClientIds)
            .order('event_date', { ascending: false })
            .limit(50)

          if (chargeError && !relationMissing(chargeError)) throw chargeError
          setCharges(chargeRows || [])
        } else {
          setCharges([])
        }
        setShowAccessLink(linkedClientIds.length === 0 && rows.length === 0)
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
      {showAccessLink && <CustomerAccessLink />}

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
          {charges.length > 0 && (
            <section className="card">
              <h2 className="text-lg font-semibold text-white">Driver-documented charges</h2>
              <p className="mt-1 text-sm text-slate-400">Photo-backed charges appear here before they are finalized on an invoice.</p>
              <div className="mt-4 space-y-3">
                {charges.map(charge => (
                  <div key={charge.id} className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-white">{charge.charge_type || charge.event_type || 'Additional charge'}</div>
                        <div className="mt-1 text-sm text-slate-400">{charge.project_name || 'Project pending'}{charge.bin_number ? ` | Bin #${charge.bin_number}` : ''}</div>
                        {charge.note && <p className="mt-2 text-sm text-slate-300">{charge.note}</p>}
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-xl font-bold text-white">{money(Number(charge.amount || 0))}</div>
                        <div className="text-xs text-slate-500 capitalize">{charge.status || 'pending review'} | {charge.event_date || 'Date pending'}</div>
                      </div>
                    </div>
                    {charge.photo_url && (
                      <div className="mt-3 rounded-lg border border-slate-700/50 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
                        Photo evidence is stored securely and visible to the operator for review.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

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
