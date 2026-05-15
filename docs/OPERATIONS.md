# SiteSync Pro Operations Runbook

## Backup Status

Supabase Free projects do not include daily automated backups. Supabase Pro includes daily automated backups and point-in-time recovery options depending on configuration.

Launch requirement: upgrade the production Supabase project to Pro and confirm daily backups are enabled before onboarding paying operators.

Production project: `odviemgfhdmskhvdgjvy`.

## Required Runtime Secrets

- `CRON_SECRET`: random 32+ character string used to protect `/api/cron/run-billing`. Add it to Vercel Production and Preview before enabling the nightly billing cron.

Pre-hardening baseline snapshot:

- Status: dashboard action required
- Timestamp to record: after taking the snapshot in Supabase Dashboard > Database > Backups
- Reason: the Codex runtime could not reach Supabase's direct Postgres host from this network, so the baseline snapshot must be initiated in the Supabase dashboard.

## Manual Backup

Use `pg_dump` for a one-off export before large imports, schema migrations, or client onboarding:

```bash
pg_dump "postgresql://postgres:<password>@db.odviemgfhdmskhvdgjvy.supabase.co:5432/postgres" \
  --format=custom \
  --file=sitesync-pro-$(date +%Y-%m-%d).dump
```

For plain SQL:

```bash
pg_dump "postgresql://postgres:<password>@db.odviemgfhdmskhvdgjvy.supabase.co:5432/postgres" \
  --clean \
  --if-exists \
  --file=sitesync-pro-$(date +%Y-%m-%d).sql
```

Never commit database dumps to GitHub. Store them in a private, access-controlled backup location.

## Restore Procedure

1. Pause imports and operator changes.
2. In Supabase, open the production project.
3. Go to Database backups.
4. Select the newest clean restore point before the incident.
5. Restore into a temporary project first when possible.
6. Validate organizations, clients, equipment, jobsites, service requests, invoices, and audit logs.
7. If the temporary restore is clean, promote it or restore production from the snapshot.
8. Rotate exposed keys if the incident involved secrets.

## Restore Drill Log

Run this drill before first real operator onboarding:

1. Take a manual production snapshot.
2. Restore it to a scratch Supabase project.
3. Verify table counts for `clients`, `equipment`, `jobsites`, `service_requests`, `driver_routes`, `route_stops`, `billing_events`, `customer_profile_sheets`, and `audit_logs`.
4. Verify private storage buckets exist and note that database snapshots do not guarantee application-level validation of storage file contents.
5. Delete the scratch project after verification.
6. Record time-to-restore here.

Latest drill:

- Status: pending dashboard execution
- Time-to-restore: pending
- Scratch project: pending

Screenshot placeholders:

- Supabase backup list
- Restore confirmation screen
- Post-restore table-count verification

## Disaster Recovery

### Database Corruption

1. Stop new imports and high-volume writes.
2. Export the current damaged database for forensics.
3. Identify the last clean backup.
4. Restore to a temporary Supabase project.
5. Compare row counts for organizations, clients, jobsites, equipment, service_requests, invoices, and audit_logs.
6. Restore production or point Vercel to the recovered project.
7. Document the root cause and add a migration/test to prevent repeat damage.

### Vercel Down

1. Check Vercel status.
2. Check the latest deployment logs.
3. Roll back to the last green deployment if the outage followed a deploy.
4. Verify `/api/health`, `/quotes`, `/auth/login`, and `/dashboard`.

### Supabase Down

1. Check Supabase status.
2. Confirm `/api/health` reports database failure.
3. Do not retry imports while degraded.
4. Communicate that dashboards may be read-only or unavailable until Supabase recovers.

### Environment Variable Leaked

1. Rotate the leaked value immediately in Supabase, Quo, Resend, Sentry, or Upstash.
2. Update Vercel environment variables.
3. Redeploy production.
4. Review audit logs and provider logs for suspicious usage.
5. If `SUPABASE_SERVICE_ROLE_KEY` leaked, assume full database access was possible and investigate accordingly.

## Required Production Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `QUO_API_KEY`
- `QUO_FROM_NUMBER`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_API_TOKEN` or `SENTRY_AUTH_TOKEN` for source map uploads and alert-rule automation
- `SENTRY_ORG` for source map uploads, Site Doctor, and alert-rule automation
- `SENTRY_PROJECT` for source map uploads, Site Doctor, and alert-rule automation
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Health Checks

Use `/api/health` from BetterStack, UptimeRobot, or another monitor.

Expected healthy response:

```json
{
  "status": "ok",
  "timestamp": "2026-05-03T00:00:00.000Z",
  "checks": {
    "database": "ok",
    "auth": "ok"
  }
}
```

## Sentry Alerts

Sentry is wired through `@sentry/nextjs`, `instrumentation.ts`, `instrumentation-client.ts`, `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and the `withSentryConfig` wrapper in `next.config.js`.

After `NEXT_PUBLIC_SENTRY_DSN` is added and production redeploys, open `/sentry-debug` once. It intentionally throws `Sentry debug route test error`; confirm that issue appears in the Sentry project.

Create these rules in Sentry project `sitesync-pro/sitesync-pro`:

1. Event frequency: when more than 10 events occur in 1 minute in production, email `brock.doonan@gmail.com`.
2. New issue: when a new issue first appears in production, email `brock.doonan@gmail.com`.
3. Aging unresolved issue: when an issue remains unresolved for 24 hours and has more than 50 occurrences, email `brock.doonan@gmail.com`.

Alert-rule automation script:

```bash
SENTRY_API_TOKEN=<token> SENTRY_ORG=sitesync-pro SENTRY_PROJECT=sitesync-pro node scripts/create_sentry_alerts.mjs
```

The high-spike rule uses Sentry's metric-alert percentage comparison API: 900% higher than the prior hour is the closest API equivalent to "10x rolling hourly average." The unresolved-24h rule fires on the next error event for an issue older than 24 hours; Sentry's legacy issue-alert API is event-triggered, not a background scheduler.

The Site Doctor reads recent events through `SENTRY_API_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT`.

## Supabase Auth Password Protection

Enable leaked-password protection before onboarding real operators:

1. Open `https://supabase.com/dashboard/project/odviemgfhdmskhvdgjvy/auth/providers`
2. Open Password Provider.
3. Turn on "Leaked password protection".
4. Save changes.

This is a Supabase Auth dashboard toggle. It is not represented in the SQL migrations in this repo.

## Pending SQL Editor Backlog

If direct Postgres access is unavailable, apply these files manually in Supabase SQL Editor:

1. `supabase/migrations/0015_job_profile_sheet_links.sql`
2. `supabase/migrations/0016_profile_sheet_file_types.sql`
3. `supabase/migrations/0017_prelaunch_hardening.sql`
4. `supabase/migrations/0018_public_quote_rpc_rate_limit.sql`

SQL Editor:

`https://supabase.com/dashboard/project/odviemgfhdmskhvdgjvy/sql/new`

Each file is idempotent and records itself in `supabase_migrations.schema_migrations` when it finishes.

## Pre-Onboarding Checklist

Before importing a new operator with hundreds of trucks or thousands of containers:

1. Export a fresh backup.
2. Confirm migrations are applied in order.
3. Confirm `/api/health` is `ok`.
4. Import one file in preview and review warnings.
5. Import the full file.
6. Confirm equipment counts, jobsite map pins, service request counts, billing trace entries, and audit log entries.

## Dependency Security Notes

`next` is now on the 16.x line. Continue testing App Router, middleware, Sentry, and Supabase SSR behavior after every Next upgrade.

Excel profile sheet parsing uses `read-excel-file` for profile imports. Keep uploaded document parsing server-side, preserve file-size limits, and avoid exposing service-role keys or parsed private documents to client components.
