import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureAppException } from '@/lib/monitoring/sentry'
import { getClientIp } from '@/lib/request'
import { checkRateLimit, tooManyRequests } from '@/lib/rateLimit'

const inviteDriverSchema = z.object({
  full_name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional().default(''),
  truck_id: z.string().uuid().nullable().optional(),
  cdl_number: z.string().max(80).optional().default(''),
  cdl_expires_on: z.string().nullable().optional(),
})

export async function POST(request: NextRequest) {
  const org = await getCurrentOrg()
  if (!org?.organizationId || (!org.isOperator && !org.isSuperAdmin)) {
    return NextResponse.json({ error: 'Operator access is required.' }, { status: 403 })
  }

  const rate = await checkRateLimit({
    key: `operator-drivers:${org.user.id}:${getClientIp(request)}`,
    limit: 30,
    windowSeconds: 60,
    route: '/api/operator/drivers',
    userId: org.user.id,
  })
  if (!rate.allowed) {
    const limited = tooManyRequests(rate.resetAt)
    return NextResponse.json(limited.body, limited.init)
  }

  const body = await request.json().catch(() => null)
  const parsed = inviteDriverSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid driver invite.' }, { status: 400 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required to invite drivers.' }, { status: 500 })

  try {
    const redirectTo = `${new URL(request.url).origin}/auth/callback?next=/dashboard/driver`
    const invited = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo,
      data: { portal: 'driver', full_name: parsed.data.full_name },
    })
    if (invited.error) throw invited.error
    const userId = invited.data.user?.id
    if (!userId) return NextResponse.json({ error: 'Supabase did not return the invited user.' }, { status: 500 })

    const { data: driver, error: driverError } = await admin
      .from('drivers')
      .upsert({
        user_id: userId,
        organization_id: org.organizationId,
        truck_id: parsed.data.truck_id || null,
        full_name: parsed.data.full_name,
        phone: parsed.data.phone || null,
        cdl_number: parsed.data.cdl_number || null,
        cdl_expires_on: parsed.data.cdl_expires_on || null,
        active: true,
        invited_at: new Date().toISOString(),
      }, { onConflict: 'user_id,organization_id' })
      .select('*')
      .single()
    if (driverError) throw driverError

    await admin.from('organization_members').upsert({
      user_id: userId,
      organization_id: org.organizationId,
      role: 'driver',
    }, { onConflict: 'user_id,organization_id' })

    return NextResponse.json({ driver })
  } catch (error) {
    captureAppException(error, { route: '/api/operator/drivers', organizationId: org.organizationId, userId: org.user.id })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not invite driver.' }, { status: 500 })
  }
}
