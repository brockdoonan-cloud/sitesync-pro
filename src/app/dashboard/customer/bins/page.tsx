import { createClient } from '@/lib/supabase/server'
import PaginationControls from '@/components/PaginationControls'
import { paginate } from '@/lib/pagination'

function statusClass(status?: string) {
  if (status === 'deployed') return 'bg-green-500/10 text-green-400 border-green-500/30'
  if (status === 'in_transit') return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30'
  if (status === 'needs_swap' || status === 'full') return 'bg-red-500/10 text-red-400 border-red-500/30'
  return 'bg-slate-700/40 text-slate-400 border-slate-600/40'
}

export default async function CustomerBinsPage({ searchParams }: { searchParams?: Promise<{ page?: string }> }) {
  const supabase = await createClient()
  const resolvedSearchParams = await searchParams
  const pagination = paginate({ page: resolvedSearchParams?.page })
  const { data: rows, count } = await supabase
    .from('equipment')
    .select('id,bin_number,status,location,last_serviced_at', { count: 'exact' })
    .order('bin_number', { ascending: true })
    .range(pagination.from, pagination.to)
  const total = count || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Bins</h1>
        <p className="text-slate-400 mt-1">Containers currently visible to your customer account.</p>
      </div>

      <div className="card overflow-hidden p-0">
        {(rows || []).length > 0 ? (rows || []).map((item: any) => (
          <div key={item.id} className="grid grid-cols-12 gap-3 border-b border-slate-700/30 px-4 py-3 text-sm last:border-0">
            <div className="col-span-3 font-mono text-white">#{item.bin_number || item.id.slice(0, 8)}</div>
            <div className="col-span-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs capitalize ${statusClass(item.status)}`}>{item.status || 'unknown'}</span></div>
            <div className="col-span-4 truncate text-slate-300">{item.location || 'Unassigned'}</div>
            <div className="col-span-2 text-right text-slate-500">{item.last_serviced_at ? new Date(item.last_serviced_at).toLocaleDateString() : '-'}</div>
          </div>
        )) : (
          <div className="px-4 py-10 text-center text-sm text-slate-400">No bins are linked to this account yet.</div>
        )}
        <PaginationControls basePath="/dashboard/customer/bins" pagination={pagination} total={total} />
      </div>
    </div>
  )
}
