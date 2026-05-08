import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/log'
import { captureAppException } from '@/lib/monitoring/sentry'

type Params = { params: Promise<{ id: string }> }

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })
  }

  const org = await getCurrentOrg()
  if (!org?.isOperator) {
    return NextResponse.json({ error: 'Operator access required.' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: lead, error: leadError } = await supabase
    .from('quote_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found or already deleted.' }, { status: 404 })
  }

  const { error } = await supabase
    .from('quote_requests')
    .delete()
    .eq('id', id)

  if (error) {
    captureAppException(error, { route: '/api/quote-requests/[id]', organizationId: lead.organization_id, userId: org.user.id })
    return NextResponse.json({ error: error.message || 'Could not delete lead.' }, { status: 500 })
  }

  await logAuditEvent({
    userId: org.user.id,
    orgId: lead.organization_id || org.organizationId,
    action: 'delete',
    resourceType: 'quote_request',
    resourceId: id,
    beforeState: lead,
    request,
  })

  return NextResponse.json({ success: true })
}
