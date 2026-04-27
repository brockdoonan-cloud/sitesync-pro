import { createClient } from '@/lib/supabase/server'
export default async function OperatorDashboard() {
  const supabase = createClient()
  const [{ count: pending },{ count: deployed },{ data: recent }] = await Promise.all([
    supabase.from('service_requests').select('*',{count:'exact',head:true}).eq('status','pending'),
    supabase.from('equipment').select('*',{count:'exact',head:true}).eq('status','deployed'),
    supabase.from('service_requests').select('*,profiles(full_name,company_name)').order('created_at',{ascending:false}).limit(5)
  ])
  const today = new Date().toISOString().split('T')[0]
  const { count: todayJobs } = await supabase.from('service_requests').select('*',{count:'exact',head:true}).gte('preferred_date',today).lte('preferred_date',today)
  return(<div className="space-y-8"><div><h1 className="text-2xl font-bold text-white">Operator Dashboard</h1><p className="text-slate-400 mt-1">Manage service requests and equipment across all job sites</p></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[{l:'Pending Requests',v:pending??0,c:'text-yellow-400',bg:'bg-yellow-500/10 border-yellow-500/20'},{l:'Jobs Today',v:todayJobs??0,c:'text-blue-400',bg:'bg-blue-500/10 border-blue-500/20'},{l:'Active Equipment',v:deployed??0,c:'text-green-400',bg:'bg-green-500/10 border-green-500/20'}].map(s=>(<div key={s.l} className={`card border ${s.bg}`}><div className={`text-3xl font-bold ${s.c}`}>{s.v}</div><div className="text-slate-400 text-sm mt-1">{s.l}</div></div>))}</div><div className="card"><h2 className="text-lg font-semibold text-white mb-4">Recent Service Requests</h2>{recent&&recent.length>0?<div className="space-y-3">{recent.map((r:any)=>(<div key={r.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"><div><div className="text-white font-medium text-sm">{r.service_type?.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}</div><div className="text-slate-400 text-xs mt-0.5">{r.profiles?.company_name??r.profiles?.full_name} · {r.jobsite_address}</div></div><span className={`badge-${r.status}`}>{r.status}</span></div>))}</div>:<p className="text-slate-400 text-sm">No service requests yet.</p>}</div></div>)
}
