'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Jobsite = {
  id: string
  address?: string
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

type MapSite = Jobsite & {
  equipment: Equipment[]
  x: number
  y: number
}

const DEMO_SITES: MapSite[] = [
  {
    id: 'demo-north-yard',
    address: 'Lake Mary Retail Buildout, Lake Mary Blvd, Lake Mary, FL',
    lat: 28.7589,
    lng: -81.3178,
    status: 'active',
    x: 28,
    y: 24,
    equipment: [
      { id: 'demo-401', bin_number: '401', status: 'deployed', location: 'North loading zone', last_serviced_at: '2026-04-27' },
      { id: 'demo-402', bin_number: '402', status: 'needs_swap', location: 'Framing debris full', last_serviced_at: '2026-04-22' },
    ],
  },
  {
    id: 'demo-downtown',
    address: 'Downtown Orlando Remodel, Central Blvd, Orlando, FL',
    lat: 28.5421,
    lng: -81.3790,
    status: 'active',
    x: 48,
    y: 52,
    equipment: [
      { id: 'demo-515', bin_number: '515', status: 'full', location: 'Alley dock', last_serviced_at: '2026-04-20' },
    ],
  },
  {
    id: 'demo-lake-nona',
    address: 'Lake Nona Medical Pad, Narcoossee Rd, Orlando, FL',
    lat: 28.3954,
    lng: -81.2440,
    status: 'scheduled',
    x: 72,
    y: 70,
    equipment: [
      { id: 'demo-633', bin_number: '633', status: 'deployed', location: 'Slab pour washout', last_serviced_at: '2026-04-29' },
      { id: 'demo-634', bin_number: '634', status: 'available', location: 'Reserved for delivery' },
    ],
  },
]

function needsSwap(item: Equipment) {
  return ['needs_swap', 'full', 'overflowing', 'swap_needed'].includes((item.status || '').toLowerCase())
}

function siteSwapCount(site: MapSite) {
  return site.equipment.filter(needsSwap).length
}

function statusClass(status?: string) {
  if (needsSwap({ id: 'status', status })) return 'bg-red-500/10 text-red-400 border-red-500/30'
  if (status === 'deployed' || status === 'active') return 'bg-green-500/10 text-green-400 border-green-500/30'
  if (status === 'available' || status === 'scheduled') return 'bg-sky-500/10 text-sky-400 border-sky-500/30'
  return 'bg-slate-700/40 text-slate-400 border-slate-600/40'
}

function coordToPoint(site: Jobsite, index: number, total: number) {
  if (typeof site.lat === 'number' && typeof site.lng === 'number') {
    const minLat = 28.2
    const maxLat = 28.9
    const minLng = -81.65
    const maxLng = -81.1
    const x = ((site.lng - minLng) / (maxLng - minLng)) * 80 + 10
    const y = (1 - ((site.lat - minLat) / (maxLat - minLat))) * 74 + 12
    return {
      x: Math.max(8, Math.min(92, x)),
      y: Math.max(10, Math.min(88, y)),
    }
  }

  const angle = (index / Math.max(1, total)) * Math.PI * 2
  return {
    x: 50 + Math.cos(angle) * 30,
    y: 50 + Math.sin(angle) * 24,
  }
}

export default function MapPage() {
  const [sites, setSites] = useState<MapSite[]>(DEMO_SITES)
  const [selectedId, setSelectedId] = useState(DEMO_SITES[0].id)
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(true)
  const [filter, setFilter] = useState<'all' | 'swap' | 'ok'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: jobsites }, { data: equipment }] = await Promise.all([
      supabase.from('jobsites').select('id,address,lat,lng,status').order('status', { ascending: true }),
      supabase.from('equipment').select('id,bin_number,status,location,jobsite_id,last_serviced_at').order('bin_number', { ascending: true }),
    ])

    if (jobsites && jobsites.length > 0) {
      const mapped = jobsites.map((site: Jobsite, index: number) => ({
        ...site,
        ...coordToPoint(site, index, jobsites.length),
        equipment: (equipment || []).filter((item: Equipment) => item.jobsite_id === site.id),
      }))
      setSites(mapped)
      setSelectedId(mapped[0]?.id || '')
      setUsingDemo(false)
    } else {
      setSites(DEMO_SITES)
      setSelectedId(DEMO_SITES[0].id)
      setUsingDemo(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filteredSites = useMemo(() => {
    if (filter === 'swap') return sites.filter(site => siteSwapCount(site) > 0)
    if (filter === 'ok') return sites.filter(site => siteSwapCount(site) === 0)
    return sites
  }, [filter, sites])

  const selected = sites.find(site => site.id === selectedId) || filteredSites[0] || sites[0]
  const allEquipment = sites.flatMap(site => site.equipment)
  const swapNeeded = allEquipment.filter(needsSwap)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipment Map</h1>
          <p className="text-slate-400 mt-1">See deployed equipment by jobsite and identify bins that need swaps.</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'swap', 'ok'] as const).map(option => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filter === option ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' : 'text-slate-400 border-slate-700/50 hover:text-white'}`}
            >
              {option === 'all' ? 'All Sites' : option === 'swap' ? 'Needs Swap' : 'No Swap'}
            </button>
          ))}
          <button onClick={load} className="btn-secondary text-sm px-4 py-2">Refresh</button>
        </div>
      </div>

      {usingDemo && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-300">
          Demo mode is showing sample Orlando jobsites because live jobsite rows were not returned. Real Supabase data will replace this automatically.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Jobsites', value: sites.length, className: 'bg-slate-700/40 text-white border-slate-600/40' },
          { label: 'Equipment On Sites', value: allEquipment.length, className: 'bg-green-500/10 text-green-400 border-green-500/20' },
          { label: 'Needs Swap', value: swapNeeded.length, className: 'bg-red-500/10 text-red-400 border-red-500/20' },
          { label: 'Okay For Now', value: Math.max(0, allEquipment.length - swapNeeded.length), className: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border px-4 py-3 ${stat.className}`}>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl border border-slate-700/50 bg-slate-900 overflow-hidden min-h-[560px] relative">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-950/80 to-transparent" />
          <div className="absolute left-4 top-4 z-10">
            <div className="text-xs uppercase tracking-wide text-slate-500">Orlando service area</div>
            <div className="text-lg font-semibold text-white">Live Equipment Map</div>
          </div>
          {filteredSites.map(site => {
            const count = siteSwapCount(site)
            const selectedPin = selected?.id === site.id
            return (
              <button
                key={site.id}
                onClick={() => setSelectedId(site.id)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 rounded-full border-2 shadow-lg transition-all ${selectedPin ? 'h-12 w-12 border-white scale-110' : 'h-9 w-9 border-slate-950'} ${count > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ left: `${site.x}%`, top: `${site.y}%` }}
                title={site.address || 'Jobsite'}
              >
                <span className="text-xs font-bold text-white">{site.equipment.length}</span>
              </button>
            )
          })}
          <div className="absolute bottom-4 left-4 right-4 z-10 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">Green pins: equipment okay</div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">Red pins: one or more swaps needed</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">{selected?.address || 'Select a jobsite'}</h2>
                <p className="text-slate-400 text-sm mt-1">{selected?.address || 'No address on file'}</p>
              </div>
              {selected && <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${statusClass(selected.status)}`}>{selected.status || 'unknown'}</span>}
            </div>
            {selected && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-700/40 p-3">
                  <div className="text-slate-500 text-xs">On Site</div>
                  <div className="text-white text-2xl font-bold">{selected.equipment.length}</div>
                </div>
                <div className="rounded-xl bg-red-500/10 p-3">
                  <div className="text-slate-500 text-xs">Needs Swap</div>
                  <div className="text-red-400 text-2xl font-bold">{siteSwapCount(selected)}</div>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold text-white mb-3">Equipment at selected site</h3>
            {selected?.equipment.length ? (
              <div className="space-y-2">
                {selected.equipment.map(item => (
                  <div key={item.id} className="rounded-lg border border-slate-700/50 bg-slate-700/20 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">Bin #{item.bin_number || item.id.slice(0, 6)}</div>
                        <div className="text-xs text-slate-500">{item.location || selected.address || 'On site'}</div>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${statusClass(item.status)}`}>{needsSwap(item) ? 'Swap needed' : item.status || 'unknown'}</span>
                    </div>
                    {item.last_serviced_at && <div className="text-xs text-slate-500 mt-2">Last serviced {new Date(item.last_serviced_at).toLocaleDateString()}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No equipment linked to this site yet.</p>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold text-white mb-3">Swap queue</h3>
            {swapNeeded.length > 0 ? (
              <div className="space-y-2">
                {sites.flatMap(site => site.equipment.filter(needsSwap).map(item => ({ site, item }))).map(({ site, item }) => (
                  <button key={item.id} onClick={() => setSelectedId(site.id)} className="w-full text-left rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 hover:border-red-500/40 transition-colors">
                    <div className="text-sm font-medium text-white">Bin #{item.bin_number || item.id.slice(0, 6)}</div>
                    <div className="text-xs text-red-300">{site.address || 'Jobsite'} needs swap</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No swaps needed in the current view.</p>
            )}
          </div>
        </div>
      </div>

      {loading && <p className="text-slate-500 text-sm">Refreshing map data...</p>}
    </div>
  )
}
