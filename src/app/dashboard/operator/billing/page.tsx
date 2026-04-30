import { createClient } from '@/lib/supabase/server'

function money(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function statusClass(status?: string) {
  if (status === 'paid') return 'bg-green-500/10 text-green-400 border-green-500/30'
  if (status === 'overdue') return 'bg-red-500/10 text-red-400 border-red-500/30'
  if (status === 'open') return 'bg-sky-500/10 text-sky-400 border-sky-500/30'
  return 'bg-slate-700/40 text-slate-400 border-slate-600/40'
}

export default async function BillingPage() {
  const supabase = createClient()
  const { data: invoices } = await supabase.from('invoices').select('*').order('created_at', { ascending: false })
  const rows = invoices || []
  const activeRows = rows.filter((invoice: any) => !['paid', 'void', 'cancelled'].includes(invoice.status))
  const activeBalance = activeRows.reduce((sum: number, invoice: any) => sum + Number(invoice.total || invoice.amount || 0), 0)
  const paidTotal = rows.filter((invoice: any) => invoice.status === 'paid').reduce((sum: number, invoice: any) => sum + Number(invoice.total || invoice.amount || 0), 0)
  const overdueTotal = rows.filter((invoice: any) => invoice.status === 'overdue').reduce((sum: number, invoice: any) => sum + Number(invoice.total || invoice.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing</h1>
          <p className="text-slate-400 mt-1">Review invoices, active balances, and customer billing actions.</p>
        </div>
        <a href="/dashboard/operator/onboarding" className="btn-primary px-4 py-2 text-sm">Add Balance</a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-600/40 bg-slate-700/40 px-4 py-3"><div className="text-2xl font-bold text-white">{rows.length}</div><div className="text-slate-500 text-xs mt-0.5">Invoices</div></div>
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3"><div className="text-2xl font-bold text-sky-400">{money(activeBalance)}</div><div className="text-slate-500 text-xs mt-0.5">Active Balance</div></div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3"><div className="text-2xl font-bold text-red-400">{money(overdueTotal)}</div><div className="text-slate-500 text-xs mt-0.5">Overdue</div></div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3"><div className="text-2xl font-bold text-green-400">{money(paidTotal)}</div><div className="text-slate-500 text-xs mt-0.5">Paid</div></div>
      </div>

      <div className="card space-y-3">
        {rows.length > 0 ? rows.map((invoice: any) => {
          const amount = invoice.total || invoice.amount || 0
          const customerEmail = invoice.email || invoice.client_email || ''
          const invoiceNumber = invoice.invoice_number || invoice.id.slice(0, 8)
          const mailto = `mailto:${customerEmail}?subject=${encodeURIComponent(`Invoice ${invoiceNumber}`)}&body=${encodeURIComponent(`Your current SiteSync Pro balance is ${money(amount)}.`)}`
          return (
            <div key={invoice.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-slate-700/30 px-4 py-3">
              <div>
                <div className="font-medium text-white">{invoiceNumber}</div>
                <div className="text-xs text-slate-500">{invoice.client_name || invoice.customer_name || invoice.client_id || 'Client not linked'}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${statusClass(invoice.status)}`}>{invoice.status || 'draft'}</span>
                <div className="text-right text-white font-semibold min-w-24">{money(amount)}</div>
                {customerEmail ? <a href={mailto} className="btn-secondary px-3 py-1.5 text-xs">Send</a> : <span className="text-xs text-slate-500">No email</span>}
              </div>
            </div>
          )
        }) : <p className="text-slate-400 text-sm">No invoices found.</p>}
      </div>
    </div>
  )
}
