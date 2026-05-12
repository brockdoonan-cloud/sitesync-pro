'use client'

import { useState } from 'react'

export default function CustomerAccessLink() {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  const linkAccount = async () => {
    setLoading(true)
    setMessage('')
    setError(false)

    const response = await fetch('/api/customer/link-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_code: code }),
    })
    const payload = await response.json().catch(() => ({}))
    setLoading(false)

    if (!response.ok) {
      setError(true)
      setMessage(payload.error || 'Could not link account.')
      return
    }

    setMessage('Customer account linked. Refreshing your portal...')
    window.setTimeout(() => window.location.reload(), 700)
  }

  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
      <h2 className="font-semibold text-white">Link Your Customer Account</h2>
      <p className="mt-1 text-sm text-slate-400">
        Enter the access code from dispatch or billing to unlock only your company&apos;s bins, jobsites, requests, and invoices.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          className="input flex-1 font-mono uppercase"
          value={code}
          onChange={event => setCode(event.target.value.toUpperCase())}
          placeholder="ACW-CLIENT-CODE"
        />
        <button type="button" onClick={linkAccount} disabled={loading || !code.trim()} className="btn-primary px-4 py-2 disabled:opacity-50">
          {loading ? 'Linking...' : 'Link Account'}
        </button>
      </div>
      {message && <div className={`mt-3 text-sm ${error ? 'text-red-300' : 'text-green-300'}`}>{message}</div>}
    </div>
  )
}
