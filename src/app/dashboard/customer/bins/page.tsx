import { createClient } from '@/lib/supabase/server'
import PaginationControls from '@/components/PaginationControls'
import { paginate } from '@/lib/pagination'
import CustomerBinsList, { type CustomerBinItem } from '@/components/customer/CustomerBinsList'

type ClientRow = {
  id: string
  email?: string | null
  billing_email?: string | null
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || ''
}

function binNumberFor(item: any) {
  return item.bin_number || item.container_number || item.id?.slice(0, 8)
}

export default async function CustomerBinsPage({ searchParams }: { searchParams?: Promise<{ page?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const resolvedSearchParams = await searchParams
  const pagination = paginate({ page: resolvedSearchParams?.page })
  const userEmail = normalizeEmail(user?.email)

  const { data: clientRows } = await supabase
    .from('clients')
    .select('id,email,billing_email')
    .limit(500)

  const clientIds = (clientRows || [])
    .filter((client: ClientRow) => {
      const emails = [normalizeEmail(client.email), normalizeEmail(client.billing_email)].filter(Boolean)
      return emails.length === 0 ? false : emails.includes(userEmail)
    })
    .map((client: ClientRow) => client.id)

  let rows: any[] | null = []
  let count = 0

  if (clientIds.length > 0) {
    const clientIdList = clientIds.join(',')
    const result = await supabase
      .from('equipment')
      .select('id,bin_number,container_number,type,status,location,last_serviced_at,client_id,current_client_id,jobsite_id,current_jobsite_id', { count: 'exact' })
      .or(`client_id.in.(${clientIdList}),current_client_id.in.(${clientIdList})`)
      .in('status', ['deployed', 'needs_swap', 'full', 'in_transit'])
      .order('bin_number', { ascending: true })
      .range(pagination.from, pagination.to)
    rows = result.data || []
    count = result.count || 0
  }

  const jobsiteIds = Array.from(new Set((rows || []).map((item: any) => item.jobsite_id || item.current_jobsite_id).filter(Boolean)))
  const { data: jobsites } = jobsiteIds.length > 0
    ? await supabase.from('jobsites').select('id,name,address,city,state,zip').in('id', jobsiteIds)
    : { data: [] }
  const jobsitesById = new Map((jobsites || []).map((jobsite: any) => [jobsite.id, jobsite]))

  const binNumbers = (rows || []).map(binNumberFor).filter(Boolean)
  const { data: activeRequests } = binNumbers.length > 0
    ? await supabase
      .from('service_requests')
      .select('bin_number,status')
      .eq('customer_id', user!.id)
      .in('bin_number', binNumbers)
      .in('status', ['pending', 'dispatch_ready', 'scheduled', 'confirmed', 'in_progress'])
    : { data: [] }
  const activeSwapBins = new Set((activeRequests || []).map((request: any) => request.bin_number).filter(Boolean))

  const items: CustomerBinItem[] = (rows || []).map((item: any) => {
    const jobsiteId = item.jobsite_id || item.current_jobsite_id
    const binNumber = binNumberFor(item)
    return {
      ...item,
      jobsite_id: jobsiteId,
      jobsite: jobsiteId ? jobsitesById.get(jobsiteId) || null : null,
      active_swap_requested: activeSwapBins.has(binNumber),
    }
  })
  const total = count || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Rented Equipment</h1>
        <p className="text-slate-400 mt-1">Only equipment assigned to your jobsites is visible here. Request a swap from the exact bin that needs service.</p>
      </div>

      <div className="space-y-4">
        {items.length > 0 ? (
          <CustomerBinsList items={items} />
        ) : (
          <div className="card px-4 py-10 text-center text-sm text-slate-400">
            No rented equipment is linked to this customer account yet.
          </div>
        )}
        <PaginationControls basePath="/dashboard/customer/bins" pagination={pagination} total={total} />
      </div>
    </div>
  )
}
