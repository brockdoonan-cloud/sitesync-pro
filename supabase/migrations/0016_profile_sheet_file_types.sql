-- Allow billing profile-sheet imports from PDFs, plain text, CSVs, and common image scans.

begin;

update storage.buckets
set
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/markdown',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
where id = 'profile-sheets';

do $$
declare
  has_name boolean;
  has_statements boolean;
begin
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    name text,
    statements text[]
  );

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
      and column_name = 'name'
  ) into has_name;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
      and column_name = 'statements'
  ) into has_statements;

  if has_name and has_statements then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3) on conflict (version) do nothing'
      using '0016', 'profile_sheet_file_types', array['manual SQL Editor apply'];
  elsif has_name then
    execute 'insert into supabase_migrations.schema_migrations (version, name) values ($1, $2) on conflict (version) do nothing'
      using '0016', 'profile_sheet_file_types';
  elsif has_statements then
    execute 'insert into supabase_migrations.schema_migrations (version, statements) values ($1, $2) on conflict (version) do nothing'
      using '0016', array['manual SQL Editor apply'];
  else
    execute 'insert into supabase_migrations.schema_migrations (version) values ($1) on conflict (version) do nothing'
      using '0016';
  end if;
end $$;

commit;
