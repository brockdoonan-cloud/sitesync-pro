'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DivIcon, Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'

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

function knownPosition(site?: Jobsite): GoogleLatLng | null {
  if (!site) return null
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

const TILE_SIZE = 256
const DEFAULT_CENTER = { lat: 28.5384, lng: -81.3789 }

function projectLatLng(position: GoogleLatLng, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom
  const sinLat = Math.sin((Math.max(-85.0511, Math.min(85.0511, position.lat)) * Math.PI) / 180)
  return {
    x: ((position.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  }
}

function unprojectLatLng(point: { x: number; y: number }, zoom: number): GoogleLatLng {
  const scale = TILE_SIZE * 2 ** zoom
  const lng = (point.x / scale) * 360 - 180
  const n = Math.PI - (2 * Math.PI * point.y) / scale
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
  return { lat, lng }
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

function FallbackEquipmentMap({
  sites,
  selected,
  onSelect,
}: {
  sites: MapSite[]
  selected?: MapSite
  onSelect: (id: string) => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<LeafletMap | null>(null)
  const markerLayer = useRef<{ clearLayers: () => void; addLayer: (marker: LeafletMarker) => void } | null>(null)
  const initialCenter = useRef<GoogleLatLng>(knownPosition(selected || sites[0]) || DEFAULT_CENTER)
  const visibleBinMarkers = useMemo(() => sites.flatMap(site => site.equipment.map((item, index) => ({
    site,
    item,
    position: binMarkerPosition(knownPosition(site) || DEFAULT_CENTER, index, site.equipment.length),
  }))), [sites])

  useEffect(() => {
    let cancelled = false

    async function initMap() {
      if (!mapRef.current || leafletMap.current) return
      const L = await import('leaflet')
      if (cancelled || !mapRef.current) return

      const map = L.map(mapRef.current, {
        center: [initialCenter.current.lat, initialCenter.current.lng],
        zoom: 10,
        minZoom: 7,
        maxZoom: 17,
        preferCanvas: true,
        zoomControl: true,
        attributionControl: true,
        wheelDebounceTime: 40,
        wheelPxPerZoomLevel: 90,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '(c) OpenStreetMap',
        keepBuffer: 5,
        updateWhenIdle: true,
        updateWhenZooming: false,
      }).addTo(map)
      markerLayer.current = L.layerGroup().addTo(map)
      leafletMap.current = map
    }

    initMap()

    return () => {
      cancelled = true
      leafletMap.current?.remove()
      leafletMap.current = null
      markerLayer.current = null
    }
  }, [])

  useEffect(() => {
    const map = leafletMap.current
    if (!map) return
    const next = knownPosition(selected)
    if (next) map.panTo([next.lat, next.lng], { animate: true, duration: 0.35 })
  }, [selected])

  useEffect(() => {
    let cancelled = false

    async function renderMarkers() {
      const map = leafletMap.current
      const layer = markerLayer.current
      if (!map || !layer) return
      const L = await import('leaflet')
      if (cancelled) return
      layer.clearLayers()

      const bounds: [number, number][] = []
      visibleBinMarkers.forEach(({ site, item, position }) => {
        const swap = needsSwap(item)
        const active = selected?.id === site.id
        const icon: DivIcon = L.divIcon({
          className: '',
          html: `<button class="bin-map-pin ${swap ? 'bin-map-pin-swap' : 'bin-map-pin-ok'} ${active ? 'bin-map-pin-active' : ''}">${markerLabel(item)}</button>`,
          iconSize: [34, 28],
          iconAnchor: [17, 28],
        })
        const marker = L.marker([position.lat, position.lng], { icon })
          .bindPopup(`<strong>Bin #${item.bin_number || item.id.slice(0, 6)}</strong><br/>${site.address || 'Jobsite'}<br/>${swap ? 'Swap needed' : item.status || 'OK'}`)
          .on('click', () => onSelect(site.id))
        layer.addLayer(marker)
        bounds.push([position.lat, position.lng])
      })

      if (bounds.length && !selected) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 11 })
    }

    renderMarkers()

    return () => {
      cancelled = true
    }
  }, [onSelect, selected, visibleBinMarkers])

  useEffect(() => {
    const timer = window.setTimeout(() => leafletMap.current?.invalidateSize(), 100)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="xl:col-span-2 rounded-2xl border border-slate-700/50 bg-slate-900 overflow-hidden min-h-[560px] relative isolate">
      <div ref={mapRef} className="absolute inset-0 z-0 bg-slate-900" />
    </div>
  )
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
  const [failed, setFailed] = useState(false)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || ''

  useEffect(() => {
    if (!apiKey) return
    setFailed(false)
    loadGoogleMaps(apiKey, () => setReady(Boolean((window as GoogleMapsWindow).google?.maps)))
    const timeout = window.setTimeout(() => {
      if (!(window as GoogleMapsWindow).google?.maps) setFailed(true)
    }, 5000)
    return () => window.clearTimeout(timeout)
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

  if (!apiKey || failed) return <FallbackEquipmentMap sites={sites} selected={selected} onSelect={onSelect} />

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
          <FallbackEquipmentMap sites={filteredSites} selected={selected} onSelect={setSelectedId} />
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
