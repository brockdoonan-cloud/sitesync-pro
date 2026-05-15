'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { money } from '@/lib/pricing'
import { createClient } from '@/lib/supabase/client'
import type { BillingChargeMode, ProfileSheetExtraction } from '@/lib/billing/profileSheetTypes'

type PricingKey = keyof ProfileSheetExtraction['pricing']
type TypeOption = { id: string; label: string; code?: string | null }

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

const chargeModes: Array<{ value: BillingChargeMode; label: string }> = [
  { value: 'per_service', label: 'Per drop/swap/pickup' },
  { value: 'per_pumpout', label: 'Per pumpout' },
  { value: 'per_bin_month', label: 'Monthly per bin' },
  { value: 'percent_of_service', label: 'Percent surcharge' },
  { value: 'conditional', label: 'Only when flagged' },
  { value: 'manual', label: 'Manual only' },
]

function confidenceClass(value: string) {
  if (value === 'high') return 'border-green-500/30 bg-green-500/10 text-green-300'
  if (value === 'medium') return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
  return 'border-red-500/30 bg-red-500/10 text-red-200'
}

function numberInputValue(value: number | null) {
  return value === null || Number.isNaN(value) ? '' : String(value)
}

function manualTerm(label: string, value: number | null, chargeMode: BillingChargeMode): ProfileSheetExtraction['pricing'][PricingKey] {
  return {
    label,
    value,
    confidence: 'medium',
    enabled: value !== null && chargeMode !== 'manual',
    chargeMode,
    source: 'Entered manually by operator.',
  }
}

function baseBillingRules(): ProfileSheetExtraction['billingRules'] {
  return [
    { eventType: 'delivery_completed', chargeLabel: 'Bin drop', rate: 395, unit: 'event', enabled: true, chargeMode: 'per_service', description: 'Applied whenever a driver completes a bin delivery.' },
    { eventType: 'swap_completed', chargeLabel: 'Bin swap', rate: 395, unit: 'event', enabled: true, chargeMode: 'per_service', description: 'Applied whenever a driver completes a swap and closes the stop.' },
    { eventType: 'pickup_completed', chargeLabel: 'Bin pickup', rate: 395, unit: 'event', enabled: true, chargeMode: 'per_service', description: 'Applied when a final pickup is completed.' },
    { eventType: 'monthly_usage', chargeLabel: 'Monthly bin usage', rate: 150, unit: 'bin_month', enabled: true, chargeMode: 'per_bin_month', description: 'Applied once per active bin on site for the billing month.' },
    { eventType: 'water_pumpout_completed', chargeLabel: 'Water pumpout', rate: 395, unit: 'event', enabled: false, chargeMode: 'per_pumpout', description: 'Applied when a pumpout is completed.' },
    { eventType: 'environmental_service_fee', chargeLabel: 'Environmental service fee', rate: 25, unit: 'event', enabled: true, chargeMode: 'per_service', description: 'Applied to each billable service event.' },
    { eventType: 'fuel_surcharge', chargeLabel: 'Fuel surcharge', rate: 0, unit: 'percent', enabled: false, chargeMode: 'percent_of_service', description: 'Calculated as a percent of service and environmental charges.' },
    { eventType: 'dead_run', chargeLabel: 'Dead run', rate: 0, unit: 'flag', enabled: false, chargeMode: 'conditional', description: 'Applied when the driver cannot complete the service due to site conditions.' },
    { eventType: 'trash_or_overload', chargeLabel: 'Trash or overload fee', rate: 0, unit: 'flag', enabled: false, chargeMode: 'conditional', description: 'Applied when unauthorized material or overloaded concrete is documented.' },
  ]
}

function createManualExtraction(): ProfileSheetExtraction {
  const extraction: ProfileSheetExtraction = {
    fileName: 'manual-entry',
    sourceFilePath: null,
    jobId: null,
    extractedAt: new Date().toISOString(),
    customer: {
      legalBusinessName: '',
      billingAddress: '',
      billingCity: '',
      billingState: '',
      billingZip: '',
      mainPhone: '',
      taxId: '',
      billingContactName: '',
      billingEmail: '',
      additionalBillingEmails: [],
    },
    job: {
      jobsiteName: '',
      jobNumber: '',
      poNumber: '',
      agreementDate: '',
      jobsiteAddress: '',
      jobsiteCity: '',
      jobsiteState: 'FL',
      jobsiteZip: '',
      jobsiteContactName: '',
      jobsiteContactPhone: '',
      jobsiteContactEmail: '',
    },
    pricing: {
      oneBinService: manualTerm('Using 1 bin at a time', 395, 'per_service'),
      twoBinService: manualTerm('Using 2 bins at a time', null, 'per_service'),
      waterPumpout: manualTerm('Bin pumpout - water', null, 'per_pumpout'),
      slurryPumpout: manualTerm('Bin pumpout - slurry / paint', null, 'per_pumpout'),
      trashFee: manualTerm('Trash or unauthorized materials', null, 'conditional'),
      deadRun: manualTerm('Dead run', null, 'conditional'),
      relocate: manualTerm('Bin relocate', null, 'conditional'),
      onsiteRelocate: manualTerm('Onsite relocation', null, 'conditional'),
      sameDayWeekendFee: manualTerm('Same day / nights / weekends', null, 'conditional'),
      monthlyUsage: manualTerm('Monthly bin usage fee', 150, 'per_bin_month'),
      environmentalFee: manualTerm('Environmental service fee', 25, 'per_service'),
      fuelSurchargePercent: manualTerm('Fuel surcharge percent', 0, 'percent_of_service'),
      overloadedFee: manualTerm('Container overloaded fee', null, 'conditional'),
      standbyThirtyToFortyFive: manualTerm('Stand-by 31-45 minutes', null, 'conditional'),
      standbyFortySixToSixty: manualTerm('Stand-by 46-60 minutes', null, 'conditional'),
      weightTicketFee: manualTerm('Weight ticket fee', null, 'conditional'),
    },
    compliance: { greenBuildingRequired: null, weightTicketRequired: null },
    signers: { salespersonName: '', customerSignerName: '', customerSignedDate: '' },
    billingRules: baseBillingRules(),
    feeSettings: {},
    preview: {
      periodLabel: '',
      activity: { swaps: 0, drops: 0, pickups: 0, pumpouts: 0, activeBins: 0 },
      lines: [],
      serviceSubtotal: 0,
      recurringSubtotal: 0,
      surchargeTotal: 0,
      total: 0,
    },
    warnings: [],
    sourceTextExcerpt: 'Manual entry: operator typed the billing profile because OCR/scanning was not needed or could not read the document.',
  }
  return rebuildPreview(extraction)
}

function termValue(extraction: ProfileSheetExtraction, key: PricingKey, fallback = 0) {
  return Number(extraction.pricing[key].value ?? fallback)
}

function isEnabled(extraction: ProfileSheetExtraction, key: PricingKey) {
  const term = extraction.pricing[key]
  return term.enabled !== false && Number(term.value ?? 0) > 0
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
    isEnabled(extraction, 'oneBinService') ? { id: 'services', label: 'Drops / swaps / pickups', source: 'Driver closeouts and completed swap requests', quantity: serviceCount, rate: serviceRate, amount: Number((serviceCount * serviceRate).toFixed(2)) } : null,
    isEnabled(extraction, 'waterPumpout') ? { id: 'pumpouts', label: 'Water pumpouts', source: 'Completed pumpout stops', quantity: pumpouts, rate: pumpoutRate, amount: Number((pumpouts * pumpoutRate).toFixed(2)) } : null,
    isEnabled(extraction, 'monthlyUsage') ? { id: 'monthly', label: 'Monthly bin usage', source: 'Active bins on site during the month', quantity: activeBins, rate: monthlyRate, amount: Number((activeBins * monthlyRate).toFixed(2)) } : null,
    isEnabled(extraction, 'environmentalFee') ? { id: 'environmental', label: 'Environmental service fees', source: 'Per bin/service from profile sheet', quantity: serviceCount + pumpouts, rate: environmentalRate, amount: Number(((serviceCount + pumpouts) * environmentalRate).toFixed(2)) } : null,
  ].filter(Boolean) as ProfileSheetExtraction['preview']['lines']
  const serviceSubtotal = lines.filter(item => item.id !== 'monthly').reduce((sum, item) => sum + item.amount, 0)
  const recurringSubtotal = lines.find(item => item.id === 'monthly')?.amount || 0
  const surchargeTotal = isEnabled(extraction, 'fuelSurchargePercent') ? Number((serviceSubtotal * (surchargePct / 100)).toFixed(2)) : 0
  if (surchargeTotal > 0) {
    lines.push({ id: 'fuel', label: `${surchargePct}% fuel surcharge`, source: 'Profile sheet fuel surcharge', quantity: 1, rate: surchargeTotal, amount: surchargeTotal })
  }

  return {
    ...extraction,
    billingRules: extraction.billingRules.map(rule => {
      if (rule.eventType === 'delivery_completed' || rule.eventType === 'swap_completed' || rule.eventType === 'pickup_completed') return { ...rule, rate: serviceRate, enabled: extraction.pricing.oneBinService.enabled, chargeMode: extraction.pricing.oneBinService.chargeMode }
      if (rule.eventType === 'monthly_usage') return { ...rule, rate: monthlyRate, enabled: extraction.pricing.monthlyUsage.enabled, chargeMode: extraction.pricing.monthlyUsage.chargeMode }
      if (rule.eventType === 'water_pumpout_completed') return { ...rule, rate: pumpoutRate, enabled: extraction.pricing.waterPumpout.enabled, chargeMode: extraction.pricing.waterPumpout.chargeMode }
      if (rule.eventType === 'environmental_service_fee') return { ...rule, rate: environmentalRate, enabled: extraction.pricing.environmentalFee.enabled, chargeMode: extraction.pricing.environmentalFee.chargeMode }
      if (rule.eventType === 'fuel_surcharge') return { ...rule, rate: surchargePct, enabled: extraction.pricing.fuelSurchargePercent.enabled, chargeMode: extraction.pricing.fuelSurchargePercent.chargeMode }
      if (rule.eventType === 'dead_run') return { ...rule, rate: termValue(extraction, 'deadRun', 0), enabled: extraction.pricing.deadRun.enabled, chargeMode: extraction.pricing.deadRun.chargeMode }
      if (rule.eventType === 'trash_or_overload') return { ...rule, rate: termValue(extraction, 'trashFee', termValue(extraction, 'overloadedFee', 0)), enabled: extraction.pricing.trashFee.enabled || extraction.pricing.overloadedFee.enabled, chargeMode: 'conditional' }
      return rule
    }),
    feeSettings: Object.fromEntries(
      Object.entries(extraction.pricing).map(([key, term]) => [key, { enabled: term.enabled, chargeMode: term.chargeMode }])
    ),
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
  const [source, setSource] = useState<'ocr_import' | 'manual_entry'>('ocr_import')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [equipmentTypes, setEquipmentTypes] = useState<TypeOption[]>([])
  const [serviceTypes, setServiceTypes] = useState<TypeOption[]>([])

  const previewTotal = useMemo(() => extraction?.preview.total || 0, [extraction])

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('equipment_types').select('id,label,code').eq('active', true).order('sort_order', { ascending: true }),
      supabase.from('service_types').select('id,label,code').eq('active', true).order('sort_order', { ascending: true }),
    ]).then(([equipment, services]) => {
      setEquipmentTypes((equipment.data || []) as TypeOption[])
      setServiceTypes((services.data || []) as TypeOption[])
    })
  }, [])

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
      setSource('ocr_import')
      setExtraction(payload.extraction)
      setMessage(`Extracted billing terms from ${file.name}. Review every value before saving.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload this profile sheet.')
    } finally {
      setLoading(false)
    }
  }

  const startManual = () => {
    setError('')
    setMessage('Manual entry mode: type the customer, jobsite, and billing rates, then optionally attach the signed profile sheet for the project file.')
    setSource('manual_entry')
    setExtraction(createManualExtraction())
  }

  const archiveAttachment = async (file?: File) => {
    if (!file || !extraction) return
    setError('')
    setArchiving(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/operator/profile-sheets/archive', {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not archive this attachment.')
      setExtraction(prev => prev ? { ...prev, fileName: payload.fileName || prev.fileName, sourceFilePath: payload.filePath || prev.sourceFilePath } : prev)
      setMessage(`Attached ${payload.fileName || file.name} to the manual job file.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not archive this attachment.')
    } finally {
      setArchiving(false)
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

  const updateFeeEnabled = (key: PricingKey, enabled: boolean) => {
    setExtraction(prev => prev ? rebuildPreview({
      ...prev,
      pricing: {
        ...prev.pricing,
        [key]: {
          ...prev.pricing[key],
          enabled,
        },
      },
    }) : prev)
  }

  const updateChargeMode = (key: PricingKey, chargeMode: BillingChargeMode) => {
    setExtraction(prev => prev ? rebuildPreview({
      ...prev,
      pricing: {
        ...prev.pricing,
        [key]: {
          ...prev.pricing[key],
          chargeMode,
          enabled: chargeMode === 'manual' ? false : prev.pricing[key].enabled,
        },
      },
    }) : prev)
  }

  const updateCustomer = (key: keyof ProfileSheetExtraction['customer'], value: string) => {
    setExtraction(prev => prev ? { ...prev, customer: { ...prev.customer, [key]: value } } : prev)
  }

  const updateJob = (key: keyof ProfileSheetExtraction['job'], value: string) => {
    setExtraction(prev => prev ? { ...prev, job: { ...prev.job, [key]: value } } : prev)
  }

  const save = async () => {
    if (!extraction) return
    if (!extraction.customer.legalBusinessName.trim()) {
      setError('Company name is required before saving.')
      return
    }
    if (!extraction.job.jobsiteName.trim() && !extraction.job.jobsiteAddress.trim()) {
      setError('Jobsite name or jobsite address is required before saving.')
      return
    }
    if (!Number(extraction.pricing.oneBinService.value || 0)) {
      setError('Drop / swap / pickup rate is required before saving.')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/operator/profile-sheets/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraction, source }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not save this profile sheet.')
      const warningText = payload.warnings?.length ? ` Warnings: ${payload.warnings.join(' | ')}` : ''
      const jobText = payload.jobId ? ` Linked to job ${payload.jobId.slice(0, 8)}.` : ''
      setMessage(`Saved client pricing profile${payload.pricingProfileId ? ` ${payload.pricingProfileId.slice(0, 8)}` : ''}.${jobText}${warningText}`)
      if (payload.jobId) window.location.href = `/dashboard/operator/jobs/${payload.jobId}`
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
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
          <input type="file" accept=".docx,.pdf,.xlsx,.txt,.text,.md,.csv,.jpg,.jpeg,.png,.webp" className="hidden" onChange={event => upload(event.target.files?.[0])} />
          <div className="text-lg font-semibold text-white">{loading ? 'Reading profile sheet...' : 'Drop customer profile sheet or signed agreement here'}</div>
          <div className="mt-2 text-sm text-slate-400">Upload from anywhere on this computer. Supports DOCX, PDF, XLSX, TXT/CSV, and scanned PDFs/images when OCR is enabled. PDFs are limited to 30 MB and 100 pages.</div>
        </label>
        <button type="button" onClick={startManual} className="rounded-2xl border border-slate-700/60 bg-slate-800/50 px-6 py-6 text-left hover:border-sky-500/40">
          <div className="text-lg font-semibold text-white">Enter manually</div>
          <div className="mt-2 max-w-sm text-sm text-slate-400">Use this when the scan is poor, the file type cannot be read, or dispatch needs to create a job and attach the signed paperwork without OCR.</div>
        </button>
      </div>

      {extraction && (
        <>
          {source === 'manual_entry' && (
            <section className="card space-y-3">
              <div>
                <h2 className="font-semibold text-white">Manual Profile Sheet Attachment</h2>
                <p className="mt-1 text-xs text-slate-500">Optional. This archives the signed PDF/image/document with the job file without trying to scan it.</p>
              </div>
              <label className="block cursor-pointer rounded-xl border border-dashed border-slate-700/60 bg-slate-900/40 px-4 py-5 text-sm text-slate-300 hover:border-sky-500/50">
                <input type="file" accept=".pdf,.doc,.docx,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.heic,.heif" className="hidden" onChange={event => archiveAttachment(event.target.files?.[0])} />
                {archiving ? 'Archiving attachment...' : extraction.sourceFilePath ? `Attached: ${extraction.fileName}` : 'Attach signed profile sheet, agreement, or job paperwork'}
              </label>
            </section>
          )}

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
                <h2 className="font-semibold text-white">Project / Job File</h2>
                <p className="mt-1 text-xs text-slate-500">The signed profile sheet is linked to this project so it can be pulled up later if pricing or authorization is disputed.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input className="input sm:col-span-2" value={extraction.job.jobsiteName} onChange={event => updateJob('jobsiteName', event.target.value)} placeholder="Jobsite name" />
                <select className="input" value={extraction.job.equipmentTypeId || ''} onChange={event => updateJob('equipmentTypeId', event.target.value)}>
                  <option value="">Equipment type</option>
                  {equipmentTypes.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
                </select>
                <select className="input" value={extraction.job.serviceTypeId || ''} onChange={event => updateJob('serviceTypeId', event.target.value)}>
                  <option value="">Service type</option>
                  {serviceTypes.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
                </select>
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
                  <div key={field.key} className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
                    <div className="flex items-start justify-between gap-2 text-xs text-slate-400">
                      <label className="flex min-w-0 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={term.enabled !== false}
                          onChange={event => updateFeeEnabled(field.key, event.target.checked)}
                        />
                        <span>{field.label}</span>
                      </label>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase ${confidenceClass(term.confidence)}`}>{term.confidence}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!field.suffix && <span className="text-slate-500">$</span>}
                      <input className="input" type="number" min="0" step="0.01" value={numberInputValue(term.value)} onChange={event => updatePricing(field.key, event.target.value)} />
                      {field.suffix && <span className="text-slate-500">{field.suffix}</span>}
                    </div>
                    <select
                      className="input text-xs"
                      value={term.chargeMode}
                      onChange={event => updateChargeMode(field.key, event.target.value as BillingChargeMode)}
                    >
                      {chargeModes.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                    </select>
                  </div>
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
                  <div key={rule.eventType} className={`rounded-lg border px-3 py-2 ${rule.enabled ? 'border-slate-700/50 bg-slate-900/40' : 'border-slate-800/60 bg-slate-950/40 opacity-60'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{rule.chargeLabel}</div>
                      <div className="text-right">
                        <div className="text-sm text-sky-300">{rule.unit === 'percent' ? `${rule.rate}%` : money(rule.rate)}</div>
                        <div className="text-[10px] uppercase text-slate-500">{rule.enabled ? rule.chargeMode.replace(/_/g, ' ') : 'not charged'}</div>
                      </div>
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
