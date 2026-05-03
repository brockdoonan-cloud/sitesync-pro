import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'

async function safeCount(admin: any, table: string, query?: (q: any) => any) {
  if (!admin) return 0
  const base = admin.from(table).select('id', { count: 'exact', head: true })
  const result = await (query ? query(base) : base)
  return result.count || 0
}

export default async function AdminDashboardPage() {
  const org = await getCurrentOrg()
  if (!org) redirect('/auth/login')
  if (!org.isSuperAdmin) redirect('/dashboard')

  const admin = createAdminClient()
  const since = new Date()
  since.setDate(since.getDate() - 7)

  const [organizations, activeLeads, quoteResponses, auditLogs, users] = await Promise.all([
    safeCount(admin, 'organizations'),
    safeCount(admin, 'quote_requests', (q: any) => q.gte('created_at', since.toISOString())),
    safeCount(admin, 'quote_responses', (q: any) => q.gte('created_at', since.toISOString())),
    admin ? admin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50) : { data: [] },
    admin?.auth?.admin?.listUsers ? admin.auth.admin.listUsers({ page: 1, perPage: 1 }) : { data: { users: [] } },
  ])

  const userData: any = users?.data || {}
  const userTotal = userData.total || userData.users?.length || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Super Admin Monitoring</h1>
        <p className="text-slate-400 mt-1">Platform health, recent writes, and production readiness signals.</p>
      </div>

      {!admin && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
          SUPABASE_SERVICE_ROLE_KEY is required for full admin metrics.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Organizations', organizations],
          ['Users', userTotal],
          ['Leads 7d', activeLeads],
          ['Responses 7d', quoteResponses],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3">
            <div className="text-2xl font-bold text-white">{String(value)}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="font-semibold text-white mb-3">Recent Audit Log Entries</h2>
        {(auditLogs.data || []).length > 0 ? (
          <div className="space-y-2">
            {(auditLogs.data || []).map((entry: any) => (
              <div key={entry.id} className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-medium text-white">{entry.action} {entry.resource_type}</span>
                  <span className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString()}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">Resource: {entry.resource_id || 'system'} | User: {entry.user_id || 'system'}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No audit log entries yet.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold text-white mb-2">Recent Errors</h2>
          <p className="text-sm text-slate-400">Sentry capture is wired. Add SENTRY_API_TOKEN, SENTRY_ORG, and SENTRY_PROJECT later to show the last 20 errors here.</p>
        </div>
        <div className="card">
          <h2 className="font-semibold text-white mb-2">Slowest Queries</h2>
          <p className="text-sm text-slate-400">Enable pg_stat_statements access in Supabase before surfacing slow query rankings here.</p>
        </div>
      </div>
    </div>
  )
}
