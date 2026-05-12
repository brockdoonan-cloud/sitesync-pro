import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { linkCustomerAccessCode } from '@/lib/customer/linkAccessCode'
import { logAuditEvent } from '@/lib/audit/log'
import { captureAppException } from '@/lib/monitoring/sentry'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in before linking a customer account.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Customer access-code linking is not configured yet.' }, { status: 503 })
  }

  try {
    const account = await linkCustomerAccessCode(admin, user.id, body?.access_code)
    await logAuditEvent({
      userId: user.id,
      orgId: account.organization_id,
      action: 'link_customer_account',
      resourceType: 'customer_account',
      resourceId: account.id,
      afterState: account,
      request,
    })
    return NextResponse.json({ account })
  } catch (error: any) {
    captureAppException(error, { route: '/api/customer/link-account', userId: user.id })
    return NextResponse.json({ error: error?.message || 'Could not link customer account.' }, { status: 400 })
  }
}
