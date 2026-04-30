'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const DUMPSTER_SIZES = ['10-yard', '20-yard', '30-yard', '40-yard']
const JOB_TYPES = ['Residential', 'Commercial', 'Construction', 'Cleanup', 'Other']
const EQUIPMENT_TYPES = ['Dumpster / Roll-off', 'Washout Container', 'Slurry Tank', 'Porta Potty', 'Water Tank', 'Storage Container', 'Other']

export default function QuotesPage() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', city: '', zip: '',
    equipment_type: '', dumpster_size: '', start_date: '',
    end_date: '', duration_days: '', job_type: '', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.city || !form.zip || !form.equipment_type || !form.job_type) {
      setError('Please fill in location, equipment type, and job type.'); return
    }
    if (!form.name || !form.email) {
      setError('Please provide your name and email so providers can reach you.'); return
    }
    setLoading(true); setError('')
    const { error: err } = await supabase.from('quote_requests').insert({
      name: form.name, email: form.email, phone: form.phone || null,
      city: form.city, zip: form.zip, equipment_type: form.equipment_type,
      dumpster_size: form.dumpster_size || null, start_date: form.start_date || null,
      end_date: form.end_date || null,
      duration_days: form.duration_days ? parseInt(form.duration_days) : null,
      job_type: form.job_type, notes: form.notes || null, status: 'open',
    })
    if (err) { setError(err.message); setLoading(false) } else { setSubmitted(true) }
  }

  if (submitted) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-green-500/30">
          <svg className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Request Sent!</h1>
        <p className="text-slate-400 mb-2 text-lg">
          Your request has been sent to local providers in <span className="text-sky-400 font-semibold">{form.city}, {form.zip}</span>.
        </p>
        <p className="text-slate-500 text-sm mb-8">
          Providers will send quotes to <strong className="text-slate-300">{form.email}</strong>. Most arrive within 1-2 business hours.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => setSubmitted(false)} className="btn-secondary px-6 py-2.5">Submit Another</button>
          <Link href="/" className="btn-primary px-6 py-2.5">Back to Home</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/60 py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-8 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none"><path d="M4 20L10 8L16 16L20 10L24 20H4Z" fill="white"/></svg>
            </div>
            <span className="font-bold text-white">SiteSync Pro</span>
          </Link>
          <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 rounded-full px-4 py-1.5 text-sky-400 text-sm font-medium mb-5">
            Free Quote Request - No Obligation
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Get Equipment Quotes<br/>from Local Providers</h1>
          <p className="text-slate-400 text-lg max-w-lg mx-auto">
            Dumpsters, washout containers, portable toilets, tanks and more. Fill out the form and local rental companies will send competitive quotes.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>}
        <div className="space-y-6">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <span className="w-6 h-6 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              Your Contact Info
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name *</label><input type="text" className="input" placeholder="Jane Smith" value={form.name} onChange={e => set('name', e.target.value)}/></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label><input type="email" className="input" placeholder="jane@company.com" value={form.email} onChange={e => set('email', e.target.value)}/></div>
              <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-300 mb-1.5">Phone <span className="text-slate-500">(optional)</span></label><input type="tel" className="input" placeholder="(407) 555-0100" value={form.phone} onChange={e => set('phone', e.target.value)}/></div>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <span className="w-6 h-6 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              Delivery Location
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1"><label className="block text-sm font-medium text-slate-300 mb-1.5">City *</label><input type="text" className="input" placeholder="Orlando" value={form.city} onChange={e => set('city', e.target.value)}/></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">ZIP *</label><input type="text" className="input font-mono" placeholder="32801" maxLength={5} value={form.zip} onChange={e => set('zip', e.target.value.replace(/\D/g,''))}/></div>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <span className="w-6 h-6 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              Equipment Needed
            </h2>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Equipment Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {EQUIPMENT_TYPES.map(t => (
                  <button key={t} onClick={() => set('equipment_type', t)}
                    className={`p-3 rounded-xl border text-left text-sm transition-colors ${form.equipment_type === t ? 'border-sky-500 bg-sky-500/10 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {form.equipment_type.includes('Dumpster') && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Dumpster Size</label>
                <div className="grid grid-cols-4 gap-2">
                  {DUMPSTER_SIZES.map(s => (
                    <button key={s} onClick={() => set('dumpster_size', s)}
                      className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${form.dumpster_size === s ? 'border-sky-500 bg-sky-500/10 text-sky-400' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Job Type *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {JOB_TYPES.map(j => (
                  <button key={j} onClick={() => set('job_type', j)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${form.job_type === j ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                    {j}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <span className="w-6 h-6 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center text-xs font-bold">4</span>
              Timeframe
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Start Date</label><input type="date" className="input" min={new Date().toISOString().split('T')[0]} value={form.start_date} onChange={e => set('start_date', e.target.value)}/></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">End Date</label><input type="date" className="input" min={form.start_date || new Date().toISOString().split('T')[0]} value={form.end_date} onChange={e => set('end_date', e.target.value)}/></div>
            </div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Or number of days <span className="text-slate-500">(if dates unknown)</span></label><input type="number" className="input w-40 font-mono" placeholder="7" min={1} max={365} value={form.duration_days} onChange={e => set('duration_days', e.target.value)}/></div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Additional Notes <span className="text-slate-500">(optional)</span></label>
            <textarea className="input min-h-[100px] resize-none" placeholder="Gate code, site access details, weight restrictions..." value={form.notes} onChange={e => set('notes', e.target.value)}/>
          </div>

          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-white text-xl transition-all bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-sky-500/20">
            {loading ? 'Sending to Providers...' : 'Get Free Quotes'}
          </button>
          <p className="text-center text-slate-600 text-xs">No spam - providers only contact you about your request. Free to use.</p>
        </div>

        <div className="mt-12 border-t border-slate-800 pt-10">
          <h2 className="text-center text-white font-semibold mb-6">How It Works</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { icon: 'Submit Request', desc: 'Fill out what you need - takes 2 minutes' },
              { icon: 'Providers Respond', desc: 'Local companies review and send quotes' },
              { icon: 'You Choose', desc: 'Pick the best price and schedule delivery' },
            ].map((s, i) => (
              <div key={i}>
                <div className="font-semibold text-white text-sm">{s.icon}</div>
                <div className="text-slate-500 text-xs mt-1">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
