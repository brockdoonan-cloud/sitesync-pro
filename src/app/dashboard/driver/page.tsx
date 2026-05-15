'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { CaptureField } from '@/lib/equipmentServiceTypes'

type DriverInfo = {
  id: string
  truck_id?: string | null
  full_name?: string | null
  phone?: string | null
  trucks?: { id?: string; truck_number?: string | null; driver_name?: string | null; status?: string | null } | null
}

type ShiftRow = {
  id: string
  clocked_in_at: string
  clocked_out_at?: string | null
  total_minutes?: number | null
}

type ServiceTypeRow = {
  id: string
  code?: string | null
  label?: string | null
  requires_photo?: boolean | null
  capture_fields?: CaptureField[] | null
}

type RouteRow = {
  id: string
  route_date?: string | null
  truck_id?: string | null
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
  service_type_id?: string | null
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
  capture_data?: Record<string, unknown> | null
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
  return (value || 'assigned').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function mapsHref(address?: string | null) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`
}

function elapsedLabel(shift?: ShiftRow | null) {
  if (!shift?.clocked_in_at) return ''
  const end = shift.clocked_out_at ? new Date(shift.clocked_out_at).getTime() : Date.now()
  const minutes = Math.max(0, Math.floor((end - new Date(shift.clocked_in_at).getTime()) / 60000))
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours}h ${remainder}m`
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
  const [driver, setDriver] = useState<DriverInfo | null>(null)
  const [shift, setShift] = useState<ShiftRow | null>(null)
  const [routes, setRoutes] = useState<RouteRow[]>([])
  const [serviceTypes, setServiceTypes] = useState<Record<string, ServiceTypeRow>>({})
  const [captureData, setCaptureData] = useState<Record<string, Record<string, string>>>({})
  const [proofPhotos, setProofPhotos] = useState<Record<string, File | null>>({})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState('')
  const [chargeStopId, setChargeStopId] = useState('')
  const [chargeType, setChargeType] = useState(chargeTypes[0].value)
  const [amount, setAmount] = useState(String(chargeTypes[0].amount))
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)

  const activeShift = Boolean(shift && !shift.clocked_out_at)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    const shiftResponse = await fetch('/api/driver/shifts')
    const shiftPayload = await shiftResponse.json().catch(() => ({}))
    if (!shiftResponse.ok) {
      setMessage(shiftPayload.error || 'Could not load driver profile.')
      setLoading(false)
      return
    }

    const driverRow = shiftPayload.driver as DriverInfo | null
    setDriver(driverRow)
    setShift((shiftPayload.shift || null) as ShiftRow | null)

    if (!driverRow?.truck_id) {
      setRoutes([])
      setLoading(false)
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    const { data: routeRows, error } = await supabase
      .from('driver_routes')
      .select('id,route_date,truck_id,driver_profile_id,truck_number,driver_name,status,opened_at,closed_at')
      .eq('route_date', today)
      .eq('truck_id', driverRow.truck_id)
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
        .select('id,route_id,stop_order,service_request_id,service_type_id,address,bin_numbers,stop_type,status,eta,eta_minutes,arrived_at,completed_at,notes,driver_notes,capture_data')
        .in('route_id', routeIds)
        .order('stop_order', { ascending: true })
      : { data: [] }

    const serviceTypeIds = Array.from(new Set((stops || []).map((stop: any) => stop.service_type_id).filter(Boolean)))
    if (serviceTypeIds.length) {
      const { data: typeRows } = await supabase
        .from('service_types')
        .select('id,code,label,requires_photo,capture_fields')
        .in('id', serviceTypeIds)
      setServiceTypes(Object.fromEntries((typeRows || []).map((row: any) => [row.id, row])))
    } else {
      setServiceTypes({})
    }

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

  const runShiftAction = async (action: 'clock_in' | 'clock_out') => {
    setBusyId(action)
    setMessage('')
    const gps = await currentPosition()
    const response = await fetch('/api/driver/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...gps }),
    })
    const payload = await response.json().catch(() => ({}))
    setBusyId('')
    if (!response.ok) setMessage(payload.error || 'Shift action failed.')
    else setMessage(action === 'clock_in' ? 'Shift started. You can open your route now.' : 'Shift complete.')
    await load()
  }

  const runRouteAction = async (routeId: string, action: 'open' | 'close') => {
    if (action === 'open' && !activeShift) {
      setMessage('Clock in to start your shift before opening a route.')
      return
    }
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

  const submitProofPhoto = async (stop: StopRow, file: File) => {
    const formData = new FormData()
    formData.append('charge_type', 'Proof photo')
    formData.append('amount', '0')
    formData.append('note', 'Required proof photo for service completion.')
    formData.append('photo', file)
    const response = await fetch(`/api/driver/stops/${stop.id}/charge`, { method: 'POST', body: formData })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Could not upload proof photo.')
  }

  const runStopAction = async (stop: StopRow, action: 'en_route' | 'arrived' | 'complete' | 'cancel') => {
    if (action === 'complete' && !activeShift) {
      setMessage('Clock in to start your shift before completing stops.')
      return
    }
    const serviceType = stop.service_type_id ? serviceTypes[stop.service_type_id] : null
    const fields = serviceType?.capture_fields || []
    const values = captureData[stop.id] || {}
    const missing = fields.find(field => field.required && !String(values[field.key] || '').trim())
    if (action === 'complete' && missing) {
      setMessage(`${missing.label} is required before completing this stop.`)
      return
    }
    const proofPhoto = proofPhotos[stop.id]
    if (action === 'complete' && serviceType?.requires_photo && !proofPhoto) {
      setMessage('This service type requires a proof photo before completion.')
      return
    }
    const reason = action === 'cancel' ? window.prompt('Why is this stop skipped?') || '' : ''
    if (action === 'cancel' && !reason.trim()) return

    setBusyId(`${stop.id}:${action}`)
    setMessage('')
    try {
      if (action === 'complete' && proofPhoto) await submitProofPhoto(stop, proofPhoto)
      const gps = await currentPosition()
      const response = await fetch(`/api/driver/stops/${stop.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason,
          eta_minutes: stop.eta_minutes || 45,
          proof_notes: action === 'complete' ? 'Completed from driver mobile workflow.' : undefined,
          capture_data: values,
          ...gps,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Stop action failed.')
      setMessage(action === 'complete' ? 'Stop completed. Billing and unit status were updated.' : `Stop marked ${statusLabel(action)}.`)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Stop action failed.')
    } finally {
      setBusyId('')
    }
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
    const response = await fetch(`/api/driver/stops/${stop.id}/charge`, { method: 'POST', body: formData })
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

  const updateCapture = (stopId: string, key: string, value: string) => {
    setCaptureData(prev => ({ ...prev, [stopId]: { ...(prev[stopId] || {}), [key]: value } }))
  }

  const onChargeTypeChange = (value: string) => {
    setChargeType(value)
    const selected = chargeTypes.find(item => item.value === value)
    setAmount(String(selected?.amount ?? 0))
  }

  const renderCaptureField = (stop: StopRow, field: CaptureField) => {
    const value = captureData[stop.id]?.[field.key] ?? String((stop.capture_data || {})[field.key] || '')
    if (field.type === 'select') {
      return (
        <select className="input" value={value} onChange={event => updateCapture(stop.id, field.key, event.target.value)}>
          <option value="">Select {field.label.toLowerCase()}</option>
          {(field.options || []).map(option => <option key={option} value={option}>{statusLabel(option)}</option>)}
        </select>
      )
    }
    if (field.type === 'boolean') {
      return (
        <label className="flex items-center gap-2 rounded-lg border border-slate-700/50 px-3 py-2 text-sm text-slate-300">
          <input type="checkbox" checked={value === 'true'} onChange={event => updateCapture(stop.id, field.key, event.target.checked ? 'true' : 'false')} />
          {field.label}
        </label>
      )
    }
    return <input className="input" type={field.type === 'number' ? 'number' : 'text'} value={value} onChange={event => updateCapture(stop.id, field.key, event.target.value)} placeholder={`${field.label}${field.unit ? ` (${field.unit})` : ''}`} />
  }

  return (
    <div className="pb-24 space-y-5">
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Driver Route</h1>
            <p className="mt-1 text-sm text-slate-400">{driver?.full_name || 'Driver'} {driver?.trucks?.truck_number ? `- Truck ${driver.trucks.truck_number}` : '- no truck assigned'}</p>
          </div>
          <Link href="/dashboard/driver/profile" className="rounded-lg border border-slate-700/60 px-3 py-2 text-xs text-slate-300">Profile</Link>
        </div>
        <div className="mt-4 rounded-xl border border-slate-700/50 bg-slate-950/50 p-3">
          {!shift ? (
            <button type="button" onClick={() => runShiftAction('clock_in')} disabled={busyId === 'clock_in' || !driver?.truck_id} className="btn-primary w-full py-3 disabled:opacity-50">Clock In</button>
          ) : shift.clocked_out_at ? (
            <div className="text-center text-sm text-green-300">Shift complete - {elapsedLabel(shift)}</div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Clocked in</div>
                <div className="text-xs text-slate-400">{elapsedLabel(shift)} elapsed</div>
              </div>
              <button type="button" onClick={() => runShiftAction('clock_out')} disabled={busyId === 'clock_out'} className="btn-secondary px-4 py-2 text-sm disabled:opacity-50">Clock Out</button>
            </div>
          )}
        </div>
      </div>

      {message && <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">{message}</div>}

      {loading ? (
        <div className="card py-10 text-center text-sm text-slate-400">Loading assigned route...</div>
      ) : !driver?.truck_id ? (
        <div className="card py-10 text-center text-sm text-slate-400">No truck is assigned to this driver yet. Ask dispatch to assign a truck before starting a shift.</div>
      ) : routes.length === 0 ? (
        <div className="card py-10 text-center text-sm text-slate-400">No route is assigned to your truck for today.</div>
      ) : routes.map(route => {
        const openStops = route.route_stops.filter(stop => !['completed', 'cancelled'].includes((stop.status || '').toLowerCase()))
        return (
          <section key={route.id} className="card space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">Truck {route.truck_number || driver.trucks?.truck_number || '-'}</h2>
                <p className="text-sm text-slate-400">{statusLabel(route.status)} - {openStops.length} open stop(s)</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => runRouteAction(route.id, 'open')} disabled={busyId === `${route.id}:open` || route.status === 'in_progress'} className="btn-secondary px-3 py-2 text-sm disabled:opacity-50">Open</button>
                <button type="button" onClick={() => runRouteAction(route.id, 'close')} disabled={busyId === `${route.id}:close` || openStops.length > 0} className="btn-primary px-3 py-2 text-sm disabled:opacity-50">End</button>
              </div>
            </div>

            <div className="space-y-3">
              {route.route_stops.map(stop => {
                const status = (stop.status || 'planned').toLowerCase()
                const done = ['completed', 'cancelled'].includes(status)
                const serviceType = stop.service_type_id ? serviceTypes[stop.service_type_id] : null
                const fields = serviceType?.capture_fields || []
                return (
                  <div key={stop.id} className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">Stop #{stop.stop_order} - {serviceType?.label || statusLabel(stop.stop_type)}</div>
                        <a href={mapsHref(stop.address)} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-sky-300 underline-offset-2 hover:underline">{stop.address || 'No address'}</a>
                        <div className="mt-1 text-xs text-slate-500">{statusLabel(stop.status)} - ETA {stop.eta ? new Date(stop.eta).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'pending'} - {(stop.bin_numbers || []).join(', ') || 'No unit attached'}</div>
                      </div>
                      <span className="rounded-full border border-slate-700/60 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">{statusLabel(stop.status)}</span>
                    </div>
                    {stop.notes && <p className="mt-3 rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-300">{stop.notes}</p>}
                    {fields.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 gap-2">
                        {fields.map(field => (
                          <label key={field.key} className="space-y-1">
                            <span className="text-xs text-slate-400">{field.label}{field.required && <span className="text-red-300"> *</span>}</span>
                            {renderCaptureField(stop, field)}
                          </label>
                        ))}
                      </div>
                    )}
                    {serviceType?.requires_photo && (
                      <label className="mt-3 block cursor-pointer rounded-lg border border-dashed border-slate-700/60 bg-slate-950/40 px-3 py-3 text-xs text-slate-300">
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={event => setProofPhotos(prev => ({ ...prev, [stop.id]: event.target.files?.[0] || null }))} />
                        {proofPhotos[stop.id]?.name || 'Required proof photo'}
                      </label>
                    )}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => runStopAction(stop, 'en_route')} disabled={done || Boolean(busyId)} className="min-h-11 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200 disabled:opacity-40">On the way</button>
                      <button type="button" onClick={() => runStopAction(stop, 'arrived')} disabled={done || Boolean(busyId)} className="min-h-11 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-300 disabled:opacity-40">Arrived</button>
                      <button type="button" onClick={() => runStopAction(stop, 'complete')} disabled={done || Boolean(busyId)} className="min-h-11 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-300 disabled:opacity-40">Completed</button>
                      <button type="button" onClick={() => runStopAction(stop, 'cancel')} disabled={done || Boolean(busyId)} className="min-h-11 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 disabled:opacity-40">Skipped</button>
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
