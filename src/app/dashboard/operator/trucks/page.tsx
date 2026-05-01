'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  { id: 'demo-12', truck_number: '12', driver: 'Mike R.', status: 'en_route', lat: 28.5384, lng: -81.3689, last_seen: new Date().toISOString(), capacity: 8 },
  { id: 'demo-18', truck_number: '18', driver: 'Carlos M.', status: 'servicing', lat: 28.4332, lng: -81.2983, last_seen: new Date(Date.now() - 120000).toISOString(), capacity: 6 },
  { id: 'demo-24', truck_number: '24', driver: 'Sam T.', status: 'available', lat: 28.8045, lng: -81.2652, last_seen: new Date(Date.now() - 180000).toISOString(), capacity: 7 },
  { id: 'demo-31', truck_number: '31', driver: 'J. Davis', status: 'returning', lat: 28.5420, lng: -81.3800, last_seen: new Date(Date.now() - 30000).toISOString(), capacity: 8 },
]

const STATUS_COLOR: Record<string, string> = {
  en_route:  '#22d3ee',
  servicing: '#ef4444',
  available: '#22c55e',
  returning: '#a78bfa',
  offline:   '#6b7280',
}

const STATUS_LABEL: Record<string, string> = {
  en_route:  'En route',
  servicing: 'Servicing',
  available: 'Available',
  returning: 'Returning',
  offline:   'Offline',
}

function timeAgo(iso?: string) {
  if (!iso) return 'Unknown'
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return secs + 's ago'
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago'
  return Math.floor(secs / 3600) + 'h ago'
}

export default function TrucksPage() {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Truck | null>(null)
  const [tick, setTick] = useState(0)
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const mapInstanceRef = useRef<any>(null)
  const supabase = createClient()

  // Load trucks from Supabase, fall back to demo
  const loadTrucks = useCallback(async () => {
    const { data } = await supabase.from('trucks').select('*')
    if (data && data.length > 0) {
      setTrucks(data.map((t: any) => ({
        id: t.id,
        truck_number: t.truck_number || t.id.slice(0, 4),
        driver: t.driver_name || t.driver || 'Unassigned',
        status: t.status || 'available',
        lat: t.current_lat || t.lat,
        lng: t.current_lng || t.lng,
        last_seen: t.last_seen_at || t.updated_at,
        capacity: t.capacity || 6,
      })))
    } else {
      setTrucks(DEMO_TRUCKS)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadTrucks() }, [loadTrucks])

  // Tick every 5s to update timeAgo labels
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 5000)
    return () => clearInterval(t)
  }, [])

  // Simulate demo GPS drift
  useEffect(() => {
    if (trucks.length === 0 || trucks[0].id !== 'demo-12') return
    const t = setInterval(() => {
      setTrucks(prev => prev.map(tr => ({
        ...tr,
        lat: (tr.lat || 28.5) + (Math.random() - 0.5) * 0.002,
        lng: (tr.lng || -81.3) + (Math.random() - 0.5) * 0.002,
        last_seen: tr.status !== 'available' ? new Date().toISOString() : tr.last_seen,
      })))
    }, 4000)
    return () => clearInterval(t)
  }, [trucks])

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Dynamically load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Dynamically load Leaflet JS
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      const L = (window as any).L
      leafletRef.current = L

      const map = L.map(mapRef.current!, {
        center: [28.5, -81.35],
        zoom: 10,
        zoomControl: true,
      })

      // OpenStreetMap tiles — free, no API key needed
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = map
    }
    document.head.appendChild(script)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersRef.current = {}
      }
    }
  }, [])

  // Update markers whenever trucks change
  useEffect(() => {
    const L = leafletRef.current
    const map = mapInstanceRef.current
    if (!L || !map) return

    trucks.forEach(truck => {
      if (!truck.lat || !truck.lng) return

      const color = STATUS_COLOR[truck.status || 'offline'] || '#6b7280'
      const label = STATUS_LABEL[truck.status || 'offline'] || truck.status || 'Offline'

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          background:${color};
          color:#fff;
          padding:4px 8px;
          border-radius:8px;
          font-size:12px;
          font-weight:700;
          white-space:nowrap;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
          border:2px solid rgba(255,255,255,0.3);
          cursor:pointer;
        ">Truck ${truck.truck_number}<br/><span style="font-size:10px;font-weight:400;">${label}</span></div>`,
        iconAnchor: [40, 20],
      })

      if (markersRef.current[truck.id]) {
        markersRef.current[truck.id].setLatLng([truck.lat, truck.lng])
        markersRef.current[truck.id].setIcon(icon)
      } else {
        const marker = L.marker([truck.lat, truck.lng], { icon })
          .addTo(map)
          .on('click', () => setSelected(truck))
        markersRef.current[truck.id] = marker
      }
    })
  }, [trucks])

  const googleMapsUrl = (t: Truck) =>
    t.lat && t.lng
      ? `https://www.google.com/maps?q=${t.lat},${t.lng}&z=15`
      : 'https://www.google.com/maps'

  const activeTrucks = trucks.filter(t => t.status !== 'available' && t.status !== 'offline')
  const available = trucks.filter(t => t.status === 'available')
  const gpsOnline = trucks.filter(t => t.lat && t.lng)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Truck GPS</h1>
          <p className="text-slate-400 mt-1">Live fleet tracking with real-world map</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadTrucks}
            className="btn-secondary text-sm px-4 py-2"
          >
            Refresh
          </button>
        </div>
      </div>

      {trucks.some(t => t.id.startsWith('demo-')) && (
        <div className="bg-sky-500/10 border border-sky-500/30 text-sky-400 text-sm rounded-xl px-4 py-3">
          Demo mode — simulating GPS movement. Production tracking uses driver app location pings into Supabase (trucks table: current_lat, current_lng, last_seen_at).
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Fleet Trucks', value: trucks.length, color: 'text-white' },
          { label: 'Active', value: activeTrucks.length, color: 'text-sky-400' },
          { label: 'Available', value: available.length, color: 'text-green-400' },
          { label: 'GPS Online', value: gpsOnline.length, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Real Map */}
        <div className="lg:col-span-2 bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div ref={mapRef} style={{ height: '500px', width: '100%' }} />
        </div>

        {/* Truck list */}
        <div className="space-y-2 overflow-y-auto max-h-[500px]">
          {loading ? (
            [1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-800/40 rounded-xl animate-pulse" />)
          ) : trucks.map(truck => (
            <div
              key={truck.id}
              onClick={() => {
                setSelected(selected?.id === truck.id ? null : truck)
                if (mapInstanceRef.current && truck.lat && truck.lng) {
                  mapInstanceRef.current.setView([truck.lat, truck.lng], 14, { animate: true })
                }
              }}
              className={`rounded-xl border px-4 py-3 cursor-pointer transition-all ${
                selected?.id === truck.id
                  ? 'bg-sky-500/10 border-sky-500/40'
                  : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white">Truck {truck.truck_number}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: STATUS_COLOR[truck.status || 'offline'] + '30', color: STATUS_COLOR[truck.status || 'offline'] }}
                >
                  {STATUS_LABEL[truck.status || 'offline']}
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
                    onClick={e => e.stopPropagation()}
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
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
