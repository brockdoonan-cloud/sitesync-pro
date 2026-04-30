import { createClient } from '@/lib/supabase/server'

export default async function BillingPage() {
  const supabase = createClient()
  const { data: invoices } = await supabase.from('invoices').select('*').order('created_at', { ascending: false })
  const rows = invoices || []
  const total = rows.reduce((sum: number, invoice: any) => sum + Number(invoice.total || invoice.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-slate-400 mt-1">Review invoices and payment status.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-600/40 bg-slate-700/40 px-4 py-3"><div className="text-2xl font-bold text-white">{rows.length}</div><div className="text-slate-500 text-xs mt-0.5">Invoices</div></div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3"><div className="text-2xl font-bold text-green-400">${total.toLocaleString()}</div><div className="text-slate-500 text-xs mt-0.5">Tracked Total</div></div>
      </div>
      <div className="card space-y-3">
        {rows.length > 0 ? rows.map((invoice: any) => (
          <div key={invoice.id} className="flex items-center justify-between rounded-lg bg-slate-700/30 px-4 py-3">
            <div><div className="font-medium text-white">{invoice.invoice_number || invoice.id.slice(0, 8)}</div><div className="text-xs text-slate-500">{invoice.status || 'draft'}</div></div>
            <div className="text-right text-white font-semibold">${Number(invoice.total || invoice.amount || 0).toLocaleString()}</div>
          </div>
        )) : <p className="text-slate-400 text-sm">No invoices found.</p>}
      </div>
    </div>
  )
}
