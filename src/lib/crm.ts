import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { CustomerInfo } from "@/lib/customer";
import { Answers } from "@/lib/offers";
import { demoClients, demoTasks, pipelineSummary } from "@/lib/records";

type SalesRecommendation = {
  packageKey: string;
  packageName: string;
  totalToday: number;
  monthlyDue: number;
  discountPercent: number;
};

type SalesPayload = {
  customer: CustomerInfo;
  answers: Answers;
  recommendation: SalesRecommendation;
};

type LeadRecord = {
  id: string;
  lead_code: string;
  status: string;
};

type DashboardLead = {
  id: string;
  lead_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  company: string;
  website: string | null;
  package_name: string;
  total_today: number;
  monthly_due: number;
  discount_percent: number;
  status: string;
  created_at: string;
};

type DashboardTask = {
  id: string;
  title: string;
  owner: string;
  status: string;
  priority: string;
  due_at: string | null;
  company?: string | null;
};

type CrmCompany = {
  id: string;
  company_name: string;
  industry: string | null;
  website: string | null;
  main_phone: string | null;
  general_email: string | null;
  lifecycle_status: string;
  lead_source: string | null;
  created_at: string;
};

type CrmContact = {
  id: string;
  company_id: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  lifecycle_status: string;
  lead_source: string | null;
  next_follow_up_at: string | null;
  crm_companies?: { company_name?: string | null } | null;
};

type CrmDeal = {
  id: string;
  company_id: string | null;
  stage_id: string | null;
  deal_title: string;
  service: string | null;
  value: number;
  probability: number;
  expected_close_date: string | null;
  priority: string;
  status: string;
  crm_pipeline_stages?: { name?: string | null; probability?: number | null } | null;
  crm_companies?: { company_name?: string | null } | null;
};

type CrmNote = {
  id: string;
  entity_type: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
};

type CrmActivity = {
  id: string;
  action_type: string;
  entity_type: string;
  summary: string;
  created_at: string;
};

type CrmStage = {
  id: string;
  name: string;
  stage_order: number;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
};

type CrmSettings = {
  lead_statuses: string[];
  lead_sources: string[];
  task_types: string[];
  lost_reasons: string[];
};

export type CrmSearchParams = {
  q?: string;
  status?: string;
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

export function isCrmConfigured() {
  return Boolean(getServiceClient());
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function displayNameFromEmail(email: string) {
  return email.split("@")[0] || email;
}

async function getDefaultOrganizationId(supabase: SupabaseClient<any>) {
  const { data, error } = await supabase
    .from("crm_organizations")
    .select("id")
    .eq("slug", "fusion-digital-dynamics")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("Unable to load Fusion CRM organization.", error);
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
  metadata: Record<string, string | number | boolean | null> = {}
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

function demoDashboardRecords() {
  return {
    summary: pipelineSummary,
    leads: demoClients.map((client) => ({
      id: client.id,
      lead_code: client.id,
      customer_name: client.name,
      customer_email: client.email,
      customer_phone: client.phone,
      company: client.company,
      website: client.website || null,
      package_name: client.recommendation.packageName,
      total_today: client.recommendation.totalToday,
      monthly_due: client.recommendation.monthlyDue,
      discount_percent: client.recommendation.discountPercent,
      status: client.status,
      created_at: client.createdAt
    })),
    tasks: demoTasks.map((task) => ({
      id: task.id,
      title: task.title,
      owner: task.owner,
      status: task.status,
      priority: "normal",
      due_at: null,
      company: task.client
    }))
  };
}

export async function getFusionDashboardRecords() {
  const supabase = getServiceClient();
  if (!supabase) return demoDashboardRecords();

  const [{ data: leads, error: leadsError }, { data: tasks, error: tasksError }] = await Promise.all([
    supabase
      .from("crm_leads")
      .select("id, lead_code, customer_name, customer_email, customer_phone, company, website, package_name, total_today, monthly_due, discount_percent, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("crm_tasks")
      .select("id, title, owner, status, priority, due_at, crm_leads(company)")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(50)
  ]);

  if (leadsError || tasksError) {
    console.error("Unable to load Fusion admin dashboard records.", { leadsError, tasksError });
    return demoDashboardRecords();
  }

  const safeLeads = (leads || []) as DashboardLead[];
  const safeTasks = ((tasks || []) as Array<DashboardTask & { crm_leads?: { company?: string | null } | null }>).map((task) => ({
    ...task,
    company: task.crm_leads?.company || null
  }));

  return {
    summary: [
      { label: "New leads", value: safeLeads.filter((lead) => lead.status === "captured").length },
      { label: "Checkout started", value: safeLeads.filter((lead) => lead.status === "checkout_started").length },
      { label: "Paid clients", value: safeLeads.filter((lead) => lead.status === "paid").length },
      { label: "Open tasks", value: safeTasks.filter((task) => task.status !== "done").length }
    ],
    leads: safeLeads,
    tasks: safeTasks
  };
}

export async function getFusionCrmWorkspace(params: CrmSearchParams = {}) {
  const supabase = getServiceClient();
  if (!supabase) {
    const demo = demoDashboardRecords();
    return {
      organization: { name: "Fusion Digital Dynamics LLC", default_currency: "USD", default_time_zone: "America/New_York" },
      summary: demo.summary,
      leads: demo.leads,
      tasks: demo.tasks,
      contacts: [] as CrmContact[],
      companies: [] as CrmCompany[],
      deals: [] as CrmDeal[],
      notes: [] as CrmNote[],
      activities: [] as CrmActivity[],
      stages: [] as CrmStage[],
      settings: null as CrmSettings | null,
      notifications: [] as Array<{ id: string; title: string; created_at: string; read_at: string | null }>
    };
  }

  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ...demoDashboardRecords(), contacts: [], companies: [], deals: [], notes: [], activities: [], stages: [], settings: null, notifications: [], organization: null };

  const search = params.q?.trim();
  const leadQuery = supabase
    .from("crm_leads")
    .select("id, lead_code, customer_name, customer_email, customer_phone, company, website, package_name, total_today, monthly_due, discount_percent, status, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (params.status && params.status !== "all") leadQuery.eq("status", params.status);
  if (search) leadQuery.or(`customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,company.ilike.%${search}%,lead_code.ilike.%${search}%`);

  const [
    organizationResult,
    leadsResult,
    tasksResult,
    contactsResult,
    companiesResult,
    dealsResult,
    notesResult,
    activitiesResult,
    stagesResult,
    settingsResult,
    notificationsResult
  ] = await Promise.all([
    supabase.from("crm_organizations").select("name, default_currency, default_time_zone").eq("id", organizationId).single(),
    leadQuery,
    supabase.from("crm_tasks").select("id, title, owner, status, priority, due_at, crm_leads(company)").eq("organization_id", organizationId).is("deleted_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(50),
    supabase.from("crm_contacts").select("id, company_id, display_name, email, phone, job_title, lifecycle_status, lead_source, next_follow_up_at").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("crm_companies").select("id, company_name, industry, website, main_phone, general_email, lifecycle_status, lead_source, created_at").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("crm_deals").select("id, company_id, stage_id, deal_title, service, value, probability, expected_close_date, priority, status").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("crm_notes").select("id, entity_type, body, is_pinned, created_at").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(20),
    supabase.from("crm_activities").select("id, action_type, entity_type, summary, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(30),
    supabase.from("crm_pipeline_stages").select("id, name, stage_order, probability, is_won, is_lost").eq("organization_id", organizationId).eq("is_active", true).order("stage_order", { ascending: true }),
    supabase.from("crm_app_settings").select("lead_statuses, lead_sources, task_types, lost_reasons").eq("organization_id", organizationId).single(),
    supabase.from("crm_notifications").select("id, title, created_at, read_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(10)
  ]);

  const leads = (leadsResult.data || []) as DashboardLead[];
  const tasks = ((tasksResult.data || []) as Array<DashboardTask & { crm_leads?: { company?: string | null } | null }>).map((task) => ({
    ...task,
    company: task.crm_leads?.company || null
  }));
  const deals = (dealsResult.data || []) as CrmDeal[];
  const companies = (companiesResult.data || []) as CrmCompany[];
  const stages = (stagesResult.data || []) as CrmStage[];
  const companyNameById = new Map(companies.map((company) => [company.id, company.company_name]));
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const contacts = ((contactsResult.data || []) as CrmContact[]).map((contact) => ({
    ...contact,
    crm_companies: contact.company_id ? { company_name: companyNameById.get(contact.company_id) || null } : null
  }));
  const mappedDeals = deals.map((deal) => {
    const stage = deal.stage_id ? stageById.get(deal.stage_id) : null;

    return {
      ...deal,
      crm_pipeline_stages: stage ? { name: stage.name, probability: stage.probability } : null,
      crm_companies: deal.company_id ? { company_name: companyNameById.get(deal.company_id) || null } : null
    };
  });
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const newThisMonth = leads.filter((lead) => {
    const created = new Date(lead.created_at);
    return created.getMonth() === month && created.getFullYear() === year;
  }).length;
  const openDeals = deals.filter((deal) => deal.status !== "won" && deal.status !== "lost");
  const pipelineValue = openDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  const weightedValue = openDeals.reduce((sum, deal) => sum + Math.round(Number(deal.value || 0) * Number(deal.probability || 0) / 100), 0);
  const overdueTasks = tasks.filter((task) => task.status !== "done" && task.due_at && new Date(task.due_at) < now).length;

  return {
    organization: organizationResult.data || null,
    summary: [
      { label: "Active leads", value: leads.filter((lead) => !["paid", "lost", "unqualified"].includes(lead.status)).length },
      { label: "New this month", value: newThisMonth },
      { label: "Open deals", value: openDeals.length },
      { label: "Pipeline value", value: `$${pipelineValue.toLocaleString()}` },
      { label: "Weighted value", value: `$${weightedValue.toLocaleString()}` },
      { label: "Overdue tasks", value: overdueTasks }
    ],
    leads,
    tasks,
    contacts,
    companies,
    deals: mappedDeals,
    notes: (notesResult.data || []) as CrmNote[],
    activities: (activitiesResult.data || []) as CrmActivity[],
    stages,
    settings: settingsResult.data as CrmSettings | null,
    notifications: notificationsResult.data || []
  };
}

export function createLeadCode() {
  return `FDD-${Date.now().toString(36).toUpperCase()}`;
}

function leadInsertPayload(leadCode: string, payload: SalesPayload) {
  const { customer, answers, recommendation } = payload;

  return {
    lead_code: leadCode,
    customer_name: customer.name,
    customer_email: customer.email,
    customer_phone: customer.phone,
    company: customer.company,
    website: customer.website || null,
    project_notes: customer.projectNotes || null,
    answers,
    recommendation,
    package_key: recommendation.packageKey,
    package_name: recommendation.packageName,
    total_today: recommendation.totalToday,
    monthly_due: recommendation.monthlyDue,
    discount_percent: recommendation.discountPercent,
    status: "captured"
  };
}

export async function captureLead(payload: SalesPayload) {
  const leadCode = createLeadCode();
  const supabase = getServiceClient();

  if (!supabase) {
    console.info("Supabase CRM is not configured; returning transient lead code.", { leadCode });
    return { leadId: leadCode, persisted: false };
  }

  const organizationId = await getDefaultOrganizationId(supabase);
  const { data, error } = await supabase
    .from("crm_leads")
    .insert({ ...leadInsertPayload(leadCode, payload), organization_id: organizationId })
    .select("id, lead_code, status")
    .single<LeadRecord>();

  if (error) {
    console.error("Unable to persist Fusion sales lead.", error);
    return { leadId: leadCode, persisted: false };
  }

  await supabase.from("crm_tasks").insert({
    organization_id: organizationId,
    lead_id: data.id,
    title: `Follow up with ${payload.customer.company}`,
    owner: "Fusion AI Team",
    status: "open",
    priority: payload.recommendation.discountPercent >= 60 ? "high" : "normal",
    due_at: new Date(Date.now() + 1000 * 60 * 30).toISOString()
  });

  return { leadId: data.lead_code, persisted: true };
}

export async function createCrmContact(input: {
  actorId: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  leadSource?: string;
  nextFollowUpAt?: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  let companyId: string | null = null;
  if (input.companyName?.trim()) {
    const { data: company } = await supabase
      .from("crm_companies")
      .upsert({ organization_id: organizationId, company_name: input.companyName.trim(), updated_by: input.actorId }, { onConflict: "organization_id,company_name", ignoreDuplicates: false })
      .select("id")
      .single<{ id: string }>();
    companyId = company?.id || null;
  }

  const displayName = [input.firstName, input.lastName].filter(Boolean).join(" ");
  const { data, error } = await supabase
    .from("crm_contacts")
    .insert({
      organization_id: organizationId,
      company_id: companyId,
      first_name: input.firstName.trim(),
      last_name: input.lastName?.trim() || null,
      display_name: displayName,
      email: input.email?.trim() || null,
      normalized_email: input.email ? normalizeEmail(input.email) : null,
      phone: input.phone?.trim() || null,
      normalized_phone: input.phone ? normalizePhone(input.phone) : null,
      lead_source: input.leadSource?.trim() || "Manual",
      next_follow_up_at: input.nextFollowUpAt || null,
      created_by: input.actorId,
      updated_by: input.actorId
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to create contact." };
  await logActivity(supabase, organizationId, input.actorId, "contact.created", "contact", data.id, `Contact created: ${displayName}`);
  return { ok: true };
}

export async function createCrmDeal(input: {
  actorId: string;
  dealTitle: string;
  companyName?: string;
  service?: string;
  value?: number;
  stageId?: string;
  expectedCloseDate?: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  let companyId: string | null = null;
  if (input.companyName?.trim()) {
    const { data: company } = await supabase
      .from("crm_companies")
      .upsert({ organization_id: organizationId, company_name: input.companyName.trim(), updated_by: input.actorId }, { onConflict: "organization_id,company_name", ignoreDuplicates: false })
      .select("id")
      .single<{ id: string }>();
    companyId = company?.id || null;
  }

  let stageId = input.stageId || null;
  let probability = 25;
  if (!stageId) {
    const { data: stage } = await supabase
      .from("crm_pipeline_stages")
      .select("id, probability")
      .eq("organization_id", organizationId)
      .order("stage_order", { ascending: true })
      .limit(1)
      .single<{ id: string; probability: number }>();
    stageId = stage?.id || null;
    probability = stage?.probability || probability;
  }

  const { data, error } = await supabase
    .from("crm_deals")
    .insert({
      organization_id: organizationId,
      stage_id: stageId,
      company_id: companyId,
      deal_title: input.dealTitle.trim(),
      service: input.service?.trim() || null,
      value: Math.max(0, Number(input.value || 0)),
      probability,
      expected_close_date: input.expectedCloseDate || null,
      created_by: input.actorId,
      updated_by: input.actorId
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to create deal." };
  await logActivity(supabase, organizationId, input.actorId, "deal.created", "deal", data.id, `Deal created: ${input.dealTitle}`);
  return { ok: true };
}

export async function createCrmTask(input: {
  actorId: string;
  title: string;
  taskType?: string;
  priority?: string;
  dueAt?: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({
      organization_id: organizationId,
      title: input.title.trim(),
      task_type: input.taskType || "Follow-Up",
      priority: input.priority || "normal",
      status: "open",
      owner: "Fusion AI Team",
      due_at: input.dueAt || null,
      assigned_user_id: input.actorId
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to create task." };
  await logActivity(supabase, organizationId, input.actorId, "task.created", "task", data.id, `Task created: ${input.title}`);
  return { ok: true };
}

export async function createCrmNote(input: {
  actorId: string;
  body: string;
  entityType?: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };
  const safeBody = input.body.trim().replace(/<[^>]*>/g, "");

  const { data, error } = await supabase
    .from("crm_notes")
    .insert({
      organization_id: organizationId,
      entity_type: input.entityType || "general",
      body: safeBody,
      author_id: input.actorId
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to create note." };
  await logActivity(supabase, organizationId, input.actorId, "note.created", "note", data.id, "Internal note added");
  return { ok: true };
}

export async function markCheckoutStarted(leadCode: string | undefined, session: Stripe.Checkout.Session) {
  if (!leadCode) return;

  const supabase = getServiceClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("crm_leads")
    .update({
      status: "checkout_started",
      stripe_checkout_session_id: session.id,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
      updated_at: new Date().toISOString()
    })
    .eq("lead_code", leadCode);

  if (error) console.error("Unable to mark checkout as started.", error);
}

export async function recordStripeEvent(event: Stripe.Event) {
  const supabase = getServiceClient();
  if (!supabase) return;

  const { error } = await supabase.from("stripe_events").upsert({
    id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
    processed_at: new Date().toISOString()
  });

  if (error) console.error("Unable to store Stripe webhook event.", error);
}

export async function fulfillCheckout(session: Stripe.Checkout.Session) {
  const supabase = getServiceClient();
  const leadCode = session.metadata?.leadCode;
  if (!supabase || !leadCode) return;

  const now = new Date().toISOString();
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
  const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : null;

  const { data: lead, error: leadError } = await supabase
    .from("crm_leads")
    .update({
      status: "paid",
      stripe_customer_id: stripeCustomerId,
      stripe_checkout_session_id: session.id,
      stripe_subscription_id: stripeSubscriptionId,
      paid_at: now,
      updated_at: now
    })
    .eq("lead_code", leadCode)
    .select("id, customer_email, customer_name, company")
    .single<{ id: string; customer_email: string; customer_name: string; company: string }>();

  if (leadError || !lead) {
    console.error("Unable to mark Fusion lead as paid.", leadError);
    return;
  }

  const { data: client, error: clientError } = await supabase
    .from("crm_clients")
    .insert({
      lead_id: lead.id,
      customer_email: lead.customer_email,
      customer_name: lead.customer_name,
      company: lead.company,
      status: "active",
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId
    })
    .select("id")
    .single<{ id: string }>();

  if (clientError) {
    console.error("Unable to create Fusion client record.", clientError);
    return;
  }

  await supabase.from("crm_tasks").insert([
    {
      lead_id: lead.id,
      client_id: client.id,
      title: "Create client portal login and kickoff questionnaire",
      owner: "Fusion AI Team",
      status: "open",
      priority: "high",
      due_at: new Date(Date.now() + 1000 * 60 * 60).toISOString()
    },
    {
      lead_id: lead.id,
      client_id: client.id,
      title: "Schedule website strategy call",
      owner: "Fusion AI Team",
      status: "open",
      priority: "normal",
      due_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
    }
  ]);
}
