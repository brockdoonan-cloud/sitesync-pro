'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Jobsite = {
  id: string
  name?: string
  address?: string
  lat?: number
  lng?: number
  status?: string
  client_id?: string
  created_at: string
}

type Equipment = {
  id: string
  bin_number?: string
  status?: string
  jobsite_id?: string
}

export default function MapPage() {
  const [jobsites, setJobsites] = useState<Jobsite[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [selected, setSelected] = useState<Jobsite | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: js }, { data: eq }] = await Promise.all([
      supabase.from('jobsites').select('*').order('created_at', { ascending: false }),
      supabase.from('equipment').select('id, bin_number, status, jobsite_id'),
    ])
    setJobsites(js || [])
    setEquipment(eq || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const filtered = jobsites.filter(j =>
    !search ||
    (j.address || '').toLowerCase().includes(search.toLowerCase()) ||
    (j.name || '').toLowerCase().includes(search.toLowerCase())
  )

  const statusColor: Record<string, string> = {
    active:    'bg-green-500/20 text-green-400 border-green-500/30',
    inactive:  'bg-slate-700/40 text-slate-400 border-slate-600/40',
    scheduled: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    completed: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  }

  const statusDot: Record<string, string> = {
    active:    'bg-green-400',
    inactive:  'bg-slate-500',
    scheduled: 'bg-sky-400',
    completed: 'bg-purple-400',
  }

  const binsAt = (jobsiteId: string) => equipment.filter(e => e.jobsite_id === jobsiteId)
  const deployedCount = equipment.filter(e => e.status === 'deployed').length
  const activeCount = jobsites.filter(j => j.status === 'active').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Map</h1>
          <p className="text-slate-400 mt-1">Jobsite locations and deployed equipment</p>
        </div>
        <button onClick={load} className="btn-secondary text-sm px-4 py-2">
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Jobsites', value: jobsites.length, color: 'text-white' },
          { label: 'Active Sites', value: activeCount, color: 'text-green-400' },
          { label: 'Bins Deployed', value: deployedCount, color: 'text-sky-400' },
          { label: 'Bins Available', value: equipment.filter(e => e.status === 'available').length, color: 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          <input
            type="text"
            className="input text-sm py-2"
            placeholder="Search jobsites..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 text-center">
              <p className="text-slate-400 text-sm">No jobsites found</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filtered.map(site => {
                const bins = binsAt(site.id)
                const sc = statusColor[site.status || 'inactive']
                const dot = statusDot[site.status || 'inactive']
                return (
                  <div
                    key={site.id}
                    onClick={() => setSelected(site)}
                    className={`bg-slate-800/60 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${selected?.id === site.id ? 'border-sky-500/50 bg-sky-500/5' : 'border-slate-700/50 hover:border-slate-600'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                          <span className="font-medium text-white text-sm truncate">
                            {site.name || site.address || 'Unnamed Site'}
                          </span>
                        </div>
                        {site.address && site.name && (
                          <p className="text-slate-500 text-xs truncate pl-4">{site.address}</p>
                        )}
                        {bins.length > 0 && (
                          <p className="text-sky-400 text-xs pl-4 mt-1">{bins.length} bin{bins.length !== 1 ? 's' : ''} on site</p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${sc}`}>
                        {site.status || 'inactive'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
            {selected ? (
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-white text-lg">{selected.name || 'Jobsite'}</h3>
                    <p className="text-slate-400 text-sm mt-1">{selected.address || 'No address on file'}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white p-1">x</button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-700/40 rounded-xl p-3">
                    <div className="text-slate-500 text-xs mb-1">Status</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor[selected.status || 'inactive']}`}>
                      {selected.status || 'inactive'}
                    </span>
                  </div>
                  <div className="bg-slate-700/40 rounded-xl p-3">
                    <div className="text-slate-500 text-xs mb-1">Equipment</div>
                    <div className="text-white font-semibold">{binsAt(selected.id).length} bins</div>
                  </div>
                </div>

                {selected.address ? (
                  <div className="rounded-xl overflow-hidden border border-slate-700/50 h-64">
                    <iframe
                      title="map"
                      width="100%"
                      height="256"
                      style={{ border: 0 }}
                      loading="lazy"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(selected.address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-700/50 h-64 bg-slate-900 flex flex-col items-center justify-center gap-3">
                    <p className="text-slate-500 text-sm">No address on file for this site</p>
                  </div>
                )}

                {binsAt(selected.id).length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Equipment at this site</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {binsAt(selected.id).map(bin => (
                        <div key={bin.id} className="bg-slate-700/40 rounded-lg px-3 py-2 text-xs">
                          <div className="text-white font-medium">Bin #{bin.bin_number || bin.id.slice(0,6)}</div>
                          <div className="text-sky-400 mt-0.5">{bin.status}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 gap-4">
                <svg className="w-16 h-16 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="text-center">
                  <p className="text-slate-400 font-medium">Select a jobsite</p>
                  <p className="text-slate-600 text-sm mt-1">Click any site from the list to view its location and deployed equipment</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
