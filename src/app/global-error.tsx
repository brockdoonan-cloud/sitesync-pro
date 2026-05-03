'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-lg rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">
              !
            </div>
            <h1 className="text-2xl font-bold text-white">SiteSync needs a refresh</h1>
            <p className="mt-2 text-sm text-slate-400">A critical error was reported automatically. Try again in a moment.</p>
            <button onClick={reset} className="mt-6 rounded-xl bg-sky-500 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-400">
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
