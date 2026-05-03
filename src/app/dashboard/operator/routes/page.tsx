'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DivIcon, Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'

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

type ServiceRequest = {
  id: string
  service_type?: string | null
  jobsite_address?: string | null
  service_address?: string | null
  bin_number?: string | null
  status?: string | null
  preferred_date?: string | null
  scheduled_date?: string | null
  priority?: string | null
  notes?: string | null
  jobsite_id?: string | null
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
  request?: ServiceRequest
  priorityScore: number
  distanceFromPrevious?: number
}

type AssignedRoute = {
  truck: Truck
  stops: Stop[]
  miles: number
  swaps: number
}

type LatLng = { lat: number; lng: number }
type GoogleMapsWindow = Window & {
  google?: {
    maps: {
      Map: new (element: HTMLElement, options: object) => {
        fitBounds: (bounds: unknown) => void
      }
      Marker: new (options: object) => { addListener: (eventName: string, cb: () => void) => void }
      InfoWindow: new (options: object) => { open: (map: unknown, marker: unknown) => void }
      LatLngBounds: new () => { extend: (latLng: LatLng) => void }
      Point: new (x: number, y: number) => unknown
    }
  }
  initSiteSyncRouteMap?: () => void
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
  mapsWindow.initSiteSyncRouteMap = () => {
    googleMapsLoaded = true
    googleCallbacks.splice(0).forEach(fn => fn())
  }
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initSiteSyncRouteMap&loading=async`
  script.async = true
  script.defer = true
  script.onerror = () => googleCallbacks.splice(0).forEach(fn => fn())
  document.head.appendChild(script)
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

function requestPriorityScore(request: ServiceRequest) {
  const service = (request.service_type || '').toLowerCase()
  const priority = (request.priority || '').toLowerCase()
  let score = 10
  if (['urgent', 'emergency'].includes(priority) || service === 'emergency') score += 28
  if (['high'].includes(priority) || ['swap', 'pump_out', 'water_removal'].includes(service)) score += 16
  if (request.bin_number) score += 4
  return score
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
  const waypoints = stops.flatMap(routeAddressesForStop).slice(0, 9).map(stop => encodeURIComponent(stop)).join('/')
  return `https://www.google.com/maps/dir/${encodeURIComponent(start)}/${waypoints}`
}

function mapsSearchUrl(site: Jobsite) {
  return `https://www.google.com/maps/search/${encodeURIComponent(addressFor(site))}`
}

function routeStopType(stop: Stop) {
  return stop.request?.service_type || (stop.equipment.some(needsSwap) ? 'swap' : 'service')
}

function jobsiteNameFromNotes(notes?: string | null) {
  return notes?.match(/Jobsite:\s*([^.]+)/i)?.[1]?.trim()
}

function noteField(notes: string | null | undefined, label: string) {
  return notes?.match(new RegExp(`${label}:\\s*([^.]+)`, 'i'))?.[1]?.trim()
}

function swapPlanFromNotes(notes?: string | null) {
  return {
    pickupBin: noteField(notes, 'Pickup bin'),
    landfill: noteField(notes, 'Landfill'),
    dropoffJobsite: noteField(notes, 'Next jobsite'),
    dropoffAddress: noteField(notes, 'Dropoff address'),
  }
}

function routeAddressesForStop(stop: Stop) {
  const plan = swapPlanFromNotes(stop.request?.notes)
  return [
    addressFor(stop),
    plan.landfill,
    plan.dropoffAddress || plan.dropoffJobsite,
  ].filter(Boolean) as string[]
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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

function DispatchMap({
  routes,
  stops,
  selectedTruck,
  tick,
  onSelectTruck,
}: {
  routes: AssignedRoute[]
  stops: Stop[]
  selectedTruck: string
  tick: number
  onSelectTruck: (id: string) => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
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
      center: HOME_BASE,
      zoom: 9,
      mapTypeControl: false,
      fullscreenControl: true,
      streetViewControl: false,
    })
    const bounds = new google.maps.LatLngBounds()

    stops.forEach(stop => {
      const position = roughCoord(stop)
      const urgent = stop.equipment.filter(needsSwap).length
      const marker = new google.maps.Marker({
        map,
        position,
        title: `${stop.name || addressFor(stop)} - ${urgent} swaps`,
        label: urgent ? { text: String(urgent), color: '#ffffff', fontWeight: '800' } : undefined,
        icon: {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
          fillColor: urgent ? '#ef4444' : '#22c55e',
          fillOpacity: 1,
          strokeColor: '#0f172a',
          strokeWeight: 2,
          scale: urgent ? 1.45 : 1.2,
          anchor: new google.maps.Point(12, 24),
        },
      })
      const info = new google.maps.InfoWindow({
        content: `<div style="font-family:system-ui;min-width:220px"><strong>${stop.name || addressFor(stop)}</strong><br/>${addressFor(stop)}<br/>${urgent} swap bins | ${stop.equipment.length} total bins</div>`,
      })
      marker.addListener('click', () => info.open(map, marker))
      bounds.extend(position)
    })

    routes.forEach(route => {
      const position = liveTruckPosition(route.truck, route.stops, tick)
      const marker = new google.maps.Marker({
        map,
        position,
        title: `Truck ${route.truck.truck_number}`,
        label: { text: `T${route.truck.truck_number}`, color: selectedTruck === route.truck.id ? '#0f172a' : '#ffffff', fontWeight: '800', fontSize: '12px' },
        icon: {
          path: 'M3 13h2l2-5h8l2 5h2v6h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3v-6z',
          fillColor: selectedTruck === route.truck.id ? '#38bdf8' : '#0f172a',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: selectedTruck === route.truck.id ? 3 : 2,
          scale: 1.35,
          anchor: new google.maps.Point(11, 14),
        },
      })
      marker.addListener('click', () => onSelectTruck(route.truck.id))
      bounds.extend(position)
    })

    bounds.extend(HOME_BASE)
    map.fitBounds(bounds)
  }, [apiKey, googleFailed, googleReady, onSelectTruck, routes, selectedTruck, stops, tick])

  useEffect(() => {
    if (apiKey && googleReady && !googleFailed) return
    let cancelled = false

    async function initLeaflet() {
      if (!mapRef.current || leafletMap.current) return
      const L = await import('leaflet')
      if (cancelled || !mapRef.current) return
      const map = L.map(mapRef.current, {
        center: [HOME_BASE.lat, HOME_BASE.lng],
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

      stops.forEach(stop => {
        const position = roughCoord(stop)
        const urgent = stop.equipment.filter(needsSwap).length
        const icon: DivIcon = L.divIcon({
          className: '',
          html: `<button class="bin-map-pin ${urgent ? 'bin-map-pin-swap' : 'bin-map-pin-ok'}">${urgent || stop.equipment.length}</button>`,
          iconSize: [34, 28],
          iconAnchor: [17, 28],
        })
        const marker = L.marker([position.lat, position.lng], { icon })
          .bindPopup(`<strong>${stop.name || addressFor(stop)}</strong><br/>${addressFor(stop)}<br/>${urgent} swap bins`)
        layer.addLayer(marker)
        bounds.push([position.lat, position.lng])
      })

      routes.forEach(route => {
        const position = liveTruckPosition(route.truck, route.stops, tick)
        const active = selectedTruck === route.truck.id
        const icon: DivIcon = L.divIcon({
          className: '',
          html: `<button class="truck-map-pin ${active ? 'truck-map-pin-active' : ''}">T${route.truck.truck_number}</button>`,
          iconSize: [44, 30],
          iconAnchor: [22, 30],
        })
        const marker = L.marker([position.lat, position.lng], { icon }).on('click', () => onSelectTruck(route.truck.id))
        layer.addLayer(marker)
        bounds.push([position.lat, position.lng])
      })

      if (bounds.length) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 10 })
    }

    renderLeaflet()
    return () => {
      cancelled = true
    }
  }, [apiKey, googleFailed, googleReady, onSelectTruck, routes, selectedTruck, stops, tick])

  return (
    <div className="xl:col-span-2 rounded-2xl border border-slate-700/50 bg-slate-900 overflow-hidden min-h-[560px] relative">
      <div ref={mapRef} className="absolute inset-0" />
      {apiKey && !googleReady && !googleFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
          Loading Google Maps...
        </div>
      )}
    </div>
  )
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
  const [savingPlan, setSavingPlan] = useState(false)
  const [message, setMessage] = useState('')
  const [manual, setManual] = useState({
    jobsiteName: '',
    address: '',
    binNumber: '',
    landfill: '',
    dropoffJobsite: '',
    dropoffAddress: '',
    serviceType: 'swap',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const [usingDemo, setUsingDemo] = useState(true)
  const [filter, setFilter] = useState<'swap' | 'all'>('swap')
  const [selectedTruck, setSelectedTruck] = useState(DEMO_TRUCKS[0].id)
  const [tick, setTick] = useState(0)
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    const [{ data: jobsites }, { data: equipment }, { data: truckRows }, { data: serviceRequests }] = await Promise.all([
      supabase.from('jobsites').select('id,name,address,city,state,zip,lat,lng,status').order('status', { ascending: true }),
      supabase.from('equipment').select('id,bin_number,status,location,jobsite_id,last_serviced_at').order('bin_number', { ascending: true }),
      supabase.from('trucks').select('id,truck_number,status').order('truck_number', { ascending: true }),
      supabase
        .from('service_requests')
        .select('id,service_type,jobsite_address,service_address,bin_number,status,preferred_date,scheduled_date,priority,notes,jobsite_id')
        .in('status', ['dispatch_ready', 'pending', 'scheduled', 'confirmed', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    const mappedSites: Stop[] = (jobsites || []).map((site: Jobsite) => {
      const siteEquipment = (equipment || []).filter((item: Equipment) => item.jobsite_id === site.id)
      return {
        ...site,
        equipment: siteEquipment,
        priorityScore: priorityScore(site, siteEquipment),
      }
    }).filter((site: Stop) => site.equipment.length > 0)

    const requestStops = (serviceRequests || []).map((request: ServiceRequest) => {
      const linkedSite = mappedSites.find(site => site.id === request.jobsite_id)
      const linkedEquipment = request.bin_number
        ? (equipment || []).filter((item: Equipment) => item.bin_number === request.bin_number)
        : []
      const jobsiteName = jobsiteNameFromNotes(request.notes)
      return {
        id: `request-${request.id}`,
        name: jobsiteName || linkedSite?.name || `${(request.service_type || 'service').replace(/_/g, ' ')} request`,
        address: request.jobsite_address || request.service_address || linkedSite?.address || 'Orlando, FL',
        lat: linkedSite?.lat,
        lng: linkedSite?.lng,
        status: request.status || 'dispatch_ready',
        equipment: linkedEquipment.length ? linkedEquipment : request.bin_number ? [{ id: `request-bin-${request.id}`, bin_number: request.bin_number, status: 'needs_swap', location: request.jobsite_address || request.service_address || jobsiteName || 'Requested jobsite' }] : [],
        request,
        priorityScore: requestPriorityScore(request),
      }
    }) as Stop[]

    const mapped = [...requestStops, ...mappedSites]

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
  }, [supabase])

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
  const dispatchRequests = sites.filter(site => site.request).length

  const createManualSwap = async () => {
    const jobsiteName = manual.jobsiteName.trim()
    const address = manual.address.trim()
    const location = address || jobsiteName
    if (!location) {
      setMessage('Enter a jobsite name or address before adding a manual swap.')
      return
    }
    setLoading(true)
    setMessage('')
    const notes = [
      `Manual dispatch entry.`,
      jobsiteName ? `Jobsite: ${jobsiteName}.` : '',
      manual.binNumber ? `Pickup bin: ${manual.binNumber}.` : '',
      manual.landfill.trim() ? `Landfill: ${manual.landfill.trim()}.` : '',
      manual.dropoffJobsite.trim() ? `Next jobsite: ${manual.dropoffJobsite.trim()}.` : '',
      manual.dropoffAddress.trim() ? `Dropoff address: ${manual.dropoffAddress.trim()}.` : '',
      manual.notes,
    ].filter(Boolean).join(' ')
    const { error } = await supabase.from('service_requests').insert({
      service_type: manual.serviceType,
      jobsite_address: location,
      service_address: location,
      bin_number: manual.binNumber || null,
      preferred_date: manual.date || null,
      scheduled_date: manual.date || null,
      priority: manual.serviceType === 'emergency' ? 'urgent' : 'high',
      status: 'dispatch_ready',
      notes,
    })
    if (error) {
      setMessage(`Manual swap was not saved: ${error.message}`)
      setLoading(false)
      return
    }
    setManual({ jobsiteName: '', address: '', binNumber: '', landfill: '', dropoffJobsite: '', dropoffAddress: '', serviceType: 'swap', date: new Date().toISOString().slice(0, 10), notes: '' })
    setMessage('Manual dispatch stop added and routed.')
    await load()
  }

  const saveDispatchPlan = async () => {
    if (!routes.length) return
    setSavingPlan(true)
    setMessage('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      await supabase.from('driver_routes').delete().eq('route_date', today).eq('status', 'planned')

      let routeCount = 0
      let stopCount = 0
      for (const route of routes.filter(item => item.stops.length > 0)) {
        const { data: savedRoute, error: routeError } = await supabase
          .from('driver_routes')
          .insert({
            route_date: today,
            truck_number: route.truck.truck_number,
            driver_name: route.truck.driver,
            status: 'planned',
            start_address: HOME_BASE.address,
            total_miles: Number(route.miles.toFixed(1)),
            estimated_minutes: Math.round(route.miles * 3.2 + route.stops.length * 18),
          })
          .select('id')
          .single()
        if (routeError) throw routeError

        const stopRows = route.stops.map((stop, index) => ({
          route_id: savedRoute.id,
          stop_order: index + 1,
          jobsite_id: stop.request?.jobsite_id || (isUuid(stop.id) ? stop.id : null),
          service_request_id: stop.request?.id || null,
          address: addressFor(stop),
          lat: roughCoord(stop).lat,
          lng: roughCoord(stop).lng,
          bin_numbers: stop.equipment.map(item => item.bin_number).filter(Boolean),
          stop_type: routeStopType(stop),
          status: 'planned',
          notes: stop.request?.notes || `${stop.equipment.length} bins on site`,
        }))
        const { error: stopError } = await supabase.from('route_stops').insert(stopRows)
        if (stopError) throw stopError
        routeCount++
        stopCount += stopRows.length
      }

      const requestIds = routes.flatMap(route => route.stops.map(stop => stop.request?.id).filter(Boolean) as string[])
      if (requestIds.length > 0) await supabase.from('service_requests').update({ status: 'scheduled' }).in('id', requestIds)
      setMessage(`Saved ${routeCount} driver route(s) and ${stopCount} stop(s).`)
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save dispatch plan.')
    } finally {
      setSavingPlan(false)
    }
  }

  const cancelDispatchRequest = async (stop: Stop) => {
    if (!stop.request?.id) return
    setMessage('')
    const { error } = await supabase
      .from('service_requests')
      .update({
        status: 'cancelled',
        notes: [stop.request.notes, 'Cancelled by dispatch before route completion.'].filter(Boolean).join('\n'),
      })
      .eq('id', stop.request.id)
    if (error) {
      setMessage(`Could not cancel stop: ${error.message}`)
      return
    }
    setMessage('Dispatch stop cancelled and removed from active routing.')
    await load()
  }

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
          { label: 'Dispatch Requests', value: dispatchRequests, color: 'text-yellow-300' },
          { label: 'Est. Miles', value: Math.round(totalMiles), color: 'text-violet-300' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {message && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-300">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1">Pickup jobsite or project</label>
              <input className="input" value={manual.jobsiteName} onChange={event => setManual(prev => ({ ...prev, jobsiteName: event.target.value }))} placeholder="Project Neptune, Cocoa, Reserve of Twin Lakes..." />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1">Pickup address if known</label>
              <input className="input" value={manual.address} onChange={event => setManual(prev => ({ ...prev, address: event.target.value }))} placeholder="123 Jobsite Rd, Orlando, FL" />
            </div>
            <div className="md:w-36">
              <label className="block text-xs font-medium text-slate-400 mb-1">Pickup bin</label>
              <input className="input font-mono" value={manual.binNumber} onChange={event => setManual(prev => ({ ...prev, binNumber: event.target.value }))} placeholder="121872" />
            </div>
            <div className="md:w-40">
              <label className="block text-xs font-medium text-slate-400 mb-1">Service</label>
              <select className="input" value={manual.serviceType} onChange={event => setManual(prev => ({ ...prev, serviceType: event.target.value }))}>
                <option value="swap">Swap</option>
                <option value="pickup">Pickup</option>
                <option value="delivery">Delivery</option>
                <option value="water_removal">Water removal</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div className="md:w-40">
              <label className="block text-xs font-medium text-slate-400 mb-1">Date</label>
              <input type="date" className="input" value={manual.date} onChange={event => setManual(prev => ({ ...prev, date: event.target.value }))} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Closest landfill / dump</label>
              <input className="input" value={manual.landfill} onChange={event => setManual(prev => ({ ...prev, landfill: event.target.value }))} placeholder="Orange County Landfill, Orlando, FL" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Next jobsite</label>
              <input className="input" value={manual.dropoffJobsite} onChange={event => setManual(prev => ({ ...prev, dropoffJobsite: event.target.value }))} placeholder="Project LaBrea, bin #131074..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Next address if known</label>
              <input className="input" value={manual.dropoffAddress} onChange={event => setManual(prev => ({ ...prev, dropoffAddress: event.target.value }))} placeholder="9801 International Dr, Orlando, FL" />
            </div>
          </div>
          <div className="mt-3 flex flex-col md:flex-row gap-3">
            <input className="input flex-1" value={manual.notes} onChange={event => setManual(prev => ({ ...prev, notes: event.target.value }))} placeholder="Gate code, time window, correction note..." />
            <button onClick={createManualSwap} className="btn-primary px-5 py-2">Add Manual Stop</button>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
          <h2 className="font-semibold text-white">Dispatch plan</h2>
          <p className="text-sm text-slate-400 mt-1">Save the optimized routes into driver route tables for today.</p>
          <button onClick={saveDispatchPlan} disabled={savingPlan || routes.every(route => route.stops.length === 0)} className="btn-secondary w-full mt-4 py-3 disabled:opacity-50">
            {savingPlan ? 'Saving...' : 'Save Optimized Routes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <DispatchMap routes={routes} stops={visibleStops} selectedTruck={selectedTruck} tick={tick} onSelectTruck={setSelectedTruck} />

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
                  const swapPlan = swapPlanFromNotes(stop.request?.notes)
                  return (
                    <div key={stop.id} className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${urgent.length ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-green-500/15 border-green-500/30 text-green-300'}`}>{index + 1}</div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{stop.name || addressFor(stop)}</div>
                        <div className="text-xs text-slate-400 truncate">{addressFor(stop)}</div>
                        <div className="text-xs text-slate-500 mt-1">{(stop.distanceFromPrevious || 0).toFixed(1)} mi | {urgent.length} swap bins | {stop.equipment.length} total bins</div>
                        {(swapPlan.pickupBin || swapPlan.landfill || swapPlan.dropoffJobsite || swapPlan.dropoffAddress) && (
                          <div className="mt-2 rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
                            <div className="font-semibold text-white">Swap chain</div>
                            <div>1. Pick up {swapPlan.pickupBin ? `bin #${swapPlan.pickupBin}` : 'assigned bin'} from {stop.name || addressFor(stop)}</div>
                            <div>2. Dump/clean at {swapPlan.landfill || 'closest landfill'}</div>
                            <div>3. Drop at {swapPlan.dropoffJobsite || swapPlan.dropoffAddress || 'next assigned jobsite'}</div>
                          </div>
                        )}
                        {stop.request && (
                          <button
                            type="button"
                            onClick={() => cancelDispatchRequest(stop)}
                            className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-500/20"
                          >
                            Cancel dispatch stop
                          </button>
                        )}
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
