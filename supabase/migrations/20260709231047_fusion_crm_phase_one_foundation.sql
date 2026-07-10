create table if not exists public.crm_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  business_email text,
  business_phone text,
  website text,
  default_time_zone text not null default 'America/New_York',
  default_currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.crm_organizations (name, slug, website)
values ('Fusion Digital Dynamics LLC', 'fusion-digital-dynamics', 'https://fddynamics.com')
on conflict (slug) do nothing;

alter table public.crm_leads add column if not exists organization_id uuid references public.crm_organizations(id) on delete restrict;
alter table public.crm_clients add column if not exists organization_id uuid references public.crm_organizations(id) on delete restrict;
alter table public.crm_tasks add column if not exists organization_id uuid references public.crm_organizations(id) on delete restrict;

update public.crm_leads
set organization_id = (select id from public.crm_organizations where slug = 'fusion-digital-dynamics')
where organization_id is null;

update public.crm_clients
set organization_id = (select id from public.crm_organizations where slug = 'fusion-digital-dynamics')
where organization_id is null;

update public.crm_tasks
set organization_id = (select id from public.crm_organizations where slug = 'fusion-digital-dynamics')
where organization_id is null;

create table if not exists public.crm_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text not null,
  status text not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.crm_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.crm_organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.crm_permissions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  description text not null
);

create table if not exists public.crm_role_permissions (
  role_id uuid not null references public.crm_roles(id) on delete cascade,
  permission_id uuid not null references public.crm_permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.crm_member_roles (
  member_id uuid not null references public.crm_organization_members(id) on delete cascade,
  role_id uuid not null references public.crm_roles(id) on delete cascade,
  primary key (member_id, role_id)
);

create table if not exists public.crm_companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  company_name text not null,
  legal_name text,
  industry text,
  company_size text,
  website text,
  main_phone text,
  general_email text,
  lifecycle_status text not null default 'prospect',
  lead_source text,
  tags text[] not null default '{}',
  description text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  company_id uuid references public.crm_companies(id) on delete set null,
  first_name text not null,
  last_name text,
  display_name text not null,
  email text,
  normalized_email text,
  phone text,
  normalized_phone text,
  job_title text,
  website text,
  preferred_contact_method text,
  contact_type text not null default 'prospect',
  lifecycle_status text not null default 'new',
  lead_source text,
  tags text[] not null default '{}',
  description text,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.crm_company_contacts (
  company_id uuid not null references public.crm_companies(id) on delete cascade,
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  relationship text not null default 'contact',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (company_id, contact_id)
);

create table if not exists public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  name text not null,
  stage_order integer not null,
  probability integer not null default 0 check (probability >= 0 and probability <= 100),
  is_won boolean not null default false,
  is_lost boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (pipeline_id, stage_order),
  unique (pipeline_id, name)
);

create table if not exists public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  pipeline_id uuid references public.crm_pipelines(id) on delete set null,
  stage_id uuid references public.crm_pipeline_stages(id) on delete set null,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  company_id uuid references public.crm_companies(id) on delete set null,
  original_lead_id uuid references public.crm_leads(id) on delete set null,
  deal_title text not null,
  service text,
  value integer not null default 0 check (value >= 0),
  probability integer not null default 25 check (probability >= 0 and probability <= 100),
  expected_close_date date,
  actual_close_date date,
  priority text not null default 'normal',
  status text not null default 'open',
  description text,
  won_reason text,
  lost_reason text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.crm_tasks add column if not exists description text;
alter table public.crm_tasks add column if not exists task_type text not null default 'Follow-Up';
alter table public.crm_tasks add column if not exists assigned_user_id uuid references auth.users(id) on delete set null;
alter table public.crm_tasks add column if not exists contact_id uuid references public.crm_contacts(id) on delete set null;
alter table public.crm_tasks add column if not exists company_id uuid references public.crm_companies(id) on delete set null;
alter table public.crm_tasks add column if not exists deal_id uuid references public.crm_deals(id) on delete set null;
alter table public.crm_tasks add column if not exists completed_at timestamptz;
alter table public.crm_tasks add column if not exists deleted_at timestamptz;

create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  body text not null,
  is_pinned boolean not null default false,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.crm_organizations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  event text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  entity_type text not null,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  sort jsonb not null default '{}'::jsonb,
  columns jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_app_settings (
  organization_id uuid primary key references public.crm_organizations(id) on delete cascade,
  lead_statuses text[] not null default array['New','Contacted','Discovery Scheduled','Qualified','Unqualified','Nurture','Converted','Lost'],
  lead_sources text[] not null default array['Website','Referral','Social','Outbound','Paid Ads','Existing Client'],
  task_types text[] not null default array['Call','Email','Meeting','Follow-Up','Discovery Call','Send Proposal','Request Content','Review','Payment Follow-Up','General Task'],
  lost_reasons text[] not null default array['Price','Timing','No Response','Not a Fit','Chose Competitor'],
  updated_at timestamptz not null default now()
);

insert into public.crm_app_settings (organization_id)
select id from public.crm_organizations where slug = 'fusion-digital-dynamics'
on conflict (organization_id) do nothing;

insert into public.crm_pipelines (organization_id, name, is_default)
select id, 'Default Sales Pipeline', true from public.crm_organizations where slug = 'fusion-digital-dynamics'
on conflict (organization_id, name) do nothing;

insert into public.crm_pipeline_stages (organization_id, pipeline_id, name, stage_order, probability, is_won, is_lost)
select p.organization_id, p.id, stage.name, stage.stage_order, stage.probability, stage.is_won, stage.is_lost
from public.crm_pipelines p
cross join (
  values
    ('New Opportunity', 1, 10, false, false),
    ('Discovery Scheduled', 2, 25, false, false),
    ('Qualified', 3, 40, false, false),
    ('Proposal Needed', 4, 55, false, false),
    ('Proposal Sent', 5, 70, false, false),
    ('Negotiation', 6, 85, false, false),
    ('Won', 7, 100, true, false),
    ('Lost', 8, 0, false, true)
) as stage(name, stage_order, probability, is_won, is_lost)
where p.name = 'Default Sales Pipeline'
on conflict (pipeline_id, stage_order) do nothing;

insert into public.crm_permissions (slug, description)
values
  ('crm.view', 'View CRM records'),
  ('crm.create', 'Create CRM records'),
  ('crm.update', 'Update CRM records'),
  ('crm.delete', 'Soft-delete CRM records'),
  ('settings.manage', 'Manage CRM settings'),
  ('users.manage', 'Manage CRM users')
on conflict (slug) do nothing;

insert into public.crm_roles (organization_id, name, slug, description, is_system)
select id, role_name, role_slug, role_description, true
from public.crm_organizations
cross join (
  values
    ('Organization Owner', 'owner', 'Full access to all organization data and settings'),
    ('Administrator', 'administrator', 'Full operational CRM access'),
    ('Sales Manager', 'sales-manager', 'Manage sales CRM records and team pipeline'),
    ('Sales Representative', 'sales-representative', 'Manage assigned sales work'),
    ('Project Manager', 'project-manager', 'Manage project handoff tasks and client context'),
    ('Team Member', 'team-member', 'Limited assigned work access'),
    ('Read-Only User', 'read-only', 'View authorized records only')
) as defaults(role_name, role_slug, role_description)
where slug = 'fusion-digital-dynamics'
on conflict (organization_id, slug) do nothing;

create index if not exists crm_leads_org_status_idx on public.crm_leads (organization_id, status, created_at desc);
create index if not exists crm_clients_org_email_idx on public.crm_clients (organization_id, customer_email);
create index if not exists crm_tasks_org_due_idx on public.crm_tasks (organization_id, status, due_at);
create index if not exists crm_contacts_org_email_idx on public.crm_contacts (organization_id, normalized_email);
create index if not exists crm_contacts_org_followup_idx on public.crm_contacts (organization_id, next_follow_up_at);
create index if not exists crm_companies_org_name_idx on public.crm_companies (organization_id, company_name);
create unique index if not exists crm_companies_org_name_key on public.crm_companies (organization_id, company_name);
create index if not exists crm_deals_org_stage_idx on public.crm_deals (organization_id, stage_id, status);
create index if not exists crm_notes_org_entity_idx on public.crm_notes (organization_id, entity_type, entity_id, created_at desc);
create index if not exists crm_activities_org_created_idx on public.crm_activities (organization_id, created_at desc);
create index if not exists crm_notifications_user_read_idx on public.crm_notifications (user_id, read_at, created_at desc);

alter table public.crm_organizations enable row level security;
alter table public.crm_profiles enable row level security;
alter table public.crm_organization_members enable row level security;
alter table public.crm_roles enable row level security;
alter table public.crm_permissions enable row level security;
alter table public.crm_role_permissions enable row level security;
alter table public.crm_member_roles enable row level security;
alter table public.crm_companies enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_company_contacts enable row level security;
alter table public.crm_pipelines enable row level security;
alter table public.crm_pipeline_stages enable row level security;
alter table public.crm_deals enable row level security;
alter table public.crm_notes enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_audit_logs enable row level security;
alter table public.crm_notifications enable row level security;
alter table public.crm_saved_views enable row level security;
alter table public.crm_app_settings enable row level security;

grant select, insert, update, delete on all tables in schema public to service_role;
