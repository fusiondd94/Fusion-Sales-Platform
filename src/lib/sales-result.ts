/**
 * src/lib/sales-result.ts
 *
 * Server-only Supabase I/O and orchestration for the Phase 6 dedicated
 * shareable sales result page (/results/[token]). Validation/formatting
 * logic that doesn't touch the database lives in the pure
 * src/lib/sales-result-rules.ts, mirroring the pure/I-O split already used
 * by sales-recommendation.ts, sales-questionnaire.ts, and portal.ts.
 *
 * This page is public and unauthenticated by design (it exists to be
 * texted/emailed to a prospect), so every function here resolves access
 * through the unguessable result_share_token column on
 * sales_questionnaire_sessions - never through the httpOnly session_token
 * cookie used by the questionnaire flow itself, and never through anything
 * an admin session is required for. No pricing is computed here; every
 * dollar figure is read back from the versioned sales_website_recommendations
 * row already persisted by generateRecommendationForSession(), so the
 * "server-side-only pricing" rule holds without recomputing anything.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { RecommendationPath, RecommendationPathKind } from "@/lib/recommendation-engine";
import { loadBusinessRules } from "@/lib/sales-rules";
import { createConsultationRequest } from "@/lib/sales-questionnaire";
import {
  computeResultViewState,
  firstNameFrom,
  isValidShareToken,
  resolveDecisionTransition,
  type ClientDecision,
  type ResultViewState
} from "@/lib/sales-result-rules";

let cachedClient: SupabaseClient<any> | null = null;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cachedClient) {
    cachedClient = createClient<any>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return cachedClient;
}

async function getDefaultOrganizationId(supabase: SupabaseClient<any>): Promise<string | null> {
  const { data, error } = await supabase
    .from("crm_organizations")
    .select("id")
    .eq("slug", "fusion-digital-dynamics")
    .single<{ id: string }>();
  if (error || !data) return null;
  return data.id;
}

async function logActivity(
  supabase: SupabaseClient<any>,
  organizationId: string,
  entityId: string | null,
  summary: string,
  metadata: Record<string, string | number | boolean | null> = {}
) {
  if (!entityId) return;
  await supabase.from("crm_activities").insert({
    organization_id: organizationId,
    actor_id: null,
    action_type: "result_page",
    entity_type: "lead",
    entity_id: entityId,
    summary,
    metadata
  });
}

// ---------------------------------------------------------------------------
// Share token lifecycle
// ---------------------------------------------------------------------------

export function generateShareToken(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Returns the existing public share URL token for a questionnaire session,
 * generating and persisting one the first time it's needed. Idempotent and
 * safe to call from a read path (e.g. surfacing the link in the admin CRM
 * lead view) as well as immediately after a recommendation is generated.
 */
export async function ensureShareTokenForSession(sessionId: string): Promise<string | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data: existing } = await supabase
    .from("sales_questionnaire_sessions")
    .select("result_share_token")
    .eq("id", sessionId)
    .single<{ result_share_token: string | null }>();

  if (existing?.result_share_token) return existing.result_share_token;

  const token = generateShareToken();
  const { data: updated, error } = await supabase
    .from("sales_questionnaire_sessions")
    .update({ result_share_token: token, result_share_token_created_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("result_share_token", null)
    .select("result_share_token")
    .single<{ result_share_token: string }>();

  if (error || !updated) {
    // Lost a race with a concurrent call - re-read whatever token won.
    const { data: reread } = await supabase
      .from("sales_questionnaire_sessions")
      .select("result_share_token")
      .eq("id", sessionId)
      .single<{ result_share_token: string | null }>();
    return reread?.result_share_token || null;
  }

  return updated.result_share_token;
}

/**
 * Builds the full public results URL for a token. Mirrors the exact
 * NEXT_PUBLIC_APP_URL-with-production-fallback pattern already used by
 * src/lib/email-marketing.ts for absolute links, rather than inventing a
 * new convention.
 */
export function buildShareUrl(token: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fusion-digital-dynamics-sales-platf.vercel.app";
  return `${siteUrl.replace(/\/$/, "")}/results/${token}`;
}

/**
 * Admin-CRM convenience lookup: given a crm_leads.id, finds that lead's
 * most recent questionnaire session and returns its shareable results URL,
 * generating a token if one doesn't exist yet. Used by the "Edit lead"
 * panel in /fusionadmin/clients so a Fusion rep can copy/paste the link to
 * text or email a prospect.
 */
export async function getShareUrlForLead(leadId: string): Promise<string | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data: session } = await supabase
    .from("sales_questionnaire_sessions")
    .select("id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (!session) return null;

  const token = await ensureShareTokenForSession(session.id);
  if (!token) return null;

  return buildShareUrl(token);
}

// ---------------------------------------------------------------------------
// Loading the public result payload
// ---------------------------------------------------------------------------

type SessionRow = {
  id: string;
  organization_id: string;
  lead_id: string | null;
  session_token: string;
};

type RecommendationRow = {
  id: string;
  version: number;
  package_snapshot: { package_key?: string; package_name?: string } | null;
  total_design_cost: number;
  monthly_cost: number;
  sales_angle: string | null;
  recommended_next_action: string | null;
  feasibility_status: string;
  total_planned_budget: number;
  required_portal_cost: number;
  design_allocation: number;
  remaining_cushion: number;
  budget_gap: number;
  missing_information: string[];
  view_count: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  client_decision: ClientDecision;
  client_decision_at: string | null;
  call_requested_at: string | null;
  created_at: string;
};

type AlternativeRow = {
  package_snapshot: { package_key?: string; package_name?: string } | null;
  total_design_cost: number;
  monthly_cost: number;
  reason_suggested: string | null;
  path_label: RecommendationPathKind;
};

async function resolveSessionAndRecommendation(
  supabase: SupabaseClient<any>,
  shareToken: string
): Promise<{ session: SessionRow; recommendation: RecommendationRow } | null> {
  const { data: session } = await supabase
    .from("sales_questionnaire_sessions")
    .select("id, organization_id, lead_id, session_token")
    .eq("result_share_token", shareToken)
    .single<SessionRow>();

  if (!session) return null;

  const { data: recommendation } = await supabase
    .from("sales_website_recommendations")
    .select(
      "id, version, package_snapshot, total_design_cost, monthly_cost, sales_angle, recommended_next_action, feasibility_status, total_planned_budget, required_portal_cost, design_allocation, remaining_cushion, budget_gap, missing_information, view_count, first_viewed_at, last_viewed_at, client_decision, client_decision_at, call_requested_at, created_at"
    )
    .eq("session_id", session.id)
    .eq("status", "draft")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<RecommendationRow>();

  if (!recommendation) return null;

  return { session, recommendation };
}

export type PublicResultPayload = {
  recommendationId: string;
  version: number;
  businessName: string | null;
  contactFirstName: string | null;
  feasibilityStatus: string;
  recommendedNextAction: string | null;
  totalPlannedBudget: number;
  requiredPortalCost: number;
  designAllocation: number;
  remainingCushion: number;
  budgetGap: number;
  missingInformation: string[];
  portalPricingDisclaimer: string;
  paths: RecommendationPath[];
  viewState: ResultViewState;
  viewCount: number;
  firstViewedAt: string | null;
  callRequestedAt: string | null;
  generatedAt: string;
};

function pathFromSnapshot(
  kind: RecommendationPathKind,
  snapshot: { package_key?: string; package_name?: string } | null,
  totalDesignCost: number,
  monthlyCost: number,
  reason: string | null
): RecommendationPath {
  const labels: Record<RecommendationPathKind, string> = {
    recommended: "Recommended",
    growth: "Growth option",
    starter_phased: "Starter / phased option"
  };
  return {
    kind,
    label: labels[kind],
    packageKey: snapshot?.package_key ?? null,
    packageName: snapshot?.package_name ?? null,
    totalDesignCost,
    monthlyCost,
    reason: reason || ""
  };
}

export async function loadResultByShareToken(shareToken: string): Promise<{ ok: true; result: PublicResultPayload } | { ok: false; reason: string }> {
  if (!isValidShareToken(shareToken)) return { ok: false, reason: "This link is not valid." };

  const supabase = getServiceClient();
  if (!supabase) return { ok: false, reason: "The results page is not configured." };

  const resolved = await resolveSessionAndRecommendation(supabase, shareToken);
  if (!resolved) return { ok: false, reason: "We could not find a plan for this link." };
  const { session, recommendation } = resolved;

  const [{ data: lead }, businessRules, { data: alternatives }] = await Promise.all([
    session.lead_id
      ? supabase.from("crm_leads").select("company, customer_name").eq("id", session.lead_id).single<{ company: string | null; customer_name: string | null }>()
      : Promise.resolve({ data: null }),
    loadBusinessRules(session.organization_id),
    supabase
      .from("sales_recommendation_alternatives")
      .select("package_snapshot, total_design_cost, monthly_cost, reason_suggested, path_label")
      .eq("recommendation_id", recommendation.id)
      .order("sort_order", { ascending: true })
      .returns<AlternativeRow[]>()
  ]);

  const paths: RecommendationPath[] = [
    pathFromSnapshot("recommended", recommendation.package_snapshot, recommendation.total_design_cost, recommendation.monthly_cost, recommendation.sales_angle),
    ...(alternatives || []).map((alt) => pathFromSnapshot(alt.path_label, alt.package_snapshot, alt.total_design_cost, alt.monthly_cost, alt.reason_suggested))
  ];

  const result: PublicResultPayload = {
    recommendationId: recommendation.id,
    version: recommendation.version,
    businessName: lead?.company ?? null,
    contactFirstName: firstNameFrom(lead?.customer_name ?? null),
    feasibilityStatus: recommendation.feasibility_status,
    recommendedNextAction: recommendation.recommended_next_action,
    totalPlannedBudget: recommendation.total_planned_budget,
    requiredPortalCost: recommendation.required_portal_cost,
    designAllocation: recommendation.design_allocation,
    remainingCushion: recommendation.remaining_cushion,
    budgetGap: recommendation.budget_gap,
    missingInformation: recommendation.missing_information || [],
    portalPricingDisclaimer: businessRules.portalPricingDisclaimerText,
    paths,
    viewState: computeResultViewState({ decision: recommendation.client_decision, viewCountBeforeThisView: recommendation.view_count }),
    viewCount: recommendation.view_count,
    firstViewedAt: recommendation.first_viewed_at,
    callRequestedAt: recommendation.call_requested_at,
    generatedAt: recommendation.created_at
  };

  return { ok: true, result };
}

// ---------------------------------------------------------------------------
// View / decision / call-request tracking
// ---------------------------------------------------------------------------

export async function recordResultView(shareToken: string): Promise<void> {
  if (!isValidShareToken(shareToken)) return;
  const supabase = getServiceClient();
  if (!supabase) return;

  const resolved = await resolveSessionAndRecommendation(supabase, shareToken);
  if (!resolved) return;
  const { recommendation } = resolved;

  const now = new Date().toISOString();
  await supabase
    .from("sales_website_recommendations")
    .update({
      view_count: recommendation.view_count + 1,
      first_viewed_at: recommendation.first_viewed_at || now,
      last_viewed_at: now
    })
    .eq("id", recommendation.id);
}

export async function submitResultDecision(shareToken: string, rawDecision: unknown): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isValidShareToken(shareToken)) return { ok: false, reason: "This link is not valid." };

  const transition = resolveDecisionTransition(rawDecision);
  if (!transition.ok) return transition;

  const supabase = getServiceClient();
  if (!supabase) return { ok: false, reason: "The results page is not configured." };

  const resolved = await resolveSessionAndRecommendation(supabase, shareToken);
  if (!resolved) return { ok: false, reason: "We could not find a plan for this link." };
  const { session, recommendation } = resolved;

  await supabase
    .from("sales_website_recommendations")
    .update({ client_decision: transition.decision, client_decision_at: new Date().toISOString() })
    .eq("id", recommendation.id);

  await logActivity(
    supabase,
    session.organization_id,
    session.lead_id,
    `Client ${transition.decision} their website plan via the shareable results page (v${recommendation.version}).`,
    { recommendation_id: recommendation.id, decision: transition.decision }
  );

  return { ok: true };
}

export async function requestCallFromResults(
  shareToken: string,
  preferredContactMethod: string | null
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isValidShareToken(shareToken)) return { ok: false, reason: "This link is not valid." };

  const supabase = getServiceClient();
  if (!supabase) return { ok: false, reason: "The results page is not configured." };

  const resolved = await resolveSessionAndRecommendation(supabase, shareToken);
  if (!resolved) return { ok: false, reason: "We could not find a plan for this link." };
  const { session, recommendation } = resolved;

  const validMethods = new Set(["email", "phone", "text", "video_call"]);
  const method = preferredContactMethod && validMethods.has(preferredContactMethod) ? preferredContactMethod : null;

  const consultation = await createConsultationRequest(session.session_token, "schedule_call_from_results", method, session.organization_id);
  if (!consultation.ok) return { ok: false, reason: consultation.reason || "Unable to save your request. Please try again." };

  await supabase.from("sales_website_recommendations").update({ call_requested_at: new Date().toISOString() }).eq("id", recommendation.id);

  return { ok: true };
}
