# SiteSync Pro Operations Runbook

## Backup Status

Supabase Free projects do not include daily automated backups. Supabase Pro includes daily automated backups and point-in-time recovery options depending on configuration.

TODO before launch: upgrade the production Supabase project to Pro and confirm daily backups are enabled before onboarding paying operators.

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
- `SENTRY_AUTH_TOKEN` for source map uploads
- `SENTRY_ORG` for source map uploads and future admin error panels
- `SENTRY_PROJECT` for source map uploads and future admin error panels
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

## Pre-Onboarding Checklist

Before importing a new operator with hundreds of trucks or thousands of containers:

1. Export a fresh backup.
2. Confirm migrations are applied in order.
3. Confirm `/api/health` is `ok`.
4. Import one file in preview and review warnings.
5. Import the full file.
6. Confirm equipment counts, jobsite map pins, service request counts, billing trace entries, and audit log entries.

## Dependency Security Notes

`next` was upgraded to the patched `14.2.35` line in Phase 2. `npm audit` still reports advisories that require a major Next upgrade to fully clear. Treat a Next 15/16 upgrade as a separate compatibility project because it can affect routing, server components, middleware, and Sentry instrumentation.

`xlsx` is used for operator-uploaded Excel imports and currently has upstream advisories with no safe drop-in patch from npm audit. Phase 2 adds file type and 25 MB size validation, but before self-serve public imports you should replace `xlsx` with a maintained parser or move parsing into a sandboxed server job.
