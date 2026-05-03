'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'

export default function RequestServicePage() {
  const { t } = useLanguage()
  const [form, setForm] = useState({ service_type: '', jobsite_address: '', preferred_date: '', time_preference: '', notes: '', bin_number: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async () => {
    if (!form.service_type || !form.jobsite_address) { setError(t('serviceRequired')); return }
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const notes = [form.time_preference ? `Preferred time: ${form.time_preference}.` : '', form.bin_number ? `Bin #${form.bin_number}.` : '', form.notes].filter(Boolean).join(' ')
    const { error: err } = await supabase.from('service_requests').insert({
      customer_id: user!.id,
      service_type: form.service_type,
      jobsite_address: form.jobsite_address,
      service_address: form.jobsite_address,
      preferred_date: form.preferred_date || null,
      scheduled_date: form.preferred_date || null,
      bin_number: form.bin_number || null,
      priority: form.service_type === 'emergency' ? 'urgent' : form.service_type === 'swap' ? 'high' : 'normal',
      notes,
      status: 'dispatch_ready',
    })
    if (err) { setError(err.message); setLoading(false) } else { setSuccess(true) }
  }

  if (success) return (
    <div className="max-w-md mx-auto text-center py-16">
      <h2 className="text-xl font-bold text-white mb-2">{t('requestSubmitted')}</h2>
      <p className="text-slate-400 mb-6">{t('confirmDriver')}</p>
      <div className="flex gap-3 justify-center">
        <button onClick={() => setSuccess(false)} className="btn-secondary px-5">{t('submitAnother')}</button>
        <button onClick={() => router.push('/dashboard/customer')} className="btn-primary px-6">{t('viewServices')}</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold text-white">{t('requestService')}</h1><p className="text-slate-400 mt-1">{t('requestServiceSubtitle')}</p></div>
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}
      <div className="card space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">{t('serviceType')} *</label>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { value: 'swap', label: t('swapOut'), desc: t('swapOutDesc') },
              { value: 'removal', label: t('pickupRemoval'), desc: t('pickupRemovalDesc') },
              { value: 'delivery', label: t('newDelivery'), desc: t('newDeliveryDesc') },
              { value: 'pump_out', label: t('pumpOut'), desc: t('pumpOutDesc') },
              { value: 'emergency', label: t('emergency'), desc: t('emergencyDesc') },
            ].map(s => (
              <button key={s.value} onClick={() => setForm(f => ({...f, service_type: s.value}))}
                className={`p-3 rounded-lg border text-left transition-colors ${form.service_type===s.value?'border-sky-500 bg-sky-500/10':'border-slate-600 bg-slate-700/30 hover:border-slate-500'}`}>
                <div className="font-medium text-white text-sm">{s.label}</div>
                <div className="text-slate-400 text-xs mt-0.5">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('jobsiteAddress')} *</label>
          <input type="text" className="input" placeholder="123 Construction Blvd, Orlando, FL" value={form.jobsite_address} onChange={e => setForm(f => ({...f, jobsite_address: e.target.value}))}/>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('binNumber')} <span className="text-slate-500">({t('optional')})</span></label>
          <input type="text" className="input font-mono" placeholder="e.g. 876907" value={form.bin_number} onChange={e => setForm(f => ({...f, bin_number: e.target.value}))}/>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('preferredDate')}</label>
          <input type="date" className="input" min={new Date().toISOString().split('T')[0]} value={form.preferred_date} onChange={e => setForm(f => ({...f, preferred_date: e.target.value}))}/>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">{t('preferredTime')}</label>
          <div className="grid grid-cols-2 gap-2">
            {[t('morning'), t('midday'), t('afternoon'), t('anyTime')].map(time => (
              <button key={time} onClick={() => setForm(f => ({...f, time_preference: time}))}
                className={`py-2 px-3 rounded-lg border text-sm transition-colors ${form.time_preference===time?'border-sky-500 bg-sky-500/10 text-white':'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                {time}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('additionalNotes')}</label>
          <textarea className="input min-h-[80px] resize-none" placeholder={t('gateCodePlaceholder')} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}/>
        </div>
        <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full py-3">
          {loading ? t('submitting') : t('submitServiceRequest')}
        </button>
      </div>
    </div>
  )
}
