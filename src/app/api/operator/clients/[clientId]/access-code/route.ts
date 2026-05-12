import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { createClient } from '@/lib/supabase/server'
import { normalizeAccessCode } from '@/lib/customer/linkAccessCode'
import { logAuditEvent } from '@/lib/audit/log'
import { captureAppException } from '@/lib/monitoring/sentry'

type Params = { params: Promise<{ clientId: string }> }

function createCode() {
  return `SSP-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
}

export async function POST(request: NextRequest, { params }: Params) {
  const org = await getCurrentOrg()
  if (!org) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const canManageCustomers = org.isSuperAdmin || ['operator_admin', 'operator_member', 'operator'].includes(String(org.role))
  if (!canManageCustomers) {
    return NextResponse.json({ error: 'Operator access required.' }, { status: 403 })
  }

  const { clientId } = await params
  const supabase = await createClient()
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id,organization_id,company_name,name')
    .eq('id', clientId)
    .maybeSingle()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  }

  if (!org.isSuperAdmin && org.organizationId && client.organization_id !== org.organizationId) {
    return NextResponse.json({ error: 'Client is outside your organization.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const requestedCode = normalizeAccessCode(body?.code)
  const code = requestedCode || createCode()
  const organizationId = client.organization_id || org.organizationId

  if (!organizationId) {
    return NextResponse.json({ error: 'Client is missing organization setup.' }, { status: 400 })
  }

  const { data: accessCode, error } = await supabase
    .from('customer_access_codes')
    .insert({
      organization_id: organizationId,
      client_id: client.id,
      code,
      label: `${client.company_name || client.name || 'Customer'} portal setup`,
      max_uses: Number(body?.max_uses || 25),
      created_by_user_id: org.user.id,
    })
    .select('*')
    .single()

  if (error) {
    captureAppException(error, { route: '/api/operator/clients/[clientId]/access-code', organizationId, userId: org.user.id })
    const missingTable = error.code === '42P01' || /schema cache|does not exist/i.test(String(error.message || ''))
    return NextResponse.json({ error: missingTable ? 'Customer access-code tables have not been migrated yet.' : error.message }, { status: missingTable ? 503 : 500 })
  }

  await logAuditEvent({
    userId: org.user.id,
    orgId: organizationId,
    action: 'create',
    resourceType: 'customer_access_code',
    resourceId: accessCode.id,
    afterState: accessCode,
    request,
  })

  return NextResponse.json({ accessCode })
}
