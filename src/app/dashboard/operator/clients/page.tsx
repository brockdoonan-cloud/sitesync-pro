import { createClient } from '@/lib/supabase/server'
import PaginationControls from '@/components/PaginationControls'
import { paginate } from '@/lib/pagination'
import CustomerAccessCodeButton from '@/components/operator/CustomerAccessCodeButton'
import Link from 'next/link'

export default async function ClientsPage({ searchParams }: { searchParams?: Promise<{ page?: string }> }) {
  const supabase = await createClient()
  const resolvedSearchParams = await searchParams
  const pagination = paginate({ page: resolvedSearchParams?.page })
  let result = await supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(pagination.from, pagination.to)
  if (result.error && /created_at|order/i.test(result.error.message || '')) {
    result = await supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .range(pagination.from, pagination.to)
  }
  const rows = result.data || []
  const count = result.count || 0
  const total = count || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Clients</h1>
        <p className="text-slate-400 mt-1">Customer accounts linked to jobsites and equipment.</p>
      </div>
      {result.error && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          Clients loaded with a limited query because Supabase returned: {result.error.message}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(rows || []).length > 0 ? (rows || []).map((client: any) => (
          <div key={client.id} className="card">
            <Link href={`/dashboard/operator/clients/${client.id}`} className="font-semibold text-white hover:text-sky-300">{client.company_name || client.name || 'Unnamed client'}</Link>
            <div className="text-sm text-slate-400 mt-2 space-y-1">
              {client.contact_name && <div>Contact: {client.contact_name}</div>}
              {client.email && <div>Email: {client.email}</div>}
              {client.phone && <div>Phone: {client.phone}</div>}
              {client.status && <div>Status: {client.status}</div>}
            </div>
            <Link href={`/dashboard/operator/clients/${client.id}`} className="mt-4 inline-flex rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-sky-500/50 hover:text-white">Open Customer</Link>
            <CustomerAccessCodeButton clientId={client.id} />
          </div>
        )) : <div className="card text-center py-12 md:col-span-2 xl:col-span-3"><p className="text-slate-400">No clients found.</p></div>}
      </div>
      <div className="card p-0 overflow-hidden">
        <PaginationControls basePath="/dashboard/operator/clients" pagination={pagination} total={total} />
      </div>
    </div>
  )
}
