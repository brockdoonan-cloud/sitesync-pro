import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractTrackingRecords, normalizeTrackingRecord, type TruckTrackingMapping } from '@/lib/truckTracking'
import { saveNormalizedTruckTrackingRecord } from '@/lib/truckTrackingIngest'
import { captureAppException } from '@/lib/monitoring/sentry'

type Params = { params: Promise<{ token: string }> }
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params
  if (!uuidPattern.test(token)) return NextResponse.json({ error: 'Webhook not found.' }, { status: 404 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Truck tracking ingestion is not configured.' }, { status: 503 })

  const { data: integration, error: integrationError } = await admin
    .from('truck_tracking_integrations')
    .select('*')
    .eq('webhook_token', token)
    .single()

  if (integrationError || !integration || ['paused', 'error'].includes(integration.status)) {
    return NextResponse.json({ error: 'Webhook not found or inactive.' }, { status: 404 })
  }

  const payload = await request.json().catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })

  const rows = extractTrackingRecords(payload)
  const mapping = integration.field_mapping as TruckTrackingMapping
  const warnings: string[] = []
  let imported = 0

  try {
    for (const row of rows) {
      const normalized = normalizeTrackingRecord(row, mapping)
      if ('error' in normalized) {
        warnings.push(normalized.error)
        continue
      }
      await saveNormalizedTruckTrackingRecord(admin, integration, normalized)
      imported += 1
    }

    await admin
      .from('truck_tracking_integrations')
      .update({
        status: imported > 0 ? 'connected' : integration.status,
        last_sync_at: imported > 0 ? new Date().toISOString() : integration.last_sync_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id)

    return NextResponse.json({ success: true, imported, skipped: rows.length - imported, warnings })
  } catch (error: any) {
    captureAppException(error, { route: '/api/truck-tracking/webhook/[token]', organizationId: integration.organization_id })
    return NextResponse.json({ error: error?.message || 'Webhook ingestion failed.' }, { status: 500 })
  }
}
