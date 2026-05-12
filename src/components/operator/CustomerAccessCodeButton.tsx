'use client'

import { useState } from 'react'

type Props = {
  clientId: string
}

export default function CustomerAccessCodeButton({ clientId }: Props) {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const createCode = async () => {
    setLoading(true)
    setMessage('')
    setError(false)

    const response = await fetch(`/api/operator/clients/${clientId}/access-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const payload = await response.json().catch(() => ({}))
    setLoading(false)

    if (!response.ok) {
      setError(true)
      setMessage(payload.error || 'Could not create access code.')
      return
    }

    setCode(payload.accessCode?.code || '')
    setMessage('Give this code to the customer so they can link only their bins and invoices.')
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer Portal Code</div>
          {code ? <div className="mt-1 font-mono text-sm text-sky-300">{code}</div> : <div className="mt-1 text-xs text-slate-500">Create a one-time code for customer account setup.</div>}
        </div>
        <button
          type="button"
          onClick={createCode}
          disabled={loading}
          className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
        >
          {loading ? 'Creating...' : code ? 'Create Another' : 'Create Code'}
        </button>
      </div>
      {message && <div className={`mt-2 text-xs ${error ? 'text-red-300' : 'text-slate-400'}`}>{message}</div>}
    </div>
  )
}
