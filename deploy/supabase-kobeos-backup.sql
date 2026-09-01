-- KobeOS / Lala independent Supabase emergency layer.
-- Applied to project erimnjgpawuxesonkeoz (KobeOS Backup).

create extension if not exists pgcrypto;
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.kobe_backup_snapshots (
  key text primary key,
  payload jsonb not null default '[]'::jsonb,
  synced_at timestamptz,
  source_url text,
  last_error text,
  updated_at timestamptz not null default now()
);

create table if not exists public.kobe_backup_passports (
  id uuid primary key default gen_random_uuid(),
  qr_token text not null unique,
  passport_number text not null unique,
  phone text not null,
  name text not null,
  email text not null default '',
  nationality text not null default '',
  preferences jsonb not null default '{}'::jsonb,
  privacy jsonb not null default '{"shareName":true,"sharePhone":true,"shareHistory":false}'::jsonb,
  primary_passport_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists kobe_backup_passports_phone_idx
  on public.kobe_backup_passports (phone);

create table if not exists public.kobe_backup_queue (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('BOOKING','ORDER','REVERSE_REQUEST')),
  dedupe_key text,
  passport_token text,
  payload jsonb not null,
  status text not null default 'PENDING'
    check (status in ('PENDING','RETRY','CONFIRMED','FAILED')),
  attempts integer not null default 0,
  primary_id text,
  primary_response jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create unique index if not exists kobe_backup_queue_dedupe_idx
  on public.kobe_backup_queue (kind, dedupe_key)
  where dedupe_key is not null;

alter table public.kobe_backup_snapshots enable row level security;
alter table public.kobe_backup_passports enable row level security;
alter table public.kobe_backup_queue enable row level security;

revoke all on public.kobe_backup_snapshots from anon, authenticated;
revoke all on public.kobe_backup_passports from anon, authenticated;
revoke all on public.kobe_backup_queue from anon, authenticated;

grant all on public.kobe_backup_snapshots to service_role;
grant all on public.kobe_backup_passports to service_role;
grant all on public.kobe_backup_queue to service_role;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'kobeos_lala_backup_maintenance'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end $$;

select cron.schedule(
  'kobeos_lala_backup_maintenance',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://erimnjgpawuxesonkeoz.supabase.co/functions/v1/kobeos-backup/maintenance',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $cron$
);
