import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function titleize(value?: string) {
  return value?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Service'
}

export default async function CustomerDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('full_name,company_name').eq('id', user!.id).single()
  const [{ data: requests }, { count: binCount }, { count: activeCount }] = await Promise.all([
    supabase.from('service_requests').select('*').eq('customer_id', user!.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('equipment').select('*', { count: 'exact', head: true }),
    supabase.from('equipment').select('*', { count: 'exact', head: true }).eq('status', 'deployed'),
  ])
  const activeRequests = requests?.filter((r: any) => ['pending', 'dispatch_ready', 'scheduled', 'confirmed', 'in_progress'].includes(r.status)).length ?? 0

  const actions = [
    { href: '/dashboard/customer/request', label: 'Request Service', desc: 'Schedule swap, pickup, or delivery' },
    { href: '/dashboard/customer/tracking', label: 'Live Tracking', desc: 'Track confirmed service' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
        {profile?.company_name && <p className="text-slate-400 mt-1">{profile.company_name}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Active Requests', value: activeRequests, className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
          { label: 'Tracked Bins', value: binCount ?? 0, className: 'bg-slate-700/40 text-white border-slate-600/40' },
          { label: 'On Site', value: activeCount ?? 0, className: 'bg-green-500/10 text-green-400 border-green-500/20' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border px-4 py-3 ${stat.className}`}>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {actions.map(action => (
          <Link key={action.href} href={action.href} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 transition-all hover:bg-slate-800/60 group">
            <div className="font-semibold text-white text-sm">{action.label}</div>
            <div className="text-slate-500 text-xs mt-1">{action.desc}</div>
          </Link>
        ))}
      </div>

      {requests && requests.length > 0 ? (
        <div>
          <h2 className="font-semibold text-white mb-3">Recent Requests</h2>
          <div className="space-y-2">
            {requests.map((req: any) => (
              <div key={req.id} className="bg-slate-800/40 border border-slate-700/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium">{titleize(req.service_type)}</div>
                  <div className="text-slate-500 text-xs truncate">{req.jobsite_address}</div>
                </div>
                <span className={`shrink-0 text-xs px-2.5 py-0.5 rounded-full font-medium ${req.status === 'completed' ? 'bg-green-500/20 text-green-400' : req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-sky-500/20 text-sky-400'}`}>{req.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-slate-400">No service requests yet.</p>
        </div>
      )}
    </div>
  )
}
