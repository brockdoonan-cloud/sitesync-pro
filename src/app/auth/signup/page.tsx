'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', company_name: '', role: 'customer' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSignup = async () => {
    if (!form.email || !form.password || !form.full_name) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          company_name: form.company_name,
          role: form.role,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card text-center max-w-md w-full">
          <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-slate-400 text-sm">Confirm your account, then sign in to continue.</p>
          <Link href="/auth/login" className="btn-primary w-full mt-6 block py-2.5">Back to Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <path d="M4 20L10 8L16 16L20 10L24 20H4Z" fill="white" />
              </svg>
            </div>
            <span className="font-bold text-lg text-white">SiteSync Pro</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-slate-400 mt-1">Manage jobsite equipment from one place</p>
        </div>
        <div className="card space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name *</label>
            <input type="text" className="input" placeholder="John Smith" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Company</label>
            <input type="text" className="input" placeholder="Company name" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password *</label>
            <input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <button onClick={handleSignup} disabled={loading} className="btn-primary w-full py-3">{loading ? 'Creating...' : 'Create Account'}</button>
          <p className="text-center text-slate-400 text-sm">Already have an account? <Link href="/auth/login" className="text-sky-400 hover:text-sky-300 font-medium">Sign in</Link></p>
        </div>
      </div>
    </div>
  )
}
