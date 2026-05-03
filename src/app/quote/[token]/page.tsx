'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type QuoteRequest = {
  id: string
  access_token: string
  name: string | null
  email: string | null
  phone: string | null
  city: string | null
  zip: string | null
  equipment_type: string | null
  dumpster_size: string | null
  job_type: string | null
  notes: string | null
  status: string | null
  created_at: string | null
}

type QuoteResponse = {
  id: string
  operator_company: string
  operator_name: string
  operator_phone: string | null
  operator_email: string | null
  price_quote: number
  notes: string | null
  available_date: string | null
  status: 'submitted' | 'selected' | 'declined'
}

function money(value: number | string) {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

export default function QuoteMagicLinkPage() {
  const params = useParams<{ token: string }>()
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequest | null>(null)
  const [responses, setResponses] = useState<QuoteResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [selecting, setSelecting] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const response = await fetch(`/api/quote-requests/by-token/${params.token}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error || 'This link is invalid or expired.')
      } else {
        setQuoteRequest(payload.quoteRequest)
        setResponses(payload.responses || [])
      }
      setLoading(false)
    }

    load()
  }, [params.token])

  const selectResponse = async (responseId: string) => {
    if (!quoteRequest) return
    setSelecting(responseId)
    const response = await fetch(`/api/quote-requests/${quoteRequest.id}/select-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token, response_id: responseId }),
    })
    const payload = await response.json()
    setSelecting('')

    if (!response.ok) {
      setError(payload.error || 'Could not select quote.')
      return
    }

    setResponses(prev => prev.map(item => ({
      ...item,
      status: item.id === responseId ? 'selected' : 'declined',
    })))
    setQuoteRequest(prev => prev ? { ...prev, status: 'won' } : prev)
  }

  const selected = responses.find(response => response.status === 'selected')

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="h-40 w-full max-w-2xl rounded-2xl bg-slate-800/40 animate-pulse" />
      </div>
    )
  }

  if (error && !quoteRequest) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <h1 className="text-3xl font-bold text-white mb-3">This link is invalid or expired</h1>
          <p className="text-slate-400 mb-8">Ask the contractor or SiteSync Pro team to resend the quote link.</p>
          <Link href="/quotes" className="btn-primary px-6 py-2.5">Request a new quote</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/60 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 mb-8 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <path d="M4 20L10 8L16 16L20 10L24 20H4Z" fill="white" />
              </svg>
            </div>
            <span className="font-bold text-white">SiteSync Pro</span>
          </Link>
          <h1 className="text-4xl font-bold text-white mb-4">
            Your quotes for {quoteRequest?.equipment_type || 'equipment'} in {quoteRequest?.city || 'your area'}
          </h1>
          <p className="text-slate-400 text-lg">
            Compare operator responses and choose the best fit for your jobsite.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>}

        {selected && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
            <h2 className="font-semibold text-green-400 mb-1">You selected {selected.operator_company}</h2>
            <p className="text-slate-300 text-sm">They have been notified and will be in touch shortly.</p>
          </div>
        )}

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white">Original request</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500 block text-xs">Equipment</span><span className="text-white">{quoteRequest?.equipment_type || '-'}</span></div>
            <div><span className="text-slate-500 block text-xs">Size</span><span className="text-white">{quoteRequest?.dumpster_size || '-'}</span></div>
            <div><span className="text-slate-500 block text-xs">Location</span><span className="text-white">{quoteRequest?.city}, {quoteRequest?.zip}</span></div>
            <div><span className="text-slate-500 block text-xs">Submitted</span><span className="text-white">{quoteRequest?.created_at ? new Date(quoteRequest.created_at).toLocaleDateString() : '-'}</span></div>
          </div>
          {quoteRequest?.notes && <p className="text-sm text-slate-300 whitespace-pre-wrap rounded-xl bg-slate-900/50 p-4">{quoteRequest.notes}</p>}
        </div>

        {responses.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-8 text-center">
            <h2 className="text-xl font-semibold text-white mb-2">Operators are reviewing your request</h2>
            <p className="text-slate-400">You will receive an email or SMS when quotes start coming in.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {responses.map(response => {
              const isSelected = response.status === 'selected'
              const isLocked = Boolean(selected)
              return (
                <div key={response.id} className={`bg-slate-800/40 border rounded-2xl p-6 space-y-4 ${isSelected ? 'border-green-500/40' : 'border-slate-700/50'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-white text-lg">{response.operator_company}</h3>
                      <p className="text-slate-500 text-sm">{response.operator_name}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white">{money(response.price_quote)}</div>
                      <div className="text-xs text-slate-500">Available {response.available_date || 'date TBD'}</div>
                    </div>
                  </div>

                  {response.notes && <p className="text-sm text-slate-300 whitespace-pre-wrap">{response.notes}</p>}

                  {revealed[response.id] && (
                    <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 text-sm text-slate-300">
                      <div>{response.operator_phone || 'No phone provided'}</div>
                      <div>{response.operator_email || 'No email provided'}</div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => setRevealed(prev => ({ ...prev, [response.id]: !prev[response.id] }))}
                      className="btn-secondary px-4 py-2 text-sm"
                    >
                      Contact this operator
                    </button>
                    {!isLocked && (
                      <button
                        onClick={() => selectResponse(response.id)}
                        disabled={selecting === response.id}
                        className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
                      >
                        {selecting === response.id ? 'Selecting...' : 'Select this quote'}
                      </button>
                    )}
                    {isSelected && <span className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-2 text-sm font-medium text-green-400">Selected</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
