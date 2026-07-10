import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

type JsonObject = Record<string, string | number | boolean | null>;

export type SalesOpsServiceCategory = {
  id: string;
  name: string;
  slug: string;
};

export type SalesOpsService = {
  id: string;
  category_id: string | null;
  service_name: string;
  sku: string;
  slug: string;
  short_description: string | null;
  billing_type: string;
  pricing_model: string;
  base_price: number;
  minimum_price: number | null;
  maximum_price: number | null;
  internal_estimated_cost: number;
  default_quantity: number;
  is_taxable: boolean;
  recurring_interval: string | null;
  setup_fee: number;
  discount_eligible: boolean;
  is_active: boolean;
  is_featured: boolean;
  public_visibility: boolean;
};

export type SalesOpsProposal = {
  id: string;
  proposal_number: string;
  proposal_title: string;
  status: string;
  currency: string;
  issue_date: string;
  expiration_date: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  grand_total: number;
  recurring_monthly_total: number;
  estimated_gross_profit: number;
  estimated_gross_margin: number;
  created_at: string;
};

export type SalesOpsAppointment = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  time_zone: string;
  location: string | null;
  meeting_url: string | null;
};

export type SalesOpsEmailTemplate = {
  id: string;
  template_name: string;
  subject: string;
  category: string;
  visibility: string;
  is_active: boolean;
};

export type SalesOpsCrmForm = {
  id: string;
  form_name: string;
  form_slug: string;
  form_type: string;
  is_active: boolean;
  is_published: boolean;
  is_public: boolean;
};

export type SalesOpsLeadSource = {
  id: string;
  name: string;
  slug: string;
  is_paid: boolean;
  default_channel: string | null;
};

let cachedClient: SupabaseClient<any> | null = null;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  if (!cachedClient) {
    cachedClient = createClient<any>(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return cachedClient;
}

async function getDefaultOrganizationId(supabase: SupabaseClient<any>) {
  const { data, error } = await supabase
    .from("crm_organizations")
    .select("id")
    .eq("slug", "fusion-digital-dynamics")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("Unable to load Fusion CRM organization for sales ops.", error);
    return null;
  }

  return data.id;
}

async function logActivity(
  supabase: SupabaseClient<any>,
  organizationId: string,
  actorId: string | null,
  actionType: string,
  entityType: string,
  entityId: string | null,
  summary: string,
  metadata: JsonObject = {}
) {
  await supabase.from("crm_activities").insert({
    organization_id: organizationId,
    actor_id: actorId,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId,
    summary,
    metadata
  });
}

async function logAudit(
  supabase: SupabaseClient<any>,
  organizationId: string,
  actorId: string | null,
  event: string,
  entityType: string,
  entityId: string | null,
  metadata: JsonObject = {}
) {
  await supabase.from("crm_audit_logs").insert({
    organization_id: organizationId,
    actor_id: actorId,
    event,
    entity_type: entityType,
    entity_id: entityId,
    metadata
  });
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cents(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value);
}

function percentDiscount(subtotal: number, basisPoints: number) {
  return Math.round(subtotal * Math.max(0, basisPoints) / 10000);
}

function grossMargin(profit: number, total: number) {
  if (total <= 0) return 0;
  return Number((profit / total).toFixed(4));
}

const serviceSchema = z.object({
  actorId: z.string().uuid(),
  serviceName: z.string().trim().min(2).max(140),
  sku: z.string().trim().min(2).max(60),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  shortDescription: z.string().trim().max(400).optional(),
  billingType: z.enum(["one_time", "recurring", "usage_based", "custom_quote"]),
  pricingModel: z.enum(["fixed_price", "starting_at", "price_range", "per_unit", "hourly", "custom_quote"]),
  basePrice: z.coerce.number().int().min(0),
  minimumPrice: z.coerce.number().int().min(0).optional(),
  maximumPrice: z.coerce.number().int().min(0).optional(),
  internalEstimatedCost: z.coerce.number().int().min(0).optional(),
  recurringInterval: z.enum(["monthly", "quarterly", "semiannual", "annual", "custom"]).optional().or(z.literal("")),
  isFeatured: z.boolean().default(false),
  publicVisibility: z.boolean().default(true)
});

const proposalSchema = z.object({
  actorId: z.string().uuid(),
  proposalTitle: z.string().trim().min(2).max(180),
  serviceId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
  discountType: z.enum(["none", "fixed", "percent"]).default("none"),
  discountValue: z.coerce.number().int().min(0).default(0),
  expirationDate: z.string().optional()
});

const appointmentSchema = z.object({
  actorId: z.string().uuid(),
  title: z.string().trim().min(2).max(180),
  appointmentTypeId: z.string().uuid().optional().or(z.literal("")),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  location: z.string().trim().max(180).optional(),
  meetingUrl: z.string().trim().max(250).optional()
});

const emailTemplateSchema = z.object({
  actorId: z.string().uuid(),
  templateName: z.string().trim().min(2).max(140),
  subject: z.string().trim().min(2).max(180),
  body: z.string().trim().min(2).max(6000),
  category: z.string().trim().min(2).max(80),
  visibility: z.enum(["private", "shared"]).default("shared")
});

const crmFormSchema = z.object({
  actorId: z.string().uuid(),
  formName: z.string().trim().min(2).max(140),
  formType: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  isPublished: z.boolean().default(false)
});

export async function getSalesOpsWorkspace() {
  const supabase = getServiceClient();
  if (!supabase) {
    return {
      categories: [] as SalesOpsServiceCategory[],
      services: [] as SalesOpsService[],
      proposals: [] as SalesOpsProposal[],
      appointments: [] as SalesOpsAppointment[],
      appointmentTypes: [] as Array<{ id: string; name: string }>,
      leadSources: [] as SalesOpsLeadSource[],
      emailTemplates: [] as SalesOpsEmailTemplate[],
      forms: [] as SalesOpsCrmForm[],
      reports: {
        leadsCreated: 0,
        dealsCreated: 0,
        proposalsCreated: 0,
        proposalsAccepted: 0,
        appointmentsScheduled: 0,
        formsPublished: 0,
        totalPipelineValue: 0,
        weightedPipelineValue: 0,
        wonRevenue: 0
      }
    };
  }

  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) {
    return {
      categories: [] as SalesOpsServiceCategory[],
      services: [] as SalesOpsService[],
      proposals: [] as SalesOpsProposal[],
      appointments: [] as SalesOpsAppointment[],
      appointmentTypes: [] as Array<{ id: string; name: string }>,
      leadSources: [] as SalesOpsLeadSource[],
      emailTemplates: [] as SalesOpsEmailTemplate[],
      forms: [] as SalesOpsCrmForm[],
      reports: {
        leadsCreated: 0,
        dealsCreated: 0,
        proposalsCreated: 0,
        proposalsAccepted: 0,
        appointmentsScheduled: 0,
        formsPublished: 0,
        totalPipelineValue: 0,
        weightedPipelineValue: 0,
        wonRevenue: 0
      }
    };
  }

  const [
    categoriesResult,
    servicesResult,
    proposalsResult,
    appointmentsResult,
    appointmentTypesResult,
    leadSourcesResult,
    emailTemplatesResult,
    formsResult,
    leadsResult,
    dealsResult
  ] = await Promise.all([
    supabase.from("crm_service_categories").select("id, name, slug").eq("organization_id", organizationId).is("deleted_at", null).order("display_order", { ascending: true }),
    supabase.from("crm_services").select("id, category_id, service_name, sku, slug, short_description, billing_type, pricing_model, base_price, minimum_price, maximum_price, internal_estimated_cost, default_quantity, is_taxable, recurring_interval, setup_fee, discount_eligible, is_active, is_featured, public_visibility").eq("organization_id", organizationId).is("deleted_at", null).order("display_order", { ascending: true }).limit(100),
    supabase.from("crm_proposals").select("id, proposal_number, proposal_title, status, currency, issue_date, expiration_date, subtotal, discount_total, tax_total, grand_total, recurring_monthly_total, estimated_gross_profit, estimated_gross_margin, created_at").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("crm_appointments").select("id, title, starts_at, ends_at, status, time_zone, location, meeting_url").eq("organization_id", organizationId).is("deleted_at", null).order("starts_at", { ascending: true }).limit(50),
    supabase.from("crm_appointment_types").select("id, name").eq("organization_id", organizationId).eq("is_active", true).order("name", { ascending: true }),
    supabase.from("crm_lead_sources").select("id, name, slug, is_paid, default_channel").eq("organization_id", organizationId).eq("is_active", true).order("display_order", { ascending: true }),
    supabase.from("crm_email_templates").select("id, template_name, subject, category, visibility, is_active").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("crm_forms").select("id, form_name, form_slug, form_type, is_active, is_published, is_public").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("crm_leads").select("id, status, total_today, created_at").eq("organization_id", organizationId).limit(1000),
    supabase.from("crm_deals").select("id, status, value, probability, one_time_value, weighted_one_time_value").eq("organization_id", organizationId).is("deleted_at", null).limit(1000)
  ]);

  const deals = dealsResult.data || [];
  const proposals = (proposalsResult.data || []) as SalesOpsProposal[];
  const appointments = (appointmentsResult.data || []) as SalesOpsAppointment[];
  const forms = (formsResult.data || []) as SalesOpsCrmForm[];
  const totalPipelineValue = deals
    .filter((deal) => !["won", "lost"].includes(String(deal.status)))
    .reduce((sum, deal) => sum + Number(deal.one_time_value || deal.value || 0), 0);
  const weightedPipelineValue = deals
    .filter((deal) => !["won", "lost"].includes(String(deal.status)))
    .reduce((sum, deal) => sum + Number(deal.weighted_one_time_value || Math.round(Number(deal.value || 0) * Number(deal.probability || 0) / 100)), 0);
  const wonRevenue = deals
    .filter((deal) => deal.status === "won")
    .reduce((sum, deal) => sum + Number(deal.one_time_value || deal.value || 0), 0);

  return {
    categories: (categoriesResult.data || []) as SalesOpsServiceCategory[],
    services: (servicesResult.data || []) as SalesOpsService[],
    proposals,
    appointments,
    appointmentTypes: (appointmentTypesResult.data || []) as Array<{ id: string; name: string }>,
    leadSources: (leadSourcesResult.data || []) as SalesOpsLeadSource[],
    emailTemplates: (emailTemplatesResult.data || []) as SalesOpsEmailTemplate[],
    forms,
    reports: {
      leadsCreated: leadsResult.data?.length || 0,
      dealsCreated: deals.length,
      proposalsCreated: proposals.length,
      proposalsAccepted: proposals.filter((proposal) => proposal.status === "accepted").length,
      appointmentsScheduled: appointments.filter((appointment) => appointment.status === "scheduled").length,
      formsPublished: forms.filter((form) => form.is_published).length,
      totalPipelineValue,
      weightedPipelineValue,
      wonRevenue
    }
  };
}

export async function createSalesService(input: z.input<typeof serviceSchema>) {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Service information is not valid." };
  const value = parsed.data;
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data, error } = await supabase
    .from("crm_services")
    .insert({
      organization_id: organizationId,
      category_id: value.categoryId || null,
      service_name: value.serviceName,
      sku: value.sku.toUpperCase(),
      slug: slugify(value.serviceName),
      short_description: value.shortDescription || null,
      billing_type: value.billingType,
      pricing_model: value.pricingModel,
      base_price: cents(value.basePrice),
      minimum_price: value.minimumPrice ? cents(value.minimumPrice) : null,
      maximum_price: value.maximumPrice ? cents(value.maximumPrice) : null,
      internal_estimated_cost: cents(value.internalEstimatedCost || 0),
      recurring_interval: value.recurringInterval || null,
      is_featured: value.isFeatured,
      public_visibility: value.publicVisibility,
      created_by: value.actorId,
      updated_by: value.actorId
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to create service." };
  await logActivity(supabase, organizationId, value.actorId, "service.created", "service", data.id, `Service created: ${value.serviceName}`);
  if (cents(value.internalEstimatedCost || 0) > 0) {
    await logAudit(supabase, organizationId, value.actorId, "service.internal_cost_created", "service", data.id, { internal_cost: cents(value.internalEstimatedCost || 0) });
  }
  return { ok: true };
}

export async function createSalesProposal(input: z.input<typeof proposalSchema>) {
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Proposal information is not valid." };
  const value = parsed.data;
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data: service, error: serviceError } = await supabase
    .from("crm_services")
    .select("id, service_name, short_description, billing_type, recurring_interval, base_price, internal_estimated_cost, sku")
    .eq("organization_id", organizationId)
    .eq("id", value.serviceId)
    .is("deleted_at", null)
    .single<SalesOpsService>();

  if (serviceError || !service) return { ok: false, error: "Selected service could not be found." };

  const lineSubtotal = cents(service.base_price) * value.quantity;
  const lineDiscount = value.discountType === "fixed"
    ? Math.min(lineSubtotal, cents(value.discountValue))
    : value.discountType === "percent"
      ? Math.min(lineSubtotal, percentDiscount(lineSubtotal, value.discountValue * 100))
      : 0;
  const lineTotal = Math.max(0, lineSubtotal - lineDiscount);
  const internalCost = cents(service.internal_estimated_cost) * value.quantity;
  const profit = lineTotal - internalCost;
  const proposalNumber = `FDD-P-${Date.now().toString(36).toUpperCase()}`;

  const { data: proposal, error: proposalError } = await supabase
    .from("crm_proposals")
    .insert({
      organization_id: organizationId,
      proposal_number: proposalNumber,
      proposal_title: value.proposalTitle,
      assigned_user_id: value.actorId,
      expiration_date: value.expirationDate || null,
      subtotal: lineSubtotal,
      discount_type: value.discountType,
      discount_value: value.discountValue,
      discount_total: lineDiscount,
      grand_total: lineTotal,
      recurring_monthly_total: service.billing_type === "recurring" && service.recurring_interval === "monthly" ? lineTotal : 0,
      internal_estimated_cost: internalCost,
      estimated_gross_profit: profit,
      estimated_gross_margin: grossMargin(profit, lineTotal),
      created_by: value.actorId,
      updated_by: value.actorId
    })
    .select("id")
    .single<{ id: string }>();

  if (proposalError || !proposal) return { ok: false, error: "Unable to create proposal." };

  const { error: itemError } = await supabase.from("crm_proposal_items").insert({
    proposal_id: proposal.id,
    service_id: service.id,
    item_name: service.service_name,
    description: service.short_description,
    quantity: value.quantity,
    unit_price: cents(service.base_price),
    internal_unit_cost: cents(service.internal_estimated_cost),
    discount_type: value.discountType,
    discount_value: value.discountValue,
    line_subtotal: lineSubtotal,
    line_discount: lineDiscount,
    line_total: lineTotal,
    billing_type: service.billing_type,
    recurring_interval: service.recurring_interval,
    snapshot: {
      service_name: service.service_name,
      sku: service.sku,
      base_price: service.base_price,
      internal_estimated_cost: service.internal_estimated_cost
    }
  });

  if (itemError) return { ok: false, error: "Proposal was created, but line item snapshot failed." };
  await logActivity(supabase, organizationId, value.actorId, "proposal.created", "proposal", proposal.id, `Proposal created: ${value.proposalTitle}`, { total: lineTotal });
  return { ok: true };
}

export async function createSalesAppointment(input: z.input<typeof appointmentSchema>) {
  const parsed = appointmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Appointment information is not valid." };
  const value = parsed.data;
  const startsAt = new Date(value.startsAt);
  const endsAt = new Date(value.endsAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
    return { ok: false, error: "Appointment end time must be after start time." };
  }

  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data: conflicts } = await supabase
    .from("crm_appointments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("assigned_user_id", value.actorId)
    .is("deleted_at", null)
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString())
    .limit(1);

  if (conflicts?.length) return { ok: false, error: "This appointment overlaps with another appointment." };

  const { data, error } = await supabase
    .from("crm_appointments")
    .insert({
      organization_id: organizationId,
      appointment_type_id: value.appointmentTypeId || null,
      title: value.title,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      assigned_user_id: value.actorId,
      location: value.location || null,
      meeting_url: value.meetingUrl || null,
      created_by: value.actorId,
      updated_by: value.actorId
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to create appointment." };
  await logActivity(supabase, organizationId, value.actorId, "appointment.created", "appointment", data.id, `Appointment created: ${value.title}`);
  return { ok: true };
}

export async function createSalesEmailTemplate(input: z.input<typeof emailTemplateSchema>) {
  const parsed = emailTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Email template information is not valid." };
  const value = parsed.data;
  const unsupportedVariables = [...value.subject.matchAll(/{{\s*([^}\s]+)\s*}}/g), ...value.body.matchAll(/{{\s*([^}\s]+)\s*}}/g)]
    .map((match) => match[1])
    .filter((variable) => !ALLOWED_TEMPLATE_VARIABLES.includes(variable));
  if (unsupportedVariables.length) return { ok: false, error: `Unsupported variables: ${unsupportedVariables.join(", ")}` };

  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data, error } = await supabase
    .from("crm_email_templates")
    .insert({
      organization_id: organizationId,
      template_name: value.templateName,
      subject: value.subject,
      body: value.body.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ""),
      plain_text_body: value.body.replace(/<[^>]+>/g, " "),
      category: value.category,
      visibility: value.visibility,
      owner_id: value.visibility === "private" ? value.actorId : null,
      supported_variables: ALLOWED_TEMPLATE_VARIABLES,
      created_by: value.actorId,
      updated_by: value.actorId
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to create email template." };
  await logActivity(supabase, organizationId, value.actorId, "email_template.created", "email_template", data.id, `Email template created: ${value.templateName}`);
  return { ok: true };
}

export async function createSalesCrmForm(input: z.input<typeof crmFormSchema>) {
  const parsed = crmFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Form information is not valid." };
  const value = parsed.data;
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data, error } = await supabase
    .from("crm_forms")
    .insert({
      organization_id: organizationId,
      form_name: value.formName,
      form_slug: slugify(value.formName),
      form_type: value.formType,
      description: value.description || null,
      is_published: value.isPublished,
      created_by: value.actorId,
      updated_by: value.actorId
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to create CRM form." };
  await supabase.from("crm_form_fields").insert([
    { form_id: data.id, field_key: "name", label: "Name", field_type: "short_text", is_required: true, crm_field_mapping: "customer_name", display_order: 1 },
    { form_id: data.id, field_key: "email", label: "Email", field_type: "email", is_required: true, crm_field_mapping: "customer_email", display_order: 2 },
    { form_id: data.id, field_key: "company", label: "Company", field_type: "short_text", is_required: true, crm_field_mapping: "company", display_order: 3 }
  ]);
  await logActivity(supabase, organizationId, value.actorId, value.isPublished ? "form.published" : "form.created", "form", data.id, `CRM form created: ${value.formName}`);
  if (value.isPublished) await logAudit(supabase, organizationId, value.actorId, "form.published", "form", data.id);
  return { ok: true };
}

const ALLOWED_TEMPLATE_VARIABLES = [
  "contact_first_name",
  "contact_last_name",
  "contact_full_name",
  "company_name",
  "assigned_user_name",
  "deal_title",
  "deal_value",
  "proposal_title",
  "proposal_number",
  "proposal_link",
  "proposal_expiration_date",
  "appointment_title",
  "appointment_date",
  "appointment_time",
  "organization_name",
  "organization_phone",
  "organization_website"
];
