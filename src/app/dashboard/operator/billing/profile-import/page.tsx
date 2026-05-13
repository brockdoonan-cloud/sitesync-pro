'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { money } from '@/lib/pricing'
import type { ProfileSheetExtraction } from '@/lib/billing/profileSheetTypes'

type PricingKey = keyof ProfileSheetExtraction['pricing']

const pricingFields: Array<{ key: PricingKey; label: string; suffix?: string }> = [
  { key: 'oneBinService', label: 'Drop / swap / pickup rate' },
  { key: 'twoBinService', label: 'Two-bin same-trip rate' },
  { key: 'waterPumpout', label: 'Water pumpout' },
  { key: 'slurryPumpout', label: 'Slurry / paint pumpout' },
  { key: 'trashFee', label: 'Trash / unauthorized materials' },
  { key: 'deadRun', label: 'Dead run' },
  { key: 'relocate', label: 'Bin relocate' },
  { key: 'onsiteRelocate', label: 'Onsite relocation' },
  { key: 'sameDayWeekendFee', label: 'Same day / nights / weekends' },
  { key: 'monthlyUsage', label: 'Monthly bin usage' },
  { key: 'environmentalFee', label: 'Environmental service fee' },
  { key: 'fuelSurchargePercent', label: 'Fuel surcharge', suffix: '%' },
  { key: 'overloadedFee', label: 'Overloaded container' },
  { key: 'standbyThirtyToFortyFive', label: 'Stand-by 31-45 minutes' },
  { key: 'standbyFortySixToSixty', label: 'Stand-by 46-60 minutes' },
  { key: 'weightTicketFee', label: 'Weight ticket' },
]

function confidenceClass(value: string) {
  if (value === 'high') return 'border-green-500/30 bg-green-500/10 text-green-300'
  if (value === 'medium') return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
  return 'border-red-500/30 bg-red-500/10 text-red-200'
}

function numberInputValue(value: number | null) {
  return value === null || Number.isNaN(value) ? '' : String(value)
}

function termValue(extraction: ProfileSheetExtraction, key: PricingKey, fallback = 0) {
  return Number(extraction.pricing[key].value ?? fallback)
}

function rebuildPreview(extraction: ProfileSheetExtraction): ProfileSheetExtraction {
  const serviceCount = 6
  const pumpouts = 1
  const activeBins = 4
  const serviceRate = termValue(extraction, 'oneBinService', 395)
  const pumpoutRate = termValue(extraction, 'waterPumpout', serviceRate)
  const monthlyRate = termValue(extraction, 'monthlyUsage', 150)
  const environmentalRate = termValue(extraction, 'environmentalFee', 25)
  const surchargePct = termValue(extraction, 'fuelSurchargePercent', 0)
  const lines = [
    { id: 'services', label: 'Drops / swaps / pickups', source: 'Driver closeouts and completed swap requests', quantity: serviceCount, rate: serviceRate, amount: Number((serviceCount * serviceRate).toFixed(2)) },
    { id: 'pumpouts', label: 'Water pumpouts', source: 'Completed pumpout stops', quantity: pumpouts, rate: pumpoutRate, amount: Number((pumpouts * pumpoutRate).toFixed(2)) },
    { id: 'monthly', label: 'Monthly bin usage', source: 'Active bins on site during the month', quantity: activeBins, rate: monthlyRate, amount: Number((activeBins * monthlyRate).toFixed(2)) },
    { id: 'environmental', label: 'Environmental service fees', source: 'Per bin/service from profile sheet', quantity: serviceCount + pumpouts, rate: environmentalRate, amount: Number(((serviceCount + pumpouts) * environmentalRate).toFixed(2)) },
  ]
  const serviceSubtotal = lines.filter(item => item.id !== 'monthly').reduce((sum, item) => sum + item.amount, 0)
  const recurringSubtotal = lines.find(item => item.id === 'monthly')?.amount || 0
  const surchargeTotal = Number((serviceSubtotal * (surchargePct / 100)).toFixed(2))
  if (surchargeTotal > 0) {
    lines.push({ id: 'fuel', label: `${surchargePct}% fuel surcharge`, source: 'Profile sheet fuel surcharge', quantity: 1, rate: surchargeTotal, amount: surchargeTotal })
  }

  return {
    ...extraction,
    billingRules: extraction.billingRules.map(rule => {
      if (rule.eventType === 'delivery_completed' || rule.eventType === 'swap_completed' || rule.eventType === 'pickup_completed') return { ...rule, rate: serviceRate }
      if (rule.eventType === 'monthly_usage') return { ...rule, rate: monthlyRate }
      if (rule.eventType === 'water_pumpout_completed') return { ...rule, rate: pumpoutRate }
      if (rule.eventType === 'environmental_service_fee') return { ...rule, rate: environmentalRate }
      if (rule.eventType === 'fuel_surcharge') return { ...rule, rate: surchargePct }
      if (rule.eventType === 'dead_run') return { ...rule, rate: termValue(extraction, 'deadRun', 0) }
      if (rule.eventType === 'trash_or_overload') return { ...rule, rate: termValue(extraction, 'trashFee', termValue(extraction, 'overloadedFee', 0)) }
      return rule
    }),
    preview: {
      periodLabel: 'Demo month preview',
      activity: { swaps: 3, drops: 2, pickups: 1, pumpouts, activeBins },
      lines,
      serviceSubtotal,
      recurringSubtotal,
      surchargeTotal,
      total: Number(lines.reduce((sum, item) => sum + item.amount, 0).toFixed(2)),
    },
  }
}

export default function ProfileSheetImportPage() {
  const [extraction, setExtraction] = useState<ProfileSheetExtraction | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const previewTotal = useMemo(() => extraction?.preview.total || 0, [extraction])

  const upload = async (file?: File) => {
    if (!file) return
    setError('')
    setMessage('')
    setLoading(true)
    setExtraction(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/operator/profile-sheets/extract', {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not extract this profile sheet.')
      setExtraction(payload.extraction)
      setMessage(`Extracted billing terms from ${file.name}. Review every value before saving.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload this profile sheet.')
    } finally {
      setLoading(false)
    }
  }

  const updatePricing = (key: PricingKey, value: string) => {
    setExtraction(prev => {
      if (!prev) return prev
      const parsed = value.trim() === '' ? null : Number(value)
      return rebuildPreview({
        ...prev,
        pricing: {
          ...prev.pricing,
          [key]: {
            ...prev.pricing[key],
            value: Number.isFinite(parsed) ? parsed : null,
            confidence: 'medium',
          },
        },
      })
    })
  }

  const updateCustomer = (key: keyof ProfileSheetExtraction['customer'], value: string) => {
    setExtraction(prev => prev ? { ...prev, customer: { ...prev.customer, [key]: value } } : prev)
  }

  const updateJob = (key: keyof ProfileSheetExtraction['job'], value: string) => {
    setExtraction(prev => prev ? { ...prev, job: { ...prev.job, [key]: value } } : prev)
  }

  const save = async () => {
    if (!extraction) return
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/operator/profile-sheets/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraction }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not save this profile sheet.')
      const warningText = payload.warnings?.length ? ` Warnings: ${payload.warnings.join(' | ')}` : ''
      setMessage(`Saved client pricing profile${payload.pricingProfileId ? ` ${payload.pricingProfileId.slice(0, 8)}` : ''}.${warningText}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this profile sheet.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Profile Sheet Billing Import</h1>
          <p className="mt-1 text-slate-400">Drop a customer pricing agreement, review the extracted rates, and save the rules used for swaps, monthly usage, pumpouts, and add-on fees.</p>
        </div>
        <Link href="/dashboard/operator/billing" className="btn-secondary px-4 py-2 text-sm">Back to Billing</Link>
      </div>

      {(message || error) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>
          {error || message}
        </div>
      )}

      <label
        onDragOver={event => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault()
          setDragging(false)
          upload(event.dataTransfer.files[0])
        }}
        className={`block cursor-pointer rounded-2xl border border-dashed px-6 py-10 text-center transition-colors ${dragging ? 'border-sky-300 bg-sky-500/20' : 'border-sky-500/40 bg-sky-500/10 hover:border-sky-400'}`}
      >
        <input type="file" accept=".docx" className="hidden" onChange={event => upload(event.target.files?.[0])} />
        <div className="text-lg font-semibold text-white">{loading ? 'Reading profile sheet...' : 'Drop customer profile sheet here'}</div>
        <div className="mt-2 text-sm text-slate-400">DOCX supported. The system extracts customer info, jobsite, swap pricing, monthly usage, environmental fee, fuel surcharge, standby, and special charges.</div>
      </label>

      {extraction && (
        <>
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="card space-y-4">
              <div>
                <h2 className="font-semibold text-white">Customer</h2>
                <p className="mt-1 text-xs text-slate-500">This creates or matches the billing client.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input className="input sm:col-span-2" value={extraction.customer.legalBusinessName} onChange={event => updateCustomer('legalBusinessName', event.target.value)} placeholder="Legal company name" />
                <input className="input" value={extraction.customer.billingContactName} onChange={event => updateCustomer('billingContactName', event.target.value)} placeholder="Billing contact" />
                <input className="input" value={extraction.customer.billingEmail} onChange={event => updateCustomer('billingEmail', event.target.value)} placeholder="Billing email" />
                <input className="input" value={extraction.customer.mainPhone} onChange={event => updateCustomer('mainPhone', event.target.value)} placeholder="Main phone" />
                <input className="input" value={extraction.customer.taxId} onChange={event => updateCustomer('taxId', event.target.value)} placeholder="Tax ID" />
              </div>
            </div>

            <div className="card space-y-4">
              <div>
                <h2 className="font-semibold text-white">Jobsite</h2>
                <p className="mt-1 text-xs text-slate-500">These details attach the pricing to the correct active project.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input className="input sm:col-span-2" value={extraction.job.jobsiteName} onChange={event => updateJob('jobsiteName', event.target.value)} placeholder="Jobsite name" />
                <input className="input sm:col-span-2" value={extraction.job.jobsiteAddress} onChange={event => updateJob('jobsiteAddress', event.target.value)} placeholder="Jobsite address" />
                <input className="input" value={extraction.job.jobsiteCity} onChange={event => updateJob('jobsiteCity', event.target.value)} placeholder="City" />
                <input className="input" value={extraction.job.jobsiteZip} onChange={event => updateJob('jobsiteZip', event.target.value)} placeholder="ZIP" />
                <input className="input" value={extraction.job.jobsiteContactName} onChange={event => updateJob('jobsiteContactName', event.target.value)} placeholder="Jobsite contact" />
                <input className="input" value={extraction.job.jobsiteContactPhone} onChange={event => updateJob('jobsiteContactPhone', event.target.value)} placeholder="Contact phone" />
              </div>
            </div>
          </section>

          <section className="card space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold text-white">Billing Terms</h2>
                <p className="mt-1 text-xs text-slate-500">Review extracted rates before the system uses them on driver closeouts and monthly billing.</p>
              </div>
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-right">
                <div className="text-xs text-slate-400">Demo invoice preview</div>
                <div className="text-2xl font-bold text-white">{money(previewTotal)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {pricingFields.map(field => {
                const term = extraction.pricing[field.key]
                return (
                  <label key={field.key} className="space-y-1 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
                    <span className="flex items-center justify-between gap-2 text-xs text-slate-400">
                      {field.label}
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${confidenceClass(term.confidence)}`}>{term.confidence}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {!field.suffix && <span className="text-slate-500">$</span>}
                      <input className="input" type="number" min="0" step="0.01" value={numberInputValue(term.value)} onChange={event => updatePricing(field.key, event.target.value)} />
                      {field.suffix && <span className="text-slate-500">{field.suffix}</span>}
                    </div>
                  </label>
                )
              })}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="card space-y-4">
              <div>
                <h2 className="font-semibold text-white">Automatic Billing Rules</h2>
                <p className="mt-1 text-xs text-slate-500">These rules are saved with the profile and map live operational events into charges.</p>
              </div>
              <div className="space-y-2">
                {extraction.billingRules.map(rule => (
                  <div key={rule.eventType} className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{rule.chargeLabel}</div>
                      <div className="text-sm text-sky-300">{rule.unit === 'percent' ? `${rule.rate}%` : money(rule.rate)}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{rule.description}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card space-y-4">
              <div>
                <h2 className="font-semibold text-white">Billing Preview</h2>
                <p className="mt-1 text-xs text-slate-500">Demo month using 3 swaps, 2 drops, 1 pickup, 1 pumpout, and 4 active bins.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-700/50">
                      <th className="px-3 py-2 text-left">Charge</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extraction.preview.lines.map(item => (
                      <tr key={item.id} className="border-b border-slate-700/30 last:border-0">
                        <td className="px-3 py-2 text-slate-200">{item.label}<div className="text-xs text-slate-500">{item.source}</div></td>
                        <td className="px-3 py-2 text-right text-slate-400">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-slate-400">{money(item.rate)}</td>
                        <td className="px-3 py-2 text-right text-white">{money(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-right text-2xl font-bold text-white">{money(extraction.preview.total)}</div>
            </div>
          </section>

          {extraction.warnings.length > 0 && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
              {extraction.warnings.join(' ')}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Link href="/dashboard/operator/pricing" className="btn-secondary px-4 py-2 text-sm">Open Pricing Setup</Link>
            <button onClick={save} disabled={saving} className="btn-primary px-5 py-2">{saving ? 'Saving...' : 'Save Client Billing Profile'}</button>
          </div>
        </>
      )}
    </div>
  )
}
