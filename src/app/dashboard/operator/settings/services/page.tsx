'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_SERVICE_TYPES, type ServiceCategory } from '@/lib/equipmentServiceTypes'

type ServiceTypeRow = {
  id: string
  organization_id: string
  code: string
  label: string
  category: ServiceCategory
  capture_fields: any[]
  requires_photo: boolean
  default_rate?: number | null
  active: boolean
  sort_order: number
}

const categories: ServiceCategory[] = ['swap', 'service', 'refuel', 'inspect', 'deliver_only', 'pickup_only', 'relocate', 'emergency', 'other']

export default function ServiceSettingsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<ServiceTypeRow[]>([])
  const [orgId, setOrgId] = useState('')
  const [message, setMessage] = useState('')
  const [custom, setCustom] = useState({ code: '', label: '', category: 'other' as ServiceCategory, default_rate: '' })

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: member } = user ? await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle() : { data: null }
    const currentOrg = member?.organization_id || ''
    setOrgId(currentOrg)
    const { data } = await supabase.from('service_types').select('*').order('sort_order', { ascending: true })
    setRows((data || []) as ServiceTypeRow[])
  }, [supabase])

  useEffect(() => { load() }, [load])

  const updateRow = async (id: string, patch: Partial<ServiceTypeRow>) => {
    const { error } = await supabase.from('service_types').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    setMessage(error ? error.message : 'Service type updated.')
    await load()
  }

  const addDefaults = async () => {
    if (!orgId) return
    const { error } = await supabase.from('service_types').upsert(DEFAULT_SERVICE_TYPES.map(item => ({ ...item, organization_id: orgId })), { onConflict: 'organization_id,code' })
    setMessage(error ? error.message : 'Default service types enabled.')
    await load()
  }

  const addCustom = async () => {
    if (!orgId || !custom.code || !custom.label) {
      setMessage('Code and label are required.')
      return
    }
    const { error } = await supabase.from('service_types').insert({
      organization_id: orgId,
      code: custom.code.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
      label: custom.label,
      category: custom.category,
      capture_fields: [],
      requires_photo: false,
      default_rate: custom.default_rate ? Number(custom.default_rate) : null,
      active: true,
      sort_order: rows.length * 10 + 10,
    })
    setMessage(error ? error.message : 'Custom service type added.')
    if (!error) setCustom({ code: '', label: '', category: 'other', default_rate: '' })
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Service Types</h1>
          <p className="mt-1 text-slate-400">Control the labels, proof-photo requirement, and driver completion fields for each service.</p>
        </div>
        <button type="button" onClick={addDefaults} className="btn-secondary px-4 py-2 text-sm">Seed Defaults</button>
      </div>
      {message && <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">{message}</div>}

      <section className="card space-y-3">
        <h2 className="font-semibold text-white">Add custom service</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input className="input" placeholder="Code" value={custom.code} onChange={event => setCustom(prev => ({ ...prev, code: event.target.value }))} />
          <input className="input" placeholder="Label" value={custom.label} onChange={event => setCustom(prev => ({ ...prev, label: event.target.value }))} />
          <select className="input" value={custom.category} onChange={event => setCustom(prev => ({ ...prev, category: event.target.value as ServiceCategory }))}>{categories.map(category => <option key={category} value={category}>{category.replace(/_/g, ' ')}</option>)}</select>
          <input className="input" placeholder="Default rate" value={custom.default_rate} onChange={event => setCustom(prev => ({ ...prev, default_rate: event.target.value }))} />
        </div>
        <button type="button" onClick={addCustom} className="btn-primary px-4 py-2">Add Service</button>
      </section>

      <section className="grid gap-3">
        {rows.map(row => (
          <div key={row.id} className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_120px_120px_auto_auto]">
              <input className="input" value={row.label} onChange={event => updateRow(row.id, { label: event.target.value })} />
              <select className="input" value={row.category} onChange={event => updateRow(row.id, { category: event.target.value as ServiceCategory })}>{categories.map(category => <option key={category} value={category}>{category.replace(/_/g, ' ')}</option>)}</select>
              <input className="input" type="number" value={row.default_rate ?? ''} onChange={event => updateRow(row.id, { default_rate: event.target.value ? Number(event.target.value) : null })} />
              <input className="input" type="number" value={row.sort_order} onChange={event => updateRow(row.id, { sort_order: Number(event.target.value) })} />
              <button type="button" onClick={() => updateRow(row.id, { requires_photo: !row.requires_photo })} className={`rounded-lg border px-3 py-2 text-xs ${row.requires_photo ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200' : 'border-slate-700/50 bg-slate-800 text-slate-300'}`}>{row.requires_photo ? 'Photo Required' : 'No Photo'}</button>
              <button type="button" onClick={() => updateRow(row.id, { active: !row.active })} className={`rounded-lg border px-3 py-2 text-xs ${row.active ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-slate-700/50 bg-slate-800 text-slate-300'}`}>{row.active ? 'Active' : 'Inactive'}</button>
            </div>
            <div className="mt-2 text-xs text-slate-500">{row.code} - {(row.capture_fields || []).length} driver field(s)</div>
          </div>
        ))}
      </section>
    </div>
  )
}
