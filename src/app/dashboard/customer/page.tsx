'use client'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
export default async function CustomerDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('full_name,company_name').eq('id', user!.id).single()
  const [{ data: requests }, { count: binCount }, { count: activeCount }] = await Promise.all([
    supabase.from('service_requests').select('*').eq('customer_id', user!.id).order('created_at',{ascending:false}).limit(5),
    supabase.from('equipment').select('*',{ count:'exact',head:true }),
    supabase.from('equipment').select('*',{ count:'exact',head:true }).eq('status','deployed'),
  ])
  const pendingCount = requests?.filter(r=>['pending','confirmed','in_progress'].includes(r.status)).length??0
  return (
    <div className="space-y-8">
      <div><h1 className="text-2xl font-bold text-white">Welcome back{profile?.full_name?`, ${profile.full_name.split(' ')[0]}`:''}</h1>
      {profile?.company_name&&<p className="text-slate-400 mt-1">{profile.company_name}</p>}</div>
      <Link href="/dashboard/customer/bins" className="block bg-gradient-to-br from-sky-500/20 via-sky-600/10 to-slate-800/60 border border-sky-500/30 rounded-2xl p-6 hover:border-sky-400/50 transition-all group">
        <div className="flex items-center justify-between">
          <div><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 bg-sky-500/20 rounded-xl flex items-center justify-center text-xl"></div><h2 className="text-xl font-bold text-white">My Containers</h2></div>
            <p className="text-slate-400 text-sm">{activeCount?<span className="text-sky-400 font-semibold">{activeCount} container{activeCount!==1?'s':''}</span>:'View all your containers'} currently deployed</p>
            <div className="flex gap-4 mt-4"><div><span className="text-white font-bold text-lg">{binCount??0}</span><span className="text-slate-500 ml-1.5 text-sm">Bins</span></div><div><span className="text-green-400 font-bold text-lg">{activeCount??0}</span><span className="text-slate-500 ml-1.5 text-sm">On Site</span></div></div></div>
          <div className="text-sky-400 text-2xl group-hover:translate-x-1 transition-transform shrink-0"></div>
        </div>
      </Link>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[{href:'/dashboard/customer/request',icon'',label:'Request Service',desc:'Schedule swap, pickup, or delivery' },{href:'/dashboard/customer/tracking',icon:'|'',label:'Live Tracking',desc:'Track confirmed service'},{href:'/dashboard/customer/bins',icon:'',label:'Service History',desc:'View past services by bin'}].map(a=>(
          <Link key={a.href} href={a.href} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 transition-all hover:bs-slate-800/60 group">
            <div className="text-2xl mb-2">{a.icon}</div>
            <div className="font-semibold text-white text-sm">{a.label}</div>
            <div className="text-slate-500 text-xs mt-1">{a.desc}</div>
          </Link>
        ))}
      </div>
      {requests&&requests.length>0&&(<div><h2 className="font-semibold text-white mb-3">Recent Requests</h2><div className="space-y-2">{requests.map((req:any)=>(<div key={req.id} className="bg-slate-800/40 border border-slate-700/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4"><div className="flex-1 min-w-0"><div className="text-white text-sm font-medium">{req.service_type?.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}</div><div className="text-slate-500 text-xs truncate">{req.jobsite_address}</div></div><span className={`shrink-0 text-xs px-2.5 py-0.5 rounded-full font-medium ${req.status==='completed'?'bg-green-500/20 text-green-400':req.status==='pending'?'bg-yellow-500/20 text-yellow-400':'bg-sky-500/20 text-sky-400'}`}>{req.status}</span></div>))}</div></div>)}
    </div>
  )
}
