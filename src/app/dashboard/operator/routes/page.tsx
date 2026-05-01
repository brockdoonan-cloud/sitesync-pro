'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Jobsite = {
  id: string
  name?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  lat?: number
  lng?: number
  status?: string
}

type Equipment = {
  id: string
  bin_number?: string
  status?: string
  location?: string
  jobsite_id?: string
  last_serviced_at?: string
}

type Truck = {
  id: string
  truck_number: string
  driver: string
  status: 'available' | 'en_route' | 'servicing' | 'returning'
  capacity: number
  lat: number
  lng: number
  progress: number
}

type Stop = Jobsite & {
  equipment: Equipment[]
  priorityScore: number
  distanceFromPrevious?: number
}

type AssignedRoute = {
  truck: Truck
  stops: Stop[]
  miles: number
  swaps: number
}

const HOME_BASE = {
  label: 'Orlando yard',
  address: '255 S Orange Ave, Orlando, FL 32801',
  lat: 28.5384,
  lng: -81.3789,
}

const DEMO_TRUCKS: Truck[] = [
  { id: 'truck-12', truck_number: '12', driver: 'Mike R.', status: 'en_route', capacity: 8, lat: 28.5384, lng: -81.3789, progress: 0.18 },
  { id: 'truck-18', truck_number: '18', driver: 'Carlos M.', status: 'servicing', capacity: 6, lat: 28.4312, lng: -81.3081, progress: 0.48 },
  { id: 'truck-24', truck_number: '24', driver: 'Sam T.', status: 'available', capacity: 7, lat: 28.8006, lng: -81.2744, progress: 0.05 },
]

const DEMO_STOPS: Stop[] = [
  {
    id: 'demo-neptune',
    name: 'Project Neptune',
    address: '1 Jeff Fuqua Blvd, Orlando, FL 32827',
    lat: 28.4312,
    lng: -81.3081,
    status: 'active',
    priorityScore: 26,
    equipment: [
      { id: 'bin-165905', bin_number: '165905', status: 'needs_swap', location: 'South gate', last_serviced_at: '2026-04-22' },
      { id: 'bin-32971', bin_number: '32971', status: 'deployed', location: 'Phase 2 slab', last_serviced_at: '2026-04-29' },
    ],
  },
  {
    id: 'demo-labrea',
    name: 'Project LaBrea',
    address: '9801 International Dr, Orlando, FL 32819',
    lat: 28.4239,
    lng: -81.4697,
    status: 'active',
    priorityScore: 23,
    equipment: [
      { id: 'bin-166378', bin_number: '166378', status: 'full', location: 'Loading dock', last_serviced_at: '2026-04-20' },
    ],
  },
  {
    id: 'demo-cocoa',
    name: 'Cocoa',
    address: '401 Riveredge Blvd, Cocoa, FL 32922',
    lat: 28.3547,
    lng: -80.7253,
    status: 'active',
    priorityScore: 21,
    equipment: [
      { id: 'bin-140707', bin_number: '140707', status: 'needs_service', location: 'Tilt wall area', last_serviced_at: '2026-04-18' },
      { id: 'bin-pw114', bin_number: 'PW114', status: 'deployed', location: 'Washout pad', last_serviced_at: '2026-04-28' },
    ],
  },
  {
    id: 'demo-sanford',
    name: 'Sanford Plant',
    address: '301 W 13th St, Sanford, FL 32771',
    lat: 28.8006,
    lng: -81.2744,
    status: 'active',
    priorityScore: 16,
    equipment: [
      { id: 'bin-143287', bin_number: '143287', status: 'deployed', location: 'North yard', last_serviced_at: '2026-04-30' },
    ],
  },
  {
    id: 'demo-lake-nona',
    name: 'DHI Nona West',
    address: '6900 Tavistock Lakes Blvd, Orlando, FL 32827',
    lat: 28.3720,
    lng: -81.2787,
    status: 'scheduled',
    priorityScore: 14,
    equipment: [
      { id: 'bin-876917', bin_number: '876917', status: 'swap_needed', location: 'Lot 7', last_serviced_at: '2026-04-21' },
    ],
  },
  {
    id: 'demo-twin-lakes',
    name: 'Reserve of Twin Lakes',
    address: '951 Market Promenade Ave, Lake Mary, FL 32746',
    lat: 28.7850,
    lng: -81.3576,
    status: 'active',
    priorityScore: 9,
    equipment: [
      { id: 'bin-60677', bin_number: '60677', status: 'deployed', location: 'Clubhouse', last_serviced_at: '2026-04-30' },
    ],
  },
]

function addressFor(site: Jobsite) {
  return site.address || [site.name, site.city, site.state, site.zip].filter(Boolean).join(', ') || 'Orlando, FL'
}

function needsSwap(item: Equipment) {
  return ['needs_swap', 'full', 'overflowing', 'swap_needed', 'maintenance', 'needs_service'].includes((item.status || '').toLowerCase())
}

function priorityScore(site: Jobsite, equipment: Equipment[]) {
  const urgent = equipment.filter(needsSwap).length
  const aging = equipment.filter(item => {
    if (!item.last_serviced_at) return false
    const ageDays = (Date.now() - new Date(item.last_serviced_at).getTime()) / 86400000
    return ageDays >= 7
  }).length
  const activeBoost = site.status === 'active' ? 1 : 0
  return urgent * 12 + aging * 4 + activeBoost
}

function roughCoord(site: Jobsite) {
  if (typeof site.lat === 'number' && typeof site.lng === 'number') return { lat: site.lat, lng: site.lng }
  const text = addressFor(site).toLowerCase()
  let hash = 0
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 10000
  return {
    lat: 28.2 + (hash % 760) / 1000,
    lng: -81.75 + (Math.floor(hash / 7) % 720) / 1000,
  }
}

function miles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthMiles = 3958.8
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return earthMiles * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

function optimizeStops(stops: Stop[], start: { lat: number; lng: number } = HOME_BASE) {
  const remaining = [...stops].sort((a, b) => b.priorityScore - a.priorityScore)
  const ordered: Stop[] = []
  let current = { lat: start.lat, lng: start.lng }

  while (remaining.length) {
    let bestIndex = 0
    let bestScore = Number.POSITIVE_INFINITY
    remaining.forEach((stop, index) => {
      const distance = miles(current, roughCoord(stop))
      const urgentBins = stop.equipment.filter(needsSwap).length
      const score = distance - stop.priorityScore * 1.35 - urgentBins * 3
      if (score < bestScore) {
        bestScore = score
        bestIndex = index
      }
    })
    const [next] = remaining.splice(bestIndex, 1)
    const distanceFromPrevious = miles(current, roughCoord(next))
    ordered.push({ ...next, distanceFromPrevious })
    current = roughCoord(next)
  }

  return ordered
}

function assignRoutes(stops: Stop[], trucks: Truck[]) {
  const urgentStops = optimizeStops(stops)
  const routes: AssignedRoute[] = trucks.map(truck => ({ truck, stops: [], miles: 0, swaps: 0 }))

  urgentStops.forEach((stop, index) => {
    const route = routes[index % routes.length]
    route.stops.push(stop)
    route.swaps += stop.equipment.filter(needsSwap).length
  })

  return routes.map(route => {
    const ordered = optimizeStops(route.stops, route.truck)
    return {
      ...route,
      stops: ordered,
      miles: ordered.reduce((sum, stop) => sum + (stop.distanceFromPrevious || 0), 0),
    }
  })
}

function mapsRouteUrl(stops: Stop[], start = HOME_BASE.address) {
  const waypoints = stops.slice(0, 9).map(stop => encodeURIComponent(addressFor(stop))).join('/')
  return `https://www.google.com/maps/dir/${encodeURIComponent(start)}/${waypoints}`
}

function mapsSearchUrl(site: Jobsite) {
  return `https://www.google.com/maps/search/${encodeURIComponent(addressFor(site))}`
}

function mapPoint(lat: number, lng: number) {
  const minLat = 28.1
  const maxLat = 28.92
  const minLng = -81.82
  const maxLng = -80.65
  return {
    x: Math.max(4, Math.min(96, ((lng - minLng) / (maxLng - minLng)) * 100)),
    y: Math.max(6, Math.min(94, (1 - (lat - minLat) / (maxLat - minLat)) * 100)),
  }
}

function liveTruckPosition(truck: Truck, stops: Stop[], tick: number) {
  if (!stops.length) return { lat: truck.lat, lng: truck.lng }
  const ordered = stops.map(roughCoord)
  const segment = Math.min(ordered.length - 1, Math.floor((truck.progress + tick * 0.018) % 1 * ordered.length))
  const from = segment === 0 ? { lat: truck.lat, lng: truck.lng } : ordered[segment - 1]
  const to = ordered[segment]
  const local = ((truck.progress + tick * 0.018) * ordered.length) % 1
  return {
    lat: from.lat + (to.lat - from.lat) * local,
    lng: from.lng + (to.lng - from.lng) * local,
  }
}

function statusLabel(status: Truck['status']) {
  if (status === 'en_route') return 'En route'
  if (status === 'servicing') return 'Servicing'
  if (status === 'returning') return 'Returning'
  return 'Available'
}

export default function RoutesPage() {
  const [sites, setSites] = useState<Stop[]>(DEMO_STOPS)
  const [trucks, setTrucks] = useState<Truck[]>(DEMO_TRUCKS)
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(true)
  const [filter, setFilter] = useState<'swap' | 'all'>('swap')
  const [selectedTruck, setSelectedTruck] = useState(DEMO_TRUCKS[0].id)
  const [tick, setTick] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: jobsites }, { data: equipment }, { data: truckRows }] = await Promise.all([
      supabase.from('jobsites').select('id,name,address,city,state,zip,lat,lng,status').order('status', { ascending: true }),
      supabase.from('equipment').select('id,bin_number,status,location,jobsite_id,last_serviced_at').order('bin_number', { ascending: true }),
      supabase.from('trucks').select('id,truck_number,status').order('truck_number', { ascending: true }),
    ])

    const mapped = (jobsites || []).map((site: Jobsite) => {
      const siteEquipment = (equipment || []).filter((item: Equipment) => item.jobsite_id === site.id)
      return {
        ...site,
        equipment: siteEquipment,
        priorityScore: priorityScore(site, siteEquipment),
      }
    }).filter((site: Stop) => site.equipment.length > 0)

    const liveTrucks = (truckRows || []).slice(0, 4).map((truck: any, index: number) => ({
      id: truck.id,
      truck_number: truck.truck_number || String(index + 1),
      driver: `Driver ${index + 1}`,
      status: index === 0 ? 'en_route' : index === 1 ? 'servicing' : 'available',
      capacity: 6 + index,
      lat: HOME_BASE.lat + index * 0.08,
      lng: HOME_BASE.lng + index * 0.06,
      progress: 0.12 + index * 0.17,
    })) as Truck[]

    if (mapped.length > 0) {
      setSites(mapped)
      setTrucks(liveTrucks.length ? liveTrucks : DEMO_TRUCKS)
      setSelectedTruck((liveTrucks[0] || DEMO_TRUCKS[0]).id)
      setUsingDemo(false)
    } else {
      setSites(DEMO_STOPS)
      setTrucks(DEMO_TRUCKS)
      setSelectedTruck(DEMO_TRUCKS[0].id)
      setUsingDemo(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => setTick(value => value + 1), 2500)
    return () => window.clearInterval(timer)
  }, [])

  const swapStops = useMemo(() => sites.filter(site => site.equipment.some(needsSwap)), [sites])
  const visibleStops = filter === 'swap' ? swapStops : sites
  const routes = useMemo(() => assignRoutes(visibleStops, trucks), [trucks, visibleStops])
  const selectedRoute = routes.find(route => route.truck.id === selectedTruck) || routes[0]
  const allStopsOptimized = useMemo(() => optimizeStops(visibleStops), [visibleStops])
  const totalMiles = routes.reduce((sum, route) => sum + route.miles, 0)
  const swapBins = swapStops.reduce((sum, site) => sum + site.equipment.filter(needsSwap).length, 0)
  const totalBins = sites.reduce((sum, site) => sum + site.equipment.length, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">GPS Dispatch & Route Optimizer</h1>
          <p className="text-slate-400 mt-1">Demo live truck tracking, swap detection, and efficient driver route planning.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['swap', 'all'] as const).map(option => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${filter === option ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'text-slate-400 border-slate-700/50 hover:text-white'}`}
            >
              {option === 'swap' ? 'Swap Route' : 'All Active'}
            </button>
          ))}
          <button onClick={load} className="btn-secondary text-sm px-4 py-2">Refresh</button>
        </div>
      </div>

      {usingDemo && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-300">
          Demo mode is using Orlando trucks, GPS positions, bins, and active swap stops. Real jobsites, trucks, and equipment replace this automatically after onboarding.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Route Stops', value: visibleStops.length, color: 'text-white' },
          { label: 'Swap Bins', value: swapBins, color: 'text-red-400' },
          { label: 'Bins Tracked', value: totalBins, color: 'text-green-400' },
          { label: 'Active Trucks', value: trucks.length, color: 'text-sky-400' },
          { label: 'Est. Miles', value: Math.round(totalMiles), color: 'text-violet-300' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl border border-slate-700/50 bg-slate-900 overflow-hidden min-h-[560px] relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.12),transparent_28%),linear-gradient(135deg,#0f172a,#111827_48%,#052e2b)]" />
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.18) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />

          <div className="absolute left-[8%] top-[12%] rounded-full border border-slate-500/30 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
            {HOME_BASE.label}
          </div>

          {visibleStops.map(stop => {
            const point = mapPoint(roughCoord(stop).lat, roughCoord(stop).lng)
            const urgent = stop.equipment.filter(needsSwap).length
            return (
              <a
                key={stop.id}
                href={mapsSearchUrl(stop)}
                target="_blank"
                rel="noopener noreferrer"
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-lg transition-transform hover:scale-110 ${urgent ? 'bg-red-500 border-white w-8 h-8' : 'bg-green-500 border-slate-950 w-6 h-6'}`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                title={`${stop.name || addressFor(stop)} - ${urgent} swaps`}
              >
                <span className="sr-only">{stop.name || addressFor(stop)}</span>
                {urgent > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-slate-950 border border-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white">{urgent}</span>}
              </a>
            )
          })}

          {routes.map(route => {
            const live = liveTruckPosition(route.truck, route.stops, tick)
            const point = mapPoint(live.lat, live.lng)
            return (
              <button
                key={route.truck.id}
                onClick={() => setSelectedTruck(route.truck.id)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold shadow-xl border transition-transform hover:scale-110 ${selectedTruck === route.truck.id ? 'bg-sky-400 text-slate-950 border-white' : 'bg-slate-950 text-sky-300 border-sky-500/50'}`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                T{route.truck.truck_number}
              </button>
            )
          })}

          <div className="absolute left-4 bottom-4 right-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            {routes.map(route => (
              <button
                key={route.truck.id}
                onClick={() => setSelectedTruck(route.truck.id)}
                className={`rounded-xl border px-3 py-2 text-left ${selectedTruck === route.truck.id ? 'border-sky-400 bg-sky-500/15' : 'border-slate-700/60 bg-slate-950/80'}`}
              >
                <div className="text-white text-sm font-semibold">Truck {route.truck.truck_number}</div>
                <div className="text-xs text-slate-400">{statusLabel(route.truck.status)} | {route.stops.length} stops</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Truck {selectedRoute?.truck.truck_number}</h2>
                <p className="text-sm text-slate-400">{selectedRoute?.truck.driver}</p>
              </div>
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">{selectedRoute ? statusLabel(selectedRoute.truck.status) : 'Available'}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-slate-700/40 p-3">
                <div className="text-xl font-bold text-white">{selectedRoute?.stops.length || 0}</div>
                <div className="text-xs text-slate-500">Stops</div>
              </div>
              <div className="rounded-lg bg-red-500/10 p-3">
                <div className="text-xl font-bold text-red-300">{selectedRoute?.swaps || 0}</div>
                <div className="text-xs text-slate-500">Swaps</div>
              </div>
              <div className="rounded-lg bg-sky-500/10 p-3">
                <div className="text-xl font-bold text-sky-300">{Math.round(selectedRoute?.miles || 0)}</div>
                <div className="text-xs text-slate-500">Miles</div>
              </div>
            </div>
            {selectedRoute && (
              <a href={mapsRouteUrl(selectedRoute.stops)} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 block w-full rounded-xl py-3 text-center font-semibold">
                Open Driver Route
              </a>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold text-white mb-3">Route timeline</h3>
            {selectedRoute?.stops.length ? (
              <div className="space-y-3">
                {selectedRoute.stops.map((stop, index) => {
                  const urgent = stop.equipment.filter(needsSwap)
                  return (
                    <div key={stop.id} className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${urgent.length ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-green-500/15 border-green-500/30 text-green-300'}`}>{index + 1}</div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{stop.name || addressFor(stop)}</div>
                        <div className="text-xs text-slate-400 truncate">{addressFor(stop)}</div>
                        <div className="text-xs text-slate-500 mt-1">{(stop.distanceFromPrevious || 0).toFixed(1)} mi | {urgent.length} swap bins | {stop.equipment.length} total bins</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No stops assigned to this truck.</p>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold text-white mb-3">Best overall route</h3>
            <p className="text-sm text-slate-400">This route orders every selected stop by urgency and drive distance from the Orlando yard.</p>
            <a href={mapsRouteUrl(allStopsOptimized)} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-4 block w-full rounded-xl py-3 text-center font-semibold">
              Open Full Route
            </a>
            <p className="text-xs text-slate-500 mt-3">Google Maps links include the first 9 highest-priority stops. Production routing can use Google Routes API for larger multi-truck optimization.</p>
          </div>
        </div>
      </div>

      {loading && <p className="text-slate-500 text-sm">Refreshing route data...</p>}
    </div>
  )
}
