import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CustomerAccessCodeButton from '@/components/operator/CustomerAccessCodeButton'

type Params = { params: Promise<{ id: string }> }

function money(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

export default async function OperatorClientDetailPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !client) notFound()

  const [jobsResult, equipmentResult, agreementsResult, invoicesResult, chargesResult] = await Promise.all([
    supabase.from('jobs').select('*').or(`client_id.eq.${id},customer_id.eq.${id}`).limit(25),
    supabase.from('equipment').select('*').or(`client_id.eq.${id},current_client_id.eq.${id}`).limit(50),
    supabase.from('customer_profile_sheets').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(25),
    supabase.from('invoices').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(25),
    supabase.from('billing_events').select('*').eq('client_id', id).order('event_date', { ascending: false }).limit(25),
  ])

  const jobs = jobsResult.data || []
  const equipment = equipmentResult.data || []
  const agreements = agreementsResult.data || []
  const invoices = invoicesResult.data || []
  const charges = chargesResult.data || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard/operator/clients" className="text-sm text-sky-300 hover:underline">Back to Clients</Link>
          <h1 className="mt-2 text-2xl font-bold text-white">{client.company_name || client.name || 'Customer'}</h1>
          <p className="mt-1 text-slate-400">Customer profile, jobs, signed profile sheets, rented equipment, invoices, and billing charges.</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-sm text-slate-300">
          Status: <span className="capitalize text-white">{client.status || client.account_status || 'active'}</span>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card">
          <h2 className="font-semibold text-white">Contact</h2>
          <div className="mt-3 space-y-1 text-sm text-slate-400">
            <div>{client.contact_name || client.billing_contact_name || 'No contact name'}</div>
            <div>{client.email || client.billing_email || 'No email'}</div>
            <div>{client.phone || client.main_phone || 'No phone'}</div>
          </div>
          <CustomerAccessCodeButton clientId={client.id} />
        </div>
        <div className="card">
          <h2 className="font-semibold text-white">Billing</h2>
          <div className="mt-3 space-y-1 text-sm text-slate-400">
            <div>Terms: {client.payment_terms || 'net30'}</div>
            <div>Credit: {money(client.credit_limit)}</div>
            <div>Tax ID: {client.tax_id || 'Not stored'}</div>
          </div>
        </div>
        <div className="card">
          <h2 className="font-semibold text-white">Activity</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-slate-900/50 px-3 py-2"><div className="text-xl font-bold text-white">{jobs.length}</div><div className="text-xs text-slate-500">Jobs</div></div>
            <div className="rounded-lg bg-slate-900/50 px-3 py-2"><div className="text-xl font-bold text-white">{equipment.length}</div><div className="text-xs text-slate-500">Bins</div></div>
            <div className="rounded-lg bg-slate-900/50 px-3 py-2"><div className="text-xl font-bold text-white">{agreements.length}</div><div className="text-xs text-slate-500">Agreements</div></div>
            <div className="rounded-lg bg-slate-900/50 px-3 py-2"><div className="text-xl font-bold text-white">{invoices.length}</div><div className="text-xs text-slate-500">Invoices</div></div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold text-white">Jobs</h2>
        <div className="mt-3 space-y-2">
          {jobs.length ? jobs.map((job: any) => (
            <Link key={job.id} href={`/dashboard/operator/jobs/${job.id}`} className="block rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 hover:border-sky-500/50">
              <div className="font-medium text-white">{job.job_name || job.project_name || job.name || 'Job'}</div>
              <div className="text-xs text-slate-500">{job.jobsite_address || job.address || 'No address'} · {job.status || 'active'}</div>
            </Link>
          )) : <p className="text-sm text-slate-400">No jobs linked yet.</p>}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold text-white">Signed Profile Sheets</h2>
          <div className="mt-3 space-y-2">
            {agreements.length ? agreements.map((agreement: any) => (
              <div key={agreement.id} className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">
                <div className="font-medium text-white">{agreement.job_name || agreement.file_name || 'Agreement'}</div>
                <div className="text-xs text-slate-500">{agreement.import_source || 'ocr_import'} · {agreement.jobsite_address || 'No jobsite address'}</div>
              </div>
            )) : <p className="text-sm text-slate-400">No signed profile sheets linked yet.</p>}
          </div>
        </div>
        <div className="card">
          <h2 className="font-semibold text-white">Additional Charges</h2>
          <div className="mt-3 space-y-2">
            {charges.length ? charges.map((charge: any) => (
              <div key={charge.id} className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-white">{charge.charge_type || charge.event_type}</span>
                  <span className="text-sky-300">{money(charge.amount || charge.total)}</span>
                </div>
                <div className="text-xs text-slate-500">{charge.note || charge.project_name || 'Driver charge'}</div>
              </div>
            )) : <p className="text-sm text-slate-400">No additional charges yet.</p>}
          </div>
        </div>
      </section>
    </div>
  )
}
