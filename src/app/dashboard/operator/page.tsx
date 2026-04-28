import { createClient } from '@/lib/supabase/server'

export default async function OperatorDashboard() {
  const supabase = createClient()

  const [
    { count: pendingCount },
    { count: jobsToday },
    { count: equipmentCount },
    { data: recentRequests },
  ] = await Promise.all([
    supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).gte('scheduled_date', new Date().toISOString().split('T')[0]),
    supabase.from('equipment').select('*', { count: 'exact', head: true }).eq('status', 'deployed'),
    supabase.from('service_requests').select('*, profiles(full_name, company_name)').order('created_at', { ascending: false }).limit(5),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Operator Dashboard</h1>
        <p className="text-slate-400 mt-1">Manage service requests and equipment across all job sites</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Pending Requests', value: pendingCount ?? 0, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
          { label: 'Jobs Today', value: jobsToday ?? 0, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Active Equipment', value: equipmentCount ?? 0, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
        ].map(s => (
          <div key={s.label} className={`card border ${s.bg}`}>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-slate-400 text-sm mt-1">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Service Requests</h2>
        {recentRequests && recentRequests.length > 0 ? (
          <div className="space-y-3">
            {recentRequests.map((req: any) => (
              <div key={req.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div><div className="text-white font-medium text-sm">{req.service_type?.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}</div><div className="text-slate-400 text-xs mt-0.5">{req.profiles?.company_name??req.profiles?.full_name} · {req.jobsite_address}</div></div>
                <span className={`badge-${req.status}`}>{req.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">No service requests yet.</p>
        )}
      </div>
    </div>
  )
}
