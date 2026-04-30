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
    if (!form.city || !form.zip || !form.equipment_type || !form.job_type) { setError('Please fill in location, equipment type, and job type.'); return }
    if (!form.name || !form.email) { setError('Please provide your name and email.'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.from('quote_requests').insert({
      name: form.name, email: form.email, phone: form.phone || null,
      city: form.city, zip: form.zip, equipment_type: form.equipment_type,
      dumpster_size: form.dumpster_size || null, start_date: form.start_date || null,
      end_date: form.end_date || null, duration_days: form.duration_days ? parseInt(form.duration_days) : null,
      job_type: form.job_type, notes: form.notes || null, status: 'open',
    })
    if (err) { setError(err.message); setLoading(false) } else { setSubmitted(true) }
  }

  if (submitted) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Request Sent! 🎉</h1>
        <p className="text-slate-400 mb-2 text-lg">Your request has been sent to local providers in <span className="text-sky-400 font-semibold">{form.city}, {form.zip}</span>.</p>
        <p className="text-slate-500 text-sm mb-8">Quotes will be sent to <strong className="text-slate-300">{form.email}</strong>.</r>
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
          <Link href="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none"><path d="M4 20L10 8L16 16L20 10L24 20H4Z" fill="white"/></svg>
            </div>
            <span className="font-bold text-white">SiteSync Pro</span>
          </Link>
          <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 rounded-full px-4 py-1.5 text-sky-400 text-sm font-medium mb-5">
🏗️ Free Quote Request - No Obligation
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Get Equipment Quotes<br/>from Local Providers</h1>
          <p className="text-slate-400 text-lg max-w-lg mx-auto">
            Dumpsters, washout containers, portable toilets, tanks &amp; more.
          </p>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-10">
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>}
        <div className="space-y-6">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-white">1. Your Contact Info</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name *</label><input type="text" className="input" placeholder="Jane Smith" value={form.name} onChange={e => set('name', e.target.value)}/></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label><input type="email" className="input" placeholder="jane@company.com" value={form.email} onChange={e => set('email', e.target.value)}/></div>
              <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label><input type="tel" className="input" placeholder="(407) 555-0100" value={form.phone} onChange={e => set('phone', e.target.value)}/></div>
            </div>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-white">2. Location</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1"><label className="block text-sm font-medium text-slate-300 mb-1.5">City *</label><input type="text" className="input" placeholder="Orlando" value={form.city} onChange={e => set('city', e.target.value)}/></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">ZIP *</label><input type="text" className="input font-mono" placeholder="32801" maxLength={5} value={form.zip} onChange={e => set('zip', e.target.value.replace(/\D/g,''))}/></div>
            </div>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-white">3. Equipment</h2>
            <div><label className="block text-sm font-medium text-slate-300 mb-2">Equipment Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {EQUIPMENT_TYPES.map(t => (
                  <button key={t} onClick={() => set('equipment_type', t)}
                    className={`p-3 rounded-xl border text-left text-sm ${form.equipment_type === t ? 'border-sky-500 bg-sky-500/10 text-white' : 'border-slate-600 text-slate-400'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {form.equipment_type.includes('Dumpster') && (
              <div><label className="block text-sm font-medium text-slate-300 mb-2">Size</label>
                <div className="grid grid-cols-4 gap-2">
                  {DUMPSTER_SIZES.map(s => (
                    <button key={s} onClick={() => set('dumpster_size', s)}
                      className={`py-2.5 rounded-xl border text-sm font-medium ${form.dumpster_size === s ? 'border-sky-500 bg-sky-500/10 text-sky-400' : 'border-slate-600 text-slate-400'}`}>{s]</button>
                  ))}
                </div></div>
            )}
            <div><label className="block text-sm font-medium text-slate-300 mb-2">Job Type *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {JOB_TYPES.map(j => (
                  <button key={j} onClick={() => set('job_type', j)}
                    className={`py-2.5 rounded-xl border text-sm font-medium ${form.job_type === j ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-slate-600 text-slate-400'}`}>{j}</button>
                ))}
              </div></div>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes (optional)</label>
            <textarea className="input min-h-[100px] resize-none" placeholder="Gate code, weight restrictions..." value={form.notes} onChange={e => set('notes', e.target.value)}/>
          </div>
          <button onClick={handleSubmit} disabled={loading} className="w-full py-4 rounded-2xl font-bold text-white text-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-60 flex items-center justify-center gap-3">
            {loading ? 'Sending...' : '🏏️ Get Free Quotes'}
          </button>
        </div>
      </div>
    </div>
  )
}
