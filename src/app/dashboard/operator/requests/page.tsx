import { createClient } from '@/lib/supabase/server'
import UpdateRequestStatus from '@/components/UpdateRequestStatus'

export default async function OperatorRequestsPage() {
  const supabase = createClient()

  const { data: requests } = await supabase
    .from('service_requests')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Service Requests</h1>
        <p className="text-slate-400 mt-1">Review and manage all incoming service requests</p>
      </div>
      <div className="space-y-3">
        {requests && requests.length > 0 ? requests.map((req: any) => (
          <div key={req.id} className="card">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-white">
                    {(req.service_type || req.equipment_type || 'Service request')?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </h3>
                  <span className={`badge-${req.status}`}>{req.status}</span>
                </div>
                <div className="space-y-1 text-sm text-slate-400">
                  <div>{req.jobsite_address || [req.address, req.city, req.zip].filter(Boolean).join(', ') || 'No address'}</div>
                  {(req.preferred_date || req.scheduled_date) && <div>{new Date(req.preferred_date || req.scheduled_date).toLocaleDateString()}</div>}
                  {req.notes && <div> {req.notes}</div>}
                </div>
              </div>
              <UpdateRequestStatus requestId={req.id} currentStatus={req.status} />
            </div>
          </div>
        )) : (
          <div className="card text-center py-12">
            <p className="text-slate-400">No service requests yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
