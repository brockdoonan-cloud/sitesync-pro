# Production Migration Catch-Up

Date: 2026-05-15

Supabase project: `odviemgfhdmskhvdgjvy`

## Access Note

This Codex runtime does not expose a Supabase MCP tool. The catch-up plan below is based on the production object list supplied from Supabase MCP/dashboard checks plus local inspection of every migration in `supabase/migrations`.

## Production-Confirmed Missing

- `public.customer_profile_sheets`
- `public.profile_sheet_billing_runs`
- Storage bucket `profile-sheets`
- `public.site_doctor_slowest_queries()`

Because `customer_profile_sheets` and `profile_sheet_billing_runs` are created by `0014_profile_sheet_billing.sql`, the migration backlog must start at `0014`. Migrations `0015`, `0016`, and parts of `0017` depend on those objects.

## Applied / Structurally Present

Based on the production tables/functions the app already uses, migrations `0001` through `0013` are treated as already applied or already backfilled by the 2026-05-15 MCP repairs. The catch-up SQL does not re-run those full migrations.

Known production-present objects include:

- `clients`
- `jobs`
- `equipment`
- `service_requests`
- `profiles`
- `organizations`
- `organization_members`
- `route_stops`
- `billing_events`
- `pricing_profiles`
- `quote_requests`
- `quote_responses`
- `truck_locations`
- truck tracking import/integration objects from the 0009 migration family

## Partially Applied

- `0017_prelaunch_hardening.sql`
  - Some customer portal/security/performance hardening was applied manually via MCP on 2026-05-15.
  - The production check still shows `public.site_doctor_slowest_queries()` missing.
  - `0017` also depends on `0014` objects for the `import_source` columns, so those pieces are included in the catch-up.

## Not Applied / Included In Catch-Up

- `0014_profile_sheet_billing.sql`
  - Creates `profile-sheets` storage bucket.
  - Creates `customer_profile_sheets`.
  - Creates `profile_sheet_billing_runs`.
  - Links `pricing_profiles.profile_sheet_id`.
  - Adds profile-sheet RLS and storage policies.

- `0015_job_profile_sheet_links.sql`
  - Adds profile sheet/job linking columns.
  - Adds `fee_settings`.
  - Adds job/profile sheet indexes and FKs.

- `0016_profile_sheet_file_types.sql`
  - Expands `profile-sheets` bucket MIME types for PDF, DOC/DOCX, XLSX, CSV, text, and common scan image formats.

- `0017_prelaunch_hardening.sql`
  - Adds import source columns.
  - Adds route stop GPS/status fields.
  - Adds billing event charge/photo fields.
  - Creates `stop-photos` bucket and storage policies.
  - Creates `site_doctor_slowest_queries()`.

- `0018_public_quote_rpc_rate_limit.sql`
  - Creates `api_rate_limits`.
  - Adds RPC-side rate-limit helpers.
  - Replaces `create_quote_request_with_matches(jsonb)` with a rate-limited version.

## One-Paste SQL

Run this file in Supabase SQL Editor:

`supabase/migrations/catch_up_production.sql`

It is wrapped in a single transaction. If any statement fails, Postgres rolls the whole catch-up back.

## Data Safety

The catch-up SQL is additive/idempotent:

- No `DROP TABLE`, `TRUNCATE`, or data-deleting statements.
- Existing rows for Atlantic Concrete Washout Inc, Titan America, Castle, WM, Baker, and all other production clients are preserved.
- Existing `service_requests`, `equipment`, routes, billing events, and quote data are not rewritten.
- The only data update is a safe backfill of `customer_profile_sheets.fee_settings` from its own `extracted_terms` JSON when the new table/column is empty.

