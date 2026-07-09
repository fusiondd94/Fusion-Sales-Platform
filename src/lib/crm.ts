import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { CustomerInfo } from "@/lib/customer";
import { Answers } from "@/lib/offers";

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

  const { data, error } = await supabase
    .from("crm_leads")
    .insert(leadInsertPayload(leadCode, payload))
    .select("id, lead_code, status")
    .single<LeadRecord>();

  if (error) {
    console.error("Unable to persist Fusion sales lead.", error);
    return { leadId: leadCode, persisted: false };
  }

  await supabase.from("crm_tasks").insert({
    lead_id: data.id,
    title: `Follow up with ${payload.customer.company}`,
    owner: "Fusion AI Team",
    status: "open",
    priority: payload.recommendation.discountPercent >= 60 ? "high" : "normal",
    due_at: new Date(Date.now() + 1000 * 60 * 30).toISOString()
  });

  return { leadId: data.lead_code, persisted: true };
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
