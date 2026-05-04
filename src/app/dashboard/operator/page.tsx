import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function OperatorDashboard() {
  const supabase = await createClient()
  const [jobs, deployed, available, leads, clients] = await Promise.all([
    supabase.from('jobs').select('id', { count: 'exact', head: true }),
    supabase.from('equipment').select('id', { count: 'exact', head: true }).eq('status', 'deployed'),
    supabase.from('equipment').select('id', { count: 'exact', head: true }).eq('status', 'available'),
    supabase.from('quote_requests').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('clients').select('id', { count: 'exact', head: true }),
  ])
  const stats = {
    jobs: jobs.count || 0,
    deployed: deployed.count || 0,
    available: available.count || 0,
    leads: leads.count || 0,
    clients: clients.count || 0,
  }

  const navCards = [
    { href: '/dashboard/operator/onboarding', label: 'Setup Real Data', desc: 'Onboard clients, jobsites, bins, and balances', highlight: true },
    { href: '/dashboard/operator/import', label: 'Bulk Import', desc: 'Drag in Excel reports for mass onboarding', highlight: true },
    { href: '/dashboard/operator/jobs', label: 'Jobs', desc: 'Active service jobs' },
    { href: '/dashboard/operator/leads', label: 'Quote Leads', desc: 'New quote requests', highlight: stats.leads > 0 },
    { href: '/dashboard/operator/equipment', label: 'Equipment', desc: 'Bins and containers' },
    { href: '/dashboard/operator/pricing', label: 'Pricing', desc: 'Rates, mileage, and invoice breakdowns' },
    { href: '/dashboard/operator/map', label: 'Equipment Map', desc: 'Swap status by jobsite' },
    { href: '/dashboard/operator/clients', label: 'Clients', desc: 'Client accounts' },
    { href: '/dashboard/operator/requests', label: 'Requests', desc: 'Service requests' },
    { href: '/dashboard/operator/routes', label: 'Routes', desc: 'Driver routes' },
    { href: '/dashboard/operator/billing', label: 'Billing', desc: 'Invoices and payments' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Operator Dashboard</h1>
        <p className="text-slate-400 mt-1">Operations overview</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Jobs', value: String(stats.jobs), color: 'text-white' },
          { label: 'New Leads', value: String(stats.leads), color: stats.leads > 0 ? 'text-sky-400' : 'text-white' },
          { label: 'Bins Deployed', value: String(stats.deployed), color: 'text-green-400' },
          { label: 'Bins Available', value: String(stats.available), color: 'text-slate-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {navCards.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className={`block bg-slate-800/40 border rounded-xl p-4 hover:border-sky-500/40 hover:bg-sky-500/5 transition-all group ${card.highlight ? 'border-sky-500/40 bg-sky-500/5' : 'border-slate-700/50'}`}
          >
            <div className="font-semibold text-white group-hover:text-sky-300 transition-colors">{card.label}</div>
            <div className="text-slate-500 text-xs mt-1">{card.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
