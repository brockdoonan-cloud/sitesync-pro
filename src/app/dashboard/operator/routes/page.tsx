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

type Stop = Jobsite & {
  equipment: Equipment[]
  priorityScore: number
  distanceFromPrevious?: number
}

const HOME_BASE = {
  label: 'Orlando yard',
  address: '255 S Orange Ave, Orlando, FL 32801',
  lat: 28.5384,
  lng: -81.3789,
}

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
  const statusBoost = site.status === 'active' ? 1 : 0
  return urgent * 10 + aging * 3 + statusBoost
}

function roughCoord(site: Jobsite) {
  if (typeof site.lat === 'number' && typeof site.lng === 'number') return { lat: site.lat, lng: site.lng }
  const text = addressFor(site).toLowerCase()
  let hash = 0
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 10000
  return {
    lat: 28.25 + (hash % 650) / 1000,
    lng: -81.65 + (Math.floor(hash / 7) % 560) / 1000,
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

function optimizeStops(stops: Stop[]) {
  const remaining = [...stops].sort((a, b) => b.priorityScore - a.priorityScore)
  const ordered: Stop[] = []
  let current = { lat: HOME_BASE.lat, lng: HOME_BASE.lng }

  while (remaining.length) {
    let bestIndex = 0
    let bestScore = Number.POSITIVE_INFINITY
    remaining.forEach((stop, index) => {
      const distance = miles(current, roughCoord(stop))
      const score = distance - stop.priorityScore * 1.5
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

function mapsRouteUrl(stops: Stop[]) {
  const waypoints = stops.slice(0, 9).map(stop => encodeURIComponent(addressFor(stop))).join('/')
  return `https://www.google.com/maps/dir/${encodeURIComponent(HOME_BASE.address)}/${waypoints}`
}

function mapsSearchUrl(site: Jobsite) {
  return `https://www.google.com/maps/search/${encodeURIComponent(addressFor(site))}`
}

export default function RoutesPage() {
  const [sites, setSites] = useState<Stop[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'swap' | 'all'>('swap')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: jobsites }, { data: equipment }] = await Promise.all([
      supabase.from('jobsites').select('id,name,address,city,state,zip,lat,lng,status').order('status', { ascending: true }),
      supabase.from('equipment').select('id,bin_number,status,location,jobsite_id,last_serviced_at').order('bin_number', { ascending: true }),
    ])

    const mapped = (jobsites || []).map((site: Jobsite) => {
      const siteEquipment = (equipment || []).filter((item: Equipment) => item.jobsite_id === site.id)
      return {
        ...site,
        equipment: siteEquipment,
        priorityScore: priorityScore(site, siteEquipment),
      }
    }).filter((site: Stop) => site.equipment.length > 0)

    setSites(mapped)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const swapStops = useMemo(() => sites.filter(site => site.equipment.some(needsSwap)), [sites])
  const visibleStops = filter === 'swap' ? swapStops : sites
  const optimizedStops = useMemo(() => optimizeStops(visibleStops), [visibleStops])
  const totalBins = sites.reduce((sum, site) => sum + site.equipment.length, 0)
  const swapBins = swapStops.reduce((sum, site) => sum + site.equipment.filter(needsSwap).length, 0)
  const estimatedMiles = optimizedStops.reduce((sum, stop) => sum + (stop.distanceFromPrevious || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Route Optimizer</h1>
          <p className="text-slate-400 mt-1">Prioritized driver route for active jobsites and bins that need swaps.</p>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Active Stops', value: sites.length, color: 'text-white' },
          { label: 'Bins On Route', value: totalBins, color: 'text-green-400' },
          { label: 'Swap Bins', value: swapBins, color: 'text-red-400' },
          { label: 'Est. Miles', value: Math.round(estimatedMiles), color: 'text-sky-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-800/40 rounded-xl animate-pulse" />)}
        </div>
      ) : optimizedStops.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="font-semibold text-white mb-2">No route stops found</h3>
          <p className="text-slate-400 text-sm">Import jobsites and equipment, or mark bins as full/needs service to build the swap route.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-2">
            {optimizedStops.map((stop, index) => {
              const stopSwapBins = stop.equipment.filter(needsSwap)
              return (
                <div key={stop.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-5 py-4 flex items-start gap-4">
                  <div className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold text-sm shrink-0 ${stopSwapBins.length > 0 ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-sky-500/20 border-sky-500/30 text-sky-300'}`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full border border-slate-600/50 bg-slate-700/40 text-slate-300 capitalize">{stop.status || 'active'}</span>
                      {stop.distanceFromPrevious !== undefined && <span className="text-xs text-slate-500">{stop.distanceFromPrevious.toFixed(1)} mi from previous</span>}
                    </div>
                    <div className="text-sm font-medium text-white truncate">{stop.name || addressFor(stop)}</div>
                    <div className="text-sm text-slate-400 truncate">{addressFor(stop)}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-700/50 px-2 py-1 text-slate-300">{stop.equipment.length} bins on site</span>
                      <span className={`rounded-full px-2 py-1 ${stopSwapBins.length > 0 ? 'bg-red-500/15 text-red-300' : 'bg-green-500/15 text-green-300'}`}>{stopSwapBins.length} need swap</span>
                    </div>
                  </div>
                  <a href={mapsSearchUrl(stop)} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs px-3 py-1.5 shrink-0">
                    Navigate
                  </a>
                </div>
              )
            })}
          </div>

          <div className="space-y-4">
            <div className="card">
              <h2 className="font-semibold text-white">Driver route</h2>
              <p className="text-sm text-slate-400 mt-2">Stops are ordered from the Orlando yard by a priority-plus-distance pass: urgent swap bins first, then nearby jobsites to reduce drive time.</p>
              <a href={mapsRouteUrl(optimizedStops)} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 block w-full rounded-xl py-3 text-center font-semibold">
                Open Optimized Route
              </a>
              <p className="text-xs text-slate-500 mt-3">Google Maps supports a limited number of stops per route link, so this sends the first 9 highest-priority stops.</p>
            </div>

            <div className="card">
              <h3 className="font-semibold text-white mb-3">Swap queue</h3>
              <div className="space-y-2">
                {swapStops.slice(0, 10).map(stop => (
                  <a key={stop.id} href={mapsSearchUrl(stop)} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 hover:border-red-500/40 transition-colors">
                    <div className="text-sm font-medium text-white truncate">{stop.name || addressFor(stop)}</div>
                    <div className="text-xs text-red-300">{stop.equipment.filter(needsSwap).map(item => `#${item.bin_number || item.id.slice(0, 6)}`).join(', ')}</div>
                  </a>
                ))}
                {swapStops.length === 0 && <p className="text-slate-400 text-sm">No bins currently need swaps.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
