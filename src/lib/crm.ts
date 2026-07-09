import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { CustomerInfo } from "@/lib/customer";
import { Answers } from "@/lib/offers";
import { demoClients, demoTasks, pipelineSummary } from "@/lib/records";

type SalesRecommendation = { packageKey: string; packageName: string; totalToday: number; monthlyDue: number; discountPercent: number };
type SalesPayload = { customer: CustomerInfo; answers: Answers; recommendation: SalesRecommendation };
let cachedClient: SupabaseClient<any> | null = null;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cachedClient) cachedClient = createClient<any>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cachedClient;
}

export function createLeadCode() { return `FDD-${Date.now().toString(36).toUpperCase()}`; }

export async function captureLead(payload: SalesPayload) {
  const leadCode = createLeadCode();
  const supabase = getServiceClient();
  if (!supabase) return { leadId: leadCode, persisted: false };
  const { customer, answers, recommendation } = payload;
  const { data, error } = await supabase.from("crm_leads").insert({
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
  }).select("id, lead_code").single<{ id: string; lead_code: string }>();
  if (error || !data) {
    console.error("Unable to persist Fusion sales lead.", error);
    return { leadId: leadCode, persisted: false };
  }
  await supabase.from("crm_tasks").insert({ lead_id: data.id, title: `Follow up with ${customer.company}`, owner: "Fusion AI Team", status: "open", priority: recommendation.discountPercent >= 60 ? "high" : "normal", due_at: new Date(Date.now() + 1000 * 60 * 30).toISOString() });
  return { leadId: data.lead_code, persisted: true };
}

export async function markCheckoutStarted(leadCode: string | undefined, session: Stripe.Checkout.Session) {
  if (!leadCode) return;
  const supabase = getServiceClient();
  if (!supabase) return;
  await supabase.from("crm_leads").update({ status: "checkout_started", stripe_checkout_session_id: session.id, stripe_customer_id: typeof session.customer === "string" ? session.customer : null, updated_at: new Date().toISOString() }).eq("lead_code", leadCode);
}

export async function recordStripeEvent(event: Stripe.Event) {
  const supabase = getServiceClient();
  if (!supabase) return;
  await supabase.from("stripe_events").upsert({ id: event.id, type: event.type, payload: event as unknown as Record<string, unknown>, processed_at: new Date().toISOString() });
}

export async function fulfillCheckout(session: Stripe.Checkout.Session) {
  const supabase = getServiceClient();
  const leadCode = session.metadata?.leadCode;
  if (!supabase || !leadCode) return;
  const now = new Date().toISOString();
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
  const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  const { data: lead } = await supabase.from("crm_leads").update({ status: "paid", stripe_customer_id: stripeCustomerId, stripe_checkout_session_id: session.id, stripe_subscription_id: stripeSubscriptionId, paid_at: now, updated_at: now }).eq("lead_code", leadCode).select("id, customer_email, customer_name, company").single<{ id: string; customer_email: string; customer_name: string; company: string }>();
  if (!lead) return;
  const { data: client } = await supabase.from("crm_clients").insert({ lead_id: lead.id, customer_email: lead.customer_email, customer_name: lead.customer_name, company: lead.company, status: "active", stripe_customer_id: stripeCustomerId, stripe_subscription_id: stripeSubscriptionId }).select("id").single<{ id: string }>();
  if (!client) return;
  await supabase.from("crm_tasks").insert([{ lead_id: lead.id, client_id: client.id, title: "Create client portal login and kickoff questionnaire", owner: "Fusion AI Team", status: "open", priority: "high", due_at: new Date(Date.now() + 1000 * 60 * 60).toISOString() }, { lead_id: lead.id, client_id: client.id, title: "Schedule website strategy call", owner: "Fusion AI Team", status: "open", priority: "normal", due_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() }]);
}

function demoDashboardRecords() {
  return {
    summary: pipelineSummary,
    leads: demoClients.map((client) => ({ id: client.id, lead_code: client.id, customer_name: client.name, customer_email: client.email, customer_phone: client.phone, company: client.company, website: client.website || null, package_name: client.recommendation.packageName, total_today: client.recommendation.totalToday, monthly_due: client.recommendation.monthlyDue, discount_percent: client.recommendation.discountPercent, status: client.status, created_at: client.createdAt })),
    tasks: demoTasks.map((task) => ({ id: task.id, title: task.title, owner: task.owner, status: task.status, priority: "normal", due_at: null, company: task.client }))
  };
}

export async function getFusionDashboardRecords() {
  const supabase = getServiceClient();
  if (!supabase) return demoDashboardRecords();
  const [{ data: leads }, { data: tasks }] = await Promise.all([
    supabase.from("crm_leads").select("id, lead_code, customer_name, customer_email, customer_phone, company, website, package_name, total_today, monthly_due, discount_percent, status, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("crm_tasks").select("id, title, owner, status, priority, due_at, crm_leads(company)").order("due_at", { ascending: true, nullsFirst: false }).limit(50)
  ]);
  const safeLeads = leads || [];
  const safeTasks = ((tasks || []) as Array<any>).map((task) => ({ ...task, company: task.crm_leads?.company || null }));
  return { summary: [{ label: "New leads", value: safeLeads.filter((lead: any) => lead.status === "captured").length }, { label: "Checkout started", value: safeLeads.filter((lead: any) => lead.status === "checkout_started").length }, { label: "Paid clients", value: safeLeads.filter((lead: any) => lead.status === "paid").length }, { label: "Open tasks", value: safeTasks.filter((task: any) => task.status !== "done").length }], leads: safeLeads, tasks: safeTasks };
}
