import 'server-only'

type CheckStatus = 'ok' | 'warn' | 'fail'

export type SiteDoctorCheck = {
  key: string
  label: string
  status: CheckStatus
  detail: string
  action?: string
}

export type SiteDoctorReport = {
  status: CheckStatus
  checkedAt: string
  checks: SiteDoctorCheck[]
  repairs: string[]
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
    return { status: 'fail', checkedAt: new Date().toISOString(), checks, repairs }
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
      const { error } = await admin.from('quote_requests').delete().in('id', ids)
      if (error) {
        checks.push({
          key: 'demo_leads_repair',
          label: 'Demo lead cleanup',
          status: 'fail',
          detail: error.message,
          action: 'Delete demo leads manually from Supabase if this repeats.',
        })
      } else {
        repairs.push(`Deleted ${ids.length} demo/smoke lead(s).`)
        const demoCheck = checks.find(check => check.key === 'demo_leads')
        if (demoCheck) {
          demoCheck.status = 'ok'
          demoCheck.detail = `Deleted ${ids.length} demo or smoke-test lead(s).`
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
  }
}
