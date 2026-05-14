import { createClient } from '@/lib/supabase/server'
import PaginationControls from '@/components/PaginationControls'
import { paginate } from '@/lib/pagination'

type JobRow = {
  id: string
  status?: string | null
  scheduled_date?: string | null
  truck_number?: string | null
  driver_name?: string | null
  bin_number?: string | null
  service_requests?: {
    service_type?: string | null
    jobsite_address?: string | null
    profiles?: {
      full_name?: string | null
      company_name?: string | null
    } | null
  } | null
}

type AgreementRow = {
  id: string
  job_id?: string | null
  file_name?: string | null
  file_path?: string | null
  customer_name?: string | null
  job_name?: string | null
  jobsite_address?: string | null
  billing_rules?: Array<{ chargeLabel?: string; rate?: number; unit?: string; enabled?: boolean; chargeMode?: string }> | null
  billing_preview?: { total?: number } | null
  source_text_excerpt?: string | null
  created_at?: string | null
  signedUrl?: string | null
}

function titleize(value?: string | null) {
  return value?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Service'
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function dateAt(dayOffset: number, hour: number, minute = 0) {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

function demoJobs(): JobRow[] {
  return [
    {
      id: 'demo-job-today-1',
      status: 'scheduled',
      scheduled_date: dateAt(0, 8),
      truck_number: '12',
      driver_name: 'Mike R.',
      bin_number: '61506',
      service_requests: {
        service_type: 'swap',
        jobsite_address: '1 Jeff Fuqua Blvd, Orlando, FL 32827',
        profiles: { company_name: 'Baker Concrete - Project Neptune' },
      },
    },
    {
      id: 'demo-job-today-2',
      status: 'en_route',
      scheduled_date: dateAt(0, 10, 30),
      truck_number: '18',
      driver_name: 'Carlos M.',
      bin_number: '41848',
      service_requests: {
        service_type: 'water_removal',
        jobsite_address: '6900 Tavistock Lakes Blvd, Orlando, FL 32827',
        profiles: { company_name: 'WM - HGR Mater Academy' },
      },
    },
    {
      id: 'demo-job-today-3',
      status: 'scheduled',
      scheduled_date: dateAt(0, 14),
      truck_number: '24',
      driver_name: 'Sam T.',
      bin_number: '876920',
      service_requests: {
        service_type: 'pickup',
        jobsite_address: '9801 International Dr, Orlando, FL 32819',
        profiles: { company_name: 'The Conlan Company - Beachline 2 & 3' },
      },
    },
    {
      id: 'demo-job-upcoming-1',
      status: 'scheduled',
      scheduled_date: dateAt(1, 9),
      truck_number: '12',
      driver_name: 'Mike R.',
      bin_number: '143287',
      service_requests: {
        service_type: 'delivery',
        jobsite_address: '301 W 13th St, Sanford, FL 32771',
        profiles: { company_name: 'Sterling Concrete - Sanford Plant' },
      },
    },
    {
      id: 'demo-job-upcoming-2',
      status: 'dispatch_ready',
      scheduled_date: dateAt(2, 11),
      truck_number: '18',
      driver_name: 'Carlos M.',
      bin_number: '165905',
      service_requests: {
        service_type: 'swap',
        jobsite_address: '401 Riveredge Blvd, Cocoa, FL 32922',
        profiles: { company_name: 'Titan America - Cocoa' },
      },
    },
    {
      id: 'demo-job-upcoming-3',
      status: 'scheduled',
      scheduled_date: dateAt(3, 7, 30),
      truck_number: '24',
      driver_name: 'Sam T.',
      bin_number: '60677',
      service_requests: {
        service_type: 'pickup',
        jobsite_address: '951 Market Promenade Ave, Lake Mary, FL 32746',
        profiles: { company_name: 'Jones - Reserve of Twin Lakes' },
      },
    },
  ]
}

function JobCard({ job }: { job: JobRow }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-white">{titleize(job.service_requests?.service_type)}</h3>
            <span className={`badge-${job.status} capitalize`}>{job.status?.replace(/_/g, ' ')}</span>
          </div>
          <div className="text-sm text-slate-400 space-y-0.5">
            <div>Address: {job.service_requests?.jobsite_address || 'No address'}</div>
            <div>Customer: {job.service_requests?.profiles?.company_name ?? job.service_requests?.profiles?.full_name ?? 'Unassigned'}</div>
            {job.bin_number && <div>Bin: #{job.bin_number}</div>}
            {(job.truck_number || job.driver_name) && <div>Truck: {job.truck_number || 'TBD'}{job.driver_name ? ` | ${job.driver_name}` : ''}</div>}
            {job.scheduled_date && <div>Scheduled: {new Date(job.scheduled_date).toLocaleString()}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function OperatorJobsPage({ searchParams }: { searchParams?: Promise<{ page?: string }> }) {
  const supabase = await createClient()
  const resolvedSearchParams = await searchParams
  const pagination = paginate({ page: resolvedSearchParams?.page })
  const [{ data: jobs, count }, agreementResult] = await Promise.all([
    supabase
    .from('jobs')
    .select('*,service_requests(service_type,jobsite_address,profiles(full_name,company_name))', { count: 'exact' })
    .order('scheduled_date', { ascending: true })
      .range(pagination.from, pagination.to),
    supabase
      .from('customer_profile_sheets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(25),
  ])
  const agreementRows = (agreementResult.data || []) as AgreementRow[]
  const agreements = await Promise.all(agreementRows.map(async agreement => {
    if (!agreement.file_path) return { ...agreement, signedUrl: null }
    const { data } = await supabase.storage.from('profile-sheets').createSignedUrl(agreement.file_path, 60 * 10)
    return { ...agreement, signedUrl: data?.signedUrl || null }
  }))

  const today = new Date().toISOString().split('T')[0]
  const liveJobs = (jobs || []) as JobRow[]
  const fallbackJobs = liveJobs.length > 0 ? [] : demoJobs()
  const schedule = [...liveJobs, ...fallbackJobs]
  const todaysJobs = schedule.filter(job => job.scheduled_date?.startsWith(today))
  const upcomingJobs = schedule.filter(job => job.scheduled_date && job.scheduled_date.slice(0, 10) > today)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Jobs</h1>
        <p className="text-slate-400 mt-1">Today&apos;s schedule, upcoming jobs, and signed project agreements</p>
        {fallbackJobs.length > 0 && (
          <p className="text-sky-300 text-sm mt-2">Demo schedule is showing because no live jobs are scheduled yet.</p>
        )}
      </div>

      {agreements.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Project Agreements ({agreements.length})</h2>
            <p className="text-xs text-slate-500">Profile sheets saved from billing import. Use these when a customer questions what was signed or which fees apply to a project.</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {agreements.map(agreement => {
              const enabledRules = (agreement.billing_rules || []).filter(rule => rule.enabled !== false)
              const disabledRules = (agreement.billing_rules || []).filter(rule => rule.enabled === false)
              return (
                <div key={agreement.id} className="card space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{agreement.job_name || 'Project agreement'}</h3>
                      <div className="mt-1 text-sm text-slate-400">{agreement.customer_name || 'Client not linked'}</div>
                      <div className="text-xs text-slate-500">{agreement.jobsite_address || 'No jobsite address stored'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Preview total</div>
                      <div className="text-lg font-bold text-white">{money(agreement.billing_preview?.total)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {agreement.signedUrl && (
                      <a href={agreement.signedUrl} target="_blank" rel="noreferrer" className="btn-primary px-3 py-1.5 text-xs">Open Signed Sheet</a>
                    )}
                    <span className="rounded-full border border-slate-700/60 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-300">{agreement.file_name || 'Profile sheet'}</span>
                    {agreement.job_id && <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300">Job {agreement.job_id.slice(0, 8)}</span>}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2">
                      <div className="text-xs font-semibold text-green-300">Charged fees</div>
                      <div className="mt-1 text-xs text-slate-300">{enabledRules.length ? enabledRules.map(rule => rule.chargeLabel).join(', ') : 'None selected'}</div>
                    </div>
                    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">
                      <div className="text-xs font-semibold text-slate-300">Not charged automatically</div>
                      <div className="mt-1 text-xs text-slate-400">{disabledRules.length ? disabledRules.map(rule => rule.chargeLabel).join(', ') : 'No disabled fees'}</div>
                    </div>
                  </div>
                  {agreement.source_text_excerpt && (
                    <details className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-medium text-sky-300">View extracted agreement text</summary>
                      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{agreement.source_text_excerpt}</pre>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Today ({todaysJobs.length})</h2>
        {todaysJobs.length > 0 ? (
          <div className="space-y-3">{todaysJobs.map((j: any) => <JobCard key={j.id} job={j} />)}</div>
        ) : (
          <div className="card text-center py-8"><p className="text-slate-400">No jobs today.</p></div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Upcoming ({upcomingJobs.length})</h2>
        {upcomingJobs.length > 0 ? (
          <div className="space-y-3">{upcomingJobs.map((j: any) => <JobCard key={j.id} job={j} />)}</div>
        ) : (
          <div className="card text-center py-8"><p className="text-slate-400">No upcoming jobs.</p></div>
        )}
      </div>

      {liveJobs.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <PaginationControls basePath="/dashboard/operator/jobs" pagination={pagination} total={count || 0} />
        </div>
      )}
    </div>
  )
}
