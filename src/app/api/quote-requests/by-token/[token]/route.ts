import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: { token: string } }

export async function GET(_request: NextRequest, { params }: Params) {
  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server quote access is not configured.' }, { status: 503 })
  }

  const { data: quoteRequest, error } = await admin
    .from('quote_requests')
    .select('*')
    .eq('access_token', params.token)
    .single()

  if (error || !quoteRequest) {
    return NextResponse.json({ error: 'This quote link is invalid or expired.' }, { status: 404 })
  }

  const { data: responses, error: responseError } = await admin
    .from('quote_responses')
    .select('*')
    .eq('quote_request_id', quoteRequest.id)
    .order('price_quote', { ascending: true })

  if (responseError) {
    return NextResponse.json({ error: responseError.message }, { status: 500 })
  }

  return NextResponse.json({ quoteRequest, responses: responses || [] })
}
