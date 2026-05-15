import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

function money(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

async function signedUrl(supabase: Awaited<ReturnType<typeof createClient>>, bucket: string, path?: string | null) {
  if (!path) return null
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10)
  return data?.signedUrl || null
}

export default async function OperatorJobDetailPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: job, error } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle()
  if (error || !job) notFound()

  const [agreementsResult, chargesResult, equipmentResult, routeStopsResult] = await Promise.all([
    supabase.from('customer_profile_sheets').select('*').eq('job_id', id).order('created_at', { ascending: false }).limit(25),
    supabase.from('billing_events').select('*').eq('job_id', id).order('event_date', { ascending: false }).limit(50),
    supabase.from('equipment').select('*').eq('job_id', id).limit(100),
    supabase.from('route_stops').select('*').eq('job_id', id).order('stop_order', { ascending: true }).limit(100),
  ])

  const agreements = await Promise.all((agreementsResult.data || []).map(async (agreement: any) => ({
    ...agreement,
    signedUrl: await signedUrl(supabase, 'profile-sheets', agreement.file_path),
  })))
  const charges = await Promise.all((chargesResult.data || []).map(async (charge: any) => ({
    ...charge,
    photoSignedUrl: await signedUrl(supabase, 'stop-photos', charge.photo_url || charge.payload?.photo_url),
  })))
  const equipment = equipmentResult.data || []
  const routeStops = routeStopsResult.data || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard/operator/jobs" className="text-sm text-sky-300 hover:underline">Back to Jobs</Link>
          <h1 className="mt-2 text-2xl font-bold text-white">{job.job_name || job.project_name || job.name || 'Job'}</h1>
          <p className="mt-1 text-slate-400">{job.jobsite_address || job.address || 'No jobsite address'} · {job.status || 'active'}</p>
        </div>
        {agreements[0]?.signedUrl && <a href={agreements[0].signedUrl} target="_blank" rel="noreferrer" className="btn-primary px-4 py-2 text-sm">Open Signed Profile Sheet</a>}
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card">
          <h2 className="font-semibold text-white">Jobsite</h2>
          <div className="mt-3 space-y-1 text-sm text-slate-400">
            <div>{job.jobsite_address || job.address || 'No address'}</div>
            <div>{[job.jobsite_city, job.jobsite_state_code, job.jobsite_zip].filter(Boolean).join(', ') || 'No city/state/ZIP'}</div>
            <div>Contact: {job.jobsite_contact_name || 'Not stored'}</div>
            <div>Phone: {job.jobsite_contact_phone || 'Not stored'}</div>
          </div>
        </div>
        <div className="card">
          <h2 className="font-semibold text-white">Billing Evidence</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-slate-900/50 px-3 py-2"><div className="text-xl font-bold text-white">{agreements.length}</div><div className="text-xs text-slate-500">Agreements</div></div>
            <div className="rounded-lg bg-slate-900/50 px-3 py-2"><div className="text-xl font-bold text-white">{charges.length}</div><div className="text-xs text-slate-500">Charges</div></div>
            <div className="rounded-lg bg-slate-900/50 px-3 py-2"><div className="text-xl font-bold text-white">{equipment.length}</div><div className="text-xs text-slate-500">Bins</div></div>
            <div className="rounded-lg bg-slate-900/50 px-3 py-2"><div className="text-xl font-bold text-white">{routeStops.length}</div><div className="text-xs text-slate-500">Stops</div></div>
          </div>
        </div>
        <div className="card">
          <h2 className="font-semibold text-white">PO / Contract</h2>
          <div className="mt-3 space-y-1 text-sm text-slate-400">
            <div>Job #: {job.job_number || 'Not stored'}</div>
            <div>PO #: {job.po_number || 'Not stored'}</div>
            <div>Contract date: {job.contract_date || job.created_at?.slice(0, 10) || 'Not stored'}</div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold text-white">Signed Profile Sheets</h2>
        <div className="mt-3 space-y-2">
          {agreements.length ? agreements.map((agreement: any) => (
            <div key={agreement.id} className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-white">{agreement.file_name || agreement.job_name || 'Profile sheet'}</div>
                  <div className="text-xs text-slate-500">{agreement.import_source || 'ocr_import'} · {agreement.created_at ? new Date(agreement.created_at).toLocaleString() : ''}</div>
                </div>
                {agreement.signedUrl && <a href={agreement.signedUrl} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-1.5 text-xs">Open Document</a>}
              </div>
            </div>
          )) : <p className="text-sm text-slate-400">No profile sheet attached yet.</p>}
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold text-white">Driver Additional Charges</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {charges.length ? charges.map((charge: any) => (
            <div key={charge.id} className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{charge.charge_type || charge.payload?.charge_type || charge.event_type}</div>
                  <div className="mt-1 text-xs text-slate-500">{charge.note || charge.payload?.note || 'No note'} · {charge.status || 'pending_review'}</div>
                </div>
                <div className="text-lg font-bold text-sky-300">{money(charge.amount || charge.payload?.amount)}</div>
              </div>
              {charge.photoSignedUrl && (
                <a href={charge.photoSignedUrl} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-lg border border-slate-700/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={charge.photoSignedUrl} alt="Driver charge evidence" className="h-40 w-full object-cover" />
                </a>
              )}
            </div>
          )) : <p className="text-sm text-slate-400">No driver charges are linked to this job yet.</p>}
        </div>
      </section>
    </div>
  )
}
