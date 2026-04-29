'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const SERVICE_TYPES = [
  { value: 'swap', label: 'Swap Out', desc: 'Exchange full container for empty', icon: '🔄' },
  { value: 'removal', label: 'Pickup / Removal', desc: 'Remove equipment from jobsite', icon: '🚛' },
  { value: 'delivery', label: 'New Delivery', desc: 'Bring new equipment to site', icon: '📦' },
  { value: 'pump_out', label: 'Pump Out', desc: 'Water removal service', icon: '💧' },
  { value: 'emergency', label: 'Emergency', desc: 'Urgent service needed ASAP', icon: '🚨' },
]

const TIME_PREFS = ['Morning (7am–11am)', 'Midday (11am–2pm)', 'Afternoon (2pm–5pm)', 'Any time']

export default function RequestServicePage() {
  const [form, setForm] = useState({ service_type: '', jobsite_address: '', preferred_date: '', time_preference: '', notes: '', bin_number: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async () => {
    if (!form.service_type || !form.jobsite_address) { setError('Please select a service type and enter the jobsite address'); return }
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const notes = [form.time_preference ? `Preferred time: ${form.time_preference}.` : '', form.bin_number ? `Bin #${form.bin_number}.` : '', form.notes].filter(Boolean).join(' ')
    const { error: err } = await supabase.from('service_requests').insert({ customer_id: user!.id, service_type: form.service_type, jobsite_address: form.jobsite_address, preferred_date: form.preferred_date || null, notes, status: 'pending' })
    if (err) { setError(err.message); setLoading(false) } else { setSuccess(true) }
  }

  if (success) return (
    <div className="max-w-md mx-auto text-center py-16">
      <h2 className="text-xl font-bold text-white mb-2">Request Submitted!</h2>
      <p className="text-slate-400 mb-6">We&apos;ll confirm shortly and assign a driver.</p>
      <div className="flex gap-3 justify-center">
        <button onClick={() => setSuccess(false)} className="btn-secondary px-5">Submit Another</button>
        <button onClick={() => router.push('/dashboard/customer')} className="btn-primary px-6">View Services</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Request Service</h1><p className="text-slate-400 mt-1">Tell us what you need, where, and when</p></div>
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}
      <div className="card space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Service Type *</label>
          <div className="grid grid-cols-2 gap-2.5">
            {SERVICE_TYPES.map(s => (
              <button key={s.value} onClick={() => setForm(f => ({...f, service_type: s.value}))}
                className={`p-3 rounded-lg border text-left transition-colors ${form.service_type===s.value?'border-sky-500 bg-sky-500/10':'border-slate-600 bg-slate-700/30 hover:border-slate-500'}`}>
                <div className="font-medium text-white text-sm">{s.icon} {s.label}</div>
                <div className="text-slate-400 text-xs mt-0.5">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Jobsite Address *</label>
          <input type="text" className="input" placeholder="123 Construction Blvd, Orlando, FL" value={form.jobsite_address} onChange={e => setForm(f => ({...f, jobsite_address: e.target.value}))}/>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Bin # <span className="text-slate-500">(optional)</span></label>
          <input type="text" className="input font-mono" placeholder="e.g. 876907" value={form.bin_number} onChange={e => setForm(f => ({...f, bin_number: e.target.value}))}/>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Preferred Date</label>
          <input type="date" className="input" min={new Date().toISOString().split('T')[0]} value={form.preferred_date} onChange={e => setForm(f => ({...f, preferred_date: e.target.value}))}/>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Preferred Time</label>
          <div className="grid grid-cols-2 gap-2">
            {TIME_PREFS.map(t => (
              <button key={t} onClick={() => setForm(f => ({...f, time_preference: t}))}
                className={`py-2 px-3 rounded-lg border text-sm transition-colors ${form.time_preference===t?'border-sky-500 bg-sky-500/10 text-white':'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Additional Notes</label>
          <textarea className="input min-h-[80px] resize-none" placeholder="Gate code, location on site, overloaded bin..." value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}/>
        </div>
        <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full py-3">
          {loading ? 'Submitting...' : 'Submit Service Request'}
        </button>
      </div>
    </div>
  )
}
