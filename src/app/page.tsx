import Link from 'next/link'
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900/20" />
      <div className="relative z-10 text-center max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 20L10 8L16 16L20 10L24 20H4Z" fill="white"/></svg>
          </div>
          <span className="text-3xl font-bold tracking-tight">SiteSync Pro</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
          Equipment Service, <span className="text-sky-400">Streamlined</span>
        </h1>
        <p className="text-xl text-slate-400 mb-10 leading-relaxed">
          Real-time scheduling, live bin tracking, and AI-powered route optimization for jobsite equipment rentals.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/signup" className="btn-primary text-lg px-8 py-3 rounded-xl">Get Started Free</Link>
          <Link href="/auth/login" className="btn-secondary text-lg px-8 py-3 rounded-xl">Sign In</Link>
        </div>
        <div className="mt-12 grid grid-cols-3 gap-6 text-sm text-slate-400">
          {'['Live Bin Tracking', 'AI Route Optimizer', 'Auto Billing'].map(f => (
            <div key={f} className="flex items-center justify-center gap-2">
              <span className="text-sky-400">•</span> {f}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
