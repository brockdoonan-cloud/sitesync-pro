'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="card max-w-lg text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">
          !
        </div>
        <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-400">The error was reported automatically. Try again, and if it continues we can investigate from the logs.</p>
        <button onClick={reset} className="btn-primary mt-6 px-5 py-2">Try again</button>
      </div>
    </div>
  )
}
