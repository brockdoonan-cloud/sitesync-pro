import * as Sentry from '@sentry/nextjs'
import { sentryEnvironment } from '@/lib/monitoring/sentry'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: sentryEnvironment(),
  tracesSampleRate: 0.1,
})
