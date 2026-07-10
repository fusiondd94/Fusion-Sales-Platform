insert into public.crm_permissions (slug, description)
values
  ('services.view', 'View service catalog records'),
  ('services.create', 'Create service catalog records'),
  ('services.update', 'Update service catalog records'),
  ('services.delete', 'Archive service catalog records'),
  ('services.restore', 'Restore archived service catalog records'),
  ('services.manage_pricing', 'Manage service catalog pricing'),
  ('services.manage_costs', 'Manage service internal costs'),
  ('proposals.view', 'View assigned proposals'),
  ('proposals.view_all', 'View all organization proposals'),
  ('proposals.create', 'Create proposals'),
  ('proposals.update', 'Update proposals'),
  ('proposals.send', 'Mark proposals as sent'),
  ('proposals.accept', 'Accept proposals internally'),
  ('proposals.decline', 'Decline proposals'),
  ('proposals.delete', 'Archive proposals'),
  ('proposals.restore', 'Restore archived proposals'),
  ('proposals.export', 'Export proposals'),
  ('proposals.manage_templates', 'Manage proposal templates'),
  ('proposals.view_internal_costs', 'View proposal internal costs'),
  ('deals.view_values', 'View deal financial values'),
  ('deals.update_values', 'Update deal financial values'),
  ('deals.view_costs', 'View deal costs'),
  ('deals.view_profit', 'View deal profit and margin'),
  ('deals.manage_discounts', 'Manage deal discounts'),
  ('lead_sources.view', 'View lead sources'),
  ('lead_sources.manage', 'Manage lead sources'),
  ('lead_sources.view_attribution', 'View lead attribution'),
  ('calendar.view_own', 'View own calendar'),
  ('calendar.view_team', 'View team calendar'),
  ('calendar.create', 'Create appointments'),
  ('calendar.update', 'Update appointments'),
  ('calendar.delete', 'Archive appointments'),
  ('calendar.manage_types', 'Manage appointment types'),
  ('email_templates.view', 'View email templates'),
  ('email_templates.create', 'Create email templates'),
  ('email_templates.update', 'Update email templates'),
  ('email_templates.delete', 'Archive email templates'),
  ('email_templates.manage_shared', 'Manage shared email templates'),
  ('email_templates.send_test', 'Send test email templates'),
  ('forms.view', 'View CRM forms'),
  ('forms.create', 'Create CRM forms'),
  ('forms.update', 'Update CRM forms'),
  ('forms.publish', 'Publish CRM forms'),
  ('forms.delete', 'Archive CRM forms'),
  ('forms.view_submissions', 'View form submissions'),
  ('forms.export_submissions', 'Export form submissions'),
  ('forms.manage_automation', 'Manage form automation'),
  ('reports.view_sales', 'View sales reports'),
  ('reports.view_lead_sources', 'View lead source reports'),
  ('reports.view_revenue', 'View revenue reports'),
  ('reports.view_team', 'View team reports'),
  ('reports.export', 'Export reports')
on conflict (slug) do nothing;

alter table public.crm_deals add column if not exists currency text not null default 'USD';
alter table public.crm_deals add column if not exists one_time_value integer not null default 0 check (one_time_value >= 0);
alter table public.crm_deals add column if not exists monthly_recurring_value integer not null default 0 check (monthly_recurring_value >= 0);
alter table public.crm_deals add column if not exists annual_recurring_value integer not null default 0 check (annual_recurring_value >= 0);
alter table public.crm_deals add column if not exists setup_fee integer not null default 0 check (setup_fee >= 0);
alter table public.crm_deals add column if not exists discount_total integer not null default 0 check (discount_total >= 0);
alter table public.crm_deals add column if not exists estimated_internal_cost integer not null default 0 check (estimated_internal_cost >= 0);
alter table public.crm_deals add column if not exists estimated_gross_profit integer not null default 0;
alter table public.crm_deals add column if not exists estimated_gross_margin numeric(7,4) not null default 0;
alter table public.crm_deals add column if not exists weighted_one_time_value integer not null default 0;
alter table public.crm_deals add column if not exists weighted_recurring_value integer not null default 0;
alter table public.crm_deals add column if not exists contract_duration_months integer check (contract_duration_months is null or contract_duration_months > 0);
alter table public.crm_deals add column if not exists revenue_start_date date;
alter table public.crm_deals add column if not exists revenue_end_date date;
alter table public.crm_deals add column if not exists value_source text not null default 'manual';
alter table public.crm_deals add column if not exists manual_override_reason text;
alter table public.crm_deals add column if not exists last_value_calculated_at timestamptz;

alter table public.crm_leads add column if not exists original_lead_source_id uuid;
alter table public.crm_leads add column if not exists latest_lead_source_id uuid;
alter table public.crm_leads add column if not exists source_category text;
alter table public.crm_leads add column if not exists campaign text;
alter table public.crm_leads add column if not exists referrer_url text;
alter table public.crm_leads add column if not exists landing_page text;
alter table public.crm_leads add column if not exists utm_source text;
alter table public.crm_leads add column if not exists utm_medium text;
alter table public.crm_leads add column if not exists utm_campaign text;
alter table public.crm_leads add column if not exists utm_term text;
alter table public.crm_leads add column if not exists utm_content text;
alter table public.crm_leads add column if not exists first_touch_at timestamptz;
alter table public.crm_leads add column if not exists latest_touch_at timestamptz;
alter table public.crm_leads add column if not exists converted_at timestamptz;
alter table public.crm_leads add column if not exists attribution_notes text;

create table if not exists public.crm_service_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, slug)
);

create table if not exists public.crm_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  category_id uuid references public.crm_service_categories(id) on delete set null,
  service_name text not null,
  sku text not null,
  slug text not null,
  short_description text,
  full_description text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  billing_type text not null default 'one_time' check (billing_type in ('one_time','recurring','usage_based','custom_quote')),
  pricing_model text not null default 'fixed_price' check (pricing_model in ('fixed_price','starting_at','price_range','per_unit','hourly','custom_quote')),
  base_price integer not null default 0 check (base_price >= 0),
  minimum_price integer check (minimum_price is null or minimum_price >= 0),
  maximum_price integer check (maximum_price is null or maximum_price >= 0),
  internal_estimated_cost integer not null default 0 check (internal_estimated_cost >= 0),
  default_quantity integer not null default 1 check (default_quantity > 0),
  is_taxable boolean not null default false,
  estimated_delivery_duration integer check (estimated_delivery_duration is null or estimated_delivery_duration >= 0),
  delivery_duration_unit text not null default 'days',
  recurring_interval text check (recurring_interval in ('monthly','quarterly','semiannual','annual','custom')),
  setup_fee integer not null default 0 check (setup_fee >= 0),
  discount_eligible boolean not null default true,
  display_order integer not null default 0,
  public_visibility boolean not null default true,
  internal_notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, sku),
  unique (organization_id, slug)
);

create table if not exists public.crm_proposal_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  template_name text not null,
  description text,
  sections jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, template_name)
);

create table if not exists public.crm_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  proposal_number text not null,
  proposal_title text not null,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  company_id uuid references public.crm_companies(id) on delete set null,
  lead_id uuid references public.crm_leads(id) on delete set null,
  deal_id uuid references public.crm_deals(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  template_id uuid references public.crm_proposal_templates(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','ready_for_review','sent','viewed','accepted','declined','expired','revised','cancelled')),
  currency text not null default 'USD',
  issue_date date not null default current_date,
  expiration_date date,
  executive_summary text,
  scope_of_work text,
  payment_terms text,
  internal_notes text,
  client_notes text,
  subtotal integer not null default 0,
  discount_type text not null default 'none' check (discount_type in ('none','fixed','percent')),
  discount_value integer not null default 0 check (discount_value >= 0),
  discount_total integer not null default 0 check (discount_total >= 0),
  tax_total integer not null default 0 check (tax_total >= 0),
  grand_total integer not null default 0 check (grand_total >= 0),
  recurring_monthly_total integer not null default 0 check (recurring_monthly_total >= 0),
  internal_estimated_cost integer not null default 0 check (internal_estimated_cost >= 0),
  estimated_gross_profit integer not null default 0,
  estimated_gross_margin numeric(7,4) not null default 0,
  accepted_at timestamptz,
  declined_at timestamptz,
  viewed_at timestamptz,
  sent_at timestamptz,
  revision_number integer not null default 1,
  parent_proposal_id uuid references public.crm_proposals(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, proposal_number)
);

create table if not exists public.crm_proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.crm_proposals(id) on delete cascade,
  service_id uuid references public.crm_services(id) on delete set null,
  item_name text not null,
  description text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price integer not null default 0 check (unit_price >= 0),
  internal_unit_cost integer not null default 0 check (internal_unit_cost >= 0),
  discount_type text not null default 'none' check (discount_type in ('none','fixed','percent')),
  discount_value integer not null default 0 check (discount_value >= 0),
  tax_rate_basis_points integer not null default 0 check (tax_rate_basis_points >= 0),
  line_subtotal integer not null default 0,
  line_discount integer not null default 0,
  line_tax integer not null default 0,
  line_total integer not null default 0,
  display_order integer not null default 0,
  billing_type text not null default 'one_time',
  recurring_interval text,
  is_optional boolean not null default false,
  is_selected boolean not null default true,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_lead_source_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.crm_lead_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  category_id uuid references public.crm_lead_source_categories(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  is_active boolean not null default true,
  is_paid boolean not null default false,
  default_channel text,
  supports_campaigns boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.crm_appointment_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  color text not null default '#004443',
  default_duration_minutes integer not null default 30 check (default_duration_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.crm_appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  appointment_type_id uuid references public.crm_appointment_types(id) on delete set null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_zone text not null default 'America/New_York',
  is_all_day boolean not null default false,
  location text,
  meeting_url text,
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','completed','cancelled','no_show','rescheduled')),
  assigned_user_id uuid references auth.users(id) on delete set null,
  external_attendees jsonb not null default '[]'::jsonb,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  company_id uuid references public.crm_companies(id) on delete set null,
  lead_id uuid references public.crm_leads(id) on delete set null,
  deal_id uuid references public.crm_deals(id) on delete set null,
  task_id uuid references public.crm_tasks(id) on delete set null,
  reminder_minutes integer not null default 30,
  cancellation_reason text,
  reschedule_history jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at > starts_at)
);

create table if not exists public.crm_email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  template_name text not null,
  subject text not null,
  body text not null,
  plain_text_body text,
  category text not null default 'General Sales',
  is_active boolean not null default true,
  visibility text not null default 'shared' check (visibility in ('private','shared')),
  owner_id uuid references auth.users(id) on delete set null,
  supported_variables text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, template_name)
);

create table if not exists public.crm_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  form_name text not null,
  form_slug text not null,
  form_type text not null default 'Lead Inquiry',
  description text,
  is_active boolean not null default true,
  is_published boolean not null default false,
  is_public boolean not null default true,
  success_message text not null default 'Thanks. Fusion Digital Dynamics received your request.',
  redirect_url text,
  lead_source_id uuid references public.crm_lead_sources(id) on delete set null,
  default_owner_id uuid references auth.users(id) on delete set null,
  duplicate_handling text not null default 'create_new_lead',
  spam_protection jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, form_slug)
);

create table if not exists public.crm_form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.crm_forms(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type text not null,
  placeholder text,
  help_text text,
  is_required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  validation_rules jsonb not null default '{}'::jsonb,
  crm_field_mapping text,
  display_order integer not null default 0,
  is_hidden boolean not null default false,
  default_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_id, field_key)
);

create table if not exists public.crm_form_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  form_id uuid not null references public.crm_forms(id) on delete cascade,
  status text not null default 'received',
  submitted_values jsonb not null default '{}'::jsonb,
  request_metadata jsonb not null default '{}'::jsonb,
  spam_state text not null default 'unchecked',
  processing_state text not null default 'pending',
  error_summary text,
  created_contact_id uuid references public.crm_contacts(id) on delete set null,
  created_lead_id uuid references public.crm_leads(id) on delete set null,
  submitted_at timestamptz not null default now()
);

create table if not exists public.crm_report_saved_filters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  report_type text not null,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_services_org_category_idx on public.crm_services (organization_id, category_id, is_active, display_order);
create index if not exists crm_proposals_org_status_idx on public.crm_proposals (organization_id, status, created_at desc);
create index if not exists crm_proposal_items_proposal_idx on public.crm_proposal_items (proposal_id, display_order);
create index if not exists crm_appointments_org_range_idx on public.crm_appointments (organization_id, starts_at, ends_at, status);
create index if not exists crm_email_templates_org_category_idx on public.crm_email_templates (organization_id, category, is_active);
create index if not exists crm_forms_org_slug_idx on public.crm_forms (organization_id, form_slug, is_published);
create index if not exists crm_form_submissions_form_idx on public.crm_form_submissions (form_id, submitted_at desc);
create index if not exists crm_lead_sources_org_category_idx on public.crm_lead_sources (organization_id, category_id, is_active);
create index if not exists crm_deals_org_financial_idx on public.crm_deals (organization_id, status, expected_close_date);

alter table public.crm_service_categories enable row level security;
alter table public.crm_services enable row level security;
alter table public.crm_proposal_templates enable row level security;
alter table public.crm_proposals enable row level security;
alter table public.crm_proposal_items enable row level security;
alter table public.crm_lead_source_categories enable row level security;
alter table public.crm_lead_sources enable row level security;
alter table public.crm_appointment_types enable row level security;
alter table public.crm_appointments enable row level security;
alter table public.crm_email_templates enable row level security;
alter table public.crm_forms enable row level security;
alter table public.crm_form_fields enable row level security;
alter table public.crm_form_submissions enable row level security;
alter table public.crm_report_saved_filters enable row level security;

grant select, insert, update, delete on
  public.crm_service_categories,
  public.crm_services,
  public.crm_proposal_templates,
  public.crm_proposals,
  public.crm_proposal_items,
  public.crm_lead_source_categories,
  public.crm_lead_sources,
  public.crm_appointment_types,
  public.crm_appointments,
  public.crm_email_templates,
  public.crm_forms,
  public.crm_form_fields,
  public.crm_form_submissions,
  public.crm_report_saved_filters
to service_role;

with org as (
  select id from public.crm_organizations where slug = 'fusion-digital-dynamics'
)
insert into public.crm_service_categories (organization_id, name, slug, display_order)
select org.id, category.name, category.slug, category.display_order
from org
cross join (
  values
    ('Website Design', 'website-design', 1),
    ('Website Development', 'website-development', 2),
    ('E-Commerce', 'e-commerce', 3),
    ('Hosting', 'hosting', 4),
    ('Domains', 'domains', 5),
    ('SSL', 'ssl', 6),
    ('SEO', 'seo', 7),
    ('Maintenance', 'maintenance', 8),
    ('Content Creation', 'content-creation', 9),
    ('Branding', 'branding', 10),
    ('AI Integration', 'ai-integration', 11),
    ('Custom Development', 'custom-development', 12),
    ('Add-Ons', 'add-ons', 13)
) as category(name, slug, display_order)
on conflict (organization_id, slug) do nothing;

with org as (
  select id from public.crm_organizations where slug = 'fusion-digital-dynamics'
),
categories as (
  select id, slug from public.crm_service_categories where organization_id = (select id from org)
)
insert into public.crm_services (organization_id, category_id, service_name, sku, slug, short_description, billing_type, pricing_model, base_price, minimum_price, maximum_price, internal_estimated_cost, setup_fee, recurring_interval, display_order)
select org.id, categories.id, service.name, service.sku, service.slug, service.description, service.billing_type, service.pricing_model, service.base_price, service.minimum_price, service.maximum_price, service.cost, service.setup_fee, service.interval, service.display_order
from org
cross join (
  values
    ('template-customization', 'Template Customization', 'FDD-TEMPLATE', 'website-design', 'Customize a proven website template for a fast polished launch.', 'one_time', 'fixed_price', 750, 500, 1200, 250, 0, null, 1),
    ('custom-website-design', 'Custom Website Design', 'FDD-CUSTOM-SITE', 'website-design', 'Custom responsive website design for service businesses.', 'one_time', 'starting_at', 1800, 1200, 5000, 650, 0, null, 2),
    ('custom-website-content', 'Custom Website Design + Content Creation', 'FDD-SITE-CONTENT', 'content-creation', 'Website design bundled with page copy and content structure.', 'one_time', 'starting_at', 2600, 1800, 6500, 950, 0, null, 3),
    ('ecommerce-starter', 'E-Commerce Starter Bundle', 'FDD-COMMERCE', 'e-commerce', 'Storefront, product structure, checkout readiness, and launch QA.', 'one_time', 'starting_at', 3200, 2400, 8500, 1350, 0, null, 4),
    ('logo-design', 'Logo Design', 'FDD-LOGO', 'branding', 'Professional logo concept and brand lockup.', 'one_time', 'fixed_price', 450, 350, 900, 120, 0, null, 5),
    ('seo-services', 'SEO Services', 'FDD-SEO', 'seo', 'Technical SEO, metadata, sitemap, and search visibility setup.', 'recurring', 'starting_at', 350, 250, 1500, 125, 0, 'monthly', 6),
    ('website-maintenance', 'Website Maintenance', 'FDD-MAINT', 'maintenance', 'Managed updates, uptime monitoring, and monthly support.', 'recurring', 'fixed_price', 149, 89, 499, 45, 0, 'monthly', 7),
    ('hosting', 'Hosting', 'FDD-HOST', 'hosting', 'Managed hosting package for Fusion-built websites.', 'recurring', 'fixed_price', 89, 49, 299, 25, 0, 'monthly', 8),
    ('domain-registration', 'Domain Registration', 'FDD-DOMAIN', 'domains', 'Domain registration and DNS connection support.', 'recurring', 'fixed_price', 25, 15, 75, 12, 0, 'annual', 9),
    ('ssl', 'SSL', 'FDD-SSL', 'ssl', 'SSL provisioning and renewal monitoring.', 'recurring', 'fixed_price', 20, 0, 99, 5, 0, 'monthly', 10),
    ('blog-content', 'Blog and Content Writing', 'FDD-BLOG', 'content-creation', 'SEO-aware blog and web content writing.', 'one_time', 'per_unit', 250, 150, 1000, 90, 0, null, 11),
    ('ai-integration', 'AI Integration', 'FDD-AI', 'ai-integration', 'AI workflow, chatbot, or automation integration for the website.', 'one_time', 'starting_at', 1500, 900, 7000, 550, 0, null, 12),
    ('custom-development', 'Custom Development', 'FDD-DEV', 'custom-development', 'Custom web application or integration work.', 'one_time', 'custom_quote', 0, 1000, null, 0, 0, null, 13)
) as service(slug, name, sku, category_slug, description, billing_type, pricing_model, base_price, minimum_price, maximum_price, cost, setup_fee, interval, display_order)
join categories on categories.slug = service.category_slug
on conflict (organization_id, slug) do nothing;

with org as (
  select id from public.crm_organizations where slug = 'fusion-digital-dynamics'
)
insert into public.crm_proposal_templates (organization_id, template_name, description, sections, is_default)
select org.id, 'Fusion Website Proposal', 'Default proposal structure for Fusion website services.', '{"introduction":"Thank you for considering Fusion Digital Dynamics.","scope":"A clear scope will be customized for the selected services.","terms":"Pricing is valid through the proposal expiration date."}'::jsonb, true
from org
on conflict (organization_id, template_name) do nothing;

with org as (
  select id from public.crm_organizations where slug = 'fusion-digital-dynamics'
)
insert into public.crm_appointment_types (organization_id, name, slug, color, default_duration_minutes)
select org.id, type.name, type.slug, type.color, type.duration
from org
cross join (
  values
    ('Discovery Call', 'discovery-call', '#004443', 30),
    ('Consultation', 'consultation', '#36454f', 45),
    ('Proposal Review', 'proposal-review', '#d3a939', 30),
    ('Project Kickoff', 'project-kickoff', '#004443', 60),
    ('Sales Follow-Up', 'sales-follow-up', '#36454f', 20)
) as type(name, slug, color, duration)
on conflict (organization_id, slug) do nothing;

with org as (
  select id from public.crm_organizations where slug = 'fusion-digital-dynamics'
)
insert into public.crm_lead_source_categories (organization_id, name, slug, display_order)
select org.id, source.name, source.slug, source.display_order
from org
cross join (
  values
    ('Website', 'website', 1),
    ('Referral', 'referral', 2),
    ('Organic Search', 'organic-search', 3),
    ('Paid Search', 'paid-search', 4),
    ('Social Media', 'social-media', 5),
    ('Fiverr', 'fiverr', 6),
    ('Marketplace', 'marketplace', 7),
    ('Manual Entry', 'manual-entry', 8),
    ('Other', 'other', 9)
) as source(name, slug, display_order)
on conflict (organization_id, slug) do nothing;

with org as (
  select id from public.crm_organizations where slug = 'fusion-digital-dynamics'
),
categories as (
  select id, slug from public.crm_lead_source_categories where organization_id = (select id from org)
)
insert into public.crm_lead_sources (organization_id, category_id, name, slug, description, is_paid, default_channel, display_order)
select org.id, categories.id, source.name, source.slug, source.description, source.is_paid, source.channel, source.display_order
from org
cross join (
  values
    ('Fusion Website', 'fusion-website', 'website', 'Lead from the Fusion website or hosted CRM form.', false, 'Website', 1),
    ('Referral Partner', 'referral-partner', 'referral', 'Referral from a partner or existing contact.', false, 'Referral', 2),
    ('Google Search', 'google-search', 'organic-search', 'Organic search visitor.', false, 'SEO', 3),
    ('Paid Campaign', 'paid-campaign', 'paid-search', 'Paid search or social campaign.', true, 'Paid Ads', 4),
    ('Fiverr', 'fiverr', 'fiverr', 'Fiverr marketplace opportunity.', true, 'Marketplace', 5),
    ('Manual Entry', 'manual-entry', 'manual-entry', 'Manually entered lead or client.', false, 'Manual', 6)
) as source(name, slug, category_slug, description, is_paid, channel, display_order)
join categories on categories.slug = source.category_slug
on conflict (organization_id, slug) do nothing;

with org as (
  select id from public.crm_organizations where slug = 'fusion-digital-dynamics'
)
insert into public.crm_email_templates (organization_id, template_name, subject, body, plain_text_body, category, visibility, supported_variables)
select org.id, template.name, template.subject, template.body, template.plain, template.category, 'shared', template.variables
from org
cross join (
  values
    ('Lead Follow-Up', 'Thanks for reaching out, {{contact_full_name}}', 'Hi {{contact_first_name}},<br><br>Thanks for reaching out to {{organization_name}}. I would love to learn more about {{company_name}} and the website goals.', 'Hi {{contact_first_name}}, Thanks for reaching out to {{organization_name}}.', 'Lead Follow-Up', array['contact_first_name','contact_full_name','company_name','organization_name']),
    ('Proposal Sent', 'Your Fusion proposal is ready', 'Hi {{contact_first_name}},<br><br>Your proposal {{proposal_number}} is ready for review: {{proposal_link}}', 'Hi {{contact_first_name}}, your proposal {{proposal_number}} is ready: {{proposal_link}}', 'Proposal Sent', array['contact_first_name','proposal_number','proposal_link'])
) as template(name, subject, body, plain, category, variables)
on conflict (organization_id, template_name) do nothing;

with org as (
  select id from public.crm_organizations where slug = 'fusion-digital-dynamics'
),
source as (
  select id from public.crm_lead_sources where organization_id = (select id from org) and slug = 'fusion-website'
)
insert into public.crm_forms (organization_id, form_name, form_slug, form_type, description, is_published, lead_source_id)
select org.id, 'Website Project Intake', 'website-project-intake', 'Website Project Intake', 'Public intake form for website design prospects.', true, source.id
from org, source
on conflict (organization_id, form_slug) do nothing;

insert into public.crm_form_fields (form_id, field_key, label, field_type, is_required, crm_field_mapping, display_order)
select form.id, field.key, field.label, field.field_type, field.required, field.mapping, field.display_order
from public.crm_forms form
join public.crm_organizations org on org.id = form.organization_id and org.slug = 'fusion-digital-dynamics'
cross join (
  values
    ('name', 'Name', 'short_text', true, 'customer_name', 1),
    ('email', 'Email', 'email', true, 'customer_email', 2),
    ('phone', 'Phone', 'phone', false, 'customer_phone', 3),
    ('company', 'Company', 'short_text', true, 'company', 4),
    ('project_notes', 'Project Notes', 'long_text', false, 'project_notes', 5)
) as field(key, label, field_type, required, mapping, display_order)
where form.form_slug = 'website-project-intake'
on conflict (form_id, field_key) do nothing;
