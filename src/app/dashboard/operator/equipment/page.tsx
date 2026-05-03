import { createClient } from '@/lib/supabase/server'
import PaginationControls from '@/components/PaginationControls'
import { paginate } from '@/lib/pagination'

function statusClass(status?: string) {
  if (status === 'deployed') return 'bg-green-500/10 text-green-400 border-green-500/30'
  if (status === 'available') return 'bg-sky-500/10 text-sky-400 border-sky-500/30'
  if (status === 'in_transit') return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30'
  if (status === 'needs_swap' || status === 'full') return 'bg-red-500/10 text-red-400 border-red-500/30'
  if (status === 'maintenance') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
  return 'bg-slate-700/40 text-slate-400 border-slate-600/40'
}

export default async function EquipmentPage({ searchParams }: { searchParams?: { page?: string } }) {
  const supabase = createClient()
  const pagination = paginate({ page: searchParams?.page })
  const [rowsResult, totalUnits, deployed, available, inTransit, swapNeeded] = await Promise.all([
    supabase
      .from('equipment')
      .select('id,bin_number,status,location,client_id,jobsite_id,last_serviced_at,created_at', { count: 'exact' })
      .order('bin_number', { ascending: true })
      .range(pagination.from, pagination.to),
    supabase.from('equipment').select('id', { count: 'exact', head: true }),
    supabase.from('equipment').select('id', { count: 'exact', head: true }).eq('status', 'deployed'),
    supabase.from('equipment').select('id', { count: 'exact', head: true }).eq('status', 'available'),
    supabase.from('equipment').select('id', { count: 'exact', head: true }).eq('status', 'in_transit'),
    supabase.from('equipment').select('id', { count: 'exact', head: true }).in('status', ['needs_swap', 'full']),
  ])
  const rows = rowsResult.data || []
  const total = rowsResult.count || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Equipment</h1>
        <p className="text-slate-400 mt-1">Track bins, availability, and swap needs.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Units', value: totalUnits.count || 0, className: 'bg-slate-700/40 text-white border-slate-600/40' },
          { label: 'Deployed', value: deployed.count || 0, className: 'bg-green-500/10 text-green-400 border-green-500/20' },
          { label: 'Available', value: available.count || 0, className: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
          { label: 'In Transit', value: inTransit.count || 0, className: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20' },
          { label: 'Needs Swap', value: swapNeeded.count || 0, className: 'bg-red-500/10 text-red-400 border-red-500/20' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border px-4 py-3 ${stat.className}`}>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-700/50">
          <div className="col-span-3">Unit</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-4">Location</div>
          <div className="col-span-2 text-right">Last Service</div>
        </div>
        {rows.length > 0 ? rows.map((item: any) => (
          <div key={item.id} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-slate-700/30 last:border-0 text-sm">
            <div className="col-span-3 font-mono text-white">#{item.bin_number || item.id.slice(0, 8)}</div>
            <div className="col-span-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs capitalize ${statusClass(item.status)}`}>{item.status || 'unknown'}</span></div>
            <div className="col-span-4 text-slate-300 truncate">{item.location || item.jobsite_id || 'Unassigned'}</div>
            <div className="col-span-2 text-right text-slate-500">{item.last_serviced_at ? new Date(item.last_serviced_at).toLocaleDateString() : '-'}</div>
          </div>
        )) : (
          <div className="px-4 py-10 text-center text-slate-400 text-sm">No equipment found.</div>
        )}
        <PaginationControls basePath="/dashboard/operator/equipment" pagination={pagination} total={total} />
      </div>
    </div>
  )
}
