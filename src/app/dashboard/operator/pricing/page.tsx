'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_PRICING, calculatePrice, money, serviceLabel, type MileageBand, type ServiceCode } from '@/lib/pricing'

const serviceOptions: ServiceCode[] = ['delivery', 'swap', 'pickup', 'water_removal', 'relocate', 'onsite_relocate', 'dead_run']

export default function PricingPage() {
  const supabase = useMemo(() => createClient(), [])
  const [mileageBands, setMileageBands] = useState(DEFAULT_PRICING.mileageBands.map(band => ({
    label: band.label,
    minMiles: String(band.minMiles),
    maxMiles: band.maxMiles === null ? '' : String(band.maxMiles),
    rate: String(band.rate),
  })))
  const [profile, setProfile] = useState({
    name: 'Orlando standard pricing',
    included_miles: String(DEFAULT_PRICING.includedMiles),
    extra_mile_rate: String(DEFAULT_PRICING.extraMileRate),
    one_bin_service: String(DEFAULT_PRICING.oneBinService),
    two_bin_service: String(DEFAULT_PRICING.twoBinService),
    fuel_surcharge_percent: String(DEFAULT_PRICING.fuelSurchargePercent),
    environmental_fee: String(DEFAULT_PRICING.environmentalFee),
    monthly_usage: String(DEFAULT_PRICING.monthlyUsage),
  })
  const [calc, setCalc] = useState({ serviceCode: 'swap' as ServiceCode, quantity: '1', miles: '24', sameDay: false, trashFee: false, overloadFee: false, standbyMinutes: '0' })
  const [message, setMessage] = useState('')

  const parsedMileageBands = useMemo<MileageBand[]>(() => (
    mileageBands
      .map(band => ({
        label: band.label.trim() || `${band.minMiles || 0}-${band.maxMiles || '+'} miles`,
        minMiles: Number(band.minMiles || 0),
        maxMiles: band.maxMiles.trim() ? Number(band.maxMiles) : null,
        rate: Number(band.rate || 0),
      }))
      .filter(band => Number.isFinite(band.minMiles) && (band.maxMiles === null || Number.isFinite(band.maxMiles)) && Number.isFinite(band.rate))
      .sort((a, b) => a.minMiles - b.minMiles)
  ), [mileageBands])

  const price = calculatePrice({
    serviceCode: calc.serviceCode,
    quantity: Number(calc.quantity || 1),
    miles: Number(calc.miles || 0),
    mileageBands: parsedMileageBands,
    sameDay: calc.sameDay,
    trashFee: calc.trashFee,
    overloadFee: calc.overloadFee,
    standbyMinutes: Number(calc.standbyMinutes || 0),
  })

  const saveProfile = async () => {
    setMessage('')
    const orderedBands = parsedMileageBands
    if (!orderedBands.length) {
      setMessage('Add at least one mileage band before saving.')
      return
    }
    const invalidBand = orderedBands.find((band, index) => band.maxMiles !== null && band.maxMiles < band.minMiles || index > 0 && band.minMiles <= orderedBands[index - 1].minMiles)
    if (invalidBand) {
      setMessage('Mileage bands must be in order and each end mile must be greater than its start mile.')
      return
    }
    const payload = {
      name: profile.name,
      yard_address: DEFAULT_PRICING.yardAddress,
      included_miles: Number(profile.included_miles),
      extra_mile_rate: Number(profile.extra_mile_rate),
      mileage_bands: orderedBands,
      one_bin_service: Number(profile.one_bin_service),
      two_bin_service: Number(profile.two_bin_service),
      fuel_surcharge_percent: Number(profile.fuel_surcharge_percent),
      environmental_fee: Number(profile.environmental_fee),
      monthly_usage: Number(profile.monthly_usage),
      active: true,
    }
    const { error } = await supabase.from('pricing_profiles').insert(payload)
    setMessage(error ? error.message : 'Pricing profile saved for onboarding.')
  }

  const updateMileageBand = (index: number, key: keyof typeof mileageBands[number], value: string) => {
    setMileageBands(prev => prev.map((band, bandIndex) => bandIndex === index ? { ...band, [key]: value } : band))
  }

  const addMileageBand = () => {
    setMileageBands(prev => {
      const last = prev[prev.length - 1]
      const lastMax = Number(last?.maxMiles || last?.minMiles || 50)
      const start = Number.isFinite(lastMax) ? lastMax + 1 : 51
      return [...prev, { label: `${start}+ miles`, minMiles: String(start), maxMiles: '', rate: String(DEFAULT_PRICING.extraMileRate) }]
    })
  }

  const removeMileageBand = (index: number) => {
    setMileageBands(prev => prev.filter((_, bandIndex) => bandIndex !== index))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Pricing Setup</h1>
        <p className="text-slate-400 mt-1">Container rates, mileage rules, fuel surcharge, and customer-visible invoice breakdowns.</p>
      </div>

      {message && <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-300">{message}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="card space-y-4">
          <div>
            <h2 className="font-semibold text-white">Default Orlando pricing</h2>
            <p className="text-xs text-slate-500 mt-1">Based on the current profile sheet for service within 30 miles of the yard.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="input sm:col-span-2" value={profile.name} onChange={event => setProfile(prev => ({ ...prev, name: event.target.value }))} />
            {[
              ['included_miles', 'Included miles'],
              ['extra_mile_rate', 'Extra mile rate'],
              ['one_bin_service', 'One-bin drop/swap/pickup'],
              ['two_bin_service', 'Two-bin same-trip rate'],
              ['fuel_surcharge_percent', 'Fuel surcharge %'],
              ['environmental_fee', 'Environmental fee'],
              ['monthly_usage', 'Monthly usage fee'],
            ].map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-xs text-slate-400">{label}</span>
                <input className="input" value={profile[key as keyof typeof profile]} onChange={event => setProfile(prev => ({ ...prev, [key]: event.target.value }))} />
              </label>
            ))}
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Mileage bands</h3>
                <p className="text-xs text-slate-500">Set as many tiers as needed, such as 0-30, 31-50, and 51+.</p>
              </div>
              <button type="button" onClick={addMileageBand} className="btn-secondary px-3 py-1.5 text-xs">Add Band</button>
            </div>
            <div className="mt-3 space-y-2">
              {mileageBands.map((band, index) => (
                <div key={index} className="grid grid-cols-12 gap-2">
                  <input className="input col-span-12 sm:col-span-4" value={band.label} onChange={event => updateMileageBand(index, 'label', event.target.value)} placeholder="31-50 miles" />
                  <input className="input col-span-4 sm:col-span-2" type="number" min="0" value={band.minMiles} onChange={event => updateMileageBand(index, 'minMiles', event.target.value)} placeholder="From" />
                  <input className="input col-span-4 sm:col-span-2" type="number" min="0" value={band.maxMiles} onChange={event => updateMileageBand(index, 'maxMiles', event.target.value)} placeholder="To" />
                  <input className="input col-span-4 sm:col-span-2" type="number" min="0" step="0.01" value={band.rate} onChange={event => updateMileageBand(index, 'rate', event.target.value)} placeholder="Rate" />
                  <button type="button" onClick={() => removeMileageBand(index)} className="col-span-12 sm:col-span-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20">Remove</button>
                </div>
              ))}
            </div>
          </div>
          <button onClick={saveProfile} className="btn-primary px-4 py-2">Save Pricing Profile</button>
        </section>

        <section className="card space-y-4">
          <div>
            <h2 className="font-semibold text-white">Price calculator</h2>
            <p className="text-xs text-slate-500 mt-1">Demo breakdown shown exactly like customers will see it on invoices.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={calc.serviceCode} onChange={event => setCalc(prev => ({ ...prev, serviceCode: event.target.value as ServiceCode }))}>
              {serviceOptions.map(option => <option key={option} value={option}>{serviceLabel(option)}</option>)}
            </select>
            <input className="input" type="number" min="1" value={calc.quantity} onChange={event => setCalc(prev => ({ ...prev, quantity: event.target.value }))} />
            <input className="input" type="number" min="0" value={calc.miles} onChange={event => setCalc(prev => ({ ...prev, miles: event.target.value }))} />
            <input className="input" type="number" min="0" value={calc.standbyMinutes} onChange={event => setCalc(prev => ({ ...prev, standbyMinutes: event.target.value }))} />
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {[
              ['sameDay', 'Same day/weekend'],
              ['trashFee', 'Trash fee'],
              ['overloadFee', 'Overload fee'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-700/50 px-3 py-2 text-slate-300">
                <input type="checkbox" checked={Boolean(calc[key as keyof typeof calc])} onChange={event => setCalc(prev => ({ ...prev, [key]: event.target.checked }))} />
                {label}
              </label>
            ))}
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 overflow-hidden">
            {price.lines.map(line => (
              <div key={line.label} className="grid grid-cols-12 gap-2 border-b border-slate-700/30 px-3 py-2 text-sm last:border-0">
                <div className="col-span-6 text-slate-200">{line.label}</div>
                <div className="col-span-2 text-right text-slate-500">{line.quantity}</div>
                <div className="col-span-2 text-right text-slate-500">{money(line.rate)}</div>
                <div className="col-span-2 text-right text-white">{money(line.amount)}</div>
              </div>
            ))}
          </div>
          <div className="text-right text-2xl font-bold text-white">{money(price.total)}</div>
        </section>
      </div>
    </div>
  )
}
