import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { createClient } from '@/lib/supabase/server'
import { notifyQuoteResponse } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  const org = await getCurrentOrg()
  if (!org) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (!org.isOperator) return NextResponse.json({ error: 'Operator access required' }, { status: 403 })
  if (!org.organizationId) {
    return NextResponse.json({ error: 'No organization is assigned to this operator yet.' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const price = Number(body?.price_quote)
  if (!body?.quote_request_id || !Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: 'quote_request_id and a positive price_quote are required' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name,company_name,email,phone')
    .eq('id', org.user.id)
    .single()

  const company = profile?.company_name || org.organizationName || 'SiteSync Operator'
  const operatorName = profile?.full_name || org.user.email || company
  const operatorEmail = profile?.email || org.user.email || null

  const payload = {
    quote_request_id: body.quote_request_id,
    organization_id: org.organizationId,
    operator_user_id: org.user.id,
    operator_name: operatorName,
    operator_company: company,
    operator_phone: profile?.phone || null,
    operator_email: operatorEmail,
    price_quote: price,
    notes: body.notes ? String(body.notes).trim() : null,
    available_date: body.available_date || null,
    status: 'submitted',
  }

  const { data: response, error } = await supabase
    .from('quote_responses')
    .upsert(payload, { onConflict: 'quote_request_id,organization_id' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: quoteRequest } = await supabase
    .from('quote_requests')
    .select('*')
    .eq('id', body.quote_request_id)
    .single()

  if (quoteRequest) {
    await supabase.from('quote_requests').update({ status: 'quoted' }).eq('id', body.quote_request_id)
    await notifyQuoteResponse(quoteRequest, response, supabase)
  }

  return NextResponse.json({ response })
}
