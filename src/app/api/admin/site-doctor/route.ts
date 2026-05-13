import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { createAdminClient } from '@/lib/supabase/admin'
import { runSiteDoctor } from '@/lib/siteDoctor'
import { logAuditEvent } from '@/lib/audit/log'
import { captureAppException } from '@/lib/monitoring/sentry'

async function requireSuperAdmin() {
  const org = await getCurrentOrg()
  if (!org) return { org: null, response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }
  if (!org.isSuperAdmin) return { org, response: NextResponse.json({ error: 'Super admin access required.' }, { status: 403 }) }
  return { org, response: null }
}

export async function GET() {
  const guard = await requireSuperAdmin()
  if (guard.response) return guard.response

  try {
    const report = await runSiteDoctor(createAdminClient())
    return NextResponse.json(report)
  } catch (error: any) {
    captureAppException(error, { route: '/api/admin/site-doctor', userId: guard.org?.user.id })
    return NextResponse.json({ error: error?.message || 'Site Doctor failed.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSuperAdmin()
  if (guard.response) return guard.response

  try {
    const report = await runSiteDoctor(createAdminClient(), { repair: true })
    await logAuditEvent({
      userId: guard.org!.user.id,
      orgId: guard.org!.organizationId,
      action: 'site_doctor_repair',
      resourceType: 'system',
      afterState: report,
      request,
    })
    return NextResponse.json(report)
  } catch (error: any) {
    captureAppException(error, { route: '/api/admin/site-doctor', userId: guard.org?.user.id })
    return NextResponse.json({ error: error?.message || 'Site Doctor repair failed.' }, { status: 500 })
  }
}
