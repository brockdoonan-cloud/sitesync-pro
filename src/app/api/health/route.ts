import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const timestamp = new Date().toISOString()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({
      status: 'down',
      timestamp,
      checks: {
        database: 'fail',
        auth: 'fail',
      },
    }, { status: 503 })
  }

  const admin = createAdminClient()
  const supabase = await createClient()

  const [database, auth] = await Promise.all([
    admin
      ? admin.from('organizations').select('id', { head: true, count: 'exact' }).limit(1)
      : supabase.from('quote_requests').select('id', { head: true, count: 'exact' }).limit(1),
    supabase.auth.getUser(),
  ])

  const authSessionMissing = auth.error
    && (
      auth.error.name === 'AuthSessionMissingError'
      || auth.error.message.toLowerCase().includes('auth session missing')
      || auth.error.message.toLowerCase().includes('session_missing')
    )

  const checks = {
    database: database.error ? 'fail' : 'ok',
    auth: auth.error && !authSessionMissing ? 'fail' : 'ok',
  } as const
  const status = checks.database === 'ok' && checks.auth === 'ok' ? 'ok' : checks.database === 'ok' ? 'degraded' : 'down'

  return NextResponse.json({ status, timestamp, checks }, { status: status === 'down' ? 503 : 200 })
}
