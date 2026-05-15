'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_EQUIPMENT_TYPES, DEFAULT_SERVICE_TYPES, defaultServiceCodesForEquipment } from '@/lib/equipmentServiceTypes'

export default function EquipmentOnboardingWizardPage() {
  const supabase = useMemo(() => createClient(), [])
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [rates, setRates] = useState<Record<string, string>>({})
  const [selectedServices, setSelectedServices] = useState<string[]>(['emergency'])
  const [step, setStep] = useState(1)
  const [message, setMessage] = useState('')

  const toggleEquipment = (code: string) => {
    setSelectedEquipment(prev => {
      const next = prev.includes(code) ? prev.filter(item => item !== code) : [...prev, code]
      setSelectedServices(defaultServiceCodesForEquipment(next))
      return next
    })
  }

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: member } = user ? await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle() : { data: null }
    const organizationId = member?.organization_id
    if (!organizationId) {
      setMessage('No organization was found for this login.')
      return
    }

    const equipmentRows = DEFAULT_EQUIPMENT_TYPES.map(item => ({
      ...item,
      organization_id: organizationId,
      active: selectedEquipment.includes(item.code),
      default_monthly_rate: rates[item.code] ? Number(rates[item.code]) : item.default_monthly_rate ?? null,
    }))
    const serviceRows = DEFAULT_SERVICE_TYPES.map(item => ({
      ...item,
      organization_id: organizationId,
      active: selectedServices.includes(item.code),
    }))

    const equipmentResult = await supabase.from('equipment_types').upsert(equipmentRows, { onConflict: 'organization_id,code' })
    if (equipmentResult.error) {
      setMessage(equipmentResult.error.message)
      return
    }
    const serviceResult = await supabase.from('service_types').upsert(serviceRows, { onConflict: 'organization_id,code' })
    setMessage(serviceResult.error ? serviceResult.error.message : 'Equipment and service setup saved.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Equipment Setup</h1>
        <p className="mt-1 text-slate-400">Pick what you rent; SiteSync automatically enables the right services and driver labels.</p>
      </div>
      {message && <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">{message}</div>}

      {step === 1 && (
        <section className="card space-y-4">
          <h2 className="font-semibold text-white">1. What equipment do you rent?</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DEFAULT_EQUIPMENT_TYPES.map(item => {
              const active = selectedEquipment.includes(item.code)
              return (
                <button key={item.code} type="button" onClick={() => toggleEquipment(item.code)} className={`rounded-xl border p-4 text-left ${active ? 'border-sky-400/60 bg-sky-500/10' : 'border-slate-700/50 bg-slate-900/40'}`}>
                  <div className="font-semibold text-white">{item.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.category.replace(/_/g, ' ')} - {item.unit_of_measure}</div>
                </button>
              )
            })}
          </div>
          <button type="button" onClick={() => setStep(2)} className="btn-primary px-4 py-2">Next</button>
        </section>
      )}

      {step === 2 && (
        <section className="card space-y-4">
          <h2 className="font-semibold text-white">2. Set monthly rates</h2>
          {selectedEquipment.map(code => {
            const type = DEFAULT_EQUIPMENT_TYPES.find(item => item.code === code)
            if (!type) return null
            return (
              <div key={code} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3 sm:grid-cols-[1fr_180px]">
                <div>
                  <div className="font-medium text-white">{type.label}</div>
                  <div className="text-xs text-slate-500">{type.unit_of_measure}</div>
                </div>
                <input className="input" placeholder="Monthly rate" value={rates[code] || ''} onChange={event => setRates(prev => ({ ...prev, [code]: event.target.value }))} />
              </div>
            )
          })}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="btn-secondary px-4 py-2">Back</button>
            <button type="button" onClick={() => setStep(3)} className="btn-primary px-4 py-2">Next</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="card space-y-4">
          <h2 className="font-semibold text-white">3. Confirm services</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DEFAULT_SERVICE_TYPES.map(service => {
              const active = selectedServices.includes(service.code)
              return (
                <button key={service.code} type="button" onClick={() => setSelectedServices(prev => active ? prev.filter(code => code !== service.code) : [...prev, service.code])} className={`rounded-xl border p-4 text-left ${active ? 'border-green-400/60 bg-green-500/10' : 'border-slate-700/50 bg-slate-900/40'}`}>
                  <div className="font-semibold text-white">{service.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{service.requires_photo ? 'Photo required' : 'No photo required'}</div>
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)} className="btn-secondary px-4 py-2">Back</button>
            <button type="button" onClick={save} className="btn-primary px-4 py-2">Save Setup</button>
          </div>
        </section>
      )}

      <Link href="/dashboard/operator/settings/equipment" className="text-sm text-sky-300 hover:text-sky-200">Manage equipment settings</Link>
    </div>
  )
}
