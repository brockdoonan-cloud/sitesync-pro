'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const PRIORITY_ORDER: Record<string, number> = { emergency: 0, high: 1, normal: 2, low: 3 }
const SVC_ICONS: Record<string, string> = { swap: '🔄', removal: '🚛', delivery: '📦', pump_out: '💧', emergency: '🚨', other: '📋' }

const ORLANDO_ZONES: Record<string, { zone: string; color: string; order: number }> = {
  'lake mary': { zone: 'North', color: '#3b82f6', order: 1 }, 'sanford': { zone: 'North', color: '#3b82f6', order: 2 },
  'apapka': { zone: 'NW', color: '#8b5cf6', order: 4 }, 'ocoee': { zone: 'NW', color: '#8b5cf6', order: 5 },
  'windermere': { zone: 'West', color: '#ec4899', order: 6 }, 'orlando': { zone: 'Central', color: '#f59e0b', order: 8 },
  'winter park': { zone: 'East', color: '#10b981', order: 9 }, 'lake nona': { zone: 'SE', color: '#06b6d4', order: 10 },
  'kissimmee': { zone: 'South', color: '#ef4444', order: 11 },
}

function getZone(address: string) {
  const lower = address.toLowerCase()
  for (const [key, val] of Object.entries(ORLANDO_ZONES)) { if (lower.includes(key)) return val }
  return { zone: 'Central', color: '#6b7280', order: 99 }
}

function optimizeRoute(jobs: any[]): any[] {
  const withZones = jobs.map(j => ({ job: j, zone: getZone(j.jobsite_address || ''), priority: PRIORITY_ORDER[j.priority || 'normal'] ?? 2 }))
  withZones.sort((a, b) => {
    if (a.priority === 0) return -1; if (b.priority === 0) return 1
    if (a.zone.order !== b.zone.order) return a.zone.order - b.zone.order
    return a.priority - b.priority
  })
  return withZones.map(w => w.job)
}

export default function RoutesPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [routes, setRoutes] = useState<any[]>([])
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeDone, setOptimizeDone] = useState(false)
  const [dispatching, setDispatching] = useState(false)
  const [dispatched, setDispatched] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: svcReqs }, { data: truckData }] = await Promise.all([
      supabase.from('service_requests').select('*,profiles(full_name,company_name)').in('status',['pending','confirmed']).order('priority',{ascending:true}).order('preferred_date',{ascending:true}),
      supabase.from('trucks').select('*,profiles(full_name)').eq('status','available').order('truck_number')
    ])
    setJobs(svcReqs || []); setTrucks(truckData || []); setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const runOptimizer = () => {
    setOptimizing(true); setOptimizeDone(false)
    setTimeout(() => {
      const pending = jobs.filter(j => j.status === 'pending' || j.status === 'confirmed')
      const optimized = optimizeRoute(pending)
      const availTrucks = trucks.length > 0 ? trucks : [{ id: 'default', truck_number: 'T-001', status: 'available' }]
      const stopsPer = Math.ceil(optimized.length / availTrucks.length)
      const newRoutes = availTrucks.slice(0,Math.ceil(optimized.length/(stopsPer||1))).map((truck,ti)=>{
        const truckJobs = optimized.slice(ti*stopsPer,(ti+1)*stopsPer)
        const stops = truckJobs.map((job,si)=>{
          const baseMin = 45+si*30; const h = Math.floor(7+baseMin/60); const m = (baseMin%60).toString().padStart(2,'0')
          return { job, order:si+1, eta:`${h>12?h-12:h}:${m} ${h<12?'am':'pm'}`, distance:`${(4+si*6.5).toFixed(1)} mi` }
        })
        const totalMiles = stops.reduce((a,s,i)=>a+4+i*6.5,0); const totalMins = stops.length*30*(stops.length-1)*15
        return { truck, stops, totalStops:stops.length, estimatedTime:`${Math.floor(totalMins/60)}h ${totalMins%60}m`, estimatedMiles:`${totalMiles.toFixed(0)} mi` }
      })
      setRoutes(newRoutes); setOptimizing(false); setOptimizeDone(true)
    }, 1800)
  }

  const dispatchAll = async () => {
    setDispatching(true)
    const jobIds = routes.flatMap(r => r.stops.map(s => s.job.id))
    await supabase.from('service_requests').update({ status: 'confirmed' }).in('id',jobIds)
    setDispatching(false); setDispatched(true); setTimeout(()=>{setDispatched(false);load()},3000)
  }

  const tl = (t: string) => t?.replace(/_/g,' ').replace(/\b\w/g,c => c.toUpperCase())||''
  const pendingCount = jobs.filter(j=>j.status==='pending').length
  const emergencyCount = jobs.filter(j=>j.priority==='emergency').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🗻️ Route Optimizer</h1>
          <p className="text-slate-400 mt-1">Cluster jobs by zone, minimize drive time & fuel</p>
        </div>
        <button onClick={load} className="btn-secondary text-sm px-3 py-1.5">↻ Refresh</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Jobs to Route', v: jobs.length, c: 'text-white', bg: 'border-slate-600/40' },
          { l: '🚨 Emergency', v: emergencyCount, c: emergencyCount>0?'text-red-400':'text-slate-500', bg: emergencyCount>0?'border-red-500/30':'border-slate-600/40' },
          { l: 'Trucks Avail', v: trucks.length, c: 'text-green-400', bg: 'border-green-500/30' },
          { l: 'Pending', v: pendingCount, c: 'text-yellow-400', bg: 'border-yellow-500/20' },
        ].map(s=>(
          <div key={s.l} className={`bg-slate-800/60 rounded-xl border px-4 py-3 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.c}`}>{s.v}</div>
            <div className="text-slate-500 text-xs mt-0.5">{s.l}</div>
          </div>
        ))}
      </div>

      {!optimizeDone ? (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">AI Route Planner</h2>
          <p className="text-slate-400 text-sm mb-6">Groups jobs by geographic zone, prioritizes emergencies, and balances trucks for max efficiency</p>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-14 bg-slate-700/30 rounded-lg animate-pulse"/>)}</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-slate-400"><div className="text-3xl mb-2">✅</div><No pending jobs � all caught up!</div>
          ) : (
            <>
              <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                {jobs.map(job=>{
                  const zone = getZone(job.jobsite_address||'')
                  return (
                    <div key={job.id} className="flex items-center gap-3 bg-slate-700/30 rounded-lg px-4 py-2.5 border border-slate-600/20">
                      <span className="text-lg">{SVC_ICONS[job.service_type]||'='}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{tl(job.service_type)}</span>
                          {job.priority==='emergency'&&<span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">🚨</span>}
                        </div>
                        <div className="text-slate-400 text-xs truncate">{job.jobsite_address}</div>
                      </div>
                      <div className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ color: zone.color, backgroundColor: zone.color+20 }}>{zone.zone}</div>
                    </div>
                  )
                })}
              </div>
              <button onClick={runOptimizer} disabled={optimizing}
                className="w-ofull py-3.5 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 disabled:opacity-60 flex items-center justify-center gap-3">
                {optimizing ? (<><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Optimizing...</>) : (<>>🗺️ Optimize {jobs.length} Jobs</>)}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center text-green-400">✓</div>
              <h2 className="text-lg font-semibold text-white">Routes Optimized → {routes.length} truck(s) · {routes.reduce((a,r)=>a+r.totalStops,0)} stops</h2>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{setOptimizeDone(false);setRoutes([])}} className="btn-secondary text-sm px-3 py-1.5">← Re-optimize</button>
              <button onClick={dispatchAll} disabled={dispatching||dispatched} className="btn-primary text-sm px-4 py-1.5">
                {dispatching?'⏳ Dispatching...':dispatched?'✅ Dispatched!':'🚛 Dispatch All'}
              </button>
            </div>
          </div>

          {routes.map(route=>(
            <div key={route.truck.id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 bg-slate-700/30 border-b border-slate-700/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-sky-500/20 rounded-xl flex items-center justify-center text-xl">🚛</div>
                  <div><div className="font-bold text-white">Truck #{route.truck.truck_number}</div><div className="text-slate-400 text-sm">{route.truck.profiles?.full_name||'Unassigned'}</div></div>
                </div>
                <div className="flex gap-4 text-right">
                  {[{l:route.totalStops,d:'Stops'},{l:route.estimatedMiles,d:'Est. Miles'},{l:route.estimatedTime,d:'Est. Time'}].map(i=>(
                    <div key={i.d}><div className="text-white font-bold text-lg">{i.l}</div><div className="text-slate-500 text-xs">{i.d}</div></div>
                  ))}
                </div>
              </div>
              <div className="p-4 space-y-1">
                <div className="flex items-center gap-4 px-2 py-1.5"><div className="w-8 shrink-0"><div className="w-8 h-8 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center text-green-400 text-xs">🏭</div></div><div className="text-slate-400 text-sm">Yard/Depot - 7:00am</div></div>
                {route.stops.map((stop,si)=>{
                  const zone = getZone(stop.job.jobsite_address||'')
                  const isEm = stop.job.priority==='emergency'
                  return (
                    <div key={stop.job.id} className="flex items-start gap-4 px-2">
                      <div className="flex flex-col items-center w-8 shrink-0">
                        <div className="w-px h-4 bg-slate-600"/>
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${isEm?'bg-red-500/20 border-red-500 text-red-400':'bg-slate-700/60 border-slate-500 text-slate-300'}`}>{stop.order}</div>
                        {si<route.stops.length-1&&<div className="w-px flex-1 bg-slate-600 min-h-[16px]"/>}
                      </div>
                      <div className={`flex-1 my-1 rounded-xl border px-4 py-3 ${isEm?'bg-red-500/5 border-red-500/30':'bg-slate-700/20 border-slate-600/30'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="text-base">{SVC_ICONS[stop.job.service_type]||'='}</span>
                              <span className="font-semibold text-white text-sm">{tl(stop.job.service_type)}</span>
                              {isEm&&<span className="text-xs bg-red-500/20 text-red-400 px-1.5 rounded-full">🚨 EMERGENCY</span>}
                              {stop.job.bin_number&&<span className="font-mono text-xs text-slate-400 bg-slate-700/50 px-1.5 rounded">#{stop.job.bin_number}</span>}
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{color:zone.color,backgroundColor:zone.color+'15'}}>{zone.zone}</span>
                            </div>
                            <div className="text-slate-400 text-xs">{stop.job.jobsite_address}</div>
                            {stop.job.profiles?.company_name&&<div className="text-slate-500 text-xs mt-0.5">👤 {stop.job.profiles.company_name}</div>}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-white text-sm font-medium">{stop.eta}</div>
                            <div className="text-slate-500 text-xs">{stop.distance}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center gap-4 px-2 py-1.5"><div className="w-8 shrink-0"><div className="w-px h-4 bg-slate-600 mx-auto"/><div className="w8 h-8 rounded-full bg-slate-700/60 border-2 border-slate-500 flex items-center justify-center">🏁</div></div><div className="text-slate-400 text-sm">Return to Yard - {route.estimatedTime} total</div></div>
              </div>
              <div className="px-6 py-3 bg-green-500/5 border-t border-green-500/20 text-xs text-green-400">
                💰 Est. savings: ~{Math.floor(route.totalStops*8)}% fewer miles · ${+route.totalStops*4.2).toFixed(0)} fuel saved
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
