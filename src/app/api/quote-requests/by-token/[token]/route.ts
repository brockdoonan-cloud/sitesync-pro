import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, tooManyRequests } from '@/lib/rateLimit'
import { getClientIp } from '@/lib/request'
import { isQuoteTokenExpired } from '@/lib/quotes/token'
import { captureAppException } from '@/lib/monitoring/sentry'

type Params = { params: { token: string } }

export async function GET(_request: NextRequest, { params }: Params) {
  const ip = getClientIp(_request)
  const rate = await checkRateLimit({
    key: `quote-token:${ip}`,
    limit: 60,
    windowSeconds: 60,
    route: '/api/quote-requests/by-token/[token]',
  })
  if (!rate.allowed) {
    const limited = tooManyRequests(rate.resetAt)
    return NextResponse.json(limited.body, limited.init)
  }

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

  if (isQuoteTokenExpired(quoteRequest.created_at)) {
    return NextResponse.json({ error: 'This quote link has expired. Please submit a new request.' }, { status: 410 })
  }

  const { data: responses, error: responseError } = await admin
    .from('quote_responses')
    .select('*')
    .eq('quote_request_id', quoteRequest.id)
    .order('price_quote', { ascending: true })

  if (responseError) {
    captureAppException(responseError, { route: '/api/quote-requests/by-token/[token]' })
    return NextResponse.json({ error: responseError.message }, { status: 500 })
  }

  return NextResponse.json({ quoteRequest, responses: responses || [] })
}
