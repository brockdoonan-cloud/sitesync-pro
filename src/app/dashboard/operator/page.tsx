'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function OperatorDashboard() {
  const [stats, setStats] = useState({ jobs: 0, deployed: 0, available: 0, leads: 0, clients: 0 })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [jobs, equipment, leads, clients] = await Promise.all([
        supabase.from('jobs').select('id', { count: 'exact', head: true }),
        supabase.from('equipment').select('id, status'),
        supabase.from('quote_requests').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
      ])
      const eq = equipment.data || []
      setStats({
        jobs: jobs.count || 0,
        deployed: eq.filter(e => e.status === 'deployed').length,
        available: eq.filter(e => e.status === 'available').length,
        leads: leads.count || 0,
        clients: clients.count || 0,
      })
      setLoading(false)
    }
    load()
  }, [supabase])

  const navCards = [
    { href: '/dashboard/operator/jobs', icon: '📋', label: 'Jobs', desc: 'Active service jobs' },
    { href: '/dashboard/operator/leads', icon: '📬', label: 'Quote Leads', desc: 'New quote requests', highlight: stats.leads > 0 },
    { href: '/dashboard/operator/equipment', icon: '🗑️', label: 'Equipment', desc: 'Bins and containers' },
    { href: '/dashboard/operator/map', icon: '🗺️', label: 'Live Map', desc: 'Jobsite locations' },
    { href: '/dashboard/operator/clients', icon: '👥', label: 'Clients', desc: 'Client accounts' },
    { href: '/dashboard/operator/requests', icon: '🔧', label: 'Requests', desc: 'Service requests' },
    { href: '/dashboard/operator/routes', icon: '🚛', label: 'Routes', desc: 'Driver routes' },
    { href: '/dashboard/operator/billing', icon: '💳', label: 'Billing', desc: 'Invoices and payments' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Operator Dashboard</h1>
        <p className="text-slate-400 mt-1">Operations overview</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Jobs', value: loading ? '-' : String(stats.jobs), color: 'text-white' },
          { label: 'New Leads', value: loading ? '-' : String(stats.leads), color: stats.leads > 0 ? 'text-sky-400' : 'text-white' },
          { label: 'Bins Deployed', value: loading ? '-' : String(stats.deployed), color: 'text-green-400' },
          { label: 'Bins Available', value: loading ? '-' : String(stats.available), color: 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className={'text-2xl font-bold ' + s.color}>{s.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {navCards.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className={'block bg-slate-800/40 border rounded-xl p-4 hover:border-sky-500/40 hover:bg-sky-500/5 transition-all group ' + (card.highlight ? 'border-sky-500/40 bg-sky-500/5' : 'border-slate-700/50')}
          >
            <div className="text-3xl mb-3">{card.icon}</div>
            <div className="font-semibold text-white group-hover:text-sky-300 transition-colors">{card.label}</div>
            <div className="text-slate-500 text-xs mt-1">{card.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
