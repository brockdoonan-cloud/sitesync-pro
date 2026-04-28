'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NavBar({ user, profile }: { user: any; profile: any }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/'); router.refresh() }
  const isOp = profile?.role === 'operator' || profile?.role === 'admin'

  const opLinks = [
    { href: '/dashboard/operator', label: 'Overview' },
    { href: '/dashboard/operator/routes', label: '🗺️ Routes' },
    { href: '/dashboard/operator/dispatch', label: '🚛 Dispatch' },
    { href: '/dashboard/operator/requests', label: 'Requests' },
    { href: '/dashboard/operator/tracker', label: '🗑 Tracker' },
    { href: '/dashboard/operator/billing', label: '💰 Billing' },
    { href: '/dashboard/operator/clients', label: 'Clients' },
    { href: '/dashboard/operator/equipment', label: 'Equipment' },
    { href: '/dashboard/operator/trucks', label: 'Trucks' },
    { href: '/dashboard/operator/onboarding', label: '+ Onboard' },
  ]
  const custLinks = [
    { href: '/dashboard/customer', label: 'Overview' },
    { href: '/dashboard/customer/bins', label: '📦 My Bins' },
    { href: '/dashboard/customer/request', label: 'Request Service' },
    { href: '/dashboard/customer/tracking', label: 'Track' },
  ]
  const links = isOp ? opLinks : custLinks

  return (
    <nav className="border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl flex items-center justify-between h-14">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 bg-sky-500 rounded-md flex items-center justify-center"><svg width="16" height="16" viewBox="0 0 28 28" fill="none"><path d="M4 20L10 8L16 16L20 10L24 20H4Z" fill="white"/></svg></div>
            <span className="font-bold text-white text-sm hidden sm:block">SiteSync Pro</span>
          </Link>
          <div className="hidden md:flex items-center gap-0.5 overflow-x-auto">
            {links.map(l => (
              <Link href={l.href} key={l.href} className={`px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${pathname===l.href?'bg-slate-700 text-white font-medium':l.label.includes('Onboard')?'text-sky-400 hover:bg-sky-500/10':l.label.includes('Dispatch')?'text-orange-400 hover:text-orange-300 hover:bg-orange-500/10':l.label.includes('Billing')?'text-green-400 hover:text-green-300 hover:bg-green-500/10':'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>{l.label}</Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block"><div className="text-xs font-medium text-white">{profile?.full_name??user.email}</div><div className="text-xs text-slate-500 capitalize">{profile?.company_name||profile?.role}</div></div>
          <button onClick={handleSignOut} className="text-slate-400 hover:text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-slate-700/50 transition-colors border border-slate-700/50">Sign Out</button>
        </div>
      </div>
    </nav>
  )
}
