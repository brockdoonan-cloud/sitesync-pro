'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
export default function LoginPage() {
  const { t } = useLanguage()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const router = useRouter(); const supabase = createClient()
  const handleLogin = async () => {
    if (!email || !password) { setError(t('allFieldsRequired')); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) } else { router.push('/dashboard'); router.refresh() }
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 28 28" fill="none"><path d="M4 20L10 8L16 16L20 10L24 20H4Z" fill="white"/></svg></div>
            <span className="font-bold text-lg text-white">SiteSync Pro</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">{t('welcomeBack')}</h1>
          <p className="text-slate-400 mt-1">{t('signInSubtitle')}</p>
        </div>
        <div className="card space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">{t('email')}</label><input type="email" className="input" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}/></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">{t('password')}</label><input type="password" className="input" placeholder="" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}/></div>
          <button onClick={handleLogin} disabled={loading} className="btn-primary w-full py-3">{loading ? t('signingIn') : t('signIn')}</button>
          <p className="text-center text-slate-400 text-sm">{t('noAccount')} {' '}<Link href="/auth/signup" className="text-sky-400 hover:text-sky-300 font-medium">{t('signUp')}</Link></p>
        </div>
      </div>
    </div>
  )
}
