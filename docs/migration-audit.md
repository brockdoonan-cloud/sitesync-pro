# Migration Idempotency Audit

Audit command:

```bash
rg -n "create table(?! if not exists)|create index(?! if not exists)|alter table .* add column(?! if not exists)|insert into .*values" supabase/migrations --pcre2
```

Result after this cleanup: no unsafe `CREATE TABLE`, `CREATE INDEX`, direct `ALTER TABLE ... ADD COLUMN`, or unguarded duplicate seed patterns remain in the current migration folder. Policy creation is guarded with `DROP POLICY IF EXISTS` before `CREATE POLICY`.

Current pending production migrations:

- `supabase/migrations/0015_job_profile_sheet_links.sql`
- `supabase/migrations/0016_profile_sheet_file_types.sql`
- `supabase/migrations/0017_prelaunch_hardening.sql`
- `supabase/migrations/0018_public_quote_rpc_rate_limit.sql`

Backlog contents:

- `0015_job_profile_sheet_links.sql`: does not create new tables; it links existing `jobs`, `customer_profile_sheets`, `profile_sheet_billing_runs`, and `pricing_profiles` through `job_id`, adds signed-profile-sheet references on jobs, creates related indexes, and backfills `fee_settings`.
- `0016_profile_sheet_file_types.sql`: does not create tables; it expands the private `profile-sheets` storage bucket MIME allow-list for PDF, DOC/DOCX, XLSX, TXT/CSV/Markdown, and image scans.
- `0017_prelaunch_hardening.sql`: adds import-source tracking, driver route-stop GPS/status columns, billing-event charge/photo columns, stop-photo storage bucket/policies, and the `site_doctor_slowest_queries()` RPC.
- `0018_public_quote_rpc_rate_limit.sql`: adds the public quote RPC rate limiter table/functions and wraps `create_quote_request_with_matches` with a 10 req/min per-IP guard.

Codex attempted to apply pending SQL directly, but the direct Supabase Postgres hostname `db.odviemgfhdmskhvdgjvy.supabase.co` did not resolve from this runtime, even with elevated execution. Apply the pending files in Supabase SQL Editor before production OCR/profile-sheet/driver-photo/RPC-rate-limit features are exercised.

Manual SQL Editor URL:

`https://supabase.com/dashboard/project/odviemgfhdmskhvdgjvy/sql/new`
