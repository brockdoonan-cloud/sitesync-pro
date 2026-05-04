import { createClient } from '@/lib/supabase/server'
import PaginationControls from '@/components/PaginationControls'
import { paginate } from '@/lib/pagination'

export default async function ClientsPage({ searchParams }: { searchParams?: Promise<{ page?: string }> }) {
  const supabase = await createClient()
  const resolvedSearchParams = await searchParams
  const pagination = paginate({ page: resolvedSearchParams?.page })
  const { data: rows, count } = await supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(pagination.from, pagination.to)
  const total = count || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Clients</h1>
        <p className="text-slate-400 mt-1">Customer accounts linked to jobsites and equipment.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(rows || []).length > 0 ? (rows || []).map((client: any) => (
          <div key={client.id} className="card">
            <div className="font-semibold text-white">{client.company_name || client.name || 'Unnamed client'}</div>
            <div className="text-sm text-slate-400 mt-2 space-y-1">
              {client.contact_name && <div>Contact: {client.contact_name}</div>}
              {client.email && <div>Email: {client.email}</div>}
              {client.phone && <div>Phone: {client.phone}</div>}
              {client.status && <div>Status: {client.status}</div>}
            </div>
          </div>
        )) : <div className="card text-center py-12 md:col-span-2 xl:col-span-3"><p className="text-slate-400">No clients found.</p></div>}
      </div>
      <div className="card p-0 overflow-hidden">
        <PaginationControls basePath="/dashboard/operator/clients" pagination={pagination} total={total} />
      </div>
    </div>
  )
}
