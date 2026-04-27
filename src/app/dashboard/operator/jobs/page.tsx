import { createClient } from '@/lib/supabase/server'
export default async function OperatorJobsPage() {
  const supabase = createClient()
  const { data: jobs } = await supabase.from('jobs').select('*,service_requests(service_type,jobsite_address,profiles(full_name,company_name))').order('scheduled_date',{ascending:true})
  const today = new Date().toISOString().split('T')[0]
  const todaysJobs = jobs?.filter((j:any)=>j.scheduled_date?.startsWith(today))??[]
  const upcomingJobs = jobs?.filter((j:any)=>j.ver_date&&j.scheduled_date>today)??[]
  return(<div className="space-y-8"><div><h1 className="text-2xl font-bold text-white">Jobs</h1><p className="text-slate-400 mt-1">Today&#27;;s schedule and upcoming jobs</p></div><div><h2 className="text-lg font-semibold text-white mb-3">Today ({todaysJobs.length})</h2>{todaysJobs.length>0?<div className="space-y-3">{todaysJobs.map((j:any)=>(<div key={j.id} className="card"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 mb-1"><h3 className="font-medium text-white">{j.service_requests?.service_type?.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}</h3><span className={`badge-${j.status} capitalize`}>{j.status?.replace(/_/g,' ')}</span></div><div className="text-sm text-slate-400 space-y-0.5"><div>📍 {j.service_requests?.jobsite_address}</div><div>👤 {j.service_requests?.profiles?.company_name??j.service_requests?.profiles?.full_name}</div>{j.scheduled_date&&<div>🔐 s{new Date(j.scheduled_date).toLocaleString()}</div>}</div></div></div></div>))}</div>:<div className="card text-center py-8"><p className="text-slate-400">No jobs today.</p></div>}</div></div>)
}
