'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isOperatorUser } from '@/lib/operator'
import { useLanguage } from '@/lib/i18n'

type NavLink = { href: string; label: string }

export default function NavBar({ user, profile }: { user: any; profile: any }) {
  const { t } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()
  const isOp = isOperatorUser(profile, user?.email)
  const isSuperAdmin = Boolean(profile?.is_super_admin)
  const showingCustomerPortal = pathname.startsWith('/dashboard/customer')

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const opPrimaryLinks: NavLink[] = [
    { href: '/dashboard/operator', label: t('homeShort') },
    { href: '/dashboard/operator/leads', label: t('leadsShort') },
    { href: '/dashboard/operator/requests', label: t('requestsShort') },
    { href: '/dashboard/operator/jobs', label: t('jobsShort') },
    { href: '/dashboard/operator/routes', label: t('routesShort') },
    { href: '/dashboard/operator/map', label: t('mapShort') },
    { href: '/dashboard/operator/equipment', label: t('equipmentShort') },
    { href: '/dashboard/operator/trucks', label: t('trucksShort') },
    { href: '/dashboard/operator/clients', label: t('clientsShort') },
    { href: '/dashboard/operator/billing', label: t('billingShort') },
  ]
  const opMoreLinks: NavLink[] = [
    ...(isSuperAdmin ? [{ href: '/dashboard/admin', label: 'Admin' }] : []),
    { href: '/dashboard/driver', label: 'Driver' },
    { href: '/dashboard/operator/onboarding', label: t('setup') },
    { href: '/dashboard/operator/import', label: t('import') },
    { href: '/dashboard/operator/coverage', label: t('coverage') },
    { href: '/dashboard/operator/pricing', label: t('pricing') },
  ]
  const custLinks = [
    { href: '/dashboard/customer', label: t('overview') },
    { href: '/dashboard/customer/bins', label: t('equipment') },
    { href: '/dashboard/customer/request', label: t('requestService') },
    { href: '/dashboard/customer/tracking', label: t('track') },
    { href: '/dashboard/customer/billing', label: t('billing') },
  ]
  const links = showingCustomerPortal ? custLinks : isOp ? opPrimaryLinks : custLinks
  const moreLinks = !showingCustomerPortal && isOp ? opMoreLinks : []
  const homeHref = showingCustomerPortal ? '/dashboard/customer' : '/dashboard'
  const portalLabel = showingCustomerPortal ? t('customerPortal') : profile?.company_name || (isOp ? 'Operations' : t('customerPortal'))
  const isActive = (href: string) => pathname === href || (href !== '/dashboard/operator' && href !== '/dashboard/customer' && pathname.startsWith(`${href}/`))
  const linkClass = (href: string, extra = '') => `px-2 py-1.5 rounded-lg text-[11px] whitespace-nowrap transition-colors ${extra} ${
    isActive(href)
      ? 'bg-slate-700 text-white font-medium'
      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
  }`
  const moreActive = moreLinks.some(link => isActive(link.href))

  return (
    <nav className="border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl flex items-center justify-between h-14">
        <div className="flex items-center gap-2 min-w-0">
          <Link href={homeHref} className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 bg-sky-500 rounded-md flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 28 28" fill="none"><path d="M4 20L10 8L16 16L20 10L24 20H4Z" fill="white" /></svg>
            </div>
            <span className="font-bold text-white text-sm hidden sm:block">SiteSync Pro</span>
            <span className="hidden 2xl:inline-flex text-[11px] text-slate-400 border border-slate-700/60 rounded-md px-2 py-0.5">{portalLabel}</span>
          </Link>
          <div className="hidden lg:flex items-center gap-0.5">
            {links.map(link => (
              <Link
                href={link.href}
                key={link.href}
                className={linkClass(link.href)}
              >
                {link.label}
              </Link>
            ))}
            {moreLinks.length > 0 && (
              <div className="group relative">
                <button
                  type="button"
                  className={`px-2 py-1.5 rounded-lg text-[11px] whitespace-nowrap transition-colors ${
                    moreActive
                      ? 'bg-slate-700 text-white font-medium'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {t('more')}
                </button>
                <div className="invisible absolute left-0 top-full z-50 mt-2 min-w-36 rounded-xl border border-slate-700/70 bg-slate-900 p-1.5 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  {moreLinks.map(link => (
                    <Link
                      href={link.href}
                      key={link.href}
                      className={linkClass(link.href, 'block w-full')}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-medium text-white">{profile?.full_name ?? user.email}</div>
            <div className="text-xs text-slate-500 capitalize">{portalLabel}</div>
          </div>
          <button onClick={handleSignOut} className="text-slate-400 hover:text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-slate-700/50 transition-colors border border-slate-700/50">{t('signOut')}</button>
        </div>
      </div>
      <div className="container mx-auto px-4 max-w-7xl pb-2 lg:hidden">
        <div className="flex flex-wrap gap-1">
          {[...links, ...moreLinks].map(link => (
            <Link
              href={link.href}
              key={link.href}
              className={linkClass(link.href, 'shrink-0')}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
