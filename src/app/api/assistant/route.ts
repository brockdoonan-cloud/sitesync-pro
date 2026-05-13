import { NextRequest, NextResponse } from 'next/server'
import { answerSiteQuestion } from '@/lib/assistant/knowledge'
import { getClientIp } from '@/lib/request'
import { checkRateLimit, tooManyRequests } from '@/lib/rateLimit'
import { captureAppException } from '@/lib/monitoring/sentry'

export async function POST(request: NextRequest) {
  const rate = await checkRateLimit({
    key: `assistant:${getClientIp(request)}`,
    limit: 60,
    windowSeconds: 60 * 60,
    route: '/api/assistant',
  })
  if (!rate.allowed) {
    const limited = tooManyRequests(rate.resetAt)
    return NextResponse.json(limited.body, limited.init)
  }

  const body = await request.json().catch(() => null)
  const message = String(body?.message || '').slice(0, 800)

  try {
    return NextResponse.json(answerSiteQuestion(message))
  } catch (error) {
    captureAppException(error, { route: '/api/assistant' })
    return NextResponse.json({
      answer: 'I had trouble answering that. Try asking about quotes, swap requests, billing, tracking, or onboarding.',
      links: [{ label: 'Dashboard', href: '/dashboard' }],
    })
  }
}
