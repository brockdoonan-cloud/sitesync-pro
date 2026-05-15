'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type RouteRow = {
  id: string
  route_date?: string | null
  truck_number?: string | null
  driver_name?: string | null
  status?: string | null
  opened_at?: string | null
  closed_at?: string | null
  route_stops: StopRow[]
}

type StopRow = {
  id: string
  route_id: string
  stop_order: number
  service_request_id?: string | null
  address?: string | null
  bin_numbers?: string[] | null
  stop_type?: string | null
  status?: string | null
  eta?: string | null
  eta_minutes?: number | null
  arrived_at?: string | null
  completed_at?: string | null
  notes?: string | null
  driver_notes?: string | null
}

const chargeTypes = [
  { value: 'Overloaded / oversized / solid', amount: 250 },
  { value: 'Trash / unauthorized materials', amount: 450 },
  { value: 'Dead run', amount: 450 },
  { value: 'Container covering hook', amount: 250 },
  { value: 'Standby', amount: 75 },
  { value: 'Slurry pump-out', amount: 395 },
  { value: 'Vacuum truck dispatch', amount: 0 },
  { value: 'Other', amount: 0 },
]

function statusLabel(value?: string | null) {
  return (value || 'planned').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function mapsHref(address?: string | null) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`
}

async function currentPosition(): Promise<{ lat?: number; lng?: number }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return {}
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
    )
  })
}

export default function DriverDashboardPage() {
  const supabase = useMemo(() => createClient(), [])
  const [routes, setRoutes] = useState<RouteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState('')
  const [chargeStopId, setChargeStopId] = useState('')
  const [chargeType, setChargeType] = useState(chargeTypes[0].value)
  const [amount, setAmount] = useState(String(chargeTypes[0].amount))
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const { data: routeRows, error } = await supabase
      .from('driver_routes')
      .select('id,route_date,truck_number,driver_name,status,opened_at,closed_at')
      .eq('route_date', today)
      .in('status', ['planned', 'in_progress', 'ready_to_close'])
      .order('truck_number', { ascending: true })
    if (error) {
      setMessage(error.message)
      setRoutes([])
      setLoading(false)
      return
    }

    const typedRouteRows = (routeRows || []) as RouteRow[]
    const routeIds = typedRouteRows.map(route => route.id)
    const { data: stops } = routeIds.length
      ? await supabase
        .from('route_stops')
        .select('id,route_id,stop_order,service_request_id,address,bin_numbers,stop_type,status,eta,eta_minutes,arrived_at,completed_at,notes,driver_notes')
        .in('route_id', routeIds)
        .order('stop_order', { ascending: true })
      : { data: [] }
    const stopsByRoute = new Map<string, StopRow[]>()
    ;(stops || []).forEach((stop: StopRow) => {
      const current = stopsByRoute.get(stop.route_id) || []
      current.push(stop)
      stopsByRoute.set(stop.route_id, current)
    })
    setRoutes(typedRouteRows.map(route => ({ ...route, route_stops: stopsByRoute.get(route.id) || [] })))
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const runRouteAction = async (routeId: string, action: 'open' | 'close') => {
    setBusyId(`${routeId}:${action}`)
    setMessage('')
    const response = await fetch(`/api/driver/routes/${routeId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const payload = await response.json().catch(() => ({}))
    setBusyId('')
    if (!response.ok) setMessage(payload.error || 'Route action failed.')
    else setMessage(action === 'open' ? 'Route started. Your first stop is now on the way.' : 'Route ended and is ready for billing review.')
    await load()
  }

  const runStopAction = async (stop: StopRow, action: 'en_route' | 'arrived' | 'complete' | 'cancel') => {
    const reason = action === 'cancel' ? window.prompt('Why is this stop skipped?') || '' : ''
    if (action === 'cancel' && !reason.trim()) return
    setBusyId(`${stop.id}:${action}`)
    setMessage('')
    const gps = await currentPosition()
    const response = await fetch(`/api/driver/stops/${stop.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        reason,
        eta_minutes: stop.eta_minutes || 45,
        proof_notes: action === 'complete' ? 'Completed from driver mobile workflow.' : undefined,
        ...gps,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    setBusyId('')
    if (!response.ok) setMessage(payload.error || 'Stop action failed.')
    else setMessage(action === 'complete' ? 'Stop completed. Billing and bin location were updated.' : `Stop marked ${statusLabel(action)}.`)
    await load()
  }

  const submitCharge = async (stop: StopRow) => {
    if (!photo) {
      setMessage('Take or upload a photo before submitting the charge.')
      return
    }
    setBusyId(`${stop.id}:charge`)
    setMessage('')
    const formData = new FormData()
    formData.append('charge_type', chargeType)
    formData.append('amount', amount)
    formData.append('note', note)
    formData.append('photo', photo)
    const response = await fetch(`/api/driver/stops/${stop.id}/charge`, {
      method: 'POST',
      body: formData,
    })
    const payload = await response.json().catch(() => ({}))
    setBusyId('')
    if (!response.ok) {
      setMessage(payload.error || 'Could not add charge.')
      return
    }
    setMessage(`Added ${chargeType} charge for $${Number(amount || 0).toFixed(2)}.`)
    setChargeStopId('')
    setPhoto(null)
    setNote('')
    await load()
  }

  const onChargeTypeChange = (value: string) => {
    setChargeType(value)
    const selected = chargeTypes.find(item => item.value === value)
    setAmount(String(selected?.amount ?? 0))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Driver Route</h1>
        <p className="mt-1 text-slate-400">Open your route, update each stop, capture proof photos, and close the route when the day is complete.</p>
      </div>

      {message && <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">{message}</div>}

      {loading ? (
        <div className="card py-10 text-center text-sm text-slate-400">Loading assigned routes...</div>
      ) : routes.length === 0 ? (
        <div className="card py-10 text-center text-sm text-slate-400">No driver routes are assigned for today.</div>
      ) : routes.map(route => {
        const openStops = route.route_stops.filter(stop => !['completed', 'cancelled'].includes((stop.status || '').toLowerCase()))
        return (
          <section key={route.id} className="card space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold text-white">Truck {route.truck_number || '-'}</h2>
                <p className="text-sm text-slate-400">{route.driver_name || 'Driver'} · {statusLabel(route.status)} · {openStops.length} open stop(s)</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => runRouteAction(route.id, 'open')} disabled={busyId === `${route.id}:open` || route.status === 'in_progress'} className="btn-secondary px-3 py-2 text-sm disabled:opacity-50">Open</button>
                <button type="button" onClick={() => runRouteAction(route.id, 'close')} disabled={busyId === `${route.id}:close` || openStops.length > 0} className="btn-primary px-3 py-2 text-sm disabled:opacity-50">End Route</button>
              </div>
            </div>

            <div className="space-y-3">
              {route.route_stops.map(stop => {
                const status = (stop.status || 'planned').toLowerCase()
                const done = ['completed', 'cancelled'].includes(status)
                return (
                  <div key={stop.id} className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">Stop #{stop.stop_order} · {statusLabel(stop.stop_type)}</div>
                        <a href={mapsHref(stop.address)} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-sky-300 underline-offset-2 hover:underline">{stop.address || 'No address'}</a>
                        <div className="mt-1 text-xs text-slate-500">{statusLabel(stop.status)} · ETA {stop.eta ? new Date(stop.eta).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'pending'} · {(stop.bin_numbers || []).join(', ') || 'No bin attached'}</div>
                      </div>
                      <span className="rounded-full border border-slate-700/60 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">{statusLabel(stop.status)}</span>
                    </div>
                    {stop.notes && <p className="mt-3 rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-300">{stop.notes}</p>}
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <button type="button" onClick={() => runStopAction(stop, 'en_route')} disabled={done || Boolean(busyId)} className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200 disabled:opacity-40">On the way</button>
                      <button type="button" onClick={() => runStopAction(stop, 'arrived')} disabled={done || Boolean(busyId)} className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-300 disabled:opacity-40">Arrived</button>
                      <button type="button" onClick={() => runStopAction(stop, 'complete')} disabled={done || Boolean(busyId)} className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-300 disabled:opacity-40">Completed</button>
                      <button type="button" onClick={() => runStopAction(stop, 'cancel')} disabled={done || Boolean(busyId)} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 disabled:opacity-40">Skipped</button>
                    </div>
                    <button type="button" onClick={() => setChargeStopId(chargeStopId === stop.id ? '' : stop.id)} disabled={done} className="mt-3 w-full rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-200 disabled:opacity-40">Photo + additional charge</button>
                    {chargeStopId === stop.id && (
                      <div className="mt-3 space-y-3 rounded-xl border border-slate-700/50 bg-slate-950/50 p-3">
                        <input type="file" accept="image/*" capture="environment" onChange={event => setPhoto(event.target.files?.[0] || null)} className="input" />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
                          <select className="input" value={chargeType} onChange={event => onChargeTypeChange(event.target.value)}>
                            {chargeTypes.map(item => <option key={item.value} value={item.value}>{item.value}</option>)}
                          </select>
                          <input className="input" type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} />
                        </div>
                        <textarea className="input min-h-[80px]" value={note} onChange={event => setNote(event.target.value)} placeholder="Photo context, blocked access, contamination, standby time..." />
                        <button type="button" onClick={() => submitCharge(stop)} disabled={busyId === `${stop.id}:charge`} className="btn-primary w-full px-4 py-2 text-sm disabled:opacity-50">{busyId === `${stop.id}:charge` ? 'Submitting...' : 'Submit Charge'}</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
