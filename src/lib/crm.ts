import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { CustomerInfo } from "@/lib/customer";
import { Answers } from "@/lib/offers";
import { demoClients, demoTasks, pipelineSummary } from "@/lib/records";
import { runAutomations } from "@/lib/automations";

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

export type DashboardLead = {
  id: string;
  lead_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  company: string;
  website: string | null;
  industry?: string | null;
  goal?: string | null;
  timeline?: string | null;
  budget?: string | null;
  objection?: string | null;
  project_notes?: string | null;
  package_name: string;
  total_today: number;
  monthly_due: number;
  discount_percent: number;
  status: string;
  created_at: string;
  contact_id?: string | null;
  company_id?: string | null;
  linked_contact_name?: string | null;
  linked_company_name?: string | null;
};

export type DashboardTask = {
  id: string;
  title: string;
  owner: string;
  status: string;
  priority: string;
  due_at: string | null;
  task_type?: string | null;
  completed_at?: string | null;
  company?: string | null;
};

export type CrmCompany = {
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

export type CrmContactThread = {
  id: string;
  channel_type: "whatsapp" | "messenger" | "instagram";
  status: string;
};

export type CrmContact = {
  id: string;
  company_id: string | null;
  first_name: string;
  last_name: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  lifecycle_status: string;
  lead_source: string | null;
  next_follow_up_at: string | null;
  crm_companies?: { company_name?: string | null } | null;
  message_threads?: CrmContactThread[];
};

export type CrmDeal = {
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

export type CrmNote = {
  id: string;
  entity_type: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
};

export type CrmActivity = {
  id: string;
  action_type: string;
  entity_type: string;
  summary: string;
  created_at: string;
};

export type CrmStage = {
  id: string;
  name: string;
  stage_order: number;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
};

export type CrmSettings = {
  lead_statuses: string[];
  lead_sources: string[];
  task_types: string[];
  lost_reasons: string[];
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
};

export type CrmServicePackage = {
  id: string;
  package_key: string;
  package_name: string;
  description: string | null;
  setup_price: number;
  monthly_price: number;
  inclusions: string[];
  is_active: boolean;
  sort_order: number;
};

export type CrmRole = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type CrmTeamMember = {
  id: string;
  user_id: string;
  status: string;
  title: string | null;
  created_at: string;
  crm_profiles?: { display_name?: string | null; email?: string | null } | null;
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

function splitDisplayName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || "Unnamed";
  const lastName = parts.length ? parts.join(" ") : null;
  return { firstName, lastName, displayName: [firstName, lastName].filter(Boolean).join(" ") };
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

// --- Lead / Contact / Company sync helpers -------------------------------
//
// Leads, Contacts, and Companies used to be independent, free-text records:
// capturing a new lead never created or linked a Contact or Company, so the
// same person or business could show up three different ways with nothing
// connecting them. These helpers find-or-create the matching Contact and
// Company for a person and link them together. They're called from every
// place a lead is captured, edited, or converted into a client so the three
// stay in sync automatically.

async function findOrCreateCompanyIdByName(
  supabase: SupabaseClient<any>,
  organizationId: string,
  companyName: string | null | undefined,
  actorId: string | null,
  leadSource?: string
): Promise<string | null> {
  const name = companyName?.trim();
  if (!name) return null;

  const { data, error } = await supabase
    .from("crm_companies")
    .upsert(
      {
        organization_id: organizationId,
        company_name: name,
        lead_source: leadSource?.trim() || undefined,
        updated_by: actorId,
        updated_at: new Date().toISOString()
      },
      { onConflict: "organization_id,company_name", ignoreDuplicates: false }
    )
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("Unable to find or create company for sync.", error);
    return null;
  }

  return data.id;
}

async function findOrCreateContactForPerson(
  supabase: SupabaseClient<any>,
  organizationId: string,
  input: {
    name: string;
    email?: string | null;
    phone?: string | null;
    companyId: string | null;
    leadSource?: string;
    actorId?: string | null;
  }
): Promise<string | null> {
  const normalizedEmail = input.email?.trim() ? normalizeEmail(input.email) : null;
  const normalizedPhone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  let existing: { id: string; company_id: string | null } | null = null;

  if (normalizedEmail) {
    const { data } = await supabase
      .from("crm_contacts")
      .select("id, company_id")
      .eq("organization_id", organizationId)
      .eq("normalized_email", normalizedEmail)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle<{ id: string; company_id: string | null }>();
    existing = data || null;
  }

  if (!existing && normalizedPhone) {
    const { data } = await supabase
      .from("crm_contacts")
      .select("id, company_id")
      .eq("organization_id", organizationId)
      .eq("normalized_phone", normalizedPhone)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle<{ id: string; company_id: string | null }>();
    existing = data || null;
  }

  if (existing) {
    if (!existing.company_id && input.companyId) {
      await supabase
        .from("crm_contacts")
        .update({ company_id: input.companyId, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
    return existing.id;
  }

  const names = splitDisplayName(input.name || "Unnamed");
  const { data, error } = await supabase
    .from("crm_contacts")
    .insert({
      organization_id: organizationId,
      company_id: input.companyId,
      first_name: names.firstName,
      last_name: names.lastName,
      display_name: names.displayName,
      email: input.email?.trim() || null,
      normalized_email: normalizedEmail,
      phone: input.phone?.trim() || null,
      normalized_phone: normalizedPhone,
      lead_source: input.leadSource?.trim() || "Website",
      created_by: input.actorId || null,
      updated_by: input.actorId || null
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("Unable to find or create contact for sync.", error);
    return null;
  }

  return data.id;
}

async function linkCompanyContact(supabase: SupabaseClient<any>, companyId: string | null, contactId: string | null) {
  if (!companyId || !contactId) return;

  const { count } = await supabase
    .from("crm_company_contacts")
    .select("company_id", { count: "exact", head: true })
    .eq("company_id", companyId);

  await supabase
    .from("crm_company_contacts")
    .upsert(
      { company_id: companyId, contact_id: contactId, is_primary: !count },
      { onConflict: "company_id,contact_id", ignoreDuplicates: true }
    );
}

async function syncContactAndCompanyForPerson(
  supabase: SupabaseClient<any>,
  organizationId: string | null,
  input: {
    name: string;
    email?: string | null;
    phone?: string | null;
    companyName?: string | null;
    leadSource?: string;
    actorId?: string | null;
  }
): Promise<{ contactId: string | null; companyId: string | null }> {
  if (!organizationId) return { contactId: null, companyId: null };

  const companyId = await findOrCreateCompanyIdByName(supabase, organizationId, input.companyName, input.actorId || null, input.leadSource);
  const contactId = await findOrCreateContactForPerson(supabase, organizationId, {
    name: input.name,
    email: input.email,
    phone: input.phone,
    companyId,
    leadSource: input.leadSource,
    actorId: input.actorId
  });
  await linkCompanyContact(supabase, companyId, contactId);

  return { contactId, companyId };
}

function demoDashboardRecords() {
  return {
    summary: pipelineSummary,
    leads: demoClients.map((client): DashboardLead => ({
      id: client.id,
      lead_code: client.id,
      customer_name: client.name,
      customer_email: client.email,
      customer_phone: client.phone,
      company: client.company,
      website: client.website || null,
      industry: null,
      goal: null,
      timeline: null,
      budget: null,
      objection: null,
      project_notes: null,
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
      task_type: "Follow-Up",
      completed_at: null,
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
      .select("id, lead_code, customer_name, customer_email, customer_phone, company, website, industry, goal, timeline, budget, objection, project_notes, package_name, total_today, monthly_due, discount_percent, status, created_at, contact_id, company_id")
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
      organization: { name: "Fusion Digital Dynamics LLC", website: "https://fddynamics.com", default_currency: "USD", default_time_zone: "America/New_York" },
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
    .select("id, lead_code, customer_name, customer_email, customer_phone, company, website, industry, goal, timeline, budget, objection, project_notes, package_name, total_today, monthly_due, discount_percent, status, created_at, contact_id, company_id")
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
    notificationsResult,
    contactThreadsResult
  ] = await Promise.all([
    supabase.from("crm_organizations").select("name, default_currency, default_time_zone").eq("id", organizationId).single(),
    leadQuery,
    supabase.from("crm_tasks").select("id, title, owner, status, priority, due_at, task_type, completed_at, crm_leads(company)").eq("organization_id", organizationId).is("deleted_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(50),
    supabase.from("crm_contacts").select("id, company_id, first_name, last_name, display_name, email, phone, job_title, lifecycle_status, lead_source, next_follow_up_at").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("crm_companies").select("id, company_name, industry, website, main_phone, general_email, lifecycle_status, lead_source, created_at").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("crm_deals").select("id, company_id, stage_id, deal_title, service, value, probability, expected_close_date, priority, status").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("crm_notes").select("id, entity_type, body, is_pinned, created_at").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(20),
    supabase.from("crm_activities").select("id, action_type, entity_type, summary, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(30),
    supabase.from("crm_pipeline_stages").select("id, name, stage_order, probability, is_won, is_lost").eq("organization_id", organizationId).eq("is_active", true).order("stage_order", { ascending: true }),
    supabase.from("crm_app_settings").select("lead_statuses, lead_sources, task_types, lost_reasons, logo_url, primary_color, accent_color").eq("organization_id", organizationId).single(),
    supabase.from("crm_notifications").select("id, title, created_at, read_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(10),
    // Every conversation thread linked to a contact, so we can show the
    // channel (WhatsApp/Messenger/Instagram) they reached out on next to
    // their name and jump straight back into that conversation.
    supabase.from("crm_message_threads").select("id, contact_id, channel_type, status").eq("organization_id", organizationId).not("contact_id", "is", null)
  ]);

  const rawLeads = (leadsResult.data || []) as DashboardLead[];
  const tasks = ((tasksResult.data || []) as Array<DashboardTask & { crm_leads?: { company?: string | null } | null }>).map((task) => ({
    ...task,
    company: task.crm_leads?.company || null
  }));
  const deals = (dealsResult.data || []) as CrmDeal[];
  const companies = (companiesResult.data || []) as CrmCompany[];
  const stages = (stagesResult.data || []) as CrmStage[];
  const companyNameById = new Map(companies.map((company) => [company.id, company.company_name]));
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const threadsByContactId = new Map<string, CrmContactThread[]>();
  for (const thread of (contactThreadsResult.data || []) as Array<{ id: string; contact_id: string | null; channel_type: CrmContactThread["channel_type"]; status: string }>) {
    if (!thread.contact_id) continue;
    const existing = threadsByContactId.get(thread.contact_id) || [];
    existing.push({ id: thread.id, channel_type: thread.channel_type, status: thread.status });
    threadsByContactId.set(thread.contact_id, existing);
  }
  const contacts = ((contactsResult.data || []) as CrmContact[]).map((contact) => ({
    ...contact,
    crm_companies: contact.company_id ? { company_name: companyNameById.get(contact.company_id) || null } : null,
    message_threads: threadsByContactId.get(contact.id) || []
  }));
  const contactNameById = new Map(contacts.map((contact) => [contact.id, contact.display_name]));
  const leads = rawLeads.map((lead) => ({
    ...lead,
    linked_contact_name: lead.contact_id ? contactNameById.get(lead.contact_id) || null : null,
    linked_company_name: lead.company_id ? companyNameById.get(lead.company_id) || null : null
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

export async function getFusionAdminSettings() {
  const supabase = getServiceClient();
  if (!supabase) {
    return {
      organization: { name: "Fusion Digital Dynamics LLC", website: "https://fddynamics.com", default_currency: "USD", default_time_zone: "America/New_York" },
      settings: null as CrmSettings | null,
      packages: [] as CrmServicePackage[],
      roles: [] as CrmRole[],
      members: [] as CrmTeamMember[]
    };
  }

  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) {
    return { organization: null, settings: null, packages: [], roles: [], members: [] };
  }

  const [organizationResult, settingsResult, packagesResult, rolesResult, membersResult] = await Promise.all([
    supabase.from("crm_organizations").select("name, business_email, business_phone, website, default_currency, default_time_zone").eq("id", organizationId).single(),
    supabase.from("crm_app_settings").select("lead_statuses, lead_sources, task_types, lost_reasons, logo_url, primary_color, accent_color").eq("organization_id", organizationId).single(),
    supabase.from("crm_service_packages").select("id, package_key, package_name, description, setup_price, monthly_price, inclusions, is_active, sort_order").eq("organization_id", organizationId).order("sort_order", { ascending: true }),
    supabase.from("crm_roles").select("id, name, slug, description").eq("organization_id", organizationId).order("name", { ascending: true }),
    supabase.from("crm_organization_members").select("id, user_id, status, title, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false })
  ]);
  const members = (membersResult.data || []) as CrmTeamMember[];
  const profileIds = members.map((member) => member.user_id).filter(Boolean);
  const profilesResult = profileIds.length
    ? await supabase.from("crm_profiles").select("id, display_name, email").in("id", profileIds)
    : { data: [] as Array<{ id: string; display_name: string | null; email: string | null }> };
  const profileById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));

  return {
    organization: organizationResult.data || null,
    settings: settingsResult.data as CrmSettings | null,
    packages: (packagesResult.data || []) as CrmServicePackage[],
    roles: (rolesResult.data || []) as CrmRole[],
    members: members.map((member) => ({
      ...member,
      crm_profiles: profileById.get(member.user_id) || null
    }))
  };
}

export async function updateCrmBrandSettings(input: {
  actorId: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { error } = await supabase
    .from("crm_app_settings")
    .update({
      logo_url: input.logoUrl?.trim() || null,
      primary_color: input.primaryColor?.trim() || "#31d7ff",
      accent_color: input.accentColor?.trim() || "#f5b84b",
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId);

  if (error) return { ok: false, error: "Unable to update brand settings." };
  await logActivity(supabase, organizationId, input.actorId, "settings.updated", "settings", organizationId, "Brand settings updated");
  return { ok: true };
}

// Uploads a brand logo file to the public "brand-assets" Storage bucket and
// returns its public URL, so it can be saved directly into crm_app_settings.
// Mirrors uploadContentMedia in lib/content.ts (public bucket + getPublicUrl)
// since a logo needs a plain, publicly reachable URL wherever it's rendered.
export async function uploadCrmBrandLogo(input: {
  organizationId: string;
  fileName: string;
  contentType: string;
  data: ArrayBuffer;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase storage is not configured." };

  const safeName = input.fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${input.organizationId}/logo-${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from("brand-assets").upload(path, input.data, {
    contentType: input.contentType || "application/octet-stream",
    upsert: false
  });

  if (error) return { ok: false, error: "Unable to upload logo: " + error.message };

  const { data: publicUrlData } = supabase.storage.from("brand-assets").getPublicUrl(path);
  return { ok: true, url: publicUrlData.publicUrl };
}

export async function updateCrmServicePackage(input: {
  actorId: string;
  packageId: string;
  packageName: string;
  description?: string;
  setupPrice: number;
  monthlyPrice: number;
  isActive: boolean;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { error } = await supabase
    .from("crm_service_packages")
    .update({
      package_name: input.packageName.trim(),
      description: input.description?.trim() || null,
      setup_price: Math.max(0, Math.round(input.setupPrice || 0)),
      monthly_price: Math.max(0, Math.round(input.monthlyPrice || 0)),
      is_active: input.isActive,
      updated_by: input.actorId,
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("id", input.packageId);

  if (error) return { ok: false, error: "Unable to update package pricing." };
  await logActivity(supabase, organizationId, input.actorId, "settings.pricing_updated", "service_package", input.packageId, `Pricing updated: ${input.packageName}`);
  return { ok: true };
}

export async function deleteCrmServicePackage(input: { actorId: string; packageId: string }) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { error } = await supabase
    .from("crm_service_packages")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", input.packageId);

  if (error) return { ok: false, error: "Unable to delete package." };
  await logActivity(supabase, organizationId, input.actorId, "settings.package_deleted", "service_package", input.packageId, "Service package deleted");
  return { ok: true };
}

export async function inviteCrmTeamMember(input: {
  actorId: string;
  email: string;
  displayName?: string;
  title?: string;
  roleId?: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Email is required." };

  const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: input.displayName?.trim() || displayNameFromEmail(email) }
  });

  if (inviteError || !invited.user) {
    return { ok: false, error: inviteError?.message || "Unable to invite team member." };
  }

  await supabase.from("crm_profiles").upsert({
    id: invited.user.id,
    email,
    display_name: input.displayName?.trim() || displayNameFromEmail(email),
    status: "active",
    updated_at: new Date().toISOString()
  });

  const { data: member, error: memberError } = await supabase
    .from("crm_organization_members")
    .upsert({
      organization_id: organizationId,
      user_id: invited.user.id,
      status: "active",
      title: input.title?.trim() || null,
      updated_at: new Date().toISOString()
    }, { onConflict: "organization_id,user_id", ignoreDuplicates: false })
    .select("id")
    .single<{ id: string }>();

  if (memberError || !member) return { ok: false, error: "User invited, but team membership could not be saved." };

  if (input.roleId) {
    await supabase.from("crm_member_roles").upsert({
      member_id: member.id,
      role_id: input.roleId
    });
  }

  await logActivity(supabase, organizationId, input.actorId, "team.invited", "team_member", member.id, `Team invitation sent to ${email}`);
  return { ok: true };
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

  // A new lead should immediately show up as a linked Contact (the person)
  // and Company (who they represent) instead of living only as free text on
  // the lead record.
  const { contactId, companyId } = await syncContactAndCompanyForPerson(supabase, organizationId, {
    name: payload.customer.name,
    email: payload.customer.email,
    phone: payload.customer.phone,
    companyName: payload.customer.company,
    leadSource: "Website"
  });

  const { data, error } = await supabase
    .from("crm_leads")
    .insert({
      ...leadInsertPayload(leadCode, payload),
      organization_id: organizationId,
      contact_id: contactId,
      company_id: companyId
    })
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

  if (organizationId) {
    await runAutomations({
      trigger: "lead.captured",
      entityType: "lead",
      entityId: data.id,
      organizationId,
      contact: {
        name: payload.customer.name,
        email: payload.customer.email,
        phone: payload.customer.phone
      },
      company: {
        name: payload.customer.company,
        website: payload.customer.website || null
      }
    });
  }

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
  await linkCompanyContact(supabase, companyId, data.id);
  await logActivity(supabase, organizationId, input.actorId, "contact.created", "contact", data.id, `Contact created: ${displayName}`);
  return { ok: true };
}

export async function createCrmClient(input: {
  actorId: string;
  customerName: string;
  customerEmail: string;
  company?: string;
  password?: string;
  projectName?: string;
  previewUrl?: string;
  liveUrl?: string;
  clientInstructions?: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const name = input.customerName.trim();
  const email = normalizeEmail(input.customerEmail || "");
  if (!name) return { ok: false, error: "Client name is required." };
  if (!email) return { ok: false, error: "Client email is required." };

  const password = input.password?.trim() || generateTempPassword();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name }
  });

  if (createError || !created.user) {
    return { ok: false, error: createError?.message || "Unable to create the client's portal login." };
  }

  // A manually-created client is still a person and a company — link them to
  // the same shared Contact/Company records everything else uses, and mark
  // both as an active client right away.
  const { contactId, companyId } = await syncContactAndCompanyForPerson(supabase, organizationId, {
    name,
    email,
    companyName: input.company,
    leadSource: "Manual",
    actorId: input.actorId
  });
  if (contactId) await supabase.from("crm_contacts").update({ lifecycle_status: "client", updated_at: new Date().toISOString() }).eq("id", contactId);
  if (companyId) await supabase.from("crm_companies").update({ lifecycle_status: "client", updated_at: new Date().toISOString() }).eq("id", companyId);

  const { data: client, error: clientError } = await supabase
    .from("crm_clients")
    .insert({
      organization_id: organizationId,
      customer_email: email,
      customer_name: name,
      company: input.company?.trim() || "Not set",
      contact_id: contactId,
      company_id: companyId,
      status: "active",
      portal_user_id: created.user.id,
      portal_status: "active",
      onboarding_status: "onboarded"
    })
    .select("id")
    .single<{ id: string }>();

  if (clientError || !client) {
    return { ok: false, error: "Portal login created, but the client record could not be saved." };
  }

  const previewUrl = cleanUrl(input.previewUrl || input.liveUrl || "");
  await supabase.from("crm_client_projects").insert({
    organization_id: organizationId,
    client_id: client.id,
    project_name: input.projectName?.trim() || "Website Project",
    project_status: "in_progress",
    live_url: previewUrl,
    preview_url: previewUrl,
    current_phase: "Client Review",
    client_instructions: input.clientInstructions?.trim() || null,
    created_by: input.actorId,
    updated_by: input.actorId
  });

  await logActivity(supabase, organizationId, input.actorId, "client.created", "client", client.id, `Client created: ${name}`);
  return { ok: true };
}

function cleanUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 16; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function createCrmDeal(input: {
  actorId: string;
  dealTitle: string;
  companyName?: string;
  service?: string;
  value?: number;
  stageId?: string;
  status?: string;
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

export async function updateCrmContact(input: {
  actorId: string;
  contactId: string;
  displayName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  companyName?: string;
  lifecycleStatus?: string;
  leadSource?: string;
  nextFollowUpAt?: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const names = splitDisplayName(input.displayName);
  let companyId: string | null = null;
  if (input.companyName?.trim()) {
    const { data: company } = await supabase
      .from("crm_companies")
      .upsert({
        organization_id: organizationId,
        company_name: input.companyName.trim(),
        updated_by: input.actorId,
        updated_at: new Date().toISOString()
      }, { onConflict: "organization_id,company_name", ignoreDuplicates: false })
      .select("id")
      .single<{ id: string }>();
    companyId = company?.id || null;
  }

  const { data, error } = await supabase
    .from("crm_contacts")
    .update({
      company_id: companyId,
      first_name: names.firstName,
      last_name: names.lastName,
      display_name: names.displayName,
      email: input.email?.trim() || null,
      normalized_email: input.email ? normalizeEmail(input.email) : null,
      phone: input.phone?.trim() || null,
      normalized_phone: input.phone ? normalizePhone(input.phone) : null,
      job_title: input.jobTitle?.trim() || null,
      lifecycle_status: input.lifecycleStatus?.trim() || "new",
      lead_source: input.leadSource?.trim() || "Manual",
      next_follow_up_at: input.nextFollowUpAt || null,
      updated_by: input.actorId,
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("id", input.contactId)
    .is("deleted_at", null)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to update contact." };
  await linkCompanyContact(supabase, companyId, input.contactId);
  await logActivity(supabase, organizationId, input.actorId, "contact.updated", "contact", input.contactId, `Contact updated: ${names.displayName}`);
  return { ok: true };
}

// The same person can reach out through more than one channel — a phone
// call, a Facebook message, an Instagram DM, a WhatsApp text — and each of
// those can create its own Contact record before anyone realizes they're
// the same person. This merges a duplicate into a chosen primary contact:
// every lead, client, deal, task, appointment, proposal, and conversation
// thread pointing at the duplicate is re-pointed at the primary, any
// company link is combined without creating a conflicting row, missing
// fields on the primary are filled in from the duplicate, and the
// duplicate is soft-deleted so it disappears everywhere without losing its
// history.
export async function mergeCrmContacts(input: {
  actorId: string;
  primaryContactId: string;
  duplicateContactId: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { primaryContactId, duplicateContactId } = input;
  if (!primaryContactId || !duplicateContactId) return { ok: false, error: "Choose a contact to merge in." };
  if (primaryContactId === duplicateContactId) return { ok: false, error: "Choose a different contact to merge — it can't merge into itself." };

  type FullContact = {
    id: string;
    company_id: string | null;
    display_name: string;
    email: string | null;
    normalized_email: string | null;
    phone: string | null;
    normalized_phone: string | null;
    job_title: string | null;
    lifecycle_status: string;
    next_follow_up_at: string | null;
  };

  const [{ data: primary }, { data: duplicate }] = await Promise.all([
    supabase
      .from("crm_contacts")
      .select("id, company_id, display_name, email, normalized_email, phone, normalized_phone, job_title, lifecycle_status, next_follow_up_at")
      .eq("organization_id", organizationId)
      .eq("id", primaryContactId)
      .is("deleted_at", null)
      .maybeSingle<FullContact>(),
    supabase
      .from("crm_contacts")
      .select("id, company_id, display_name, email, normalized_email, phone, normalized_phone, job_title, lifecycle_status, next_follow_up_at")
      .eq("organization_id", organizationId)
      .eq("id", duplicateContactId)
      .is("deleted_at", null)
      .maybeSingle<FullContact>()
  ]);

  if (!primary || !duplicate) return { ok: false, error: "One of those contacts could not be found." };

  const nowIso = new Date().toISOString();
  const lifecycleRank: Record<string, number> = { new: 0, prospect: 1, qualified: 2, inactive: 1, client: 3 };
  const mergedLifecycle =
    (lifecycleRank[duplicate.lifecycle_status] ?? 0) > (lifecycleRank[primary.lifecycle_status] ?? 0)
      ? duplicate.lifecycle_status
      : primary.lifecycle_status;

  await supabase
    .from("crm_contacts")
    .update({
      company_id: primary.company_id || duplicate.company_id || null,
      email: primary.email || duplicate.email || null,
      normalized_email: primary.normalized_email || duplicate.normalized_email || null,
      phone: primary.phone || duplicate.phone || null,
      normalized_phone: primary.normalized_phone || duplicate.normalized_phone || null,
      job_title: primary.job_title || duplicate.job_title || null,
      lifecycle_status: mergedLifecycle,
      next_follow_up_at: primary.next_follow_up_at || duplicate.next_follow_up_at || null,
      updated_by: input.actorId,
      updated_at: nowIso
    })
    .eq("id", primaryContactId);

  // Every record that simply has a contact_id column can be re-pointed directly.
  const linkedTables = ["crm_leads", "crm_clients", "crm_deals", "crm_message_threads", "crm_appointments", "crm_proposals", "crm_tasks"];
  for (const table of linkedTables) {
    await supabase.from(table).update({ contact_id: primaryContactId }).eq("contact_id", duplicateContactId);
  }

  // crm_company_contacts has a composite (company_id, contact_id) primary key, so a straight
  // re-point could collide with a link that already exists for the primary contact. Drop the
  // ones that would collide and re-point the rest.
  const { data: duplicateLinks } = await supabase
    .from("crm_company_contacts")
    .select("company_id")
    .eq("contact_id", duplicateContactId);

  for (const link of (duplicateLinks || []) as Array<{ company_id: string }>) {
    const { data: existingLink } = await supabase
      .from("crm_company_contacts")
      .select("company_id")
      .eq("company_id", link.company_id)
      .eq("contact_id", primaryContactId)
      .maybeSingle();

    if (existingLink) {
      await supabase.from("crm_company_contacts").delete().eq("company_id", link.company_id).eq("contact_id", duplicateContactId);
    } else {
      await supabase
        .from("crm_company_contacts")
        .update({ contact_id: primaryContactId })
        .eq("company_id", link.company_id)
        .eq("contact_id", duplicateContactId);
    }
  }

  // Keep the activity trail and any notes about the duplicate contact intact by re-pointing them.
  await supabase.from("crm_activities").update({ entity_id: primaryContactId }).eq("entity_type", "contact").eq("entity_id", duplicateContactId);
  await supabase.from("crm_notes").update({ entity_id: primaryContactId }).eq("entity_type", "contact").eq("entity_id", duplicateContactId);

  await supabase
    .from("crm_contacts")
    .update({
      deleted_at: nowIso,
      updated_by: input.actorId,
      updated_at: nowIso,
      display_name: `${duplicate.display_name} (merged into ${primary.display_name})`
    })
    .eq("id", duplicateContactId);

  await logActivity(
    supabase,
    organizationId,
    input.actorId,
    "contact.merged",
    "contact",
    primaryContactId,
    `Merged "${duplicate.display_name}" into "${primary.display_name}"`
  );

  return { ok: true };
}

export async function updateCrmLead(input: {
  actorId: string;
  leadId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  company: string;
  website?: string;
  industry?: string;
  goal?: string;
  timeline?: string;
  budget?: string;
  objection?: string;
  projectNotes?: string;
  packageName?: string;
  totalToday?: number;
  monthlyDue?: number;
  discountPercent?: number;
  status?: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const customerName = input.customerName.trim();
  const company = input.company.trim();
  const customerEmail = input.customerEmail.trim();
  const customerPhone = input.customerPhone?.trim() || null;
  if (!customerName || !company || !customerEmail) {
    return { ok: false, error: "Lead name, company, and email are required." };
  }

  const allowedStatuses = new Set(["captured", "checkout_started", "paid", "qualified", "proposal_sent", "won", "lost", "unqualified"]);
  const status = allowedStatuses.has(input.status || "") ? input.status || "captured" : "captured";
  const website = input.website?.trim();

  // Keep this lead's linked Contact and Company records (rather than a
  // second, disconnected copy of the same person/business) up to date with
  // whatever the admin just edited.
  const { data: existingLead } = await supabase
    .from("crm_leads")
    .select("contact_id, company_id")
    .eq("organization_id", organizationId)
    .eq("id", input.leadId)
    .single<{ contact_id: string | null; company_id: string | null }>();

  const companyId = await findOrCreateCompanyIdByName(supabase, organizationId, company, input.actorId, "Manual");
  let contactId = existingLead?.contact_id || null;

  if (contactId) {
    const names = splitDisplayName(customerName);
    await supabase
      .from("crm_contacts")
      .update({
        company_id: companyId,
        first_name: names.firstName,
        last_name: names.lastName,
        display_name: names.displayName,
        email: customerEmail,
        normalized_email: normalizeEmail(customerEmail),
        phone: customerPhone,
        normalized_phone: customerPhone ? normalizePhone(customerPhone) : null,
        updated_by: input.actorId,
        updated_at: new Date().toISOString()
      })
      .eq("id", contactId);
  } else {
    contactId = await findOrCreateContactForPerson(supabase, organizationId, {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      companyId,
      leadSource: "Manual",
      actorId: input.actorId
    });
  }

  await linkCompanyContact(supabase, companyId, contactId);

  const { data, error } = await supabase
    .from("crm_leads")
    .update({
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      company,
      website: website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null,
      industry: input.industry?.trim() || null,
      goal: input.goal?.trim() || null,
      timeline: input.timeline?.trim() || null,
      budget: input.budget?.trim() || null,
      objection: input.objection?.trim() || null,
      project_notes: input.projectNotes?.trim() || null,
      package_name: input.packageName?.trim() || null,
      total_today: Math.max(0, Math.round(input.totalToday || 0)),
      monthly_due: Math.max(0, Math.round(input.monthlyDue || 0)),
      discount_percent: Math.min(75, Math.max(0, Math.round(input.discountPercent || 0))),
      status,
      contact_id: contactId,
      company_id: companyId,
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("id", input.leadId)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to update lead." };
  await logActivity(supabase, organizationId, input.actorId, "lead.updated", "lead", input.leadId, `Lead updated: ${company}`);
  return { ok: true };
}

export async function updateCrmTask(input: {
  actorId: string;
  taskId: string;
  title: string;
  taskType?: string;
  priority?: string;
  status?: string;
  dueAt?: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data: existingTask } = await supabase
    .from("crm_tasks")
    .select("status")
    .eq("organization_id", organizationId)
    .eq("id", input.taskId)
    .single<{ status: string }>();
  const previousStatus = existingTask?.status || null;

  const allowedStatuses = new Set(["open", "in_progress", "done", "blocked"]);
  const status = allowedStatuses.has(input.status || "") ? input.status || "open" : "open";
  const completedAt = status === "done" ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("crm_tasks")
    .update({
      title: input.title.trim(),
      task_type: input.taskType?.trim() || "Follow-Up",
      priority: input.priority || "normal",
      status,
      due_at: input.dueAt || null,
      completed_at: completedAt,
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("id", input.taskId)
    .is("deleted_at", null)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to update task." };
  await logActivity(supabase, organizationId, input.actorId, status === "done" ? "task.completed" : "task.updated", "task", input.taskId, `Task ${status === "done" ? "completed" : "updated"}: ${input.title}`);

  if (status === "done" && previousStatus !== "done") {
    await runAutomations({
      trigger: "task.completed",
      entityType: "task",
      entityId: input.taskId,
      organizationId,
      actorId: input.actorId,
      task: { title: input.title.trim(), dueAt: input.dueAt || null, owner: null }
    });
  }
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
    .select("id, customer_email, customer_name, company, contact_id, company_id")
    .single<{ id: string; customer_email: string; customer_name: string; company: string; contact_id: string | null; company_id: string | null }>();

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
      contact_id: lead.contact_id,
      company_id: lead.company_id,
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

  // The person and company just became a paying client, not just a lead —
  // reflect that on the shared Contact/Company records too.
  if (lead.contact_id) {
    await supabase.from("crm_contacts").update({ lifecycle_status: "client", updated_at: now }).eq("id", lead.contact_id);
  }
  if (lead.company_id) {
    await supabase.from("crm_companies").update({ lifecycle_status: "client", updated_at: now }).eq("id", lead.company_id);
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

  const organizationId = await getDefaultOrganizationId(supabase);
  if (organizationId) {
    await runAutomations({
      trigger: "payment.received",
      entityType: "lead",
      entityId: lead.id,
      organizationId,
      contact: { name: lead.customer_name, email: lead.customer_email },
      company: { name: lead.company }
    });
  }
}

export async function updateCrmCompany(input: {
  actorId: string;
  companyId: string;
  companyName: string;
  industry?: string;
  website?: string;
  mainPhone?: string;
  generalEmail?: string;
  lifecycleStatus?: string;
  leadSource?: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const companyName = input.companyName.trim();
  if (!companyName) return { ok: false, error: "Company name is required." };

  const { data, error } = await supabase
    .from("crm_companies")
    .update({
      company_name: companyName,
      industry: input.industry?.trim() || null,
      website: input.website?.trim() || null,
      main_phone: input.mainPhone?.trim() || null,
      general_email: input.generalEmail?.trim() || null,
      lifecycle_status: input.lifecycleStatus?.trim() || "new",
      lead_source: input.leadSource?.trim() || "Manual",
      updated_by: input.actorId,
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("id", input.companyId)
    .is("deleted_at", null)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to update company." };
  await logActivity(supabase, organizationId, input.actorId, "company.updated", "company", input.companyId, `Company updated: ${companyName}`);
  return { ok: true };
}

export async function updateCrmDeal(input: {
  actorId: string;
  dealId: string;
  dealTitle: string;
  companyName?: string;
  service?: string;
  value?: number;
  stageId?: string;
  status?: string;
  expectedCloseDate?: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const dealTitle = input.dealTitle.trim();
  if (!dealTitle) return { ok: false, error: "Deal title is required." };

  const { data: existingDeal } = await supabase
    .from("crm_deals")
    .select("stage_id")
    .eq("organization_id", organizationId)
    .eq("id", input.dealId)
    .single<{ stage_id: string | null }>();
  const previousStageId = existingDeal?.stage_id || null;
  let previousStageName: string | null = null;
  if (previousStageId) {
    const { data: prevStage } = await supabase
      .from("crm_pipeline_stages")
      .select("name")
      .eq("id", previousStageId)
      .single<{ name: string }>();
    previousStageName = prevStage?.name || null;
  }

  let companyId: string | null = null;
  if (input.companyName?.trim()) {
    const { data: company } = await supabase
      .from("crm_companies")
      .upsert({
        organization_id: organizationId,
        company_name: input.companyName.trim(),
        updated_by: input.actorId,
        updated_at: new Date().toISOString()
      }, { onConflict: "organization_id,company_name", ignoreDuplicates: false })
      .select("id")
      .single<{ id: string }>();
    companyId = company?.id || null;
  }

  const stageId = input.stageId || null;
  let probability: number | undefined;
  let stageName: string | null = null;
  if (stageId) {
    const { data: stage } = await supabase
      .from("crm_pipeline_stages")
      .select("probability, name")
      .eq("organization_id", organizationId)
      .eq("id", stageId)
      .single<{ probability: number; name: string }>();
    probability = stage?.probability;
    stageName = stage?.name || null;
  }

  const allowedDealStatuses = new Set(["open", "won", "lost"]);
  const status = allowedDealStatuses.has(input.status || "") ? input.status || "open" : "open";
  const updatePayload: Record<string, unknown> = {
    company_id: companyId,
    stage_id: stageId,
    deal_title: dealTitle,
    service: input.service?.trim() || null,
    value: Math.max(0, Number(input.value || 0)),
    status,
    expected_close_date: input.expectedCloseDate || null,
    updated_by: input.actorId,
    updated_at: new Date().toISOString()
  };
  if (probability !== undefined) updatePayload.probability = probability;

  const { data, error } = await supabase
    .from("crm_deals")
    .update(updatePayload)
    .eq("organization_id", organizationId)
    .eq("id", input.dealId)
    .is("deleted_at", null)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to update deal." };
  await logActivity(supabase, organizationId, input.actorId, "deal.updated", "deal", input.dealId, `Deal updated: ${dealTitle}`);

  if (stageId && stageId !== previousStageId) {
    await runAutomations({
      trigger: "deal.stage_changed",
      entityType: "deal",
      entityId: input.dealId,
      organizationId,
      actorId: input.actorId,
      deal: {
        title: dealTitle,
        value: Math.max(0, Number(input.value || 0)),
        stageId,
        stageName,
        previousStageName
      },
      company: input.companyName?.trim() ? { name: input.companyName.trim() } : undefined
    });
  }
  return { ok: true };
}

export async function updateCrmTeamMember(input: {
  actorId: string;
  memberId: string;
  title?: string;
  status?: string;
  roleId?: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const allowedStatuses = new Set(["active", "inactive", "invited"]);
  const status = allowedStatuses.has(input.status || "") ? input.status || "active" : "active";

  const { data, error } = await supabase
    .from("crm_organization_members")
    .update({
      title: input.title?.trim() || null,
      status,
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("id", input.memberId)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to update team member." };

  if (input.roleId) {
    await supabase.from("crm_member_roles").upsert({
      member_id: input.memberId,
      role_id: input.roleId
    });
  }

  await logActivity(supabase, organizationId, input.actorId, "team.updated", "team_member", input.memberId, "Team member updated");
  return { ok: true };
}
