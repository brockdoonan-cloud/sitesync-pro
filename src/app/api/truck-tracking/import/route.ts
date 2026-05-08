import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { extractTrackingRecords, normalizeTrackingRecord, type TruckTrackingMapping } from '@/lib/truckTracking'
import { saveNormalizedTruckTrackingRecord } from '@/lib/truckTrackingIngest'
import { logAuditEvent } from '@/lib/audit/log'
import { captureAppException } from '@/lib/monitoring/sentry'

export async function POST(request: NextRequest) {
  const org = await getCurrentOrg()
  if (!org?.isOperator || !org.organizationId) {
    return NextResponse.json({ error: 'Operator organization required.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.integration_id) return NextResponse.json({ error: 'integration_id is required.' }, { status: 400 })

  const admin = createAdminClient()
  const supabase = admin || (await createClient())
  const { data: integration, error: integrationError } = await supabase
    .from('truck_tracking_integrations')
    .select('*')
    .eq('id', body.integration_id)
    .eq('organization_id', org.organizationId)
    .single()

  if (integrationError || !integration) {
    return NextResponse.json({ error: 'Tracking integration not found.' }, { status: 404 })
  }

  const rows = Array.isArray(body.records) ? body.records : extractTrackingRecords(body.records || body.payload)
  const mapping = (body.field_mapping || integration.field_mapping) as TruckTrackingMapping
  const warnings: string[] = []
  let imported = 0

  try {
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const normalized = normalizeTrackingRecord(row as Record<string, unknown>, mapping)
      if ('error' in normalized) {
        warnings.push(normalized.error)
        continue
      }
      await saveNormalizedTruckTrackingRecord(supabase, integration, normalized)
      imported += 1
    }

    await supabase
      .from('truck_tracking_integrations')
      .update({
        field_mapping: mapping,
        status: imported > 0 ? 'connected' : integration.status,
        last_sync_at: imported > 0 ? new Date().toISOString() : integration.last_sync_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id)

    const { data: importRow } = await supabase
      .from('truck_tracking_imports')
      .insert({
        organization_id: org.organizationId,
        integration_id: integration.id,
        source_file_name: body.source_file_name ? String(body.source_file_name) : null,
        row_count: rows.length,
        imported_count: imported,
        skipped_count: Math.max(0, rows.length - imported),
        warnings,
      })
      .select('*')
      .single()

    await logAuditEvent({
      userId: org.user.id,
      orgId: org.organizationId,
      action: 'import',
      resourceType: 'truck_tracking',
      resourceId: integration.id,
      afterState: { imported, skipped: rows.length - imported, warnings },
      request,
    })

    return NextResponse.json({ imported, skipped: rows.length - imported, warnings, import: importRow })
  } catch (error: any) {
    captureAppException(error, { route: '/api/truck-tracking/import', organizationId: org.organizationId, userId: org.user.id })
    return NextResponse.json({ error: error?.message || 'Truck tracking import failed.' }, { status: 500 })
  }
}
