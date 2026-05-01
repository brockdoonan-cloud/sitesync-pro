'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Truck = {
  id: string
  truck_number: string
  driver?: string
  status?: string
  lat?: number
  lng?: number
  last_seen?: string
  capacity?: number
}

const DEMO_TRUCKS: Truck[] = [
  { id: 'demo-12', truck_number: '12', driver: 'Mike R.', status: 'en_route', lat: 28.5384, lng: -81.3789, last_seen: new Date().toISOString(), capacity: 8 },
  { id: 'demo-18', truck_number: '18', driver: 'Carlos M.', status: 'servicing', lat: 28.4312, lng: -81.3081, last_seen: new Date(Date.now() - 90000).toISOString(), capacity: 6 },
  { id: 'demo-24', truck_number: '24', driver: 'Sam T.', status: 'available', lat: 28.8006, lng: -81.2744, last_seen: new Date(Date.now() - 180000).toISOString(), capacity: 7 },
  { id: 'demo-31', truck_number: '31', driver: 'Ana P.', status: 'returning', lat: 28.4239, lng: -81.4697, last_seen: new Date(Date.now() - 240000).toISOString(), capacity: 8 },
]

function statusClass(status?: string) {
  if (status === 'en_route') return 'border-sky-500/30 bg-sky-500/10 text-sky-300'
  if (status === 'servicing') return 'border-red-500/30 bg-red-500/10 text-red-300'
  if (status === 'returning') return 'border-violet-500/30 bg-violet-500/10 text-violet-300'
  return 'border-green-500/30 bg-green-500/10 text-green-300'
}

function statusLabel(status?: string) {
  if (status === 'en_route') return 'En route'
  if (status === 'servicing') return 'Servicing'
  if (status === 'returning') return 'Returning'
  return 'Available'
}

function relativeTime(value?: string) {
  if (!value) return 'No GPS ping'
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  return `${minutes}m ago`
}

export default function TrucksPage() {
  const [trucks, setTrucks] = useState<Truck[]>(DEMO_TRUCKS)
  const [usingDemo, setUsingDemo] = useState(true)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('trucks')
      .select('id,truck_number,status,capacity,last_seen,lat,lng')
      .order('truck_number', { ascending: true })

    if (data && data.length > 0) {
      setTrucks(data.map((truck: any, index: number) => ({
        id: truck.id,
        truck_number: truck.truck_number || String(index + 1),
        driver: `Driver ${index + 1}`,
        status: truck.status || 'available',
        lat: truck.lat,
        lng: truck.lng,
        last_seen: truck.last_seen,
        capacity: truck.capacity || 6,
      })))
      setUsingDemo(false)
    } else {
      setTrucks(DEMO_TRUCKS)
      setUsingDemo(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => setTick(value => value + 1), 3000)
    return () => window.clearInterval(timer)
  }, [])

  const simulatedTrucks = useMemo(() => trucks.map((truck, index) => ({
    ...truck,
    lat: (truck.lat || 28.5384) + Math.sin((tick + index) / 5) * 0.01,
    lng: (truck.lng || -81.3789) + Math.cos((tick + index) / 5) * 0.01,
  })), [tick, trucks])

  const active = simulatedTrucks.filter(truck => truck.status !== 'available').length
  const available = simulatedTrucks.length - active

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Truck GPS</h1>
          <p className="text-slate-400 mt-1">Live fleet demo with driver status, GPS pings, and dispatch readiness.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary text-sm px-4 py-2">Refresh</button>
          <Link href="/dashboard/operator/routes" className="btn-primary text-sm px-4 py-2">Optimize Routes</Link>
        </div>
      </div>

      {usingDemo && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-300">
          Demo mode is simulating GPS movement. Production tracking uses driver app location pings into Supabase.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Fleet Trucks', value: simulatedTrucks.length, color: 'text-white' },
          { label: 'Active', value: active, color: 'text-sky-400' },
          { label: 'Available', value: available, color: 'text-green-400' },
          { label: 'GPS Online', value: simulatedTrucks.filter(truck => truck.lat && truck.lng).length, color: 'text-violet-300' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl border border-slate-700/50 bg-slate-900 min-h-[420px] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.12),transparent_28%),linear-gradient(135deg,#0f172a,#111827_48%,#052e2b)]" />
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.18) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
          {simulatedTrucks.map((truck, index) => {
            const x = 18 + ((index * 23 + tick * 2) % 68)
            const y = 24 + ((index * 17 + tick) % 52)
            return (
              <div key={truck.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
                <div className={`rounded-xl border px-3 py-2 shadow-xl ${statusClass(truck.status)}`}>
                  <div className="text-sm font-bold">Truck {truck.truck_number}</div>
                  <div className="text-[11px] opacity-80">{statusLabel(truck.status)}</div>
                </div>
              </div>
            )
          })}
          <div className="absolute left-4 bottom-4 rounded-xl border border-slate-700/60 bg-slate-950/85 px-4 py-3 text-xs text-slate-400">
            GPS demo map. Exact production map pins are powered from driver location pings.
          </div>
        </div>

        <div className="space-y-3">
          {simulatedTrucks.map(truck => (
            <div key={truck.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-white">Truck {truck.truck_number}</div>
                  <div className="text-sm text-slate-400">{truck.driver || 'Unassigned driver'}</div>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(truck.status)}`}>{statusLabel(truck.status)}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-700/40 p-3">
                  <div className="text-slate-500">Capacity</div>
                  <div className="text-white font-semibold">{truck.capacity || 6} swaps</div>
                </div>
                <div className="rounded-lg bg-slate-700/40 p-3">
                  <div className="text-slate-500">GPS ping</div>
                  <div className="text-white font-semibold">{relativeTime(truck.last_seen)}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {truck.lat?.toFixed(4)}, {truck.lng?.toFixed(4)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading && <p className="text-slate-500 text-sm">Refreshing truck GPS...</p>}
    </div>
  )
}
