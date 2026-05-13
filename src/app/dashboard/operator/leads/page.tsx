'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { paginate, showingRange, totalPages } from '@/lib/pagination'

type Lead = {
  id: string; name: string; email: string; phone?: string;
  city: string; zip: string; equipment_type: string; dumpster_size?: string;
  start_date?: string; end_date?: string; duration_days?: number;
  job_type: string; notes?: string; status: string; created_at: string
}

const SC: Record<string,{label:string;color:string;bg:string}> = {
  open:      {label:'New Lead',  color:'text-sky-400',    bg:'bg-sky-500/20 border-sky-500/30'},
  contacted: {label:'Contacted', color:'text-yellow-400', bg:'bg-yellow-500/20 border-yellow-500/30'},
  quoted:    {label:'Quoted',    color:'text-purple-400', bg:'bg-purple-500/20 border-purple-500/30'},
  won:       {label:'Won',       color:'text-green-400',  bg:'bg-green-500/20 border-green-500/30'},
  lost:      {label:'Lost',      color:'text-slate-500',  bg:'bg-slate-700/40 border-slate-600/40'},
}
const HIDDEN_LEAD_STATUSES = new Set(['deleted', 'archived', 'spam'])
const ARCHIVE_MARKER = '[SiteSync archived from operator inbox]'

function hideArchivedLeads(query: any) {
  return query.neq('status', 'deleted').neq('status', 'archived').neq('status', 'spam')
}

function isVisibleLead(lead: Lead) {
  return !HIDDEN_LEAD_STATUSES.has(String(lead.status || '').toLowerCase()) && !String(lead.notes || '').includes(ARCHIVE_MARKER)
}

function archivedNotes(existingNotes?: string) {
  const stamp = new Date().toISOString()
  const note = `${ARCHIVE_MARKER} [${stamp}] Archived from operator inbox.`
  return existingNotes ? `${existingNotes}\n\n${note}` : note
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Lead|null>(null)
  const [filter, setFilter] = useState('open')
  const [sending, setSending] = useState(false)
  const [smsResult, setSmsResult] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [note, setNote] = useState('')
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState({ open: 0, contacted: 0, quoted: 0, won: 0 })
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const pagination = useMemo(() => paginate({ page: searchParams.get('page') }), [searchParams])
  const range = showingRange(total, pagination)
  const pages = totalPages(total, pagination.pageSize)

  const load = useCallback(async () => {
    setLoading(true)
    let matchedLeadIds: string[] | null = null
    let scopedByCoverage = false
    const { data: auth } = await supabase.auth.getUser()

    if (auth.user) {
      const { data: memberships, error: membershipError } = await supabase
        .from('organization_members')
        .select('organization_id,role')
        .eq('user_id', auth.user.id)

      if (!membershipError && memberships?.length) {
        const isSuperAdmin = memberships.some((membership: any) => membership.role === 'super_admin')
        const organizationIds = memberships
          .filter((membership: any) => ['operator_admin', 'operator_member', 'super_admin'].includes(membership.role))
          .map((membership: any) => membership.organization_id)

        if (!isSuperAdmin && organizationIds.length) {
          const { data: matches, error: matchError } = await supabase
            .from('lead_division_matches')
            .select('quote_request_id')
            .in('organization_id', organizationIds)

          if (!matchError) {
            scopedByCoverage = true
            matchedLeadIds = [
              ...new Set<string>(
                (matches || [])
                  .map((match: any) => String(match.quote_request_id || ''))
                  .filter(Boolean)
              ),
            ]
          }
        }
      }
    }

    if (scopedByCoverage && matchedLeadIds?.length === 0) {
      setLeads([])
      setTotal(0)
      setStatusCounts({ open: 0, contacted: 0, quoted: 0, won: 0 })
      setLoading(false)
      return
    }

    const applyCoverageScope = (query: any) => {
      return scopedByCoverage && matchedLeadIds ? query.in('id', matchedLeadIds) : query
    }

    let q = hideArchivedLeads(applyCoverageScope(supabase
      .from('quote_requests')
      .select('*', { count: 'exact' })
      .order('created_at',{ascending:false})
      .range(pagination.from, pagination.to)))
    if (filter !== 'all') q = q.eq('status', filter)
    const [leadResult, open, contacted, quoted, won] = await Promise.all([
      q,
      applyCoverageScope(supabase.from('quote_requests').select('id', { count: 'exact', head: true })).eq('status', 'open'),
      applyCoverageScope(supabase.from('quote_requests').select('id', { count: 'exact', head: true })).eq('status', 'contacted'),
      applyCoverageScope(supabase.from('quote_requests').select('id', { count: 'exact', head: true })).eq('status', 'quoted'),
      applyCoverageScope(supabase.from('quote_requests').select('id', { count: 'exact', head: true })).eq('status', 'won'),
    ])
    setLeads((leadResult.data || []).filter(isVisibleLead))
    setTotal(leadResult.count || 0)
    setStatusCounts({
      open: open.count || 0,
      contacted: contacted.count || 0,
      quoted: quoted.count || 0,
      won: won.count || 0,
    })
    setLoading(false)
  }, [filter, pagination.from, pagination.to, supabase])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('quote_requests').update({status}).eq('id',id)
    setLeads(p => p.map(l => l.id===id ? {...l,status} : l))
    if (selected?.id===id) setSelected(p => p ? {...p,status} : p)
  }

  const deleteLead = async (lead: Lead) => {
    if (!window.confirm(`Delete the lead from ${lead.name}? This removes it from the operator inbox.`)) return
    setDeletingId(lead.id)
    setActionMessage('')
    setActionError(false)

    const response = await fetch(`/api/quote-requests/${lead.id}`, { method: 'DELETE' })
    const payload = await response.json().catch(() => ({}))
    setDeletingId('')

    if (!response.ok) {
      const fallback = await supabase
        .from('quote_requests')
        .update({ status: 'lost', notes: archivedNotes(lead.notes) })
        .eq('id', lead.id)

      if (fallback.error) {
        setActionError(true)
        setActionMessage(payload.error || fallback.error.message || 'Could not delete lead.')
        return
      }
    }

    setSelected(current => current?.id === lead.id ? null : current)
    setLeads(current => current.filter(item => item.id !== lead.id))
    setActionMessage('Lead deleted from the operator inbox.')
    setActionError(false)
    await load()
  }

  const sendSMS = async (type: string) => {
    if (!selected?.phone) { setSmsResult('No phone number on file'); return }
    setSending(true); setSmsResult('')
    const res = await fetch('/api/sms', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        type, phone: selected.phone, customerName: selected.name,
        serviceType: `${selected.equipment_type}${selected.dumpster_size ? ` (${selected.dumpster_size})` : ''}`,
        address: `${selected.city}, ${selected.zip}`,
        eta: note || 'soon', requestId: selected.id,
      })
    })
    const data = await res.json()
    setSending(false)
    if (data.success) {
      setSmsResult('SMS sent via Quo!')
      if (type==='confirmation') updateStatus(selected.id,'contacted')
      if (type==='scheduled') updateStatus(selected.id,'quoted')
    } else if (data.reason==='not_configured') {
      setSmsResult('Quo not configured - add QUO_API_KEY and QUO_FROM_NUMBER to Vercel env vars')
    } else {
      setSmsResult(data.error || 'Failed to send')
    }
    setTimeout(() => setSmsResult(''), 5000)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Quote Leads</h1>
          <p className="text-slate-400 mt-1">Equipment rental requests from potential customers</p>
        </div>
        <a href="/quotes" target="_blank" rel="noopener noreferrer" className="btn-primary text-sm px-4 py-2 flex items-center gap-2">
          View Public Form
        </a>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {l:'New Leads', v:statusCounts.open, c:'text-sky-400', bg:'bg-sky-500/10 border-sky-500/20'},
          {l:'Contacted', v:statusCounts.contacted, c:'text-yellow-400', bg:'bg-yellow-500/10 border-yellow-500/20'},
          {l:'Quoted',    v:statusCounts.quoted, c:'text-purple-400', bg:'bg-purple-500/10 border-purple-500/20'},
          {l:'Won',       v:statusCounts.won, c:'text-green-400', bg:'bg-green-500/10 border-green-500/20'},
        ].map(s => (
          <div key={s.l} className={`rounded-xl border px-4 py-3 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.c}`}>{s.v}</div>
            <div className="text-slate-500 text-xs mt-0.5">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {['open','contacted','quoted','won','lost','all'].map(f => (
          <button key={f} onClick={() => { setFilter(f); router.push('/dashboard/operator/leads?page=1') }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter===f ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-400 border border-slate-700/50 hover:text-white'}`}>
            {f==='all' ? 'All Leads' : SC[f]?.label || f}
          </button>
        ))}
      </div>

      {actionMessage && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${actionError ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-green-500/30 bg-green-500/10 text-green-400'}`}>
          {actionMessage}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse"/>)}</div>
      ) : leads.length===0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3"></div>
          <h3 className="font-semibold text-white mb-2">No leads yet</h3>
          <p className="text-slate-400 text-sm">Share the <a href="/quotes" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">public quote form</a> to start receiving requests.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map(lead => {
            const sc = SC[lead.status] || SC.open
            return (
              <div key={lead.id} onClick={() => {setSelected(lead);setSmsResult('');setNote('')}}
                className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-5 py-4 cursor-pointer hover:border-slate-600 transition-colors flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-medium text-white">{lead.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${sc.bg} ${sc.color}`}>{sc.label}</span>
                    {lead.status==='open' && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 animate-pulse">New</span>}
                  </div>
                  <div className="flex gap-4 text-xs text-slate-400 flex-wrap">
                    <span>{lead.equipment_type}{lead.dumpster_size ? `  ${lead.dumpster_size}` : ''}</span>
                    <span>{lead.city}, {lead.zip}</span>
                    <span>{lead.job_type}</span>
                    {lead.phone && <span>{lead.phone}</span>}
                  </div>
                </div>
                <Link
                  href={`/dashboard/operator/leads/${lead.id}`}
                  onClick={event => event.stopPropagation()}
                  className="shrink-0 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-400 hover:bg-sky-500/20"
                >
                  Send Quote
                </Link>
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation()
                    deleteLead(lead)
                  }}
                  disabled={deletingId === lead.id}
                  className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  {deletingId === lead.id ? 'Deleting...' : 'Delete'}
                </button>
                <div className="text-right shrink-0 text-slate-500 text-xs">
                  {new Date(lead.created_at).toLocaleDateString()}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-slate-700/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">Showing {range.start}-{range.end} of {total}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/dashboard/operator/leads?page=${Math.max(1, pagination.page - 1)}`)}
              disabled={pagination.page <= 1}
              className="rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:pointer-events-none disabled:border-slate-700/40 disabled:text-slate-600"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">Page {pagination.page} of {pages}</span>
            <button
              onClick={() => router.push(`/dashboard/operator/leads?page=${Math.min(pages, pagination.page + 1)}`)}
              disabled={pagination.page >= pages}
              className="rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:pointer-events-none disabled:border-slate-700/40 disabled:text-slate-600"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-end p-4"
          onClick={e => e.target===e.currentTarget && setSelected(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg h-[calc(100vh-2rem)] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-700/60 flex items-start justify-between shrink-0">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-bold text-white text-lg">{selected.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${SC[selected.status]?.bg} ${SC[selected.status]?.color}`}>{SC[selected.status]?.label}</span>
                </div>
                <div className="text-slate-400 text-sm">{selected.email}{selected.phone ? `  ${selected.phone}` : ''}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white p-1"></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-slate-800/60 rounded-xl p-4 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500 block text-xs">Equipment</span><span className="text-white">{selected.equipment_type}</span></div>
                {selected.dumpster_size && <div><span className="text-slate-500 block text-xs">Size</span><span className="text-white">{selected.dumpster_size}</span></div>}
                <div><span className="text-slate-500 block text-xs">Job Type</span><span className="text-white">{selected.job_type}</span></div>
                <div><span className="text-slate-500 block text-xs">Location</span><span className="text-white">{selected.city}, {selected.zip}</span></div>
                {selected.start_date && <div><span className="text-slate-500 block text-xs">Start</span><span className="text-white">{selected.start_date}</span></div>}
                {selected.end_date && <div><span className="text-slate-500 block text-xs">End</span><span className="text-white">{selected.end_date}</span></div>}
                {selected.duration_days && <div><span className="text-slate-500 block text-xs">Duration</span><span className="text-white">{selected.duration_days} days</span></div>}
              </div>
              {selected.notes && <div className="bg-slate-700/40 rounded-lg p-3 text-slate-300 text-sm italic">&ldquo;{selected.notes}&rdquo;</div>}

              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(SC).map(([key,sc]) => (
                    <button key={key} onClick={() => updateStatus(selected.id,key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selected.status===key ? `${sc.bg} ${sc.color} border-current` : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
                <p className="text-sm font-semibold text-white mb-3">Send SMS via Quo</p>
                {!selected.phone && <p className="text-slate-500 text-xs italic mb-3">No phone number on file. Reach out by email.</p>}
                <div className="mb-3">
                  <label className="block text-xs text-slate-400 mb-1">ETA / Schedule / Quote</label>
                  <input type="text" className="input text-sm py-2" placeholder="e.g. tomorrow at 9am, $450/week"
                    value={note} onChange={e => setNote(e.target.value)}/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {type:'confirmation', label:'Confirm Order',  color:'bg-green-500/20 text-green-400 border-green-500/30'},
                    {type:'scheduled',   label:'Send Schedule',  color:'bg-sky-500/20 text-sky-400 border-sky-500/30'},
                    {type:'eta_update',  label:'ETA Update',     color:'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'},
                    {type:'completed',   label:'Mark Complete',  color:'bg-purple-500/20 text-purple-400 border-purple-500/30'},
                  ].map(btn => (
                    <button key={btn.type} onClick={() => sendSMS(btn.type)} disabled={sending || !selected.phone}
                      className={`py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${btn.color}`}>
                      {sending ? '...' : btn.label}
                    </button>
                  ))}
                </div>
                {smsResult && (
                  <div className={`mt-3 text-xs rounded-lg px-3 py-2 ${smsResult.includes('sent') ? 'bg-green-500/10 text-green-400' : smsResult.includes('configured') ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                    {smsResult}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <a href={`mailto:${selected.email}?subject=Your Equipment Quote Request`}
                  className="btn-primary text-sm px-4 py-2 flex-1 text-center">Email Customer</a>
                {selected.phone && <a href={`tel:${selected.phone}`} className="btn-secondary text-sm px-4 py-2">Call</a>}
              </div>

              <button
                type="button"
                onClick={() => deleteLead(selected)}
                disabled={deletingId === selected.id}
                className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
              >
                {deletingId === selected.id ? 'Deleting lead...' : 'Delete Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
