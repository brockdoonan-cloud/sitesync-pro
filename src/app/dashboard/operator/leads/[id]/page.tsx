'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Lead = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  city: string | null
  zip: string | null
  equipment_type: string | null
  dumpster_size: string | null
  start_date: string | null
  end_date: string | null
  job_type: string | null
  notes: string | null
  status: string | null
  created_at: string | null
}

type QuoteResponse = {
  id: string
  price_quote: number
  notes: string | null
  available_date: string | null
  status: string
  created_at: string
}

const HIDDEN_LEAD_STATUSES = new Set(['deleted', 'archived', 'spam'])
const ARCHIVE_MARKER = '[SiteSync archived from operator inbox]'

function archivedNotes(existingNotes?: string | null) {
  const stamp = new Date().toISOString()
  const note = `${ARCHIVE_MARKER} [${stamp}] Archived from operator inbox.`
  return existingNotes ? `${existingNotes}\n\n${note}` : note
}

function money(value: number | string) {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [lead, setLead] = useState<Lead | null>(null)
  const [existing, setExisting] = useState<QuoteResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [price, setPrice] = useState('')
  const [availableDate, setAvailableDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: leadData }, { data: responseData }] = await Promise.all([
        supabase.from('quote_requests').select('*').eq('id', params.id).single(),
        user
          ? supabase
              .from('quote_responses')
              .select('*')
              .eq('quote_request_id', params.id)
              .eq('operator_user_id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      const leadIsHidden = HIDDEN_LEAD_STATUSES.has(String(leadData?.status || '').toLowerCase())
        || String(leadData?.notes || '').includes(ARCHIVE_MARKER)
      setLead(leadData && !leadIsHidden ? leadData : null)
      setExisting(responseData || null)
      if (responseData) {
        setPrice(String(responseData.price_quote || ''))
        setAvailableDate(responseData.available_date || '')
        setNotes(responseData.notes || '')
      }
      setLoading(false)
    }

    load()
  }, [params.id, supabase])

  const submit = async () => {
    setSaving(true)
    setError('')

    const response = await fetch('/api/quote-responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quote_request_id: params.id,
        price_quote: Number(price),
        available_date: availableDate || null,
        notes: notes || null,
      }),
    })

    const payload = await response.json()
    setSaving(false)

    if (!response.ok) {
      setError(payload.error || 'Could not send quote.')
      return
    }

    setExisting(payload.response)
    setEditing(false)
  }

  const deleteLead = async () => {
    if (!lead || !window.confirm(`Delete the lead from ${lead.name || 'this contractor'}? This removes it from the operator inbox.`)) return
    setDeleting(true)
    setError('')

    const response = await fetch(`/api/quote-requests/${lead.id}`, { method: 'DELETE' })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      const fallback = await supabase
        .from('quote_requests')
        .update({ status: 'lost', notes: archivedNotes(lead.notes) })
        .eq('id', lead.id)

      if (fallback.error) {
        setDeleting(false)
        setError(payload.error || fallback.error.message || 'Could not delete lead.')
        return
      }
    }

    router.push('/dashboard/operator/leads')
  }

  if (loading) {
    return <div className="h-64 bg-slate-800/40 rounded-xl animate-pulse" />
  }

  if (!lead) {
    return (
      <div className="card text-center py-12">
        <h1 className="text-xl font-bold text-white mb-2">Lead not found</h1>
        <p className="text-slate-400 text-sm mb-5">This quote request is no longer available.</p>
        <Link href="/dashboard/operator/leads" className="btn-primary px-4 py-2 text-sm">Back to leads</Link>
      </div>
    )
  }

  const formDisabled = Boolean(existing && !editing)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/dashboard/operator/leads" className="text-sky-400 hover:underline text-sm">Back to leads</Link>
          <h1 className="text-2xl font-bold text-white mt-2">{lead.name || 'Quote request'}</h1>
          <p className="text-slate-400 mt-1">{lead.equipment_type}{lead.dumpster_size ? ` - ${lead.dumpster_size}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-400 capitalize">
            {lead.status || 'open'}
          </span>
          <button
            type="button"
            onClick={deleteLead}
            disabled={deleting}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete Lead'}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card space-y-5">
          <div>
            <h2 className="font-semibold text-white">Lead details</h2>
            <p className="text-slate-500 text-sm mt-1">Original request information from the public quote form.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500 block text-xs">Email</span><span className="text-white">{lead.email || '-'}</span></div>
            <div><span className="text-slate-500 block text-xs">Phone</span><span className="text-white">{lead.phone || '-'}</span></div>
            <div><span className="text-slate-500 block text-xs">Location</span><span className="text-white">{lead.city}, {lead.zip}</span></div>
            <div><span className="text-slate-500 block text-xs">Job type</span><span className="text-white">{lead.job_type || '-'}</span></div>
            <div><span className="text-slate-500 block text-xs">Start</span><span className="text-white">{lead.start_date || '-'}</span></div>
            <div><span className="text-slate-500 block text-xs">End</span><span className="text-white">{lead.end_date || '-'}</span></div>
          </div>

          {lead.notes && (
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/40 p-4 text-sm text-slate-300 whitespace-pre-wrap">
              {lead.notes}
            </div>
          )}
        </div>

        <div className="card space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Send quote</h2>
              <p className="text-slate-500 text-sm mt-1">Submit your price, availability, and notes for the contractor.</p>
            </div>
            {existing && (
              <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                Quote sent
              </span>
            )}
          </div>

          {existing && formDisabled ? (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
              <div className="text-3xl font-bold text-white">{money(existing.price_quote)}</div>
              <div className="text-sm text-slate-400">Available {existing.available_date || 'date not specified'}</div>
              {existing.notes && <p className="text-sm text-slate-300 whitespace-pre-wrap">{existing.notes}</p>}
              <button onClick={() => setEditing(true)} className="btn-secondary px-4 py-2 text-sm">Edit quote</button>
            </div>
          ) : (
            <div className="space-y-4">
              {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Price quote *</label>
                <input type="number" min="0" step="0.01" className="input" placeholder="450.00" value={price} onChange={event => setPrice(event.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Available date</label>
                <input type="date" className="input" value={availableDate} onChange={event => setAvailableDate(event.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
                <textarea className="input min-h-[120px] resize-none" placeholder="What is included, timing, terms, or any questions." value={notes} onChange={event => setNotes(event.target.value)} />
              </div>
              <div className="flex gap-2">
                <button onClick={submit} disabled={saving || !price} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                  {saving ? 'Sending...' : existing ? 'Save quote' : 'Send quote'}
                </button>
                {existing && <button onClick={() => setEditing(false)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
