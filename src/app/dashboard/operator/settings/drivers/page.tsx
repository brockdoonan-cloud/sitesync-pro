'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type TruckRow = { id: string; truck_number?: string | null; status?: string | null }
type DriverRow = {
  id: string
  user_id: string
  full_name: string
  phone?: string | null
  truck_id?: string | null
  active?: boolean | null
  invited_at?: string | null
  first_login_at?: string | null
  trucks?: TruckRow | null
  driver_shifts?: Array<{ clocked_in_at: string; clocked_out_at?: string | null; total_minutes?: number | null }>
}

const emptyInvite = { full_name: '', email: '', phone: '', truck_id: '' }

export default function OperatorDriverSettingsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [trucks, setTrucks] = useState<TruckRow[]>([])
  const [invite, setInvite] = useState(emptyInvite)
  const [showInvite, setShowInvite] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: driverRows }, { data: truckRows }] = await Promise.all([
      supabase
        .from('drivers')
        .select('id,user_id,full_name,phone,truck_id,active,invited_at,first_login_at,trucks(id,truck_number,status),driver_shifts(clocked_in_at,clocked_out_at,total_minutes)')
        .order('full_name', { ascending: true }),
      supabase.from('trucks').select('id,truck_number,status').order('truck_number', { ascending: true }),
    ])
    setDrivers((driverRows || []) as DriverRow[])
    setTrucks((truckRows || []) as TruckRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const inviteDriver = async () => {
    setMessage('')
    const response = await fetch('/api/operator/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...invite, truck_id: invite.truck_id || null }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(payload.error || 'Could not invite driver.')
      return
    }
    setInvite(emptyInvite)
    setShowInvite(false)
    setMessage('Driver invited. Supabase will send the magic-link email.')
    await load()
  }

  const patchDriver = async (driverId: string, values: Record<string, unknown>) => {
    const response = await fetch(`/api/operator/drivers/${driverId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const payload = await response.json().catch(() => ({}))
    setMessage(response.ok ? 'Driver updated.' : payload.error || 'Could not update driver.')
    await load()
  }

  const statusText = (driver: DriverRow) => {
    if (driver.active === false) return 'Inactive'
    if (!driver.first_login_at) return 'Invited'
    return 'Active'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Driver Settings</h1>
          <p className="mt-1 text-slate-400">Invite driver magic-link accounts, lock each driver to one truck, and review shift activity.</p>
        </div>
        <button type="button" onClick={() => setShowInvite(true)} className="btn-primary px-4 py-2 text-sm">Invite Driver</button>
      </div>

      {message && <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">{message}</div>}

      {showInvite && (
        <section className="card space-y-4">
          <h2 className="font-semibold text-white">Invite driver</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input className="input" placeholder="Full name" value={invite.full_name} onChange={event => setInvite(prev => ({ ...prev, full_name: event.target.value }))} />
            <input className="input" placeholder="Email" value={invite.email} onChange={event => setInvite(prev => ({ ...prev, email: event.target.value }))} />
            <input className="input" placeholder="Phone" value={invite.phone} onChange={event => setInvite(prev => ({ ...prev, phone: event.target.value }))} />
            <select className="input" value={invite.truck_id} onChange={event => setInvite(prev => ({ ...prev, truck_id: event.target.value }))}>
              <option value="">Assign truck later</option>
              {trucks.map(truck => <option key={truck.id} value={truck.id}>Truck {truck.truck_number || truck.id}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={inviteDriver} className="btn-primary px-4 py-2">Send Invite</button>
            <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary px-4 py-2">Cancel</button>
          </div>
        </section>
      )}

      <section className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading drivers...</div>
        ) : drivers.length === 0 ? (
          <div className="p-6 text-sm text-slate-400">No drivers invited yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700/50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Driver</th>
                  <th className="px-4 py-3 text-left">Truck</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Last shift</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(driver => {
                  const latestShift = driver.driver_shifts?.[0]
                  return (
                    <tr key={driver.id} className="border-b border-slate-800/80 last:border-0">
                      <td className="px-4 py-3 text-white">
                        <div className="font-medium">{driver.full_name}</div>
                        <div className="text-xs text-slate-500">{driver.phone || 'No phone'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <select className="input min-w-40" value={driver.truck_id || ''} onChange={event => patchDriver(driver.id, { truck_id: event.target.value || null })}>
                          <option value="">No truck</option>
                          {trucks.map(truck => <option key={truck.id} value={truck.id}>Truck {truck.truck_number || truck.id}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{statusText(driver)}</td>
                      <td className="px-4 py-3 text-slate-400">{latestShift ? new Date(latestShift.clocked_in_at).toLocaleString() : 'No shifts yet'}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => patchDriver(driver.id, { active: driver.active === false })} className="rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
                          {driver.active === false ? 'Reactivate' : 'Deactivate'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
