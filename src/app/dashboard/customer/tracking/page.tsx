'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n'

type ServiceRequest = {
  id: string
  status: string | null
  address?: string | null
  city?: string | null
  zip?: string | null
  equipment_type?: string | null
  scheduled_date?: string | null
  notes?: string | null
  created_at?: string | null
  jobsite_address?: string | null
  service_type?: string | null
  preferred_date?: string | null
  eta_at?: string | null
  route_stop?: {
    id: string
    status?: string | null
    eta?: string | null
    eta_minutes?: number | null
    address?: string | null
    stop_order?: number | null
  } | null
  driver_route?: {
    id: string
    truck_number?: string | null
    driver_name?: string | null
    status?: string | null
    opened_at?: string | null
    last_eta_at?: string | null
  } | null
  truck_location?: {
    lat: number
    lng: number
    status?: string | null
    recorded_at?: string | null
  } | null
}

const activeStatuses = ['pending', 'dispatch_ready', 'scheduled', 'confirmed', 'dispatched', 'en_route', 'in_progress', 'completed']

function normalizeStatus(status?: string | null) {
  if (status === 'dispatch_ready') return 'pending'
  if (status === 'confirmed') return 'scheduled'
  if (status === 'dispatched' || status === 'in_progress') return 'en_route'
  if (status === 'arrived') return 'en_route'
  return status || 'pending'
}

function canCancel(status?: string | null) {
  return ['pending', 'dispatch_ready', 'scheduled', 'confirmed'].includes(status || 'pending')
}

function titleize(value?: string | null) {
  return value?.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) || 'Service Request'
}

function requestAddress(request: ServiceRequest) {
  return [request.address || request.jobsite_address, request.city, request.zip].filter(Boolean).join(', ')
}

function requestDate(request: ServiceRequest, fallback: string) {
  const value = request.scheduled_date || request.preferred_date || request.created_at
  if (!value) return fallback
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function mapUrl(address: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
}

function trackerMapUrl(request: ServiceRequest, address: string) {
  if (request.truck_location?.lat && request.truck_location?.lng) {
    return `https://www.google.com/maps?q=${request.truck_location.lat},${request.truck_location.lng}&output=embed`
  }
  return mapUrl(address)
}

function etaText(request?: ServiceRequest | null) {
  const eta = request?.route_stop?.eta || request?.eta_at || request?.driver_route?.last_eta_at
  if (!eta) return 'ETA pending'
  return new Date(eta).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function ProgressTracker({ status, steps }: { status: string; steps: { key: string; label: string }[] }) {
  const normalized = normalizeStatus(status)
  const currentIndex = Math.max(0, steps.findIndex(step => step.key === normalized))

  return (
    <div className="grid grid-cols-4 gap-2">
      {steps.map((step, index) => {
        const isDone = index <= currentIndex
        return (
          <div key={step.key} className="space-y-2">
            <div className={`h-2 rounded-full ${isDone ? 'bg-sky-400' : 'bg-slate-700'}`} />
            <div className={`text-xs font-medium ${isDone ? 'text-white' : 'text-slate-500'}`}>{step.label}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function TrackingPage() {
  const { t } = useLanguage()
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/customer/tracking', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || t('signInTracking'))
      const rows = (payload.requests || []) as ServiceRequest[]
      setRequests(rows)
      setSelectedId(current => current && rows.some(row => row.id === current) ? current : rows[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load service requests.')
      setRequests([])
    }

    setLoading(false)
  }, [t])

  useEffect(() => {
    let isMounted = true

    loadRequests().then(() => {
      if (!isMounted) return
    })
    const timer = window.setInterval(() => {
      if (isMounted) loadRequests()
    }, 20000)

    return () => {
      isMounted = false
      window.clearInterval(timer)
    }
  }, [loadRequests])

  const cancelRequest = async (request: ServiceRequest) => {
    if (!canCancel(request.status)) return
    setActionLoading(request.id)
    setError('')
    const supabase = createClient()
    const { error: cancelError } = await supabase
      .from('service_requests')
      .update({ status: 'cancelled', notes: [request.notes, 'Cancelled by customer before dispatch.'].filter(Boolean).join('\n') })
      .eq('id', request.id)
    if (cancelError) setError(cancelError.message)
    else await loadRequests()
    setActionLoading('')
  }

  const selectedRequest = useMemo(
    () => requests.find(request => request.id === selectedId) || requests[0],
    [requests, selectedId]
  )
  const selectedAddress = selectedRequest ? requestAddress(selectedRequest) : ''
  const statusSteps = [
    { key: 'pending', label: t('pending') },
    { key: 'scheduled', label: t('scheduled') },
    { key: 'en_route', label: t('enRoute') },
    { key: 'completed', label: t('completed') },
  ]
  const statusLabel = (status?: string | null) => statusSteps.find(step => step.key === normalizeStatus(status))?.label || titleize(status)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-sky-300">{t('customerPortal')}</p>
        <h1 className="mt-1 text-2xl font-bold text-white">{t('liveTracking')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('trackingSubtitle')}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-6 text-slate-300">
          {t('loadingRequests')}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-8 text-center">
          <h2 className="text-lg font-semibold text-white">{t('noActiveRequests')}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            {t('noActiveRequestsCopy')}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="space-y-4">
            {requests.map(request => {
              const address = requestAddress(request)
              const status = normalizeStatus(request.status)
              const isSelected = request.id === selectedRequest?.id

              return (
                <div
                  key={request.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(request.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedId(request.id)
                    }
                  }}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    isSelected
                      ? 'border-sky-400 bg-sky-500/10'
                      : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-500'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-white">
                        {titleize(request.equipment_type || request.service_type)}
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">{address || t('addressPending')}</p>
                    </div>
                    <span className="inline-flex w-fit rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
                      {statusLabel(status)}
                    </span>
                  </div>

                  <div className="mt-4">
                    <ProgressTracker status={status} steps={statusSteps} />
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                    <div>{t('scheduledLabel')}: <span className="text-slate-200">{requestDate(request, t('datePending'))}</span></div>
                    <div>ETA: <span className="text-sky-200">{etaText(request)}</span></div>
                    {request.driver_route?.truck_number && <div>Truck: <span className="text-slate-200">#{request.driver_route.truck_number}</span></div>}
                    {request.driver_route?.driver_name && <div>Driver: <span className="text-slate-200">{request.driver_route.driver_name}</span></div>}
                    {request.notes && <div>{t('notesLabel')}: <span className="text-slate-200">{request.notes}</span></div>}
                  </div>

                  {canCancel(request.status) && (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={event => { event.stopPropagation(); cancelRequest(request) }}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            event.stopPropagation()
                            cancelRequest(request)
                          }
                        }}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20"
                      >
                        {actionLoading === request.id ? 'Cancelling...' : 'Cancel request'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </section>

          <aside className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-slate-700/50 bg-slate-800/40">
              <div className="border-b border-slate-700/50 px-4 py-3">
                <h2 className="font-semibold text-white">{t('jobsiteMap')}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedRequest?.truck_location ? `Truck last seen ${etaText(selectedRequest)}` : selectedAddress || t('selectAddress')}
                </p>
              </div>
              {selectedAddress ? (
                <iframe
                  title="Assigned jobsite map"
                  src={trackerMapUrl(selectedRequest, selectedAddress)}
                  className="h-80 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="flex h-80 items-center justify-center px-6 text-center text-sm text-slate-400">
                  {t('mapDetailsPending')}
                </div>
              )}
            </div>

            {selectedRequest && (
              <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4">
                <h2 className="font-semibold text-white">{t('selectedRequest')}</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">{t('status')}</dt>
                    <dd className="font-medium text-white">{statusLabel(selectedRequest.status)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">{t('equipment')}</dt>
                    <dd className="font-medium text-white">{titleize(selectedRequest.equipment_type || selectedRequest.service_type)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">{t('date')}</dt>
                    <dd className="font-medium text-white">{requestDate(selectedRequest, t('datePending'))}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">ETA</dt>
                    <dd className="font-medium text-white">{etaText(selectedRequest)}</dd>
                  </div>
                  {selectedRequest.driver_route?.truck_number && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-400">Truck</dt>
                      <dd className="font-medium text-white">#{selectedRequest.driver_route.truck_number}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
