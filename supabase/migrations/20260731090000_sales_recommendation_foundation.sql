-- Phase 1: AUDIT, DATA MODEL, AND BUSINESS-RULE FOUNDATION
-- Fusion intelligent website planning & sales system.
--
-- Design notes (see Phase 1 audit report for full context):
--  * Monetary columns are whole US dollars stored as integers, matching the
--    existing convention in crm_service_packages / crm_services / crm_proposals
--    (e.g. crm_service_packages.setup_price = 900 means $900, not $9.00).
--  * Pricing is NOT duplicated here. crm_service_packages (design packages)
--    and crm_services (add-ons / a-la-carte services) remain the single
--    source of truth for Fusion service pricing. Recommendation rows store a
--    reference (recommended_package_id) plus a point-in-time snapshot
--    (package_snapshot jsonb), mirroring the existing crm_proposal_items
--    snapshot pattern, so historical recommendations stay accurate even if
--    package prices change later.
--  * Portal products (domain, hosting, SSL, email, Microsoft 365, email
--    marketing, backups, security) are tracked separately in
--    sales_portal_products / sales_portal_product_selections and are NEVER
--    written to crm_service_packages, crm_services, or any Fusion invoice
--    line item. They exist purely for total-launch-cost transparency and are
--    purchased by the client directly at https://portal.fddynamics.com/.
--  * Discounts are opt-in and admin-authorized only: sales_discount_rules
--    rows default to is_active = false, and no discount rule is seeded as
--    active by this migration. Nothing in this schema allows a discount to
--    be invented or auto-applied.
--  * A purchase is only ever marked 'purchased' in
--    sales_portal_product_selections through a corresponding row in
--    sales_purchase_verifications (portal API sync, admin manual
--    verification, or client-submitted evidence pending admin review) -
--    never merely because a client clicked a portal link.
--  * Lead activity history reuses the existing crm_activities table via the
--    existing logActivity() helper; follow-up tasks reuse the existing
--    crm_tasks table (already has task_type/lead_id columns) rather than
--    duplicating either.
--  * Following repo convention: RLS is enabled with no policies added here,
--    consistent with 20260730120000_create_crm_content_calendar_tables.sql -
--    these tables are intended to be accessed exclusively via the
--    service-role Supabase client from server-side lib code, never via the
--    anon/authenticated client keys.

-- =========================================================================
-- 1. sales_business_rules - versioned, admin-controlled global rules
-- =========================================================================
create table if not exists sales_business_rules (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references crm_organizations(id) on delete cascade,
    rule_key text not null check (rule_key in (
      'minimum_total_budget',
      'minimum_design_allocation',
      'maximum_discount_percent',
      'deposit_required_percent',
      'sales_escalation_threshold',
      'tax_rate_percent',
      'tax_fee_disclaimer_text',
      'below_minimum_message'
    )),
    rule_value jsonb not null,
    version integer not null default 1,
    is_active boolean not null default true,
    effective_from timestamptz not null default now(),
    effective_until timestamptz,
    notes text,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
create index if not exists idx_sales_rules_org_key on sales_business_rules(organization_id, rule_key, is_active);
create unique index if not exists uq_sales_rules_org_key_version on sales_business_rules(organization_id, rule_key, version);
comment on table sales_business_rules is 'Versioned admin-controlled sales/pricing rules (e.g. $300 minimum budget). Never hard-code these values in application code.';

-- =========================================================================
-- 2. sales_discount_rules - explicit, admin-authorized discount rules only
-- =========================================================================
create table if not exists sales_discount_rules (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references crm_organizations(id) on delete cascade,
    rule_code text not null,
    rule_name text not null,
    description text,
    discount_type text not null check (discount_type in ('percent', 'fixed')),
    discount_value integer not null check (discount_value >= 0),
    max_discount_amount integer,
    requires_manual_approval boolean not null default true,
    eligibility_criteria jsonb not null default '{}'::jsonb,
    is_active boolean not null default false,
    version integer not null default 1,
    parent_rule_id uuid references sales_discount_rules(id) on delete set null,
    valid_from timestamptz not null default now(),
    valid_until timestamptz,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (organization_id, rule_code, version)
  );
create index if not exists idx_sales_discount_org on sales_discount_rules(organization_id, is_active);
comment on table sales_discount_rules is 'Admin-authorized discount definitions. is_active defaults to false - a discount only ever applies to a recommendation if an admin explicitly activates a rule here. The recommendation engine must never invent or auto-calculate a discount outside this table.';

-- =========================================================================
-- 3. sales_payment_plan_rules - admin-controlled payment plan options
-- =========================================================================
create table if not exists sales_payment_plan_rules (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references crm_organizations(id) on delete cascade,
    plan_code text not null,
    plan_name text not null,
    description text,
    deposit_percent integer not null check (deposit_percent between 0 and 100),
    number_of_installments integer not null check (number_of_installments >= 1),
    installment_interval text not null default 'monthly' check (installment_interval in ('weekly', 'biweekly', 'monthly')),
    minimum_eligible_total integer not null default 0,
    is_active boolean not null default true,
    version integer not null default 1,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (organization_id, plan_code, version)
  );
create index if not exists idx_sales_payment_plan_org on sales_payment_plan_rules(organization_id, is_active);

-- =========================================================================
-- 4. sales_portal_products - portal.fddynamics.com product catalog
-- (estimates only - never a Fusion invoice line item)
-- =========================================================================
create table if not exists sales_portal_products (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references crm_organizations(id) on delete cascade,
    product_key text not null,
    product_name text not null,
    category text not null check (category in ('domain', 'hosting', 'ssl', 'email', 'microsoft_365', 'email_marketing', 'backup', 'security', 'other')),
    description text,
    estimated_price integer not null check (estimated_price >= 0),
    price_unit text not null default 'annual' check (price_unit in ('one_time', 'monthly', 'annual')),
    is_required_default boolean not null default false,
    portal_url text not null default 'https://portal.fddynamics.com/',
    source_notes text,
    is_active boolean not null default true,
    version integer not null default 1,
    sort_order integer not null default 0,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (organization_id, product_key, version)
  );
create index if not exists idx_sales_portal_products_org on sales_portal_products(organization_id, is_active);
comment on table sales_portal_products is 'Estimated costs of third-party/reseller products (domain, hosting, SSL, email, etc.) purchased separately via https://portal.fddynamics.com/. Shown for total-launch-cost transparency only - never inserted into crm_service_packages, crm_services, or a Fusion invoice.';

-- =========================================================================
-- 5. sales_questionnaire_sessions
-- =========================================================================
create table if not exists sales_questionnaire_sessions (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references crm_organizations(id) on delete cascade,
    lead_id uuid references crm_leads(id) on delete set null,
    session_token text not null unique,
    status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
    current_step text,
    entry_url text,
    referrer_url text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    utm_content text,
    ip_hash text,
    user_agent text,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    abandoned_at timestamptz,
    last_activity_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
create index if not exists idx_sales_qs_org on sales_questionnaire_sessions(organization_id);
create index if not exists idx_sales_qs_lead on sales_questionnaire_sessions(lead_id);
create index if not exists idx_sales_qs_status on sales_questionnaire_sessions(status);
create index if not exists idx_sales_qs_last_activity on sales_questionnaire_sessions(last_activity_at);

-- =========================================================================
-- 6. sales_questionnaire_answers
-- =========================================================================
create table if not exists sales_questionnaire_answers (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references sales_questionnaire_sessions(id) on delete cascade,
    question_key text not null,
    answer_value jsonb not null default '{}'::jsonb,
    answered_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (session_id, question_key)
  );
create index if not exists idx_sales_qa_session on sales_questionnaire_answers(session_id);
create index if not exists idx_sales_qa_key on sales_questionnaire_answers(question_key);

-- =========================================================================
-- 7. sales_budget_assessments
-- =========================================================================
create table if not exists sales_budget_assessments (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references crm_organizations(id) on delete cascade,
    session_id uuid references sales_questionnaire_sessions(id) on delete set null,
    lead_id uuid references crm_leads(id) on delete set null,
    stated_total_budget integer not null check (stated_total_budget >= 0),
    design_allocation integer not null check (design_allocation >= 0),
    budget_type text not null default 'one_time' check (budget_type in ('one_time', 'monthly', 'combined', 'unsure')),
    minimum_total_budget_applied integer not null,
    minimum_design_allocation_applied integer not null,
    meets_total_minimum boolean not null,
    meets_design_minimum boolean not null,
    business_rules_version integer not null,
    assessment_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
create index if not exists idx_sales_ba_org on sales_budget_assessments(organization_id);
create index if not exists idx_sales_ba_session on sales_budget_assessments(session_id);
create index if not exists idx_sales_ba_lead on sales_budget_assessments(lead_id);

-- =========================================================================
-- 8. sales_website_recommendations
-- =========================================================================
create table if not exists sales_website_recommendations (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references crm_organizations(id) on delete cascade,
    session_id uuid references sales_questionnaire_sessions(id) on delete set null,
    lead_id uuid references crm_leads(id) on delete set null,
    budget_assessment_id uuid references sales_budget_assessments(id) on delete set null,
    recommended_package_id uuid references crm_service_packages(id) on delete set null,
    package_snapshot jsonb not null default '{}'::jsonb,
    total_design_cost integer not null check (total_design_cost >= 0),
    monthly_cost integer not null default 0 check (monthly_cost >= 0),
    applied_discount_rule_id uuid references sales_discount_rules(id) on delete set null,
    discount_amount integer not null default 0 check (discount_amount >= 0),
    discount_reason text,
    rationale text,
    sales_angle text,
    confidence_level text not null default 'standard' check (confidence_level in ('low', 'standard', 'high')),
    status text not null default 'draft' check (status in ('draft', 'presented', 'accepted', 'declined', 'superseded')),
    version integer not null default 1,
    parent_recommendation_id uuid references sales_website_recommendations(id) on delete set null,
    pricing_effective_date date not null default current_date,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
create index if not exists idx_sales_rec_org on sales_website_recommendations(organization_id);
create index if not exists idx_sales_rec_lead on sales_website_recommendations(lead_id);
create index if not exists idx_sales_rec_session on sales_website_recommendations(session_id);
create index if not exists idx_sales_rec_parent on sales_website_recommendations(parent_recommendation_id);
comment on column sales_website_recommendations.discount_amount is 'Must be 0 unless applied_discount_rule_id references an active sales_discount_rules row. Enforced by the business-rules module, not by the database.';

-- =========================================================================
-- 9. sales_recommendation_alternatives
-- =========================================================================
create table if not exists sales_recommendation_alternatives (
    id uuid primary key default gen_random_uuid(),
    recommendation_id uuid not null references sales_website_recommendations(id) on delete cascade,
    alternative_package_id uuid references crm_service_packages(id) on delete set null,
    package_snapshot jsonb not null default '{}'::jsonb,
    total_design_cost integer not null check (total_design_cost >= 0),
    monthly_cost integer not null default 0 check (monthly_cost >= 0),
    reason_suggested text,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
  );
create index if not exists idx_sales_rec_alt_rec on sales_recommendation_alternatives(recommendation_id);

-- =========================================================================
-- 10. sales_product_requirements
-- =========================================================================
create table if not exists sales_product_requirements (
    id uuid primary key default gen_random_uuid(),
    recommendation_id uuid not null references sales_website_recommendations(id) on delete cascade,
    requirement_key text not null,
    requirement_type text not null check (requirement_type in ('fusion_service', 'portal_product', 'third_party', 'client_provided')),
    is_required boolean not null default true,
    linked_service_id uuid references crm_services(id) on delete set null,
    linked_portal_product_id uuid references sales_portal_products(id) on delete set null,
    notes text,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
  );
create index if not exists idx_sales_prod_req_rec on sales_product_requirements(recommendation_id);

-- =========================================================================
-- 11. sales_portal_product_selections
-- =========================================================================
create table if not exists sales_portal_product_selections (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references crm_organizations(id) on delete cascade,
    lead_id uuid references crm_leads(id) on delete set null,
    client_id uuid references crm_clients(id) on delete set null,
    recommendation_id uuid references sales_website_recommendations(id) on delete set null,
    portal_product_id uuid not null references sales_portal_products(id) on delete restrict,
    quantity integer not null default 1 check (quantity >= 1),
    estimated_price integer not null check (estimated_price >= 0),
    status text not null default 'recommended' check (status in ('recommended', 'selected', 'not_needed', 'purchased')),
    selected_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
create index if not exists idx_sales_portal_sel_org on sales_portal_product_selections(organization_id);
create index if not exists idx_sales_portal_sel_lead on sales_portal_product_selections(lead_id);
create index if not exists idx_sales_portal_sel_client on sales_portal_product_selections(client_id);
comment on column sales_portal_product_selections.status is 'status = ''purchased'' must only be set alongside a verified row in sales_purchase_verifications - never merely because the client clicked the portal link.';

-- =========================================================================
-- 12. sales_purchase_verifications
-- =========================================================================
create table if not exists sales_purchase_verifications (
    id uuid primary key default gen_random_uuid(),
    portal_product_selection_id uuid not null references sales_portal_product_selections(id) on delete cascade,
    verification_method text not null check (verification_method in ('portal_api_sync', 'admin_manual_verification', 'client_submitted_pending_review')),
    verified boolean not null default false,
    verified_by uuid,
    verified_at timestamptz,
    evidence_url text,
    evidence_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
create index if not exists idx_sales_purchase_verif_sel on sales_purchase_verifications(portal_product_selection_id);

-- =========================================================================
-- 13. sales_consultation_requests
-- =========================================================================
create table if not exists sales_consultation_requests (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references crm_organizations(id) on delete cascade,
    lead_id uuid references crm_leads(id) on delete set null,
    session_id uuid references sales_questionnaire_sessions(id) on delete set null,
    reason text not null check (reason in ('below_minimum_budget', 'complex_project', 'undecided', 'wants_payment_plan', 'wants_phased_build', 'other')),
    preferred_contact_method text check (preferred_contact_method in ('email', 'phone', 'text', 'video_call')),
    preferred_times text,
    status text not null default 'requested' check (status in ('requested', 'scheduled', 'completed', 'cancelled')),
    assigned_user_id uuid,
    appointment_id uuid references crm_appointments(id) on delete set null,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
create index if not exists idx_sales_consult_org on sales_consultation_requests(organization_id, status);
create index if not exists idx_sales_consult_lead on sales_consultation_requests(lead_id);

-- =========================================================================
-- 14. sales_consent_records
-- =========================================================================
create table if not exists sales_consent_records (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references crm_organizations(id) on delete cascade,
    lead_id uuid references crm_leads(id) on delete set null,
    contact_id uuid references crm_contacts(id) on delete set null,
    email text,
    consent_type text not null check (consent_type in ('marketing_email', 'marketing_sms', 'marketing_calls', 'data_processing')),
    consent_given boolean not null,
    consent_source text not null,
    consent_text_version text,
    ip_address text,
    user_agent text,
    given_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz not null default now()
  );
create index if not exists idx_sales_consent_org on sales_consent_records(organization_id);
create index if not exists idx_sales_consent_lead on sales_consent_records(lead_id);
create index if not exists idx_sales_consent_email on sales_consent_records(email);

-- =========================================================================
-- Seed default business rules + portal product catalog for the Fusion org
-- =========================================================================
do $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from crm_organizations where slug = 'fusion-digital-dynamics' limit 1;

  if v_org_id is not null then
    insert into sales_business_rules (organization_id, rule_key, rule_value, notes)
    values
      (v_org_id, 'minimum_total_budget', jsonb_build_object('amount', 300, 'currency', 'USD'), 'Absolute minimum total budget accepted in the questionnaire.'),
      (v_org_id, 'minimum_design_allocation', jsonb_build_object('amount', 300, 'currency', 'USD'), 'Minimum portion of the budget that must be allocated to Fusion website-design services.'),
      (v_org_id, 'maximum_discount_percent', jsonb_build_object('percent', 75), 'Hard ceiling on any discount, regardless of which discount rule is applied. Does not imply any discount is granted by default.'),
      (v_org_id, 'deposit_required_percent', jsonb_build_object('percent', 50), 'Default deposit percentage for one-time design fees.'),
      (v_org_id, 'sales_escalation_threshold', jsonb_build_object('amount', 5000, 'currency', 'USD'), 'Recommendations at or above this design cost are flagged for manual sales-team review before presenting.'),
      (v_org_id, 'tax_rate_percent', jsonb_build_object('percent', 0), 'Default sales tax rate applied to Fusion design services; configure per applicable jurisdiction.'),
      (v_org_id, 'tax_fee_disclaimer_text', jsonb_build_object('text', 'Prices shown are for Fusion Digital Dynamics LLC website design services only. Domain, hosting, SSL, email, and other third-party products are purchased separately through the Fusion client portal and are not included in this estimate. Applicable taxes and fees are calculated at checkout.'), 'Displayed wherever pricing is shown to a prospect.'),
      (v_org_id, 'below_minimum_message', jsonb_build_object('text', 'Our minimum project budget is $300, which covers a focused single-page website. Let''s talk about what''s possible at your budget, a payment plan, or a phased build so we can still get you online.'), 'Shown when a prospect enters a budget below the accepted minimum.')
    on conflict (organization_id, rule_key, version) do nothing;

    insert into sales_payment_plan_rules (organization_id, plan_code, plan_name, description, deposit_percent, number_of_installments, installment_interval, minimum_eligible_total)
    values (v_org_id, 'standard-2pay', 'Two-Payment Plan', '50% deposit to start, 50% due at launch.', 50, 2, 'monthly', 300)
    on conflict (organization_id, plan_code, version) do nothing;

    insert into sales_portal_products (organization_id, product_key, product_name, category, description, estimated_price, price_unit, is_required_default, sort_order)
    values
      (v_org_id, 'domain-registration', 'Domain Registration', 'domain', 'Annual registration for a .com or equivalent domain name.', 20, 'annual', true, 1),
      (v_org_id, 'web-hosting', 'Web Hosting', 'hosting', 'Managed hosting for the website.', 120, 'annual', true, 2),
      (v_org_id, 'ssl-certificate', 'SSL Certificate', 'ssl', 'Secures the site with HTTPS.', 0, 'annual', true, 3),
      (v_org_id, 'professional-email', 'Professional Email', 'email', 'Business email at your own domain.', 72, 'annual', false, 4),
      (v_org_id, 'microsoft-365', 'Microsoft 365', 'microsoft_365', 'Office apps, email, and cloud storage.', 72, 'annual', false, 5),
      (v_org_id, 'email-marketing', 'Email Marketing Platform', 'email_marketing', 'Newsletters and campaign automation.', 240, 'annual', false, 6),
      (v_org_id, 'automated-backups', 'Automated Backups', 'backup', 'Scheduled site backups and restore points.', 60, 'annual', false, 7),
      (v_org_id, 'security-monitoring', 'Security Monitoring', 'security', 'Malware scanning and firewall monitoring.', 96, 'annual', false, 8)
    on conflict (organization_id, product_key, version) do nothing;
  end if;
end $$;

-- =========================================================================
-- Row Level Security - service-role access only, matching repo convention
-- =========================================================================
alter table sales_business_rules enable row level security;
alter table sales_discount_rules enable row level security;
alter table sales_payment_plan_rules enable row level security;
alter table sales_portal_products enable row level security;
alter table sales_questionnaire_sessions enable row level security;
alter table sales_questionnaire_answers enable row level security;
alter table sales_budget_assessments enable row level security;
alter table sales_website_recommendations enable row level security;
alter table sales_recommendation_alternatives enable row level security;
alter table sales_product_requirements enable row level security;
alter table sales_portal_product_selections enable row level security;
alter table sales_purchase_verifications enable row level security;
alter table sales_consultation_requests enable row level security;
alter table sales_consent_records enable row level security;
