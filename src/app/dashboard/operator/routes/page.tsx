'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Job = {
  id: string
  address?: string
  city?: string
  state?: string
  zip?: string
  status?: string
  priority?: string
  scheduled_date?: string
}

export default function RoutesPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('jobs').select('*').order('scheduled_date', { ascending: true })
    setJobs(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const todayJobs = jobs.filter(j => j.scheduled_date?.startsWith(date))

  const fmt = (j: Job) => [j.address, j.city, j.state, j.zip].filter(Boolean).join(', ') || 'No address'

  const sc = (s?: string) => {
    if (s === 'completed') return 'text-green-400 bg-green-500/20 border-green-500/30'
    if (s === 'in_progress') return 'text-sky-400 bg-sky-500/20 border-sky-500/30'
    return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Route Optimizer</h1>
          <p className="text-slate-400 mt-1">{todayJobs.length} stops scheduled for {date}</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" className="input text-sm py-2 px-3" value={date} onChange={e => setDate(e.target.value)} />
          <button onClick={load} className="btn-secondary text-sm px-4 py-2">Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Jobs', value: jobs.length, color: 'text-sky-400' },
          { label: 'Today', value: todayJobs.length, color: 'text-yellow-400' },
          { label: 'Completed', value: jobs.filter(j => j.status === 'completed').length, color: 'text-green-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className={'text-2xl font-bold ' + stat.color}>{stat.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse" />)}
        </div>
      ) : todayJobs.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="font-semibold text-white mb-2">No stops for {date}</h3>
          <p className="text-slate-400 text-sm">Select a different date or add scheduled jobs.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {todayJobs.map((job, i) => (
            <div key={job.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-5 py-4 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-sm shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={'text-xs px-2 py-0.5 rounded-full border capitalize ' + sc(job.status)}>
                    {job.status || 'pending'}
                  </span>
                </div>
                <div className="text-sm text-white truncate">{fmt(job)}</div>
              </div>
              <a href={'https://www.google.com/maps/search/' + encodeURIComponent(fmt(job))} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs px-3 py-1.5 shrink-0">
                Navigate
              </a>
            </div>
          ))}
          <div className="pt-4">
            <a href={'https://www.google.com/maps/dir/' + todayJobs.map(j => encodeURIComponent(fmt(j))).join('/')} target="_blank" rel="noopener noreferrer" className="btn-primary w-full py-3 text-center block font-semibold rounded-xl">
              Open Full Route in Google Maps
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
