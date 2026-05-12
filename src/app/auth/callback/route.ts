import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit/log'
import { createAdminClient } from '@/lib/supabase/admin'
import { linkCustomerAccessCode } from '@/lib/customer/linkAccessCode'
import { captureAppException } from '@/lib/monitoring/sentry'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      const customerAccessCode = user?.user_metadata?.customer_access_code
      if (user?.id && customerAccessCode) {
        const admin = createAdminClient()
        if (admin) {
          try {
            const account = await linkCustomerAccessCode(admin, user.id, customerAccessCode)
            await logAuditEvent({
              userId: user.id,
              orgId: account.organization_id,
              action: 'link_customer_account',
              resourceType: 'customer_account',
              resourceId: account.id,
              afterState: account,
              request,
            })
          } catch (linkError) {
            captureAppException(linkError, { route: '/auth/callback', userId: user.id })
          }
        }
      }
      await logAuditEvent({
        userId: user?.id || null,
        action: 'login',
        resourceType: 'auth',
        resourceId: user?.id || null,
        request,
      })
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`)
}
