import 'server-only'
import { captureRateLimitHit } from '@/lib/monitoring/sentry'

type RateLimitInput = {
  key: string
  limit: number
  windowSeconds: number
  route: string
  userId?: string | null
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

const memoryBuckets = new Map<string, { count: number; resetAt: number }>()

async function upstashCommand(command: unknown[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  })

  if (!response.ok) return null
  return response.json() as Promise<{ result?: unknown }>
}

export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const now = Date.now()
  const resetAt = now + input.windowSeconds * 1000
  const redisKey = `rl:${input.key}`
  const incr = await upstashCommand(['INCR', redisKey])

  const redisCount = Number(incr?.result)
  if (Number.isFinite(redisCount) && redisCount > 0) {
    const count = redisCount
    if (count === 1) await upstashCommand(['EXPIRE', redisKey, input.windowSeconds])
    const allowed = count <= input.limit
    if (!allowed) {
      captureRateLimitHit({ key: input.key, limit: input.limit, windowSeconds: input.windowSeconds, route: input.route, userId: input.userId })
    }
    return { allowed, remaining: Math.max(0, input.limit - count), resetAt }
  }

  const current = memoryBuckets.get(input.key)
  if (!current || current.resetAt <= now) {
    memoryBuckets.set(input.key, { count: 1, resetAt })
    return { allowed: true, remaining: input.limit - 1, resetAt }
  }

  current.count++
  const allowed = current.count <= input.limit
  if (!allowed) {
    captureRateLimitHit({ key: input.key, limit: input.limit, windowSeconds: input.windowSeconds, route: input.route, userId: input.userId })
  }

  return {
    allowed,
    remaining: Math.max(0, input.limit - current.count),
    resetAt: current.resetAt,
  }
}

export function tooManyRequests(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return {
    body: { error: 'Too many requests. Please try again later.' },
    init: {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    },
  }
}
