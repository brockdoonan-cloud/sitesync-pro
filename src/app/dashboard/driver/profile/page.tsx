'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function DriverProfilePage() {
  const supabase = useMemo(() => createClient(), [])
  const [driver, setDriver] = useState<any>(null)
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('drivers')
        .select('id,full_name,phone,organization_id,truck_id,organizations(name),trucks(truck_number,status)')
        .eq('user_id', user.id)
        .maybeSingle()
      setDriver({ ...data, email: user.email })
      setPhone(data?.phone || '')
    }
    load()
  }, [supabase])

  const save = async () => {
    if (!driver?.id) return
    const { error } = await supabase.from('drivers').update({ phone }).eq('id', driver.id)
    setMessage(error ? error.message : 'Phone updated.')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href="/dashboard/driver" className="text-sm text-sky-300 hover:text-sky-200">Back to route</Link>
      <section className="card space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Driver Profile</h1>
          <p className="mt-1 text-sm text-slate-400">{driver?.organizations?.name || 'Organization'} - Truck {driver?.trucks?.truck_number || 'not assigned'}</p>
        </div>
        {message && <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">{message}</div>}
        <div className="grid gap-3">
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Name</span>
            <input className="input" value={driver?.full_name || ''} readOnly />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Email</span>
            <input className="input" value={driver?.email || ''} readOnly />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Phone</span>
            <input className="input" value={phone} onChange={event => setPhone(event.target.value)} />
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={save} className="btn-primary px-4 py-2">Save Phone</button>
          <button type="button" onClick={signOut} className="btn-secondary px-4 py-2">Sign Out</button>
        </div>
      </section>
    </div>
  )
}
