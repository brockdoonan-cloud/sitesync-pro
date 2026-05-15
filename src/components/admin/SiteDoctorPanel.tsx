'use client'

import { useState } from 'react'

type Check = {
  key: string
  label: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
  action?: string
}

type Report = {
  status: 'ok' | 'warn' | 'fail'
  checkedAt: string
  checks: Check[]
  repairs: string[]
  recentErrors?: {
    status: 'ok' | 'warn' | 'fail'
    detail: string
    events: Array<{ title: string; level: string; timestamp: string; permalink: string }>
  }
  slowQueries?: {
    status: 'ok' | 'warn' | 'fail'
    detail: string
    rows: Array<{ query: string; calls: number; total_exec_time: number; mean_exec_time: number; rows: number }>
  }
}

const statusClass = {
  ok: 'border-green-500/30 bg-green-500/10 text-green-300',
  warn: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  fail: 'border-red-500/30 bg-red-500/10 text-red-300',
}

export default function SiteDoctorPanel() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const run = async (repair = false) => {
    setLoading(true)
    setMessage('')
    const response = await fetch('/api/admin/site-doctor', { method: repair ? 'POST' : 'GET' })
    const payload = await response.json().catch(() => ({}))
    setLoading(false)

    if (!response.ok) {
      setMessage(payload.error || 'Site Doctor failed.')
      return
    }

    setReport(payload)
    setMessage(repair ? (payload.repairs?.join(' ') || 'Repair pass finished.') : 'Site Doctor check finished.')
  }

  return (
    <div className="card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-white">Site Doctor</h2>
          <p className="mt-1 text-sm text-slate-400">Checks production readiness and safely repairs common data issues before onboarding.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => run(false)} disabled={loading} className="btn-secondary px-3 py-2 text-sm disabled:opacity-50">
            {loading ? 'Running...' : 'Run Check'}
          </button>
          <button type="button" onClick={() => run(true)} disabled={loading} className="btn-primary px-3 py-2 text-sm disabled:opacity-50">
            Auto-Repair
          </button>
        </div>
      </div>

      {message && <div className="mt-4 rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">{message}</div>}

      {report && (
        <div className="mt-4 space-y-3">
          <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClass[report.status]}`}>
            Overall: {report.status.toUpperCase()} | {new Date(report.checkedAt).toLocaleString()}
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {report.checks.map(check => (
              <div key={check.key} className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">{check.label}</div>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass[check.status]}`}>{check.status}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">{check.detail}</div>
                {check.action && <div className="mt-1 text-xs text-sky-300">{check.action}</div>}
              </div>
            ))}
          </div>
          {report.repairs.length > 0 && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">
              {report.repairs.join(' ')}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-white">Recent Errors</h3>
                {report.recentErrors && <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass[report.recentErrors.status]}`}>{report.recentErrors.status}</span>}
              </div>
              <p className="mt-1 text-xs text-slate-500">{report.recentErrors?.detail || 'No Sentry result returned.'}</p>
              <div className="mt-3 space-y-2">
                {(report.recentErrors?.events || []).map(event => (
                  <a key={`${event.timestamp}-${event.title}`} href={event.permalink} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-700/50 bg-slate-950/50 px-3 py-2 hover:border-sky-500/50">
                    <div className="text-sm font-medium text-white">{event.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{event.level} | {new Date(event.timestamp).toLocaleString()}</div>
                  </a>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-white">Slowest Queries</h3>
                {report.slowQueries && <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass[report.slowQueries.status]}`}>{report.slowQueries.status}</span>}
              </div>
              <p className="mt-1 text-xs text-slate-500">{report.slowQueries?.detail || 'No slow-query result returned.'}</p>
              <div className="mt-3 space-y-2">
                {(report.slowQueries?.rows || []).map((row, index) => (
                  <div key={`${index}-${row.query}`} className="rounded-lg border border-slate-700/50 bg-slate-950/50 px-3 py-2">
                    <div className="font-mono text-xs text-slate-300">{row.query}</div>
                    <div className="mt-1 text-xs text-slate-500">calls {row.calls} | mean {row.mean_exec_time.toFixed(1)}ms | total {row.total_exec_time.toFixed(1)}ms | rows {row.rows}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
