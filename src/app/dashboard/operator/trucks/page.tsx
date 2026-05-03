'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DivIcon, Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'

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

type LatLng = { lat: number; lng: number }
type GoogleMapsWindow = Window & {
  google?: {
    maps: {
      Map: new (element: HTMLElement, options: object) => {
        fitBounds: (bounds: unknown) => void
        panTo: (latLng: LatLng) => void
        setZoom: (zoom: number) => void
      }
      Marker: new (options: object) => { addListener: (eventName: string, cb: () => void) => void }
      InfoWindow: new (options: object) => { open: (map: unknown, marker: unknown) => void }
      LatLngBounds: new () => { extend: (latLng: LatLng) => void }
      Point: new (x: number, y: number) => unknown
    }
  }
  initSiteSyncTruckMap?: () => void
}

let googleMapsLoading = false
let googleMapsLoaded = false
const googleCallbacks: (() => void)[] = []

const DEMO_TRUCKS: Truck[] = [
  { id: 'demo-12', truck_number: '12', driver: 'Mike R.', status: 'en_route', lat: 28.5384, lng: -81.3689, last_seen: new Date().toISOString(), capacity: 8 },
  { id: 'demo-18', truck_number: '18', driver: 'Carlos M.', status: 'servicing', lat: 28.4332, lng: -81.2983, last_seen: new Date(Date.now() - 120000).toISOString(), capacity: 6 },
  { id: 'demo-24', truck_number: '24', driver: 'Sam T.', status: 'available', lat: 28.8045, lng: -81.2652, last_seen: new Date(Date.now() - 180000).toISOString(), capacity: 7 },
  { id: 'demo-31', truck_number: '31', driver: 'J. Davis', status: 'returning', lat: 28.5420, lng: -81.3800, last_seen: new Date(Date.now() - 30000).toISOString(), capacity: 8 },
]

const STATUS_COLOR: Record<string, string> = {
  en_route: '#22d3ee',
  servicing: '#ef4444',
  available: '#22c55e',
  returning: '#a78bfa',
  offline: '#6b7280',
}

const STATUS_LABEL: Record<string, string> = {
  en_route: 'En route',
  servicing: 'Servicing',
  available: 'Available',
  returning: 'Returning',
  offline: 'Offline',
}

function loadGoogleMaps(apiKey: string, cb: () => void) {
  const mapsWindow = window as GoogleMapsWindow
  if (googleMapsLoaded || mapsWindow.google?.maps) {
    cb()
    return
  }
  googleCallbacks.push(cb)
  if (googleMapsLoading) return
  googleMapsLoading = true
  mapsWindow.initSiteSyncTruckMap = () => {
    googleMapsLoaded = true
    googleCallbacks.splice(0).forEach(fn => fn())
  }
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initSiteSyncTruckMap&loading=async`
  script.async = true
  script.defer = true
  script.onerror = () => googleCallbacks.splice(0).forEach(fn => fn())
  document.head.appendChild(script)
}

function timeAgo(iso?: string) {
  if (!iso) return 'Unknown'
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

function googleMapsUrl(truck: Truck) {
  return truck.lat && truck.lng ? `https://www.google.com/maps?q=${truck.lat},${truck.lng}&z=15` : 'https://www.google.com/maps'
}

function TruckMap({
  trucks,
  selectedId,
  onSelect,
}: {
  trucks: Truck[]
  selectedId?: string
  onSelect: (truck: Truck) => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const googleMap = useRef<InstanceType<NonNullable<GoogleMapsWindow['google']>['maps']['Map']> | null>(null)
  const leafletMap = useRef<LeafletMap | null>(null)
  const markerLayer = useRef<{ clearLayers: () => void; addLayer: (marker: LeafletMarker) => void } | null>(null)
  const [googleReady, setGoogleReady] = useState(false)
  const [googleFailed, setGoogleFailed] = useState(false)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || ''

  useEffect(() => {
    if (!apiKey) return
    setGoogleFailed(false)
    loadGoogleMaps(apiKey, () => setGoogleReady(Boolean((window as GoogleMapsWindow).google?.maps)))
    const timer = window.setTimeout(() => {
      if (!(window as GoogleMapsWindow).google?.maps) setGoogleFailed(true)
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [apiKey])

  useEffect(() => {
    const mapsWindow = window as GoogleMapsWindow
    if (!apiKey || !googleReady || googleFailed || !mapRef.current || !mapsWindow.google?.maps) return
    const google = mapsWindow.google
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 28.5384, lng: -81.3789 },
      zoom: 9,
      mapTypeControl: false,
      fullscreenControl: true,
      streetViewControl: false,
    })
    googleMap.current = map
    const bounds = new google.maps.LatLngBounds()
    trucks.forEach(truck => {
      const position = { lat: truck.lat || 28.5384, lng: truck.lng || -81.3789 }
      const marker = new google.maps.Marker({
        map,
        position,
        title: `Truck ${truck.truck_number}`,
        label: { text: `T${truck.truck_number}`, color: selectedId === truck.id ? '#0f172a' : '#ffffff', fontWeight: '800', fontSize: '12px' },
        icon: {
          path: 'M3 13h2l2-5h8l2 5h2v6h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3v-6z',
          fillColor: selectedId === truck.id ? '#38bdf8' : STATUS_COLOR[truck.status || 'offline'] || '#6b7280',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: selectedId === truck.id ? 3 : 2,
          scale: 1.35,
          anchor: new google.maps.Point(11, 14),
        },
      })
      const info = new google.maps.InfoWindow({
        content: `<div style="font-family:system-ui;min-width:180px"><strong>Truck ${truck.truck_number}</strong><br/>${truck.driver || 'Unassigned'}<br/>${STATUS_LABEL[truck.status || 'offline'] || truck.status || 'Offline'}<br/>GPS ${timeAgo(truck.last_seen)}</div>`,
      })
      marker.addListener('click', () => {
        onSelect(truck)
        info.open(map, marker)
      })
      bounds.extend(position)
    })
    if (trucks.length) map.fitBounds(bounds)
  }, [apiKey, googleFailed, googleReady, onSelect, selectedId, trucks])

  useEffect(() => {
    const selected = trucks.find(truck => truck.id === selectedId)
    if (selected?.lat && selected.lng && googleMap.current) {
      googleMap.current.panTo({ lat: selected.lat, lng: selected.lng })
      googleMap.current.setZoom(14)
    }
  }, [selectedId, trucks])

  useEffect(() => {
    if (apiKey && googleReady && !googleFailed) return
    let cancelled = false
    async function initLeaflet() {
      if (!mapRef.current || leafletMap.current) return
      const L = await import('leaflet')
      if (cancelled || !mapRef.current) return
      const map = L.map(mapRef.current, {
        center: [28.5384, -81.3789],
        zoom: 9,
        preferCanvas: true,
        zoomControl: true,
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
    initLeaflet()
    return () => {
      cancelled = true
      leafletMap.current?.remove()
      leafletMap.current = null
      markerLayer.current = null
    }
  }, [apiKey, googleFailed, googleReady])

  useEffect(() => {
    if (apiKey && googleReady && !googleFailed) return
    let cancelled = false
    async function renderLeaflet() {
      const map = leafletMap.current
      const layer = markerLayer.current
      if (!map || !layer) return
      const L = await import('leaflet')
      if (cancelled) return
      layer.clearLayers()
      const bounds: [number, number][] = []
      trucks.forEach(truck => {
        const lat = truck.lat || 28.5384
        const lng = truck.lng || -81.3789
        const icon: DivIcon = L.divIcon({
          className: '',
          html: `<button class="truck-map-pin ${selectedId === truck.id ? 'truck-map-pin-active' : ''}">T${truck.truck_number}</button>`,
          iconSize: [44, 30],
          iconAnchor: [22, 30],
        })
        const marker = L.marker([lat, lng], { icon })
          .bindPopup(`<strong>Truck ${truck.truck_number}</strong><br/>${truck.driver || 'Unassigned'}<br/>${STATUS_LABEL[truck.status || 'offline'] || truck.status || 'Offline'}`)
          .on('click', () => onSelect(truck))
        layer.addLayer(marker)
        bounds.push([lat, lng])
      })
      const selected = trucks.find(truck => truck.id === selectedId)
      if (selected?.lat && selected.lng) map.setView([selected.lat, selected.lng], 14, { animate: true })
      else if (bounds.length) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 10 })
    }
    renderLeaflet()
    return () => {
      cancelled = true
    }
  }, [apiKey, googleFailed, googleReady, onSelect, selectedId, trucks])

  return (
    <div className="lg:col-span-2 rounded-2xl border border-slate-700/50 bg-slate-900 min-h-[500px] relative overflow-hidden">
      <div ref={mapRef} className="absolute inset-0" />
      {apiKey && !googleReady && !googleFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
          Loading Google Maps...
        </div>
      )}
    </div>
  )
}

export default function TrucksPage() {
  const [trucks, setTrucks] = useState<Truck[]>(DEMO_TRUCKS)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Truck | null>(null)
  const [tick, setTick] = useState(0)
  const supabase = useMemo(() => createClient(), [])

  const loadTrucks = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('trucks').select('*')
    if (data && data.length > 0) {
      setTrucks(data.map((truck: any) => ({
        id: truck.id,
        truck_number: truck.truck_number || truck.id.slice(0, 4),
        driver: truck.driver_name || truck.driver || 'Unassigned',
        status: truck.status || 'available',
        lat: truck.current_lat || truck.lat,
        lng: truck.current_lng || truck.lng,
        last_seen: truck.last_seen_at || truck.last_seen || truck.updated_at,
        capacity: truck.capacity || 6,
      })))
    } else {
      setTrucks(DEMO_TRUCKS)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadTrucks() }, [loadTrucks])

  useEffect(() => {
    const timer = window.setInterval(() => setTick(value => value + 1), 5000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!trucks.some(truck => truck.id.startsWith('demo-'))) return
    const timer = window.setInterval(() => {
      setTrucks(prev => prev.map(truck => ({
        ...truck,
        lat: (truck.lat || 28.5) + (truck.status !== 'available' ? (Math.random() - 0.5) * 0.002 : 0),
        lng: (truck.lng || -81.3) + (truck.status !== 'available' ? (Math.random() - 0.5) * 0.002 : 0),
        last_seen: truck.status !== 'available' ? new Date().toISOString() : truck.last_seen,
      })))
    }, 4000)
    return () => window.clearInterval(timer)
  }, [trucks])

  const activeTrucks = trucks.filter(truck => truck.status !== 'available' && truck.status !== 'offline')
  const available = trucks.filter(truck => truck.status === 'available')
  const gpsOnline = trucks.filter(truck => truck.lat && truck.lng)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Truck GPS</h1>
          <p className="text-slate-400 mt-1">Live fleet tracking with the same real-world map layer used by equipment.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadTrucks} className="btn-secondary text-sm px-4 py-2">Refresh</button>
          <Link href="/dashboard/operator/routes" className="btn-primary text-sm px-4 py-2">Optimize Routes</Link>
        </div>
      </div>

      {trucks.some(truck => truck.id.startsWith('demo-')) && (
        <div className="bg-sky-500/10 border border-sky-500/30 text-sky-400 text-sm rounded-xl px-4 py-3">
          Demo mode is simulating GPS movement. Production tracking uses driver app location pings into Supabase.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Fleet Trucks', value: trucks.length, color: 'text-white' },
          { label: 'Active', value: activeTrucks.length, color: 'text-sky-400' },
          { label: 'Available', value: available.length, color: 'text-green-400' },
          { label: 'GPS Online', value: gpsOnline.length, color: 'text-purple-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TruckMap trucks={trucks} selectedId={selected?.id} onSelect={setSelected} />

        <div className="space-y-2 overflow-y-auto max-h-[500px]">
          {loading ? (
            [1, 2, 3, 4].map(item => <div key={item} className="h-28 bg-slate-800/40 rounded-xl animate-pulse" />)
          ) : trucks.map(truck => (
            <button
              key={truck.id}
              onClick={() => setSelected(selected?.id === truck.id ? null : truck)}
              className={`w-full text-left rounded-xl border px-4 py-3 cursor-pointer transition-all ${
                selected?.id === truck.id
                  ? 'bg-sky-500/10 border-sky-500/40'
                  : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white">Truck {truck.truck_number}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${STATUS_COLOR[truck.status || 'offline'] || '#6b7280'}30`, color: STATUS_COLOR[truck.status || 'offline'] || '#6b7280' }}
                >
                  {STATUS_LABEL[truck.status || 'offline'] || truck.status || 'Offline'}
                </span>
              </div>
              <div className="text-slate-400 text-sm mb-1">{truck.driver || 'Unassigned'}</div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>GPS: {tick >= 0 && timeAgo(truck.last_seen)}</span>
                {truck.lat && truck.lng && (
                  <a
                    href={googleMapsUrl(truck)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={event => event.stopPropagation()}
                    className="text-sky-400 hover:text-sky-300 underline"
                  >
                    Open in Maps
                  </a>
                )}
              </div>
              {truck.lat && truck.lng && (
                <div className="text-xs text-slate-600 font-mono mt-1">
                  {truck.lat.toFixed(4)}, {truck.lng.toFixed(4)}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
