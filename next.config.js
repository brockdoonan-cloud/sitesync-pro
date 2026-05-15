const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ]
  },
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  org: process.env.SENTRY_ORG || 'sitesync-pro',
  project: process.env.SENTRY_PROJECT || 'sitesync-pro',
  authToken: process.env.SENTRY_AUTH_TOKEN || process.env.SENTRY_API_TOKEN,
  sourcemaps: {
    disable: !(process.env.SENTRY_AUTH_TOKEN || process.env.SENTRY_API_TOKEN),
  },
}, {
  disableLogger: true,
})
