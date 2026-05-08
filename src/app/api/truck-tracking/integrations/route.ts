import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { DEFAULT_TRUCK_TRACKING_MAPPING } from '@/lib/truckTracking'
import { logAuditEvent } from '@/lib/audit/log'
import { captureAppException } from '@/lib/monitoring/sentry'

export async function GET() {
  const org = await getCurrentOrg()
  if (!org?.isOperator || !org.organizationId) {
    return NextResponse.json({ error: 'Operator organization required.' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('truck_tracking_integrations')
    .select('*,truck_tracking_imports(id,row_count,imported_count,skipped_count,created_at)')
    .eq('organization_id', org.organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    captureAppException(error, { route: '/api/truck-tracking/integrations', organizationId: org.organizationId, userId: org.user.id })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ integrations: data || [] })
}

export async function POST(request: NextRequest) {
  const org = await getCurrentOrg()
  if (!org?.isOperator || !org.organizationId) {
    return NextResponse.json({ error: 'Operator organization required.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.provider_name) {
    return NextResponse.json({ error: 'Provider name is required.' }, { status: 400 })
  }

  const payload = {
    organization_id: org.organizationId,
    provider_key: String(body.provider_key || 'custom').trim(),
    provider_name: String(body.provider_name).trim(),
    connection_type: String(body.connection_type || 'csv').trim(),
    status: String(body.status || 'testing').trim(),
    api_base_url: body.api_base_url ? String(body.api_base_url).trim() : null,
    auth_type: body.auth_type ? String(body.auth_type).trim() : null,
    credential_reference: body.credential_reference ? String(body.credential_reference).trim() : null,
    external_account_id: body.external_account_id ? String(body.external_account_id).trim() : null,
    field_mapping: body.field_mapping || DEFAULT_TRUCK_TRACKING_MAPPING,
    notes: body.notes ? String(body.notes).trim() : null,
  }

  const admin = createAdminClient()
  const supabase = admin || (await createClient())
  const { data, error } = await supabase
    .from('truck_tracking_integrations')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    captureAppException(error, { route: '/api/truck-tracking/integrations', organizationId: org.organizationId, userId: org.user.id })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditEvent({
    userId: org.user.id,
    orgId: org.organizationId,
    action: 'create',
    resourceType: 'truck_tracking_integration',
    resourceId: data.id,
    afterState: data,
    request,
  })

  return NextResponse.json({ integration: data })
}
