create extension if not exists pgcrypto;

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  lead_code text not null unique,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  company text not null,
  website text,
  project_notes text,
  answers jsonb not null default '{}'::jsonb,
  recommendation jsonb not null default '{}'::jsonb,
  package_key text not null,
  package_name text not null,
  total_today integer not null default 0,
  monthly_due integer not null default 0,
  discount_percent integer not null default 0,
  status text not null default 'captured',
  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_subscription_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete set null,
  customer_email text not null,
  customer_name text not null,
  company text not null,
  status text not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  portal_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete cascade,
  client_id uuid references public.crm_clients(id) on delete cascade,
  title text not null,
  owner text not null default 'Fusion AI Team',
  status text not null default 'open',
  priority text not null default 'normal',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists crm_leads_email_idx on public.crm_leads (customer_email);
create index if not exists crm_leads_status_idx on public.crm_leads (status);
create index if not exists crm_clients_lead_id_idx on public.crm_clients (lead_id);
create index if not exists crm_clients_portal_user_id_idx on public.crm_clients (portal_user_id);
create index if not exists crm_tasks_lead_id_idx on public.crm_tasks (lead_id);
create index if not exists crm_tasks_client_id_idx on public.crm_tasks (client_id);
create index if not exists crm_tasks_status_due_idx on public.crm_tasks (status, due_at);

alter table public.crm_leads enable row level security;
alter table public.crm_clients enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.stripe_events enable row level security;

grant select, insert, update, delete on public.crm_leads to service_role;
grant select, insert, update, delete on public.crm_clients to service_role;
grant select, insert, update, delete on public.crm_tasks to service_role;
grant select, insert, update, delete on public.stripe_events to service_role;

grant usage, select on all sequences in schema public to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_leads'
      and policyname = 'crm leads are server managed'
  ) then
    create policy "crm leads are server managed"
    on public.crm_leads
    for all
    to authenticated
    using (false)
    with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_clients'
      and policyname = 'clients can read their own portal record'
  ) then
    create policy "clients can read their own portal record"
    on public.crm_clients
    for select
    to authenticated
    using ((select auth.uid()) = portal_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_tasks'
      and policyname = 'crm tasks are server managed'
  ) then
    create policy "crm tasks are server managed"
    on public.crm_tasks
    for all
    to authenticated
    using (false)
    with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stripe_events'
      and policyname = 'stripe events are server managed'
  ) then
    create policy "stripe events are server managed"
    on public.stripe_events
    for all
    to authenticated
    using (false)
    with check (false);
  end if;
end $$;
