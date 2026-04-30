'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const KNOWN_ADDRESS_COORDS: Record<string, GoogleLatLng> = {
  '255 s orange ave, orlando, fl 32801': { lat: 28.5384, lng: -81.3789 },
  '400 w church st, orlando, fl 32801': { lat: 28.5406, lng: -81.3839 },
  '655 w church st, orlando, fl 32805': { lat: 28.5409, lng: -81.3911 },
  '9801 international dr, orlando, fl 32819': { lat: 28.4239, lng: -81.4697 },
  '1 jeff fuqua blvd, orlando, fl 32827': { lat: 28.4312, lng: -81.3081 },
  '701 front st, celebration, fl 34747': { lat: 28.3185, lng: -81.5418 },
  '200 e robinson st, orlando, fl 32801': { lat: 28.5451, lng: -81.3751 },
  '6000 universal blvd, orlando, fl 32819': { lat: 28.4720, lng: -81.4678 },
  '1180 seven seas dr, lake buena vista, fl 32830': { lat: 28.4177, lng: -81.5812 },
  '100 n woodland blvd, deland, fl 32720': { lat: 29.0283, lng: -81.3031 },
  '301 w 13th st, sanford, fl 32771': { lat: 28.8006, lng: -81.2744 },
  '951 market promenade ave, lake mary, fl 32746': { lat: 28.7850, lng: -81.3576 },
  '14111 shoreside way, winter garden, fl 34787': { lat: 28.4616, lng: -81.6148 },
  '6900 tavistock lakes blvd, orlando, fl 32827': { lat: 28.3720, lng: -81.2787 },
  '7007 sea world dr, orlando, fl 32821': { lat: 28.4114, lng: -81.4615 },
  '1500 masters blvd, championsgate, fl 33896': { lat: 28.2616, lng: -81.6237 },
  '101 adventure ct, davenport, fl 33837': { lat: 28.1614, lng: -81.6087 },
  '4012 central florida pkwy, orlando, fl 32837': { lat: 28.4016, lng: -81.4295 },
  '260 n tubb st, oakland, fl 34760': { lat: 28.5566, lng: -81.6317 },
  '201 e pine st, orlando, fl 32801': { lat: 28.5415, lng: -81.3760 },
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
  return ['needs_swap', 'full', 'overflowing', 'swap_needed', 'maintenance', 'needs_service'].includes((item.status || '').toLowerCase())
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

function normalizeAddress(address?: string) {
  return (address || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function knownPosition(site: Jobsite): GoogleLatLng | null {
  if (typeof site.lat === 'number' && typeof site.lng === 'number') return { lat: site.lat, lng: site.lng }
  return KNOWN_ADDRESS_COORDS[normalizeAddress(site.address)] || null
}

function binMarkerPosition(position: GoogleLatLng, index: number, total: number) {
  if (total <= 1) return position
  const angle = (index / total) * Math.PI * 2
  const radius = 0.00045 + Math.min(total, 12) * 0.00004
  return {
    lat: position.lat + Math.sin(angle) * radius,
    lng: position.lng + Math.cos(angle) * radius,
  }
}

function markerLabel(item: Equipment) {
  const value = item.bin_number || item.id.slice(0, 6)
  return value.length > 4 ? value.slice(-4) : value
}

function binOverlayPoint(site: MapSite, index: number, total: number) {
  if (total <= 1) return { x: site.x, y: site.y }
  const angle = (index / total) * Math.PI * 2
  const radius = 1.8 + Math.min(total, 12) * 0.12
  return {
    x: Math.max(4, Math.min(96, site.x + Math.cos(angle) * radius)),
    y: Math.max(6, Math.min(94, site.y + Math.sin(angle) * radius)),
  }
}

function coordToPoint(site: Jobsite, index: number, total: number) {
  const position = knownPosition(site)
  if (position) {
    const minLat = 28.05
    const maxLat = 29.08
    const minLng = -81.95
    const maxLng = -80.95
    const x = ((position.lng - minLng) / (maxLng - minLng)) * 82 + 9
    const y = (1 - ((position.lat - minLat) / (maxLat - minLat))) * 76 + 12
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

type GoogleLatLng = { lat: number; lng: number }
type GoogleMapsWindow = Window & {
  google?: {
    maps: {
      Map: new (element: HTMLElement, options: object) => {
        setCenter: (latLng: GoogleLatLng) => void
        fitBounds: (bounds: unknown) => void
      }
      Marker: new (options: object) => { addListener: (eventName: string, cb: () => void) => void }
      InfoWindow: new (options: object) => { open: (map: unknown, marker: unknown) => void }
      LatLngBounds: new () => { extend: (latLng: GoogleLatLng) => void }
      Point: new (x: number, y: number) => unknown
      Geocoder: new () => { geocode: (request: { address: string }) => Promise<{ results: { geometry: { location: { lat: () => number; lng: () => number } } }[] }> }
    }
  }
  initSiteSyncGoogleMap?: () => void
}

let googleMapsLoading = false
let googleMapsLoaded = false
const googleCallbacks: (() => void)[] = []

function loadGoogleMaps(apiKey: string, cb: () => void) {
  const mapsWindow = window as GoogleMapsWindow
  if (googleMapsLoaded || mapsWindow.google?.maps) {
    cb()
    return
  }
  googleCallbacks.push(cb)
  if (googleMapsLoading) return
  googleMapsLoading = true
  mapsWindow.initSiteSyncGoogleMap = () => {
    googleMapsLoaded = true
    googleCallbacks.splice(0).forEach(fn => fn())
  }
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initSiteSyncGoogleMap&loading=async`
  script.async = true
  script.defer = true
  script.onerror = () => googleCallbacks.splice(0).forEach(fn => fn())
  document.head.appendChild(script)
}

function GoogleEquipmentMap({
  sites,
  selected,
  onSelect,
}: {
  sites: MapSite[]
  selected?: MapSite
  onSelect: (id: string) => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || ''

  useEffect(() => {
    if (!apiKey) return
    loadGoogleMaps(apiKey, () => setReady(Boolean((window as GoogleMapsWindow).google?.maps)))
  }, [apiKey])

  useEffect(() => {
    const mapsWindow = window as GoogleMapsWindow
    if (!ready || !mapRef.current || !mapsWindow.google?.maps) return

    let cancelled = false
    const google = mapsWindow.google
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 28.5384, lng: -81.3789 },
      zoom: 9,
      mapTypeControl: false,
      fullscreenControl: true,
      streetViewControl: false,
    })
    const bounds = new google.maps.LatLngBounds()
    const geocoder = new google.maps.Geocoder()

    async function positionFor(site: MapSite): Promise<GoogleLatLng | null> {
      const known = knownPosition(site)
      if (known) return known
      if (!site.address) return null
      try {
        const result = await geocoder.geocode({ address: site.address })
        const location = result.results[0]?.geometry.location
        return location ? { lat: location.lat(), lng: location.lng() } : null
      } catch {
        return null
      }
    }

    async function drawMarkers() {
      for (const site of sites) {
        const position = await positionFor(site)
        if (cancelled || !position) continue
        const equipment = site.equipment.length ? site.equipment : [{ id: `${site.id}-empty`, status: site.status, location: site.address }]
        equipment.forEach((item, index) => {
          const itemPosition = binMarkerPosition(position, index, equipment.length)
          const swap = needsSwap(item)
          const marker = new google.maps.Marker({
            map,
            position: itemPosition,
            title: `Bin #${item.bin_number || 'unassigned'} - ${site.address || 'Jobsite'}`,
            label: { text: item.bin_number ? markerLabel(item) : String(site.equipment.length), color: '#ffffff', fontWeight: '700', fontSize: '11px' },
            icon: {
              path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
              fillColor: swap ? '#ef4444' : '#22c55e',
              fillOpacity: 1,
              strokeColor: selected?.id === site.id ? '#ffffff' : '#0f172a',
              strokeWeight: selected?.id === site.id ? 3 : 2,
              scale: swap ? 1.45 : 1.25,
              anchor: new google.maps.Point(12, 24),
            },
          })
          const info = new google.maps.InfoWindow({
            content: `<div style="font-family:system-ui;min-width:220px"><strong>Bin #${item.bin_number || 'Unassigned'}</strong><br/>${site.address || 'Jobsite'}<br/>Status: ${swap ? 'Swap needed' : item.status || 'unknown'}<br/>Location: ${item.location || site.address || 'On site'}</div>`,
          })
          marker.addListener('click', () => {
            onSelect(site.id)
            info.open(map, marker)
          })
          bounds.extend(itemPosition)
        })
      }
      if (!cancelled && sites.length > 0) map.fitBounds(bounds)
    }

    drawMarkers()
    return () => {
      cancelled = true
    }
  }, [onSelect, ready, selected?.id, sites])

  if (!apiKey) return null

  return (
    <div className="xl:col-span-2 rounded-2xl border border-slate-700/50 bg-slate-900 overflow-hidden min-h-[560px] relative">
      <div ref={mapRef} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
          Loading Google Maps...
        </div>
      )}
    </div>
  )
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
  const hasGoogleMapKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY)
  const visibleBinMarkers = filteredSites.flatMap(site => site.equipment.map((item, index) => ({
    site,
    item,
    point: binOverlayPoint(site, index, site.equipment.length),
  })))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipment Map</h1>
          <p className="text-slate-400 mt-1">See every deployed bin by jobsite and identify the ones that need swaps.</p>
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
        {hasGoogleMapKey ? (
          <GoogleEquipmentMap sites={filteredSites} selected={selected} onSelect={setSelectedId} />
        ) : (
          <div className="xl:col-span-2 rounded-2xl border border-slate-700/50 bg-slate-900 overflow-hidden min-h-[560px] relative">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:48px_48px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(14,165,233,0.16),transparent_28%),radial-gradient(circle_at_72%_70%,rgba(34,197,94,0.12),transparent_30%)]" />
            <div className="absolute left-[18%] top-[18%] h-[62%] w-[62%] rounded-[42%] border border-slate-600/40 bg-slate-800/35 rotate-12" />
            <div className="absolute left-[24%] top-[26%] text-xs text-slate-500">DeLand</div>
            <div className="absolute left-[38%] top-[44%] text-xs text-slate-500">Orlando</div>
            <div className="absolute left-[18%] top-[70%] text-xs text-slate-500">ChampionsGate</div>
            <div className="absolute left-[60%] top-[55%] text-xs text-slate-500">Lake Nona</div>
            <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-transparent p-4">
              <div className="text-xs uppercase tracking-wide text-slate-300">Central Florida bin map</div>
              <div className="text-lg font-semibold text-white">{visibleBinMarkers.length} bins on the map</div>
              <div className="text-xs text-slate-300 mt-1">Red pins need swap. Green pins are okay. Pin positions use stored jobsite lat/lng when available.</div>
            </div>
            {visibleBinMarkers.map(({ site, item, point }) => {
              const swap = needsSwap(item)
              const active = selected?.id === site.id
              return (
                <button
                  key={`${site.id}-${item.id}`}
                  onClick={() => setSelectedId(site.id)}
                  className={`absolute z-20 -translate-x-1/2 -translate-y-full rounded-full border-2 shadow-lg transition-all ${active ? 'border-white scale-110' : 'border-slate-950'} ${swap ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  title={`Bin #${item.bin_number || item.id.slice(0, 6)} - ${site.address || 'Jobsite'}`}
                >
                  <span className="block min-w-8 px-1.5 py-1 text-center text-[10px] font-bold leading-none text-white">{markerLabel(item)}</span>
                </button>
              )
            })}
            <div className="absolute bottom-4 left-4 right-4 z-10 max-h-40 overflow-auto rounded-xl border border-slate-700/70 bg-slate-950/90 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Click a jobsite to move the map</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {filteredSites.slice(0, 8).map(site => (
                  <button
                    key={site.id}
                    onClick={() => setSelectedId(site.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${selected?.id === site.id ? 'border-sky-500/60 bg-sky-500/20 text-white' : 'border-slate-700/60 bg-slate-900/80 text-slate-300 hover:border-slate-500'}`}
                  >
                    <span className="block truncate font-medium">{site.address || 'Jobsite'}</span>
                    <span className={siteSwapCount(site) > 0 ? 'text-red-300' : 'text-green-300'}>{site.equipment.length} bins - {siteSwapCount(site)} need swap</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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
