import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureAppException } from '@/lib/monitoring/sentry'

export const runtime = 'nodejs'

async function runBilling(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || header !== secret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required.' }, { status: 500 })

  try {
    const runDate = new Date().toISOString().slice(0, 10)
    const { data, error } = await admin.rpc('run_monthly_billing', { p_run_date: runDate })
    if (error) throw error
    const rows = data || []
    const missingRates = rows.filter((row: any) => row.amount === null).length
    return NextResponse.json({
      ok: true,
      runDate,
      created: rows.length,
      missingRates,
    })
  } catch (error) {
    captureAppException(error, { route: '/api/cron/run-billing' })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Billing cron failed.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return runBilling(request)
}

export async function GET(request: NextRequest) {
  return runBilling(request)
}
