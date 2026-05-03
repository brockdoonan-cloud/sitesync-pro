'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'

const EQUIPMENT_TYPES = ['Dumpster / Roll-off', 'Washout Container', 'Slurry Tank', 'Porta Potty', 'Water Tank', 'Storage Container', 'Other']
const DUMPSTER_SIZES = ['10-yard', '20-yard', '30-yard', '40-yard']
const JOB_TYPES = ['Residential', 'Commercial', 'Construction', 'Cleanup', 'Other']

export default function QuotesPage() {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [equipmentType, setEquipmentType] = useState('')
  const [dumpsterSize, setDumpsterSize] = useState('')
  const [jobType, setJobType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [magicLink, setMagicLink] = useState('')

  const handleSubmit = async () => {
    if (!address || !city || !zip || !equipmentType || !jobType) {
      setError(t('quoteRequired'))
      return
    }
    if (!name || !email) {
      setError(t('contactRequired'))
      return
    }
    setLoading(true)
    setError('')
    const response = await fetch('/api/quote-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        phone: phone || null,
        address,
        city,
        zip,
        equipment_type: equipmentType,
        dumpster_size: dumpsterSize || null,
        start_date: startDate || null,
        end_date: endDate || null,
        job_type: jobType,
        notes,
      }),
    })
    const payload = await response.json()
    setLoading(false)
    if (!response.ok) {
      setError(payload.error || 'Could not submit quote request.')
      return
    }
    if (payload.request?.access_token) {
      setMagicLink(`${window.location.origin}/quote/${payload.request.access_token}`)
    }
    setSubmitted(true)
  }

  const shareQuoteLink = async () => {
    const url = window.location.origin + '/quotes'
    if (navigator.share) {
      await navigator.share({ title: 'SiteSync Pro Quote Request', url })
      return
    }
    await navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-green-500/30">
            <svg className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">{t('requestSent')}</h1>
          <p className="text-slate-400 mb-2 text-lg">
            {t('requestSentToProviders')}{' '}
            <span className="text-sky-400 font-semibold">{city}, {zip}</span>.
          </p>
          <p className="text-slate-500 text-sm mb-8">
            {t('quotesSentTo')} <strong className="text-slate-300">{email}</strong>. We also sent your tracking link for comparing responses.
          </p>
          {magicLink && (
            <Link href={magicLink} className="mb-6 inline-flex rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-400 hover:bg-sky-500/20">
              View quote responses
            </Link>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button onClick={() => setSubmitted(false)} className="btn-secondary px-6 py-2.5">{t('submitAnother')}</button>
            <button onClick={shareQuoteLink} className="btn-secondary px-6 py-2.5">
              {linkCopied ? t('linkCopied') : t('shareQuoteLink')}
            </button>
            <Link href="/" className="btn-primary px-6 py-2.5">{t('backHome')}</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/60 py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-8 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <path d="M4 20L10 8L16 16L20 10L24 20H4Z" fill="white" />
              </svg>
            </div>
            <span className="font-bold text-white">SiteSync Pro</span>
          </Link>
          <h1 className="text-4xl font-bold text-white mb-4">
            {t('quotesTitle')}
          </h1>
          <p className="text-slate-400 text-lg max-w-lg mx-auto">
            {t('quotesSubtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>}

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white">{t('contactInfo')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('fullName')} *</label>
              <input type="text" className="input" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('email')} *</label>
              <input type="email" className="input" placeholder="jane@company.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('phone')} <span className="text-slate-500">({t('optional')})</span></label>
              <input type="tel" className="input" placeholder="(407) 555-0100" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white">{t('deliveryLocation')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('exactAddress')} *</label>
              <input type="text" className="input" placeholder="123 Construction Blvd, Orlando, FL" value={address} onChange={e => setAddress(e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('city')} *</label>
              <input type="text" className="input" placeholder="Orlando" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('zip')} *</label>
              <input type="text" className="input font-mono" placeholder="32801" maxLength={5} value={zip} onChange={e => setZip(e.target.value.replace(/[^0-9]/g, ''))} />
            </div>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white">{t('equipmentNeeded')}</h2>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t('equipmentType')} *</label>
            <div className="grid grid-cols-2 gap-2">
              {EQUIPMENT_TYPES.map(t => (
                <button key={t} onClick={() => setEquipmentType(t)}
                  className={`p-3 rounded-xl border text-left text-sm transition-colors ${equipmentType === t ? 'border-sky-500 bg-sky-500/10 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {equipmentType.includes('Dumpster') && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('dumpsterSize')}</label>
              <div className="grid grid-cols-4 gap-2">
                {DUMPSTER_SIZES.map(s => (
                  <button key={s} onClick={() => setDumpsterSize(s)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${dumpsterSize === s ? 'border-sky-500 bg-sky-500/10 text-sky-400' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t('jobType')} *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {JOB_TYPES.map(j => (
                <button key={j} onClick={() => setJobType(j)}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${jobType === j ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                  {j}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white">{t('timeframe')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('startDate')}</label>
              <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('endDate')}</label>
              <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('notes')} <span className="text-slate-500">({t('optional')})</span></label>
          <textarea className="input min-h-[100px] resize-none" placeholder={t('notesPlaceholder')} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-white text-xl transition-all bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-sky-500/20">
          {loading ? t('sendingProviders') : t('getFreeQuotes')}
        </button>
        <p className="text-center text-slate-600 text-xs">{t('noSpam')}</p>
      </div>
    </div>
  )
}
