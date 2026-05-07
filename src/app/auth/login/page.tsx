'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, CheckCircle2, HardHat } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

type PortalType = 'operator' | 'customer'

export default function LoginPage() {
  const { t } = useLanguage()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const [portal, setPortal] = useState<PortalType>('operator')
  const router = useRouter(); const supabase = createClient()
  const handleLogin = async () => {
    if (!email || !password) { setError(t('allFieldsRequired')); return }
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }

    const { data: memberships } = data.user
      ? await supabase.from('organization_members').select('role').eq('user_id', data.user.id)
      : { data: null }
    const roles = new Set((memberships || []).map((membership: any) => membership.role))
    const isSuperAdmin = roles.has('super_admin')
    const isOperator = ['super_admin', 'operator_admin', 'operator_member'].some(role => roles.has(role))
    const isCustomer = roles.has('client')

    if (isSuperAdmin) router.push('/dashboard/admin')
    else if (portal === 'customer' && isCustomer && !isOperator) router.push('/dashboard/customer')
    else if (isOperator) router.push('/dashboard/operator')
    else router.push('/dashboard')
    router.refresh()
  }

  const portalOptions = [
    {
      id: 'operator' as const,
      label: t('operatorPortal'),
      description: t('operatorPortalDesc'),
      icon: HardHat,
      helper: t('operatorLoginHelper'),
    },
    {
      id: 'customer' as const,
      label: t('customerPortal'),
      description: t('customerPortalDesc'),
      icon: Building2,
      helper: t('customerLoginHelper'),
    },
  ]

  const selectedPortal = portalOptions.find(option => option.id === portal) || portalOptions[0]

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 28 28" fill="none"><path d="M4 20L10 8L16 16L20 10L24 20H4Z" fill="white"/></svg></div>
            <span className="font-bold text-lg text-white">SiteSync Pro</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">{t('welcomeBack')}</h1>
          <p className="text-slate-400 mt-1">{t('choosePortalSubtitle')}</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-4 items-start">
          <div className="space-y-3">
            {portalOptions.map(option => {
              const Icon = option.icon
              const active = portal === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPortal(option.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${active ? 'bg-sky-500/10 border-sky-400/50 shadow-lg shadow-sky-950/20' : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/70'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-sky-500 text-white' : 'bg-slate-700/60 text-slate-300'}`}>
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-white">{option.label}</span>
                        {active && <CheckCircle2 size={18} className="text-sky-300 shrink-0" />}
                      </div>
                      <p className="text-sm text-slate-400 mt-1">{option.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="card space-y-4">
            <div>
              <div className="text-sm text-sky-300 font-semibold">{selectedPortal.label}</div>
              <p className="text-slate-400 text-sm mt-1">{selectedPortal.helper}</p>
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">{t('email')}</label><input type="email" className="input" placeholder={portal === 'customer' ? 'customer@company.com' : 'you@company.com'} value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}/></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">{t('password')}</label><input type="password" className="input" placeholder="" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}/></div>
            <button onClick={handleLogin} disabled={loading} className="btn-primary w-full py-3">{loading ? t('signingIn') : `${t('signIn')} - ${selectedPortal.label}`}</button>
            {portal === 'customer' && <p className="text-slate-500 text-xs text-center">{t('customerAccessNote')}</p>}
            <p className="text-center text-slate-400 text-sm">{t('noAccount')} {' '}<Link href="/auth/signup" className="text-sky-400 hover:text-sky-300 font-medium">{t('signUp')}</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}
