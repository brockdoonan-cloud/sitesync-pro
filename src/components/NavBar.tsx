'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isOperatorUser } from '@/lib/operator'

export default function NavBar({ user, profile }: { user: any; profile: any }) {
  const router = useRouter()
  const pathname = usePathname()
  const isOp = isOperatorUser(profile, user?.email)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const opLinks = [
    { href: '/dashboard/operator', label: 'Overview' },
    { href: '/dashboard/operator/onboarding', label: 'Setup' },
    { href: '/dashboard/operator/leads', label: 'Leads' },
    { href: '/dashboard/operator/requests', label: 'Requests' },
    { href: '/dashboard/operator/jobs', label: 'Jobs' },
    { href: '/dashboard/operator/routes', label: 'Routes' },
    { href: '/dashboard/operator/map', label: 'Map' },
    { href: '/dashboard/operator/equipment', label: 'Equipment' },
    { href: '/dashboard/operator/trucks', label: 'Trucks' },
    { href: '/dashboard/operator/clients', label: 'Clients' },
    { href: '/dashboard/operator/billing', label: 'Billing' },
  ]
  const custLinks = [
    { href: '/dashboard/customer', label: 'Overview' },
    { href: '/dashboard/customer/request', label: 'Request Service' },
    { href: '/dashboard/customer/tracking', label: 'Track' },
  ]
  const links = isOp ? opLinks : custLinks

  return (
    <nav className="border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl flex items-center justify-between h-14">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 bg-sky-500 rounded-md flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 28 28" fill="none"><path d="M4 20L10 8L16 16L20 10L24 20H4Z" fill="white" /></svg>
            </div>
            <span className="font-bold text-white text-sm hidden sm:block">SiteSync Pro</span>
          </Link>
          <div className="hidden lg:flex items-center gap-0.5 overflow-x-auto">
            {links.map(link => (
              <Link
                href={link.href}
                key={link.href}
                className={`px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
                  pathname === link.href
                    ? 'bg-slate-700 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-medium text-white">{profile?.full_name ?? user.email}</div>
            <div className="text-xs text-slate-500 capitalize">{profile?.company_name || profile?.role}</div>
          </div>
          <button onClick={handleSignOut} className="text-slate-400 hover:text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-slate-700/50 transition-colors border border-slate-700/50">Sign Out</button>
        </div>
      </div>
      <div className="container mx-auto px-4 max-w-7xl pb-2 lg:hidden">
        <div className="flex gap-1 overflow-x-auto">
          {links.map(link => (
            <Link
              href={link.href}
              key={link.href}
              className={`shrink-0 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-colors ${
                pathname === link.href
                  ? 'bg-slate-700 text-white font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
