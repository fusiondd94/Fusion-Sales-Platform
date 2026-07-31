/**
 * src/lib/sales-questionnaire.ts
 *
 * Server-only session/answer persistence and orchestration for the Fusion
 * adaptive client questionnaire (Phase 2). Branching/validation logic itself
 * lives in the pure, dependency-free src/lib/questionnaire-schema.ts; this
 * file is the I/O layer that reads and writes Supabase, and delegates
 * budget-minimum enforcement to src/lib/sales-rules.ts (Phase 1) rather than
 * re-implementing any pricing or minimum-budget logic here.
 *
 * Nothing in this file invents a discount, hard-codes a price, or trusts a
 * client-submitted total - every budget figure is re-validated against the
 * admin-controlled business rules loaded by sales-rules.ts.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { AnswerMap, AnswerValue, BudgetParseResult, QuestionDefinition, QuestionnaireProgress } from "@/lib/questionnaire-schema";
import {
  CONTACT_QUESTION_KEYS,
  QUESTION_DEFINITIONS,
  computeProgress,
  getNextQuestion,
  hasContactInfo,
  parseBudgetInput,
  validateAnswerForQuestion
} from "@/lib/questionnaire-schema";
import type { BudgetAssessmentResult } from "@/lib/sales-rules";
import { assessBudgetForOrganization, loadPortalProductCatalog } from "@/lib/sales-rules";

// ---------------------------------------------------------------------------
// Supabase client (duplicated small helper, matching the existing pattern in
// src/lib/crm.ts and src/lib/sales-rules.ts rather than sharing a singleton
// across modules).
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
  entityType: string,
  entityId: string | null,
  summary: string,
  metadata: Record<string, string | number | boolean | null> = {}
) {
  await supabase.from("crm_activities").insert({
    organization_id: organizationId,
    actor_id: null,
    action_type: "questionnaire",
    entity_type: entityType,
    entity_id: entityId,
    summary,
    metadata
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuestionnaireSessionRow = {
  id: string;
  organization_id: string;
  lead_id: string | null;
  session_token: string;
  status: "in_progress" | "completed" | "abandoned";
  current_step: string | null;
  started_at: string;
  last_activity_at: string;
};

export type QuestionnaireSessionMeta = {
  entryUrl?: string;
  referrerUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  ipHash?: string;
  userAgent?: string;
};

export type QuestionnaireState = {
  session: QuestionnaireSessionRow;
  answers: AnswerMap;
  nextQuestion: QuestionDefinition | null;
  progress: QuestionnaireProgress;
};

export type SubmitAnswerResult =
  | { ok: true; state: QuestionnaireState }
  | { ok: false; reason: string };

export type SubmitBudgetResult =
  | {
      ok: true;
      parseResult: BudgetParseResult;
      assessment: BudgetAssessmentResult | null;
      requiredPortalCostEstimate: number | null;
      state: QuestionnaireState;
    }
  | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

function generateSessionToken(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export async function createQuestionnaireSession(
  meta: QuestionnaireSessionMeta = {},
  organizationId?: string
): Promise<QuestionnaireState | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const orgId = organizationId || (await getDefaultOrganizationId(supabase));
  if (!orgId) return null;

  const sessionToken = generateSessionToken();
  const { data, error } = await supabase
    .from("sales_questionnaire_sessions")
    .insert({
      organization_id: orgId,
      session_token: sessionToken,
      status: "in_progress",
      entry_url: meta.entryUrl || null,
      referrer_url: meta.referrerUrl || null,
      utm_source: meta.utmSource || null,
      utm_medium: meta.utmMedium || null,
      utm_campaign: meta.utmCampaign || null,
      utm_term: meta.utmTerm || null,
      utm_content: meta.utmContent || null,
      ip_hash: meta.ipHash || null,
      user_agent: meta.userAgent || null
    })
    .select("id, organization_id, lead_id, session_token, status, current_step, started_at, last_activity_at")
    .single<QuestionnaireSessionRow>();

  if (error || !data) {
    console.error("Unable to create questionnaire session.", error);
    return null;
  }

  return {
    session: data,
    answers: {},
    nextQuestion: getNextQuestion({}),
    progress: computeProgress({})
  };
}

async function fetchSessionRow(supabase: SupabaseClient<any>, sessionToken: string, organizationId: string) {
  const { data, error } = await supabase
    .from("sales_questionnaire_sessions")
    .select("id, organization_id, lead_id, session_token, status, current_step, started_at, last_activity_at")
    .eq("organization_id", organizationId)
    .eq("session_token", sessionToken)
    .single<QuestionnaireSessionRow>();
  if (error || !data) return null;
  return data;
}

async function fetchAnswers(supabase: SupabaseClient<any>, sessionId: string): Promise<AnswerMap> {
  const { data, error } = await supabase
    .from("sales_questionnaire_answers")
    .select("question_key, answer_value")
    .eq("session_id", sessionId);

  if (error || !data) return {};

  const answers: AnswerMap = {};
  for (const row of data as Array<{ question_key: string; answer_value: unknown }>) {
    const value = row.answer_value as { value?: AnswerValue };
    answers[row.question_key] = value && "value" in value ? (value.value as AnswerValue) : null;
  }
  return answers;
}

export async function loadQuestionnaireState(sessionToken: string, organizationId?: string): Promise<QuestionnaireState | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const orgId = organizationId || (await getDefaultOrganizationId(supabase));
  if (!orgId) return null;

  const session = await fetchSessionRow(supabase, sessionToken, orgId);
  if (!session) return null;

  const answers = await fetchAnswers(supabase, session.id);
  return {
    session,
    answers,
    nextQuestion: getNextQuestion(answers),
    progress: computeProgress(answers)
  };
}

async function touchSession(supabase: SupabaseClient<any>, sessionId: string, currentStep: string) {
  await supabase
    .from("sales_questionnaire_sessions")
    .update({ current_step: currentStep, last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", sessionId);
}

export async function markSessionCompleted(sessionToken: string, organizationId?: string): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;
  const orgId = organizationId || (await getDefaultOrganizationId(supabase));
  if (!orgId) return;
  await supabase
    .from("sales_questionnaire_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("session_token", sessionToken);
}

/**
 * Marks a session abandoned. Not yet wired to an automatic scheduled job in
 * Phase 2 (that belongs with the follow-up automation work in Phase 7) - this
 * is exposed now so an explicit "save for later" / close action, or a future
 * cron job, can call it without a schema change later.
 */
export async function markSessionAbandoned(sessionToken: string, organizationId?: string): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;
  const orgId = organizationId || (await getDefaultOrganizationId(supabase));
  if (!orgId) return;
  await supabase
    .from("sales_questionnaire_sessions")
    .update({ status: "abandoned", abandoned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("session_token", sessionToken)
    .eq("status", "in_progress");
}

// ---------------------------------------------------------------------------
// Answer persistence
// ---------------------------------------------------------------------------

async function upsertAnswerRow(supabase: SupabaseClient<any>, sessionId: string, questionKey: string, value: AnswerValue) {
  await supabase
    .from("sales_questionnaire_answers")
    .upsert(
      {
        session_id: sessionId,
        question_key: questionKey,
        answer_value: { value },
        answered_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: "session_id,question_key" }
    );
}

/** Submits an answer to any question EXCEPT total_budget (see submitBudgetAnswer). */
export async function submitAnswer(
  sessionToken: string,
  questionKey: string,
  rawValue: AnswerValue,
  organizationId?: string
): Promise<SubmitAnswerResult> {
  if (questionKey === "total_budget") {
    return { ok: false, reason: "Use submitBudgetAnswer for the budget question." };
  }

  const question = QUESTION_DEFINITIONS.find((candidate) => candidate.key === questionKey);
  if (!question) return { ok: false, reason: "Unknown question." };

  const validation = validateAnswerForQuestion(question, rawValue);
  if (!validation.valid) return { ok: false, reason: validation.reason || "Invalid answer." };

  const supabase = getServiceClient();
  if (!supabase) return { ok: false, reason: "Questionnaire storage is not configured." };
  const orgId = organizationId || (await getDefaultOrganizationId(supabase));
  if (!orgId) return { ok: false, reason: "Questionnaire storage is not configured." };

  const session = await fetchSessionRow(supabase, sessionToken, orgId);
  if (!session) return { ok: false, reason: "Session not found." };

  await upsertAnswerRow(supabase, session.id, questionKey, rawValue);
  await touchSession(supabase, session.id, questionKey);

  const answers = await fetchAnswers(supabase, session.id);

  if (questionKey === "marketing_consent") {
    await recordMarketingConsent(supabase, orgId, session, answers);
  }

  if (!session.lead_id && hasContactInfo(answers)) {
    const leadId = await upsertLeadFromSession(supabase, orgId, session, answers);
    if (leadId) session.lead_id = leadId;
  } else if (session.lead_id) {
    await refreshLeadFromSession(supabase, orgId, session.lead_id, answers);
  }

  const nextQuestion = getNextQuestion(answers);
  if (!nextQuestion && session.status === "in_progress") {
    await markSessionCompleted(sessionToken, orgId);
    session.status = "completed";
  }

  return {
    ok: true,
    state: { session, answers, nextQuestion, progress: computeProgress(answers) }
  };
}

// ---------------------------------------------------------------------------
// Budget question (special-cased: validation, minimum-budget assessment,
// and the "never a dead end" below-minimum next steps all live here).
// ---------------------------------------------------------------------------

/**
 * Rough first-year cost of the portal products marked required-by-default in
 * the admin catalog (domain, hosting, SSL by default). This is a Phase 2
 * approximation used only to give the prospect an early, honest sense of
 * their likely design-fee allocation before we know which of these products
 * they may already own - the full recommendation engine (Phase 3) re-derives
 * this precisely once existing-asset questions are answered.
 */
export async function estimateRequiredPortalCost(organizationId?: string): Promise<number> {
  const products = (await loadPortalProductCatalog(organizationId)) as Array<{
    is_required_default: boolean;
    estimated_price: number;
    price_unit: "one_time" | "monthly" | "annual";
  }>;

  return products
    .filter((product) => product.is_required_default)
    .reduce((sum, product) => {
      const firstYearCost = product.price_unit === "monthly" ? product.estimated_price * 12 : product.estimated_price;
      return sum + Math.max(0, Math.round(firstYearCost));
    }, 0);
}

async function persistBudgetAssessment(
  supabase: SupabaseClient<any>,
  organizationId: string,
  sessionId: string,
  leadId: string | null,
  statedTotalBudget: number,
  designAllocation: number,
  assessment: BudgetAssessmentResult
) {
  await supabase.from("sales_budget_assessments").insert({
    organization_id: organizationId,
    session_id: sessionId,
    lead_id: leadId,
    stated_total_budget: statedTotalBudget,
    design_allocation: designAllocation,
    budget_type: "one_time",
    minimum_total_budget_applied: assessment.minimumTotalBudgetApplied,
    minimum_design_allocation_applied: assessment.minimumDesignAllocationApplied,
    meets_total_minimum: assessment.meetsTotalMinimum,
    meets_design_minimum: assessment.meetsDesignMinimum,
    business_rules_version: assessment.businessRulesVersion,
    assessment_notes: assessment.belowMinimum ? assessment.message : null
  });
}

export async function submitBudgetAnswer(sessionToken: string, rawInput: string, organizationId?: string): Promise<SubmitBudgetResult> {
  const parseResult = parseBudgetInput(rawInput);
  if (parseResult.kind === "invalid") return { ok: false, reason: parseResult.reason };

  const supabase = getServiceClient();
  if (!supabase) return { ok: false, reason: "Questionnaire storage is not configured." };
  const orgId = organizationId || (await getDefaultOrganizationId(supabase));
  if (!orgId) return { ok: false, reason: "Questionnaire storage is not configured." };

  const session = await fetchSessionRow(supabase, sessionToken, orgId);
  if (!session) return { ok: false, reason: "Session not found." };

  // Store the canonical token/amount as the answer value, consistent with
  // every other question in AnswerMap (string in, string out).
  const storedValue = parseResult.kind === "amount" ? String(parseResult.amountUsd) : parseResult.kind;
  await upsertAnswerRow(supabase, session.id, "total_budget", storedValue);
  await touchSession(supabase, session.id, "total_budget");

  let assessment: BudgetAssessmentResult | null = null;
  let requiredPortalCostEstimate: number | null = null;

  if (parseResult.kind === "amount") {
    requiredPortalCostEstimate = await estimateRequiredPortalCost(orgId);
    const designAllocation = Math.max(0, parseResult.amountUsd - requiredPortalCostEstimate);
    assessment = await assessBudgetForOrganization(
      { statedTotalBudget: parseResult.amountUsd, designAllocation, budgetType: "one_time" },
      orgId
    );
    await persistBudgetAssessment(supabase, orgId, session.id, session.lead_id, parseResult.amountUsd, designAllocation, assessment);
  } else if (parseResult.kind === "payment_plan") {
    await createConsultationRequest(sessionToken, "wants_payment_plan", null, orgId);
  } else if (parseResult.kind === "talk_to_someone") {
    await createConsultationRequest(sessionToken, "other", null, orgId);
  }

  const answers = await fetchAnswers(supabase, session.id);
  const nextQuestion = getNextQuestion(answers);

  return {
    ok: true,
    parseResult,
    assessment,
    requiredPortalCostEstimate,
    state: { session, answers, nextQuestion, progress: computeProgress(answers) }
  };
}

// ---------------------------------------------------------------------------
// Lead creation (abandoned-session preservation): as soon as contact info is
// captured mid-questionnaire, we create the crm_leads row and link it to the
// session, so the lead survives even if the prospect never finishes.
// ---------------------------------------------------------------------------

function createQuestionnaireLeadCode(): string {
  return `FDD-Q-${Date.now().toString(36).toUpperCase()}`;
}

async function upsertLeadFromSession(
  supabase: SupabaseClient<any>,
  organizationId: string,
  session: QuestionnaireSessionRow,
  answers: AnswerMap
): Promise<string | null> {
  const businessName = String(answers.business_name || "").trim();
  const contactName = String(answers.contact_name || "").trim();
  const contactEmail = String(answers.contact_email || "").trim();
  const contactPhone = String(answers.contact_phone || "").trim();
  if (!businessName || !contactName || !contactEmail) return null;

  const leadCode = createQuestionnaireLeadCode();
  const { data, error } = await supabase
    .from("crm_leads")
    .insert({
      organization_id: organizationId,
      lead_code: leadCode,
      customer_name: contactName,
      customer_email: contactEmail,
      customer_phone: contactPhone,
      company: businessName,
      industry: (answers.industry as string) || null,
      goal: (answers.primary_conversion_goal as string) || null,
      timeline: (answers.decision_timeline as string) || null,
      budget: (answers.total_budget as string) || null,
      answers,
      recommendation: {},
      package_key: "fusion-custom",
      package_name: "Pending recommendation",
      total_today: 0,
      monthly_due: 0,
      discount_percent: 0,
      status: "captured",
      source_category: "questionnaire"
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("Unable to create lead from questionnaire session.", error);
    return null;
  }

  await supabase
    .from("sales_questionnaire_sessions")
    .update({ lead_id: data.id, updated_at: new Date().toISOString() })
    .eq("id", session.id);

  await supabase.from("crm_tasks").insert({
    organization_id: organizationId,
    lead_id: data.id,
    title: `Follow up with ${businessName} (questionnaire lead)`,
    owner: "Fusion AI Team",
    task_type: "Follow-Up",
    status: "open",
    priority: "normal",
    due_at: new Date(Date.now() + 1000 * 60 * 30).toISOString()
  });

  await logActivity(supabase, organizationId, "lead", data.id, `Lead captured via adaptive questionnaire: ${businessName}`, {
    session_id: session.id
  });

  return data.id;
}

async function refreshLeadFromSession(
  supabase: SupabaseClient<any>,
  organizationId: string,
  leadId: string,
  answers: AnswerMap
) {
  await supabase
    .from("crm_leads")
    .update({
      customer_name: (answers.contact_name as string) || undefined,
      customer_email: (answers.contact_email as string) || undefined,
      customer_phone: (answers.contact_phone as string) || undefined,
      company: (answers.business_name as string) || undefined,
      industry: (answers.industry as string) || null,
      goal: (answers.primary_conversion_goal as string) || null,
      timeline: (answers.decision_timeline as string) || null,
      budget: (answers.total_budget as string) || null,
      answers,
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("id", leadId);
}

// ---------------------------------------------------------------------------
// Consent (opt-in only, audit-logged, per-channel)
// ---------------------------------------------------------------------------

const CONSENT_TYPE_BY_OPTION: Record<string, string> = {
  marketing_email: "marketing_email",
  marketing_sms: "marketing_sms",
  marketing_calls: "marketing_calls"
};

async function recordMarketingConsent(
  supabase: SupabaseClient<any>,
  organizationId: string,
  session: QuestionnaireSessionRow,
  answers: AnswerMap
) {
  const selected = Array.isArray(answers.marketing_consent) ? answers.marketing_consent : [];
  if (!selected.length) return;

  const email = (answers.contact_email as string) || null;
  const rows = selected
    .filter((option) => CONSENT_TYPE_BY_OPTION[option])
    .map((option) => ({
      organization_id: organizationId,
      lead_id: session.lead_id,
      email,
      consent_type: CONSENT_TYPE_BY_OPTION[option],
      consent_given: true,
      consent_source: "website_questionnaire",
      given_at: new Date().toISOString()
    }));

  if (rows.length) await supabase.from("sales_consent_records").insert(rows);
}

// ---------------------------------------------------------------------------
// Consultation requests (explicit "talk to someone" / "payment plan" asks,
// and below-minimum-budget escalation)
// ---------------------------------------------------------------------------

export type ConsultationReason =
  | "below_minimum_budget"
  | "complex_project"
  | "undecided"
  | "wants_payment_plan"
  | "wants_phased_build"
  | "other";

export async function createConsultationRequest(
  sessionToken: string,
  reason: ConsultationReason,
  preferredContactMethod: string | null,
  organizationId?: string
): Promise<{ ok: boolean; reason?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, reason: "Questionnaire storage is not configured." };
  const orgId = organizationId || (await getDefaultOrganizationId(supabase));
  if (!orgId) return { ok: false, reason: "Questionnaire storage is not configured." };

  const session = await fetchSessionRow(supabase, sessionToken, orgId);
  if (!session) return { ok: false, reason: "Session not found." };

  const { error } = await supabase.from("sales_consultation_requests").insert({
    organization_id: orgId,
    lead_id: session.lead_id,
    session_id: session.id,
    reason,
    preferred_contact_method: preferredContactMethod,
    status: "requested"
  });

  if (error) return { ok: false, reason: "Unable to save your request. Please try again." };

  if (session.lead_id) {
    await logActivity(supabase, orgId, "lead", session.lead_id, `Consultation requested: ${reason}`, { session_id: session.id });
  }

  return { ok: true };
}
