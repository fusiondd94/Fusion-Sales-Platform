alter table public.crm_app_settings add column if not exists logo_url text;
alter table public.crm_app_settings add column if not exists primary_color text not null default '#31d7ff';
alter table public.crm_app_settings add column if not exists accent_color text not null default '#f5b84b';

create table if not exists public.crm_service_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  package_key text not null,
  package_name text not null,
  description text,
  setup_price integer not null default 0 check (setup_price >= 0),
  monthly_price integer not null default 0 check (monthly_price >= 0),
  inclusions text[] not null default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, package_key)
);

insert into public.crm_service_packages (
  organization_id,
  package_key,
  package_name,
  description,
  setup_price,
  monthly_price,
  inclusions,
  sort_order
)
select
  org.id,
  package.package_key,
  package.package_name,
  package.description,
  package.setup_price,
  package.monthly_price,
  package.inclusions,
  package.sort_order
from public.crm_organizations org
cross join (
  values
    ('launch', 'Launch Foundation', 'A clean business website with domain, hosting, SSL, and launch support.', 900, 89, array['5-page responsive website','Domain connection','Managed hosting','SSL setup','Lead form','Basic analytics'], 1),
    ('growth', 'Growth Engine', 'A conversion-focused site built to turn visitors into booked conversations.', 1800, 149, array['8-page conversion site','Copy structure','CRM-ready lead capture','Managed hosting','Security monitoring','Professional email'], 2),
    ('commerce', 'Commerce Builder', 'An online store package with checkout, product structure, hosting, SSL, and support.', 2600, 229, array['E-commerce website','Product catalog setup','Payment-ready checkout','Security hardening','Managed hosting','Launch QA'], 3),
    ('authority', 'Authority Suite', 'A premium brand presence for service businesses that need trust immediately.', 3400, 299, array['Premium design system','Brand messaging','Portfolio/case-study sections','Marketing setup','Email and hosting','Ongoing optimization'], 4)
) as package(package_key, package_name, description, setup_price, monthly_price, inclusions, sort_order)
where org.slug = 'fusion-digital-dynamics'
on conflict (organization_id, package_key) do nothing;

create index if not exists crm_service_packages_org_sort_idx on public.crm_service_packages (organization_id, sort_order, package_key);

alter table public.crm_service_packages enable row level security;

grant select, insert, update, delete on public.crm_service_packages to service_role;
