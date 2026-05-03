'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ClientRow = { id: string; company_name?: string | null; name?: string | null; email?: string | null }
type JobsiteRow = { id: string; address?: string | null; status?: string | null }

const emptyClient = { company_name: '', contact_name: '', email: '', phone: '', status: 'active' }
const emptyJobsite = { name: '', address: '', lat: '', lng: '', client_id: '', status: 'active' }
const emptyEquipment = { bin_number: '', type: 'other', status: 'available', location: '', client_id: '', jobsite_id: '' }
const emptyRequest = { address: '', city: '', zip: '', equipment_type: '', scheduled_date: '', notes: '', status: 'confirmed' }
const emptyInvoice = { invoice_number: '', client_id: '', total: '', status: 'open' }
const emptyTruck = { truck_number: '', driver_name: '', capacity: '6', status: 'available' }
const emptyPricing = { name: '', included_miles: '30', one_bin_service: '395', extra_mile_rate: '4.5', fuel_surcharge_percent: '14', environmental_fee: '25' }

function todayId(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`
}

export default function OperatorOnboardingPage() {
  const supabase = useMemo(() => createClient(), [])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [jobsites, setJobsites] = useState<JobsiteRow[]>([])
  const [client, setClient] = useState(emptyClient)
  const [jobsite, setJobsite] = useState(emptyJobsite)
  const [equipment, setEquipment] = useState(emptyEquipment)
  const [request, setRequest] = useState(emptyRequest)
  const [invoice, setInvoice] = useState(emptyInvoice)
  const [truck, setTruck] = useState(emptyTruck)
  const [pricing, setPricing] = useState(emptyPricing)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const refreshLookups = useCallback(async () => {
    const [{ data: clientRows }, { data: jobsiteRows }] = await Promise.all([
      supabase.from('clients').select('id,company_name,name,email').order('created_at', { ascending: false }),
      supabase.from('jobsites').select('id,address,status'),
    ])
    setClients((clientRows || []) as ClientRow[])
    setJobsites((jobsiteRows || []) as JobsiteRow[])
  }, [supabase])

  useEffect(() => { refreshLookups() }, [refreshLookups])

  const run = async (label: string, action: () => Promise<void>) => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await action()
      await refreshLookups()
      setMessage(`${label} saved.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save ${label.toLowerCase()}.`)
    } finally {
      setLoading(false)
    }
  }

  const saveClient = () => run('Client', async () => {
    if (!client.company_name && !client.email) throw new Error('Add a company name or email.')
    const { error: err } = await supabase.from('clients').insert(client)
    if (err) throw err
    setClient(emptyClient)
  })

  const saveJobsite = () => run('Jobsite', async () => {
    if (!jobsite.address) throw new Error('Add the jobsite address.')
    const payload = {
      name: jobsite.name || jobsite.address,
      address: jobsite.address,
      city: 'Orlando',
      state: 'FL',
      lat: jobsite.lat ? Number(jobsite.lat) : null,
      lng: jobsite.lng ? Number(jobsite.lng) : null,
      client_id: jobsite.client_id || null,
      status: jobsite.status,
    }
    const { error: err } = await supabase.from('jobsites').insert(payload)
    if (err) throw err
    setJobsite(emptyJobsite)
  })

  const saveEquipment = () => run('Equipment', async () => {
    if (!equipment.bin_number) throw new Error('Add a bin or unit number.')
    const payload = {
      bin_number: equipment.bin_number,
      container_number: equipment.bin_number,
      type: equipment.type,
      status: equipment.status,
      location: equipment.location || null,
      current_client_id: equipment.client_id || null,
      client_id: equipment.client_id || null,
      current_jobsite_id: equipment.jobsite_id || null,
      jobsite_id: equipment.jobsite_id || null,
      last_serviced_at: new Date().toISOString(),
      last_service_date: new Date().toISOString().slice(0, 10),
    }
    const { error: err } = await supabase.from('equipment').insert(payload)
    if (err) throw err
    setEquipment(emptyEquipment)
  })

  const saveRequest = () => run('Service request', async () => {
    if (!request.address || !request.equipment_type) throw new Error('Add an address and equipment type.')
    const payload = {
      status: request.status,
      service_type: request.equipment_type,
      jobsite_address: [request.address, request.city, request.zip].filter(Boolean).join(', '),
      service_address: [request.address, request.city, request.zip].filter(Boolean).join(', '),
      preferred_date: request.scheduled_date || null,
      notes: request.notes || null,
    }
    const { error: err } = await supabase.from('service_requests').insert(payload)
    if (err) throw err
    setRequest(emptyRequest)
  })

  const saveInvoice = () => run('Invoice', async () => {
    if (!invoice.total) throw new Error('Add an invoice total.')
    const payload = {
      invoice_number: invoice.invoice_number || todayId('INV'),
      client_id: invoice.client_id || null,
      total: Number(invoice.total),
      status: invoice.status,
    }
    const { error } = await supabase.from('invoices').insert(payload)
    if (!error) {
      setInvoice(emptyInvoice)
      return
    }

    const fallbackPayload = {
      invoice_number: payload.invoice_number,
      client_id: payload.client_id,
      amount: payload.total,
      status: payload.status,
    }
    const { error: fallbackError } = await supabase.from('invoices').insert(fallbackPayload)
    if (fallbackError) throw fallbackError
    setInvoice(emptyInvoice)
  })

  const saveTruck = () => run('Truck', async () => {
    if (!truck.truck_number) throw new Error('Add a truck number.')
    const { error } = await supabase.from('trucks').insert({
      truck_number: truck.truck_number,
      driver_name: truck.driver_name || null,
      capacity: Number(truck.capacity || 6),
      status: truck.status,
      last_seen: new Date().toISOString(),
    })
    if (error) throw error
    setTruck(emptyTruck)
  })

  const savePricing = () => run('Pricing profile', async () => {
    if (!pricing.name) throw new Error('Add a pricing profile name.')
    const { error } = await supabase.from('pricing_profiles').insert({
      name: pricing.name,
      yard_address: '255 S Orange Ave, Orlando, FL 32801',
      included_miles: Number(pricing.included_miles),
      one_bin_service: Number(pricing.one_bin_service),
      extra_mile_rate: Number(pricing.extra_mile_rate),
      fuel_surcharge_percent: Number(pricing.fuel_surcharge_percent),
      environmental_fee: Number(pricing.environmental_fee),
      active: true,
    })
    if (error) throw error
    setPricing(emptyPricing)
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Operations Onboarding</h1>
        <p className="text-slate-400 mt-1">Load real clients, jobsites, bins, active service work, and starting balances.</p>
      </div>

      {(message || error) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="card space-y-4">
          <div><h2 className="font-semibold text-white">1. Client Account</h2><p className="text-xs text-slate-500 mt-1">Creates the customer account used by jobsites, balances, and work history.</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="input" placeholder="Company name" value={client.company_name} onChange={e => setClient(v => ({ ...v, company_name: e.target.value }))} />
            <input className="input" placeholder="Contact name" value={client.contact_name} onChange={e => setClient(v => ({ ...v, contact_name: e.target.value }))} />
            <input className="input" placeholder="Email" value={client.email} onChange={e => setClient(v => ({ ...v, email: e.target.value }))} />
            <input className="input" placeholder="Phone" value={client.phone} onChange={e => setClient(v => ({ ...v, phone: e.target.value }))} />
          </div>
          <button disabled={loading} onClick={saveClient} className="btn-primary px-4 py-2">Save Client</button>
        </section>

        <section className="card space-y-4">
          <div><h2 className="font-semibold text-white">2. Active Jobsite</h2><p className="text-xs text-slate-500 mt-1">Adds the site address and optional map coordinates for live map pins.</p></div>
          <select className="input" value={jobsite.client_id} onChange={e => setJobsite(v => ({ ...v, client_id: e.target.value }))}>
            <option value="">No client selected</option>
            {clients.map(row => <option key={row.id} value={row.id}>{row.company_name || row.name || row.email || row.id}</option>)}
          </select>
          <input className="input" placeholder="Project / jobsite name" value={jobsite.name} onChange={e => setJobsite(v => ({ ...v, name: e.target.value }))} />
          <input className="input" placeholder="Exact jobsite address" value={jobsite.address} onChange={e => setJobsite(v => ({ ...v, address: e.target.value }))} />
          <div className="grid grid-cols-3 gap-3">
            <input className="input" placeholder="Latitude" value={jobsite.lat} onChange={e => setJobsite(v => ({ ...v, lat: e.target.value }))} />
            <input className="input" placeholder="Longitude" value={jobsite.lng} onChange={e => setJobsite(v => ({ ...v, lng: e.target.value }))} />
            <select className="input" value={jobsite.status} onChange={e => setJobsite(v => ({ ...v, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="complete">Complete</option>
            </select>
          </div>
          <button disabled={loading} onClick={saveJobsite} className="btn-primary px-4 py-2">Save Jobsite</button>
        </section>

        <section className="card space-y-4">
          <div><h2 className="font-semibold text-white">3. Bin / Equipment</h2><p className="text-xs text-slate-500 mt-1">Registers bin numbers and links deployed equipment to active sites.</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="input" placeholder="Bin number" value={equipment.bin_number} onChange={e => setEquipment(v => ({ ...v, bin_number: e.target.value }))} />
            <select className="input" value={equipment.type} onChange={e => setEquipment(v => ({ ...v, type: e.target.value }))}>
              <option value="other">Other</option>
              <option value="washout">Washout</option>
              <option value="slurry">Slurry</option>
              <option value="porta_potty">Porta potty</option>
              <option value="dumpster">Dumpster</option>
              <option value="tank">Tank</option>
            </select>
            <select className="input" value={equipment.status} onChange={e => setEquipment(v => ({ ...v, status: e.target.value }))}>
              <option value="available">Available</option>
              <option value="deployed">Deployed</option>
              <option value="full">Full</option>
              <option value="needs_swap">Needs swap</option>
              <option value="maintenance">Maintenance</option>
            </select>
            <select className="input" value={equipment.client_id} onChange={e => setEquipment(v => ({ ...v, client_id: e.target.value }))}>
              <option value="">No client selected</option>
              {clients.map(row => <option key={row.id} value={row.id}>{row.company_name || row.name || row.email || row.id}</option>)}
            </select>
            <select className="input" value={equipment.jobsite_id} onChange={e => setEquipment(v => ({ ...v, jobsite_id: e.target.value }))}>
              <option value="">No jobsite selected</option>
              {jobsites.map(row => <option key={row.id} value={row.id}>{row.address || row.id}</option>)}
            </select>
          </div>
          <input className="input" placeholder="Location note, e.g. north gate or staging area" value={equipment.location} onChange={e => setEquipment(v => ({ ...v, location: e.target.value }))} />
          <button disabled={loading} onClick={saveEquipment} className="btn-primary px-4 py-2">Save Equipment</button>
        </section>

        <section className="card space-y-4">
          <div><h2 className="font-semibold text-white">4. Active Service / Tracking</h2><p className="text-xs text-slate-500 mt-1">Creates a trackable active service request for customer and operator views.</p></div>
          <input className="input" placeholder="Service address" value={request.address} onChange={e => setRequest(v => ({ ...v, address: e.target.value }))} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input className="input" placeholder="City" value={request.city} onChange={e => setRequest(v => ({ ...v, city: e.target.value }))} />
            <input className="input" placeholder="ZIP" value={request.zip} onChange={e => setRequest(v => ({ ...v, zip: e.target.value }))} />
            <input className="input" placeholder="Equipment type" value={request.equipment_type} onChange={e => setRequest(v => ({ ...v, equipment_type: e.target.value }))} />
            <input className="input" type="date" value={request.scheduled_date} onChange={e => setRequest(v => ({ ...v, scheduled_date: e.target.value }))} />
          </div>
          <select className="input" value={request.status} onChange={e => setRequest(v => ({ ...v, status: e.target.value }))}>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
          <textarea className="input min-h-[80px]" placeholder="Tracking notes" value={request.notes} onChange={e => setRequest(v => ({ ...v, notes: e.target.value }))} />
          <button disabled={loading} onClick={saveRequest} className="btn-primary px-4 py-2">Save Service Request</button>
        </section>

        <section className="card space-y-4 xl:col-span-2">
          <div><h2 className="font-semibold text-white">5. Starting Balance / Invoice</h2><p className="text-xs text-slate-500 mt-1">Adds starting balances so billing can show active totals immediately.</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select className="input" value={invoice.client_id} onChange={e => setInvoice(v => ({ ...v, client_id: e.target.value }))}>
              <option value="">No client selected</option>
              {clients.map(row => <option key={row.id} value={row.id}>{row.company_name || row.name || row.email || row.id}</option>)}
            </select>
            <input className="input" placeholder="Invoice #" value={invoice.invoice_number} onChange={e => setInvoice(v => ({ ...v, invoice_number: e.target.value }))} />
            <input className="input" type="number" min="0" step="0.01" placeholder="Balance" value={invoice.total} onChange={e => setInvoice(v => ({ ...v, total: e.target.value }))} />
            <select className="input" value={invoice.status} onChange={e => setInvoice(v => ({ ...v, status: e.target.value }))}>
              <option value="open">Open</option>
              <option value="draft">Draft</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <button disabled={loading} onClick={saveInvoice} className="btn-primary px-4 py-2">Save Balance</button>
        </section>

        <section className="card space-y-4">
          <div><h2 className="font-semibold text-white">6. Pricing Profile</h2><p className="text-xs text-slate-500 mt-1">Stores the customer rate card for mileage, fuel, environmental fees, and invoice breakdowns.</p></div>
          <input className="input" placeholder="Pricing profile name" value={pricing.name} onChange={e => setPricing(v => ({ ...v, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Included miles" value={pricing.included_miles} onChange={e => setPricing(v => ({ ...v, included_miles: e.target.value }))} />
            <input className="input" placeholder="Extra mile rate" value={pricing.extra_mile_rate} onChange={e => setPricing(v => ({ ...v, extra_mile_rate: e.target.value }))} />
            <input className="input" placeholder="One-bin service" value={pricing.one_bin_service} onChange={e => setPricing(v => ({ ...v, one_bin_service: e.target.value }))} />
            <input className="input" placeholder="Fuel %" value={pricing.fuel_surcharge_percent} onChange={e => setPricing(v => ({ ...v, fuel_surcharge_percent: e.target.value }))} />
            <input className="input" placeholder="Environmental fee" value={pricing.environmental_fee} onChange={e => setPricing(v => ({ ...v, environmental_fee: e.target.value }))} />
          </div>
          <button disabled={loading} onClick={savePricing} className="btn-primary px-4 py-2">Save Pricing</button>
        </section>

        <section className="card space-y-4">
          <div><h2 className="font-semibold text-white">7. Truck / Driver</h2><p className="text-xs text-slate-500 mt-1">Adds fleet capacity so dispatch can assign routes to real trucks.</p></div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Truck number" value={truck.truck_number} onChange={e => setTruck(v => ({ ...v, truck_number: e.target.value }))} />
            <input className="input" placeholder="Driver name" value={truck.driver_name} onChange={e => setTruck(v => ({ ...v, driver_name: e.target.value }))} />
            <input className="input" placeholder="Swap capacity" value={truck.capacity} onChange={e => setTruck(v => ({ ...v, capacity: e.target.value }))} />
            <select className="input" value={truck.status} onChange={e => setTruck(v => ({ ...v, status: e.target.value }))}>
              <option value="available">Available</option>
              <option value="en_route">En route</option>
              <option value="servicing">Servicing</option>
              <option value="offline">Offline</option>
            </select>
          </div>
          <button disabled={loading} onClick={saveTruck} className="btn-primary px-4 py-2">Save Truck</button>
        </section>
      </div>
    </div>
  )
}
