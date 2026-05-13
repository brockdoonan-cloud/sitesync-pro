import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit/log'
import { captureAppException } from '@/lib/monitoring/sentry'

type Params = { params: Promise<{ id: string }> }

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i

function deletedLeadNotes(existingNotes: string | null | undefined, actor: string) {
  const stamp = new Date().toISOString()
  const deletionNote = `[${stamp}] Archived from operator inbox by ${actor}.`
  return existingNotes ? `${existingNotes}\n\n${deletionNote}` : deletionNote
}

async function cleanupLeadIndexes(supabase: any, id: string) {
  await Promise.all([
    supabase.from('lead_division_matches').delete().eq('quote_request_id', id),
    supabase.from('quote_responses').delete().eq('quote_request_id', id),
    supabase.from('sms_logs').delete().eq('request_id', id),
  ])
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })
  }

  const org = await getCurrentOrg()
  if (!org?.isOperator) {
    return NextResponse.json({ error: 'Operator access required.' }, { status: 403 })
  }

  const sessionClient = await createClient()
  const admin = createAdminClient()
  const supabase = admin || sessionClient
  const { data: lead, error: leadError } = await supabase
    .from('quote_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found or already deleted.' }, { status: 404 })
  }

  const actor = org.user.email || org.user.id
  const archivedNotes = deletedLeadNotes(lead.notes, actor)
  const { data: archivedLead, error: archiveError } = await supabase
    .from('quote_requests')
    .update({ status: 'deleted', notes: archivedNotes })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (archiveError || !archivedLead) {
    const rpcResult = await sessionClient.rpc('archive_quote_request', { target_id: id })

    if (rpcResult.error) {
      captureAppException(archiveError || rpcResult.error, {
        route: '/api/quote-requests/[id]',
        organizationId: lead.organization_id,
        userId: org.user.id,
      })
      return NextResponse.json({
        error: archiveError?.message || rpcResult.error.message || 'Could not delete lead.',
      }, { status: 500 })
    }
  } else {
    await cleanupLeadIndexes(supabase, id)
  }

  await logAuditEvent({
    userId: org.user.id,
    orgId: lead.organization_id || org.organizationId,
    action: 'archive',
    resourceType: 'quote_request',
    resourceId: id,
    beforeState: lead,
    afterState: archivedLead || { id, status: 'deleted' },
    request,
  })

  return NextResponse.json({ success: true, archived: true })
}
