/**
 * src/lib/sales-recommendation.ts
 *
 * Server-only Supabase I/O and orchestration for the Phase 3 website
 * recommendation engine. All actual recommendation logic lives in the pure,
 * dependency-free src/lib/recommendation-engine.ts; this file loads the
 * inputs that engine needs (questionnaire answers, business rules, the
 * portal-product catalog, Fusion service packages, and add-on services) and
 * persists the resulting versioned recommendation object, mirroring the
 * pure/I-O split already used by sales-rules.ts (Phase 1) and
 * sales-questionnaire.ts (Phase 2).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { BUDGET_SPECIAL_TOKENS, type AnswerMap } from "@/lib/questionnaire-schema";
import { loadQuestionnaireState } from "@/lib/sales-questionnaire";
import { loadBusinessRules, loadPortalProductCatalog } from "@/lib/sales-rules";
import {
  buildRecommendation,
  type AddOnServiceLite,
  type BudgetSpecialToken,
  type PortalProductLite,
  type RecommendationItem,
  type RecommendationPath,
  type RecommendationResult,
  type ServicePackageLite
} from "@/lib/recommendation-engine";
import { ensureShareTokenForSession } from "@/lib/sales-result";

// ---------------------------------------------------------------------------
// Supabase client (duplicated small helper, matching the existing pattern in
// src/lib/crm.ts, src/lib/sales-rules.ts, and src/lib/sales-questionnaire.ts
// rather than sharing a singleton across modules).
// ---------------------------------------------------------------------------

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
  await supabase.from("crm_activities").insert({
    organization_id: organizationId,
    actor_id: null,
    action_type: "recommendation",
    entity_type: "lead",
    entity_id: entityId,
    summary,
    metadata
  });
}

// ---------------------------------------------------------------------------
// Loaders for engine inputs not already covered by sales-rules.ts
// ---------------------------------------------------------------------------

async function loadServicePackages(supabase: SupabaseClient<any>, organizationId: string): Promise<ServicePackageLite[]> {
  const { data, error } = await supabase
    .from("crm_service_packages")
    .select("id, package_key, package_name, setup_price, monthly_price, inclusions")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data as ServicePackageLite[];
}

async function loadAddOnServices(supabase: SupabaseClient<any>, organizationId: string): Promise<AddOnServiceLite[]> {
  const { data, error } = await supabase
    .from("crm_services")
    .select("id, slug, service_name, base_price, billing_type, recurring_interval, crm_service_categories(slug)")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error || !data) return [];

  return (data as Array<Record<string, any>>).map((row) => ({
    id: row.id,
    slug: row.slug,
    service_name: row.service_name,
    base_price: row.base_price,
    billing_type: row.billing_type,
    recurring_interval: row.recurring_interval,
    category_slug: row.crm_service_categories?.slug ?? null
  }));
}

// ---------------------------------------------------------------------------
// Budget answer parsing (session answers already validated by Phase 2 -
// total_budget is stored as either a numeric string or one of
// BUDGET_SPECIAL_TOKENS, per submitBudgetAnswer in sales-questionnaire.ts).
// ---------------------------------------------------------------------------

function readBudgetFromAnswers(answers: AnswerMap): { amountUsd: number | null; specialToken: BudgetSpecialToken } {
  const raw = answers.total_budget;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return { amountUsd: null, specialToken: null };

  if ((BUDGET_SPECIAL_TOKENS as readonly string[]).includes(value)) {
    return { amountUsd: null, specialToken: value as BudgetSpecialToken };
  }

  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric)) return { amountUsd: numeric, specialToken: null };

  return { amountUsd: null, specialToken: null };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function confidenceLevel(score: number): "low" | "standard" | "high" {
  if (score >= 75) return "high";
  if (score >= 45) return "standard";
  return "low";
}

function buildRationale(result: RecommendationResult): string {
  const category = result.recommendedCategory.replace(/_/g, " ");
  return `Recommended based on a ${category} project with a complexity score of ${result.complexityScore}/100. ${result.recommendedNextAction}`;
}

function packageSnapshot(path: RecommendationPath) {
  return {
    package_key: path.packageKey,
    package_name: path.packageName,
    total_design_cost: path.totalDesignCost,
    monthly_cost: path.monthlyCost,
    snapshot_taken_at: new Date().toISOString()
  };
}

async function insertRequirements(
  supabase: SupabaseClient<any>,
  recommendationId: string,
  items: RecommendationItem[],
  isRequired: boolean,
  startSortOrder: number
) {
  if (!items.length) return;
  const rows = items.map((item, index) => ({
    recommendation_id: recommendationId,
    requirement_key: item.key,
    requirement_type: item.kind,
    is_required: isRequired,
    linked_service_id: item.linkedServiceId ?? null,
    linked_portal_product_id: item.linkedPortalProductId ?? null,
    notes: item.notes ?? null,
    sort_order: startSortOrder + index
  }));
  await supabase.from("sales_product_requirements").insert(rows);
}

export type StoredRecommendation = RecommendationResult & {
  recommendationId: string;
  version: number;
};

export async function generateRecommendationForSession(
  sessionToken: string,
  organizationId?: string
): Promise<{ ok: true; recommendation: StoredRecommendation } | { ok: false; reason: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, reason: "Recommendation storage is not configured." };
  const orgId = organizationId || (await getDefaultOrganizationId(supabase));
  if (!orgId) return { ok: false, reason: "Recommendation storage is not configured." };

  const state = await loadQuestionnaireState(sessionToken, orgId);
  if (!state) return { ok: false, reason: "Session not found." };

  const { amountUsd, specialToken } = readBudgetFromAnswers(state.answers);

  const [businessRules, portalCatalog, packages, addOnServices] = await Promise.all([
    loadBusinessRules(orgId),
    loadPortalProductCatalog(orgId) as Promise<PortalProductLite[]>,
    loadServicePackages(supabase, orgId),
    loadAddOnServices(supabase, orgId)
  ]);

  const result = buildRecommendation({
    answers: state.answers,
    totalPlannedBudgetUsd: amountUsd,
    budgetSpecialToken: specialToken,
    businessRules,
    portalCatalog,
    packages,
    addOnServices
  });

  // Find the current recommendation (if any) for this session so a new one
  // can be versioned rather than duplicated - the previous row is marked
  // 'superseded' and linked via parent_recommendation_id, preserving
  // history for audit purposes per the versioned-recommendations rule.
  const { data: previous } = await supabase
    .from("sales_website_recommendations")
    .select("id, version")
    .eq("session_id", state.session.id)
    .eq("status", "draft")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; version: number }>();

  if (previous) {
    await supabase.from("sales_website_recommendations").update({ status: "superseded", updated_at: new Date().toISOString() }).eq("id", previous.id);
  }

  const recommendedPath = result.paths.find((p) => p.kind === "recommended") || result.paths[0];
  const recommendedPackageRow = packages.find((p) => p.package_key === recommendedPath?.packageKey) || null;

  const { data: recRow, error: recError } = await supabase
    .from("sales_website_recommendations")
    .insert({
      organization_id: orgId,
      session_id: state.session.id,
      lead_id: state.session.lead_id,
      budget_assessment_id: null,
      recommended_package_id: recommendedPackageRow?.id ?? null,
      package_snapshot: recommendedPath ? packageSnapshot(recommendedPath) : {},
      total_design_cost: recommendedPath?.totalDesignCost ?? 0,
      monthly_cost: recommendedPath?.monthlyCost ?? 0,
      discount_amount: 0,
      discount_reason: null,
      rationale: buildRationale(result),
      sales_angle: recommendedPath?.reason ?? null,
      confidence_level: confidenceLevel(result.confidenceScore),
      status: "draft",
      version: previous ? previous.version + 1 : 1,
      parent_recommendation_id: previous?.id ?? null,
      recommended_category: result.recommendedCategory,
      feasibility_status: result.feasibilityStatus,
      complexity_score: result.complexityScore,
      confidence_score: result.confidenceScore,
      assumptions: result.assumptions,
      missing_information: result.missingInformation,
      recommended_next_action: result.recommendedNextAction,
      total_planned_budget: result.totalPlannedBudget,
      required_portal_cost: result.requiredPortalCost,
      design_allocation: result.designAllocation,
      remaining_cushion: result.remainingCushion,
      budget_gap: result.budgetGap,
      engine_version: 1
    })
    .select("id, version")
    .single<{ id: string; version: number }>();

  if (recError || !recRow) {
    console.error("Unable to persist recommendation.", recError);
    return { ok: false, reason: "Unable to save the recommendation." };
  }

  // Phase 6: make sure a shareable /results/[token] link exists for this
  // session as soon as a recommendation does, so it's ready to hand to the
  // client (via text/email, or copied from the admin CRM lead view)
  // without a separate provisioning step. Never blocks recommendation
  // generation if it fails for some reason.
  await ensureShareTokenForSession(state.session.id);

  const alternatives = result.paths.filter((p) => p.kind !== "recommended");
  if (alternatives.length) {
    await supabase.from("sales_recommendation_alternatives").insert(
      alternatives.map((path, index) => {
        const pkg = packages.find((p) => p.package_key === path.packageKey) || null;
        return {
          recommendation_id: recRow.id,
          alternative_package_id: pkg?.id ?? null,
          package_snapshot: packageSnapshot(path),
          total_design_cost: path.totalDesignCost,
          monthly_cost: path.monthlyCost,
          reason_suggested: path.reason,
          path_label: path.kind,
          required_portal_cost: result.requiredPortalCost,
          feasibility_status: result.feasibilityStatus,
          sort_order: index
        };
      })
    );
  }

  await insertRequirements(supabase, recRow.id, result.requiredFeatures, true, 0);
  await insertRequirements(supabase, recRow.id, result.optionalFeatures, false, 100);
  await insertRequirements(supabase, recRow.id, result.requiredPortalProducts, true, 200);
  await insertRequirements(supabase, recRow.id, result.optionalPortalProducts, false, 300);
  await insertRequirements(supabase, recRow.id, result.clientProvidedItems, false, 400);

  if (state.session.lead_id) {
    await supabase
      .from("crm_leads")
      .update({
        package_key: recommendedPath?.packageKey || "fusion-custom",
        package_name: recommendedPath?.packageName || "Pending recommendation",
        recommendation: {
          feasibility_status: result.feasibilityStatus,
          recommended_category: result.recommendedCategory,
          total_design_cost: recommendedPath?.totalDesignCost ?? 0
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", state.session.lead_id);

    await logActivity(
      supabase,
      orgId,
      state.session.lead_id,
      `Website recommendation generated (v${recRow.version}): ${result.feasibilityStatus}`,
      { session_id: state.session.id, recommendation_id: recRow.id }
    );
  }

  return { ok: true, recommendation: { ...result, recommendationId: recRow.id, version: recRow.version } };
}

export async function loadLatestRecommendation(
  sessionToken: string,
  organizationId?: string
): Promise<{ id: string; version: number; feasibility_status: string; recommended_category: string } | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const orgId = organizationId || (await getDefaultOrganizationId(supabase));
  if (!orgId) return null;

  const state = await loadQuestionnaireState(sessionToken, orgId);
  if (!state) return null;

  const { data, error } = await supabase
    .from("sales_website_recommendations")
    .select("id, version, feasibility_status, recommended_category")
    .eq("session_id", state.session.id)
    .eq("status", "draft")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
