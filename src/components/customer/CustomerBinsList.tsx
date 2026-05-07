'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, RotateCw, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n'

export type CustomerBinItem = {
  id: string
  bin_number: string | null
  container_number?: string | null
  status?: string | null
  type?: string | null
  location?: string | null
  last_serviced_at?: string | null
  client_id?: string | null
  current_client_id?: string | null
  jobsite_id?: string | null
  current_jobsite_id?: string | null
  jobsite?: {
    id: string
    name?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
  } | null
  active_swap_requested?: boolean
}

function statusClass(status?: string | null) {
  if (status === 'deployed') return 'bg-green-500/10 text-green-400 border-green-500/30'
  if (status === 'in_transit') return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30'
  if (status === 'needs_swap' || status === 'full') return 'bg-red-500/10 text-red-400 border-red-500/30'
  return 'bg-slate-700/40 text-slate-400 border-slate-600/40'
}

function formatAddress(item: CustomerBinItem) {
  const site = item.jobsite
  const parts = [site?.address, site?.city, site?.state, site?.zip].filter(Boolean)
  return parts.join(', ') || item.location || 'Jobsite address pending'
}

function displayBinNumber(item: CustomerBinItem) {
  return item.bin_number || item.container_number || item.id.slice(0, 8)
}

export default function CustomerBinsList({ items }: { items: CustomerBinItem[] }) {
  const { t } = useLanguage()
  const [selected, setSelected] = useState<CustomerBinItem | null>(null)
  const [preferredDate, setPreferredDate] = useState('')
  const [preferredTime, setPreferredTime] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())
  const supabase = useMemo(() => createClient(), [])
  const today = new Date().toISOString().split('T')[0]

  const openSwap = (item: CustomerBinItem) => {
    setSelected(item)
    setPreferredDate('')
    setPreferredTime('')
    setNotes('')
    setError('')
  }

  const closeSwap = () => {
    if (loading) return
    setSelected(null)
    setError('')
  }

  const submitSwap = async () => {
    if (!selected) return
    if (!preferredDate || !preferredTime) {
      setError(t('swapDateTimeRequired'))
      return
    }

    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError(t('signInTracking'))
      setLoading(false)
      return
    }

    const binNumber = displayBinNumber(selected)
    const jobsiteAddress = formatAddress(selected)
    const noteText = [
      `Customer requested swap for bin #${binNumber}.`,
      `Preferred time: ${preferredTime}.`,
      selected.jobsite?.name ? `Jobsite: ${selected.jobsite.name}.` : '',
      notes,
    ].filter(Boolean).join(' ')

    const { error: insertError } = await supabase.from('service_requests').insert({
      customer_id: user.id,
      client_id: selected.client_id || selected.current_client_id || null,
      jobsite_id: selected.jobsite_id || selected.current_jobsite_id || null,
      service_type: 'swap',
      jobsite_address: jobsiteAddress,
      service_address: jobsiteAddress,
      preferred_date: preferredDate,
      scheduled_date: preferredDate,
      bin_number: binNumber,
      priority: 'high',
      notes: noteText,
      status: 'dispatch_ready',
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setSubmittedIds(previous => new Set(previous).add(selected.id))
    setSelected(null)
    setLoading(false)
  }

  return (
    <>
      <div className="space-y-3">
        {items.map(item => {
          const binNumber = displayBinNumber(item)
          const swapAlreadyRequested = item.active_swap_requested || submittedIds.has(item.id)
          return (
            <div key={item.id} className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-mono text-base font-semibold text-white">#{binNumber}</div>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs capitalize ${statusClass(item.status)}`}>
                      {item.status || t('unknown')}
                    </span>
                    {swapAlreadyRequested && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">
                        <CheckCircle2 size={12} />
                        {t('activeSwapRequest')}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid gap-1 text-sm text-slate-400">
                    <div className="text-slate-300">{item.jobsite?.name || t('jobsite')}</div>
                    <div>{formatAddress(item)}</div>
                    <div className="text-xs text-slate-500">
                      {t('lastService')}: {item.last_serviced_at ? new Date(item.last_serviced_at).toLocaleDateString() : '-'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openSwap(item)}
                  disabled={swapAlreadyRequested}
                  className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    swapAlreadyRequested
                      ? 'cursor-not-allowed border-slate-700/50 text-slate-500'
                      : 'border-sky-500/50 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20'
                  }`}
                >
                  <RotateCw size={16} />
                  {swapAlreadyRequested ? t('swapRequested') : t('requestSwap')}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-700/60 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sky-300">
                  <CalendarClock size={18} />
                  <span className="text-sm font-semibold">{t('requestSwap')}</span>
                </div>
                <h2 className="mt-2 text-xl font-bold text-white">{t('requestSwapForBin')} #{displayBinNumber(selected)}</h2>
                <p className="mt-1 text-sm text-slate-400">{formatAddress(selected)}</p>
              </div>
              <button type="button" onClick={closeSwap} className="rounded-lg border border-slate-700/60 p-2 text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">{t('preferredDate')}</label>
                  <input type="date" min={today} className="input" value={preferredDate} onChange={event => setPreferredDate(event.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">{t('preferredTime')}</label>
                  <input type="time" className="input" value={preferredTime} onChange={event => setPreferredTime(event.target.value)} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">{t('additionalNotes')}</label>
                <textarea
                  className="input min-h-[90px] resize-none"
                  placeholder={t('gateCodePlaceholder')}
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeSwap} disabled={loading} className="btn-secondary px-4 py-2">{t('cancel')}</button>
              <button type="button" onClick={submitSwap} disabled={loading} className="btn-primary px-5 py-2">
                {loading ? t('submitting') : t('submitSwapRequest')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
