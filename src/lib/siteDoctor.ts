import 'server-only'

type CheckStatus = 'ok' | 'warn' | 'fail'

export type SiteDoctorCheck = {
  key: string
  label: string
  status: CheckStatus
  detail: string
  action?: string
}

export type SiteDoctorErrorEvent = {
  title: string
  level: string
  timestamp: string
  permalink: string
}

export type SiteDoctorSlowQuery = {
  query: string
  calls: number
  total_exec_time: number
  mean_exec_time: number
  rows: number
}

export type SiteDoctorReport = {
  status: CheckStatus
  checkedAt: string
  checks: SiteDoctorCheck[]
  repairs: string[]
  recentErrors: {
    status: CheckStatus
    detail: string
    events: SiteDoctorErrorEvent[]
  }
  slowQueries: {
    status: CheckStatus
    detail: string
    rows: SiteDoctorSlowQuery[]
  }
}

function worstStatus(checks: SiteDoctorCheck[]): CheckStatus {
  if (checks.some(check => check.status === 'fail')) return 'fail'
  if (checks.some(check => check.status === 'warn')) return 'warn'
  return 'ok'
}

async function tableCount(admin: any, table: string) {
  const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true })
  if (error) return { count: 0, error }
  return { count: count || 0, error: null }
}

async function fetchRecentSentryErrors() {
  const org = process.env.SENTRY_ORG
  const project = process.env.SENTRY_PROJECT
  const token = process.env.SENTRY_API_TOKEN
  if (!org || !project || !token) {
    return { status: 'warn' as CheckStatus, detail: 'Sentry API env vars are not configured.', events: [] as SiteDoctorErrorEvent[] }
  }

  try {
    const response = await fetch(`https://sentry.io/api/0/projects/${org}/${project}/events/?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (response.status === 401 || response.status === 403) {
      return { status: 'warn' as CheckStatus, detail: 'Sentry token invalid or insufficient scopes.', events: [] as SiteDoctorErrorEvent[] }
    }
    if (response.status === 404) {
      return { status: 'warn' as CheckStatus, detail: 'Sentry project not found - check SENTRY_ORG/SENTRY_PROJECT.', events: [] as SiteDoctorErrorEvent[] }
    }
    if (!response.ok) {
      return { status: 'warn' as CheckStatus, detail: `Sentry returned ${response.status}.`, events: [] as SiteDoctorErrorEvent[] }
    }
    const payload = await response.json()
    const events = (Array.isArray(payload) ? payload : []).map((event: any) => ({
      title: event.title || event.message || event.eventID || 'Untitled error',
      level: event.level || 'error',
      timestamp: event.dateCreated || event.timestamp || new Date().toISOString(),
      permalink: event.permalink || `https://sentry.io/organizations/${org}/issues/?project=${project}`,
    }))
    return {
      status: 'ok' as CheckStatus,
      detail: events.length > 0 ? `${events.length} recent Sentry event(s).` : 'No recent errors.',
      events,
    }
  } catch {
    return { status: 'warn' as CheckStatus, detail: 'Sentry unreachable.', events: [] as SiteDoctorErrorEvent[] }
  }
}

async function fetchSlowQueries(admin: any) {
  if (!admin) {
    return { status: 'warn' as CheckStatus, detail: 'SUPABASE_SERVICE_ROLE_KEY is required for slow-query rankings.', rows: [] as SiteDoctorSlowQuery[] }
  }
  const { data, error } = await admin.rpc('site_doctor_slowest_queries')
  if (error) {
    const message = String(error.message || error)
    if (/permission denied/i.test(message)) {
      return { status: 'warn' as CheckStatus, detail: 'Permission denied. Run GRANT pg_read_all_stats TO service_role;', rows: [] as SiteDoctorSlowQuery[] }
    }
    if (/does not exist|Could not find|schema cache/i.test(message)) {
      return { status: 'warn' as CheckStatus, detail: 'Slow-query RPC not installed yet. Run migration 0017_prelaunch_hardening.sql.', rows: [] as SiteDoctorSlowQuery[] }
    }
    return { status: 'warn' as CheckStatus, detail: message, rows: [] as SiteDoctorSlowQuery[] }
  }
  const rows = (data || []).map((row: any) => ({
    query: String(row.query || '').slice(0, 120),
    calls: Number(row.calls || 0),
    total_exec_time: Number(row.total_exec_time || 0),
    mean_exec_time: Number(row.mean_exec_time || 0),
    rows: Number(row.rows || 0),
  }))
  return {
    status: 'ok' as CheckStatus,
    detail: rows.length > 0 ? `${rows.length} slow-query row(s) loaded.` : 'No slow query data returned.',
    rows,
  }
}

function checkFromError(key: string, label: string, error: any, okDetail: string): SiteDoctorCheck {
  if (!error) return { key, label, status: 'ok', detail: okDetail }
  const message = String(error.message || error)
  const missing = error.code === '42P01' || /schema cache|does not exist|Could not find/i.test(message)
  return {
    key,
    label,
    status: missing ? 'fail' : 'warn',
    detail: missing ? `${label} is missing or not visible to the API.` : message,
    action: missing ? 'Run the latest Supabase migrations.' : 'Review Supabase logs.',
  }
}

export async function runSiteDoctor(admin: any, options: { repair?: boolean } = {}): Promise<SiteDoctorReport> {
  const checks: SiteDoctorCheck[] = []
  const repairs: string[] = []

  if (!admin) {
    checks.push({
      key: 'service_role',
      label: 'Admin service role',
      status: 'fail',
      detail: 'SUPABASE_SERVICE_ROLE_KEY is not configured, so the doctor cannot inspect or repair protected data.',
      action: 'Add SUPABASE_SERVICE_ROLE_KEY in Vercel before onboarding real operators.',
    })
    return {
      status: 'fail',
      checkedAt: new Date().toISOString(),
      checks,
      repairs,
      recentErrors: await fetchRecentSentryErrors(),
      slowQueries: await fetchSlowQueries(admin),
    }
  }

  const criticalTables = [
    ['quote_requests', 'Lead inbox'],
    ['service_requests', 'Customer service requests'],
    ['equipment', 'Equipment inventory'],
    ['jobsites', 'Jobsites'],
    ['clients', 'Clients'],
    ['driver_routes', 'Driver routes'],
    ['route_stops', 'Route stops'],
    ['billing_events', 'Billing events'],
  ]

  for (const [table, label] of criticalTables) {
    const result = await tableCount(admin, table)
    checks.push(checkFromError(table, label, result.error, `${label} table is reachable (${result.count} rows).`))
  }

  const accessTables = [
    ['customer_access_codes', 'Customer access codes'],
    ['customer_accounts', 'Customer account links'],
  ]
  for (const [table, label] of accessTables) {
    const result = await tableCount(admin, table)
    checks.push(checkFromError(table, label, result.error, `${label} table is reachable (${result.count} rows).`))
  }

  const zipLookup = await tableCount(admin, 'zip_lookup')
  if (zipLookup.error) {
    checks.push(checkFromError('zip_lookup', 'Nationwide ZIP lookup', zipLookup.error, ''))
  } else {
    checks.push({
      key: 'zip_lookup',
      label: 'Nationwide ZIP lookup',
      status: zipLookup.count >= 30000 ? 'ok' : 'warn',
      detail: `${zipLookup.count} ZIP rows loaded. ${zipLookup.count >= 30000 ? 'Nationwide lead matching is ready.' : 'Expected roughly 30,000+ active ZIP rows.'}`,
      action: zipLookup.count >= 30000 ? undefined : 'Run npm run seed:zip-lookup with the production database.',
    })
  }

  const { data: demoLeads, error: demoError } = await admin
    .from('quote_requests')
    .select('id,name,email,notes')
    .or('name.ilike.%codex%,name.ilike.%demo%,email.ilike.%codex%,email.ilike.%demo%,notes.ilike.%Automated%')
    .neq('status', 'deleted')
    .neq('status', 'archived')
    .neq('status', 'spam')
    .limit(200)

  if (demoError) {
    checks.push(checkFromError('demo_leads', 'Demo/smoke leads', demoError, ''))
  } else {
    const count = demoLeads?.length || 0
    checks.push({
      key: 'demo_leads',
      label: 'Demo/smoke leads',
      status: count > 0 ? 'warn' : 'ok',
      detail: count > 0 ? `${count} demo or smoke-test leads are still in the inbox.` : 'No demo or smoke-test leads found.',
      action: count > 0 ? 'Run Site Doctor repair to clean demo leads.' : undefined,
    })

    if (options.repair && count > 0) {
      const ids = demoLeads!.map((lead: any) => lead.id).filter(Boolean)
      await admin.from('lead_division_matches').delete().in('quote_request_id', ids)
      await admin.from('quote_responses').delete().in('quote_request_id', ids)
      await admin.from('sms_logs').delete().in('request_id', ids)
      const { error } = await admin
        .from('quote_requests')
        .update({ status: 'deleted', notes: 'Archived by Site Doctor demo lead cleanup.' })
        .in('id', ids)
      if (error) {
        checks.push({
          key: 'demo_leads_repair',
          label: 'Demo lead cleanup',
          status: 'fail',
          detail: error.message,
          action: 'Archive demo leads manually from Supabase if this repeats.',
        })
      } else {
        repairs.push(`Archived ${ids.length} demo/smoke lead(s).`)
        const demoCheck = checks.find(check => check.key === 'demo_leads')
        if (demoCheck) {
          demoCheck.status = 'ok'
          demoCheck.detail = `Archived ${ids.length} demo or smoke-test lead(s).`
          demoCheck.action = undefined
        }
      }
    }
  }

  if (options.repair) {
    const { error } = await admin
      .from('quote_requests')
      .update({ status: 'open' })
      .is('status', null)
    if (error) {
      checks.push({
        key: 'null_lead_status_repair',
        label: 'Null lead status repair',
        status: 'warn',
        detail: error.message,
      })
    } else {
      repairs.push('Normalized blank lead statuses to open.')
    }
  }

  return {
    status: worstStatus(checks),
    checkedAt: new Date().toISOString(),
    checks,
    repairs,
    recentErrors: await fetchRecentSentryErrors(),
    slowQueries: await fetchSlowQueries(admin),
  }
}
