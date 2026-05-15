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
      let roleRedirect = next
      if (user?.id) {
        const { data: memberships } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', user.id)
        const roles = new Set((memberships || []).map((membership: any) => membership.role))
        if (roles.has('driver')) {
          roleRedirect = '/dashboard/driver'
          const admin = createAdminClient()
          await admin?.from('drivers').update({ first_login_at: new Date().toISOString() }).eq('user_id', user.id).is('first_login_at', null)
        } else if (roles.has('super_admin')) roleRedirect = '/dashboard/admin'
        else if (roles.has('operator_admin') || roles.has('operator_member')) roleRedirect = '/dashboard/operator'
        else if (roles.has('client')) roleRedirect = '/dashboard/customer'
      }
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
      return NextResponse.redirect(`${origin}${roleRedirect}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`)
}
