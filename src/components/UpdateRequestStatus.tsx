'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
const STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']
export default function UpdateRequestStatus({ requestId, currentStatus }: { requestId: string; currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const router = useRouter(); const supabase = createClient()
  const update = async (newStatus: string) => {
    setLoading(true); setStatus(newStatus)
    await supabase.from('service_requests').update({ status: newStatus }).eq('id', requestId)
    setLoading(false); router.refresh()
  }
  return (<div className="flex flex-col gap-1.5 shrink-0">{STATUSES.filter(s => s !== status).map(s => (<button key={s} onClick={() => update(s)} disabled={loading} className="text-xs px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white border border-slate-600/50 transition-colors capitalize disabled:opacity-50"> {s.replace(/_/g, ' ')}</button>))}</div>)
}
