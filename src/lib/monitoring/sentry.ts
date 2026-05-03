import * as Sentry from '@sentry/nextjs'

type Context = {
  route?: string
  organizationId?: string | null
  role?: string | null
  userId?: string | null
  tags?: Record<string, string | number | boolean | null | undefined>
  extra?: Record<string, unknown>
}

export function sentryEnvironment() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'
}

export function setSentryUserContext(context: Context) {
  if (context.userId) Sentry.setUser({ id: context.userId })
  if (context.organizationId) Sentry.setTag('organization_id', context.organizationId)
  if (context.role) Sentry.setTag('role', context.role)
}

export function captureAppException(error: unknown, context: Context = {}) {
  Sentry.withScope(scope => {
    if (context.route) scope.setTag('route', context.route)
    if (context.organizationId) scope.setTag('organization_id', context.organizationId)
    if (context.role) scope.setTag('role', context.role)
    if (context.userId) scope.setUser({ id: context.userId })
    Object.entries(context.tags || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) scope.setTag(key, String(value))
    })
    Object.entries(context.extra || {}).forEach(([key, value]) => scope.setExtra(key, value))
    Sentry.captureException(error)
  })
}

export function captureRateLimitHit(context: Context & { key: string; limit: number; windowSeconds: number }) {
  Sentry.withScope(scope => {
    scope.setLevel('warning')
    scope.setTag('rate_limit_key', context.key)
    scope.setTag('rate_limit', String(context.limit))
    scope.setTag('rate_limit_window_seconds', String(context.windowSeconds))
    if (context.route) scope.setTag('route', context.route)
    if (context.userId) scope.setUser({ id: context.userId })
    Object.entries(context.extra || {}).forEach(([key, value]) => scope.setExtra(key, value))
    Sentry.captureMessage('Rate limit exceeded')
  })
}
