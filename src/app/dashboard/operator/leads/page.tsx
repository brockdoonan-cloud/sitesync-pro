'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Lead|null>(null)
  const [filter, setFilter] = useState('open')
  const [sending, setSending] = useState(false)
  const [smsResult, setSmsResult] = useState('')
  const [note, setNote] = useState('')
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('quote_requests').select('*').order('created_at',{ascending:false})
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setLeads(data || [])
    setLoading(false)
  }, [filter, supabase])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('quote_requests').update({status}).eq('id',id)
    setLeads(p => p.map(l => l.id===id ? {...l,status} : l))
    if (selected?.id===id) setSelected(p => p ? {...p,status} : p)
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
        <a href="/quotes" target="_blank" className="btn-primary text-sm px-4 py-2 flex items-center gap-2">
          View Public Form
        </a>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {l:'New Leads', v:leads.filter(l=>l.status==='open').length, c:'text-sky-400', bg:'bg-sky-500/10 border-sky-500/20'},
          {l:'Contacted', v:leads.filter(l=>l.status==='contacted').length, c:'text-yellow-400', bg:'bg-yellow-500/10 border-yellow-500/20'},
          {l:'Quoted',    v:leads.filter(l=>l.status==='quoted').length, c:'text-purple-400', bg:'bg-purple-500/10 border-purple-500/20'},
          {l:'Won',       v:leads.filter(l=>l.status==='won').length, c:'text-green-400', bg:'bg-green-500/10 border-green-500/20'},
        ].map(s => (
          <div key={s.l} className={`rounded-xl border px-4 py-3 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.c}`}>{s.v}</div>
            <div className="text-slate-500 text-xs mt-0.5">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {['open','contacted','quoted','won','lost','all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter===f ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-400 border border-slate-700/50 hover:text-white'}`}>
            {f==='all' ? 'All Leads' : SC[f]?.label || f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse"/>)}</div>
      ) : leads.length===0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3"></div>
          <h3 className="font-semibold text-white mb-2">No leads yet</h3>
          <p className="text-slate-400 text-sm">Share the <a href="/quotes" target="_blank" className="text-sky-400 hover:underline">public quote form</a> to start receiving requests.</p>
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
                <div className="text-right shrink-0 text-slate-500 text-xs">
                  {new Date(lead.created_at).toLocaleDateString()}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
