import { createClient } from '@/lib/supabase/server'
import PaginationControls from '@/components/PaginationControls'
import { paginate } from '@/lib/pagination'
import CustomerBinsList, { type CustomerBinItem } from '@/components/customer/CustomerBinsList'
import CustomerAccessLink from '@/components/customer/CustomerAccessLink'
import { DEMO_CUSTOMER_BINS } from '@/lib/demo/customerPortal'
import { clientIdOrFilter, getCustomerClientIds } from '@/lib/customer/access'

function binNumberFor(item: any) {
  return item.bin_number || item.container_number || item.id?.slice(0, 8)
}

export default async function CustomerBinsPage({ searchParams }: { searchParams?: Promise<{ page?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const resolvedSearchParams = await searchParams
  const pagination = paginate({ page: resolvedSearchParams?.page })
  const clientIds = await getCustomerClientIds(supabase, user)

  let rows: any[] | null = []
  let count = 0

  if (clientIds.length > 0) {
    const result = await supabase
      .from('equipment')
      .select('id,bin_number,container_number,type,status,location,last_serviced_at,client_id,current_client_id,job_id,jobsite_id,current_jobsite_id', { count: 'exact' })
      .or(clientIdOrFilter(clientIds))
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
  let activeRequests: any[] = []
  if (binNumbers.length > 0) {
    let activeRequestQuery = supabase
      .from('service_requests')
      .select('bin_number,status')
      .in('bin_number', binNumbers)
      .in('status', ['pending', 'dispatch_ready', 'scheduled', 'confirmed', 'in_progress'])
    activeRequestQuery = clientIds.length > 0
      ? activeRequestQuery.or(`customer_id.eq.${user!.id},client_id.in.(${clientIds.join(',')})`)
      : activeRequestQuery.eq('customer_id', user!.id)
    const result = await activeRequestQuery
    activeRequests = result.data || []
  }
  const activeSwapBins = new Set((activeRequests || []).map((request: any) => request.bin_number).filter(Boolean))

  let items: CustomerBinItem[] = (rows || []).map((item: any) => {
    const jobsiteId = item.jobsite_id || item.current_jobsite_id
    const binNumber = binNumberFor(item)
    return {
      ...item,
      jobsite_id: jobsiteId,
      jobsite: jobsiteId ? jobsitesById.get(jobsiteId) || null : null,
      active_swap_requested: activeSwapBins.has(binNumber),
    }
  })
  let total = count || 0
  const demoMode = items.length === 0

  if (demoMode) {
    const demoBinNumbers = DEMO_CUSTOMER_BINS.map(item => item.bin_number)
    const { data: demoActiveRequests } = await supabase
      .from('service_requests')
      .select('bin_number,status')
      .eq('customer_id', user!.id)
      .in('bin_number', demoBinNumbers)
      .in('status', ['pending', 'dispatch_ready', 'scheduled', 'confirmed', 'in_progress'])
    const activeDemoSwapBins = new Set((demoActiveRequests || []).map((request: any) => request.bin_number).filter(Boolean))

    items = DEMO_CUSTOMER_BINS.map(item => ({
      ...item,
      client_id: null,
      current_client_id: null,
      job_id: null,
      jobsite_id: null,
      current_jobsite_id: null,
      active_swap_requested: activeDemoSwapBins.has(item.bin_number),
    }))
    total = items.length
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Rented Equipment</h1>
        <p className="text-slate-400 mt-1">Only equipment assigned to your jobsites is visible here. Request a swap from the exact bin that needs service.</p>
      </div>

      <div className="space-y-4">
        {demoMode && (
          <>
            <CustomerAccessLink />
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
              Demo customer account: these sample jobsites and bins let you test customer swap requests before a real customer profile is linked.
            </div>
          </>
        )}
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
