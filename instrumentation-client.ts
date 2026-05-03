import * as Sentry from '@sentry/nextjs'
import { sentryEnvironment } from '@/lib/monitoring/sentry'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN),
  environment: sentryEnvironment(),
  tracesSampleRate: 0.1,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
