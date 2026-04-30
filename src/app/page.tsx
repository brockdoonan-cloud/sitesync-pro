'use client'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900/20" />
      <div className="relative z-10 text-center max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/30">
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
              <path d="M4 20L10 8L16 16L20 10L24 20H4Z" fill="white"/>
            </svg>
          </div>
          <span className="text-2xl font-bold text-white">SiteSync Pro</span>
        </div>
        <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
          Equipment Service,{' '}
          <span className="text-sky-400">Streamlined</span>
        </h1>
        <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
          Real-time scheduling and live tracking for jobsite equipment rentals. Dumpsters, washout containers, and more.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/quotes" className="btn-primary px-8 py-3 text-base font-semibold rounded-xl shadow-lg shadow-sky-500/20">
            Get Free Quotes
          </Link>
          <Link href="/auth/login" className="btn-secondary px-8 py-3 text-base font-semibold rounded-xl">
            Sign In
          </Link>
        </div>
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          {[
            { title: 'Lead Generator', desc: 'Customers request equipment quotes. You get notified instantly.' },
            { title: 'Live Tracking', desc: 'Customers track their delivery status from scheduled to on-site.' },
            { title: 'Operator Dashboard', desc: 'Manage your fleet, leads, routes, and billing in one place.' },
          ].map(f => (
            <div key={f.title} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-slate-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
