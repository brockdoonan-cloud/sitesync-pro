# Migration Idempotency Audit

Audit command:

```bash
rg -n "create table(?! if not exists)|create index(?! if not exists)|alter table .* add column(?! if not exists)|insert into .*values" supabase/migrations --pcre2
```

Result: no unsafe matches in the current migration folder.

Current pending production migrations:

- `supabase/migrations/0016_profile_sheet_file_types.sql`
- `supabase/migrations/0017_prelaunch_hardening.sql`

Codex attempted to apply the pending SQL directly, but the direct Supabase Postgres hostname `db.odviemgfhdmskhvdgjvy.supabase.co` did not resolve from this runtime, even with elevated execution. Apply these two files in Supabase SQL Editor before production OCR/profile-sheet/driver-photo features are exercised.

Manual SQL Editor URL:

`https://supabase.com/dashboard/project/odviemgfhdmskhvdgjvy/sql/new`
