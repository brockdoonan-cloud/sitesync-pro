import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifySelectedOperator } from '@/lib/notifications'
import { logAuditEvent } from '@/lib/audit/log'
import { isQuoteTokenExpired } from '@/lib/quotes/token'
import { captureAppException } from '@/lib/monitoring/sentry'

type Params = { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server quote selection is not configured.' }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.token || !body?.response_id) {
    return NextResponse.json({ error: 'token and response_id are required' }, { status: 400 })
  }

  const { data: quoteRequest, error: quoteError } = await admin
    .from('quote_requests')
    .select('*')
    .eq('id', params.id)
    .eq('access_token', body.token)
    .single()

  if (quoteError || !quoteRequest) {
    return NextResponse.json({ error: 'This quote link is invalid or expired.' }, { status: 404 })
  }

  if (isQuoteTokenExpired(quoteRequest.created_at)) {
    return NextResponse.json({ error: 'This quote link has expired. Please submit a new request.' }, { status: 410 })
  }

  const { data: selected, error: selectedError } = await admin
    .from('quote_responses')
    .select('*')
    .eq('id', body.response_id)
    .eq('quote_request_id', params.id)
    .single()

  if (selectedError || !selected) {
    return NextResponse.json({ error: 'Selected quote response was not found.' }, { status: 404 })
  }

  const { error: declineError } = await admin
    .from('quote_responses')
    .update({ status: 'declined' })
    .eq('quote_request_id', params.id)
    .neq('id', body.response_id)

  if (declineError) return NextResponse.json({ error: declineError.message }, { status: 500 })

  const { data: updatedSelected, error: selectError } = await admin
    .from('quote_responses')
    .update({ status: 'selected' })
    .eq('id', body.response_id)
    .select('*')
    .single()

  if (selectError) {
    captureAppException(selectError, { route: '/api/quote-requests/[id]/select-response' })
    return NextResponse.json({ error: selectError.message }, { status: 500 })
  }

  await admin.from('quote_requests').update({ status: 'won' }).eq('id', params.id)
  await notifySelectedOperator(quoteRequest, updatedSelected, admin)
  await logAuditEvent({
    action: 'select_quote',
    resourceType: 'quote_response',
    resourceId: updatedSelected.id,
    orgId: updatedSelected.organization_id,
    beforeState: selected,
    afterState: updatedSelected,
    request,
  })

  return NextResponse.json({ success: true, response: updatedSelected })
}
