/**
 * src/lib/sales-rules.ts
 *
 * Server-only business-rules module for the Fusion sales/recommendation
 * system (Phase 1 foundation).
 *
 * IMPORTANT: this module intentionally contains no hard-coded prices,
 * discounts, or minimums beyond the ABSOLUTE_* fail-safe floors below.
 * Every real value is loaded from the admin-controlled `sales_business_rules`,
 * `sales_discount_rules`, and `sales_payment_plan_rules` tables (see
 * supabase/migrations/20260731090000_sales_recommendation_foundation.sql).
 * UI components must call the functions in this module rather than embedding
 * pricing or thresholds themselves.
 *
 * The file is split into two halves:
 *   1. Pure functions and types (no I/O) - fully unit-testable in isolation.
 *   2. Supabase-backed loader functions that fetch config and delegate to
 *      the pure functions above.
 */

// ---------------------------------------------------------------------------
// Fail-safe absolute floors.
//
// These are NOT "the real minimums" - the real minimums live in
// sales_business_rules and are admin-editable. These constants are a safety
// net only: resolveBusinessRules() uses Math.max() against them so that an
// admin can raise the minimum budget/allocation above $300, but a missing,
// deleted, or misconfigured rule row can never silently drop the accepted
// minimum below $300. Likewise, if no discount configuration can be loaded
// at all, the system fails CLOSED (0% max discount) rather than open.
// ---------------------------------------------------------------------------
const ABSOLUTE_MINIMUM_TOTAL_BUDGET = 300;
const ABSOLUTE_MINIMUM_DESIGN_ALLOCATION = 300;
const FAIL_SAFE_MAX_DISCOUNT_PERCENT = 0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BudgetType = "one_time" | "monthly" | "combined" | "unsure";

export type BusinessRules = {
    minimumTotalBudget: number;
    minimumDesignAllocation: number;
    maximumDiscountPercent: number;
    depositRequiredPercent: number;
    salesEscalationThreshold: number;
    taxRatePercent: number;
    taxFeeDisclaimerText: string;
    belowMinimumMessage: string;
    /** Highest rule version among the rows used to build this object. */
    version: number;
};

export type BusinessRuleRow = {
    rule_key: string;
    rule_value: Record<string, unknown>;
    version: number;
    is_active: boolean;
};

export type NextStepAction =
    | "schedule_consultation"
  | "offer_payment_plan"
  | "offer_phased_build"
  | "save_for_later"
  | "increase_budget"
  | "check_promotions";

export type NextStep = {
    action: NextStepAction;
    label: string;
    description: string;
};

export type BudgetAssessmentInput = {
    statedTotalBudget: number;
    designAllocation: number;
    budgetType: BudgetType;
};

export type BudgetAssessmentResult = {
    meetsTotalMinimum: boolean;
    meetsDesignMinimum: boolean;
    belowMinimum: boolean;
    minimumTotalBudgetApplied: number;
    minimumDesignAllocationApplied: number;
    businessRulesVersion: number;
    message: string;
    nextSteps: NextStep[];
};

export type DiscountRule = {
    id: string;
    rule_code: string;
    rule_name: string;
    discount_type: "percent" | "fixed";
    discount_value: number;
    max_discount_amount: number | null;
    requires_manual_approval: boolean;
    is_active: boolean;
    valid_from: string;
    valid_until: string | null;
};

export type DiscountValidationInput = {
    discountRuleId: string | null;
    discountAmount: number;
    subtotal: number;
};

export type DiscountValidationResult = {
    valid: boolean;
    reason?: string;
    cappedAmount?: number;
};

export type PaymentPlanRule = {
    id: string;
    plan_code: string;
    plan_name: string;
    deposit_percent: number;
    number_of_installments: number;
    installment_interval: "weekly" | "biweekly" | "monthly";
    minimum_eligible_total: number;
    is_active: boolean;
};

export type PortalProductSelectionInput = {
    price_unit: "one_time" | "monthly" | "annual";
    estimated_price: number;
    quantity: number;
};

export type LaunchCostBreakdown = {
    fusionDesignTotal: number;
    fusionMonthlyTotal: number;
    portalOneTimeTotal: number;
    portalMonthlyTotal: number;
    portalAnnualTotal: number;
    /** Fusion design fee + portal one-time + portal annual. Excludes recurring monthly totals, which are shown separately. */
    grandLaunchEstimate: number;
};

export type PurchaseVerificationInput = {
    verified: boolean;
    verification_method: "portal_api_sync" | "admin_manual_verification" | "client_submitted_pending_review";
} | null;

export type ServicePackageSnapshotInput = {
    id: string;
    package_key: string;
    package_name: string;
    setup_price: number;
    monthly_price: number;
    inclusions: string[];
};

export type ServicePackageSnapshot = ServicePackageSnapshotInput & {
    snapshot_taken_at: string;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function sanitizeAmount(value: number): number {
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.round(value);
}

function clampPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
}

// ---------------------------------------------------------------------------
// Business rules resolution
// ---------------------------------------------------------------------------

/**
 * Converts raw sales_business_rules rows into a typed BusinessRules object.
 * Only the highest-version, active row per rule_key is used. Missing rows
 * fall back to a conservative default (see FAIL_SAFE_* / ABSOLUTE_* above).
 */
export function resolveBusinessRules(rows: BusinessRuleRow[]): BusinessRules {
    const byKey = new Map<string, BusinessRuleRow>();
    for (const row of rows) {
          if (!row.is_active) continue;
          const existing = byKey.get(row.rule_key);
          if (!existing || row.version > existing.version) byKey.set(row.rule_key, row);
    }

  const numberField = (key: string, field: string, fallback: number): number => {
        const row = byKey.get(key);
        const value = row?.rule_value?.[field];
        return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };

  const textField = (key: string, field: string, fallback: string): string => {
        const row = byKey.get(key);
        const value = row?.rule_value?.[field];
        return typeof value === "string" && value.trim().length > 0 ? value : fallback;
  };

  const maxVersion = rows.reduce((max, row) => Math.max(max, row.version), 1);

  return {
        minimumTotalBudget: Math.max(
                ABSOLUTE_MINIMUM_TOTAL_BUDGET,
                numberField("minimum_total_budget", "amount", ABSOLUTE_MINIMUM_TOTAL_BUDGET)
              ),
        minimumDesignAllocation: Math.max(
                ABSOLUTE_MINIMUM_DESIGN_ALLOCATION,
                numberField("minimum_design_allocation", "amount", ABSOLUTE_MINIMUM_DESIGN_ALLOCATION)
              ),
        maximumDiscountPercent: clampPercent(
                numberField("maximum_discount_percent", "percent", FAIL_SAFE_MAX_DISCOUNT_PERCENT)
              ),
        depositRequiredPercent: clampPercent(numberField("deposit_required_percent", "percent", 50)),
        salesEscalationThreshold: numberField("sales_escalation_threshold", "amount", Number.POSITIVE_INFINITY),
        taxRatePercent: clampPercent(numberField("tax_rate_percent", "percent", 0)),
        taxFeeDisclaimerText: textField(
                "tax_fee_disclaimer_text",
                "text",
                "Prices shown are for Fusion Digital Dynamics LLC website design services only. Domain, hosting, SSL, email, and other third-party products are purchased separately through the Fusion client portal and are not included in this estimate."
              ),
        belowMinimumMessage: textField(
                "below_minimum_message",
                "text",
                `Our minimum project budget is $${ABSOLUTE_MINIMUM_TOTAL_BUDGET}. Let's talk about what's possible at your budget, a payment plan, or a phased build.`
              ),
        version: maxVersion
  };
}

// ---------------------------------------------------------------------------
// Budget assessment (never a dead end - always returns constructive next steps)
// ---------------------------------------------------------------------------

export function assessBudget(input: BudgetAssessmentInput, rules: BusinessRules): BudgetAssessmentResult {
    const statedTotalBudget = sanitizeAmount(input.statedTotalBudget);
    const designAllocation = sanitizeAmount(input.designAllocation);

  const meetsTotalMinimum = statedTotalBudget >= rules.minimumTotalBudget;
    const meetsDesignMinimum = designAllocation >= rules.minimumDesignAllocation;
    const belowMinimum = !meetsTotalMinimum || !meetsDesignMinimum;

  return {
        meetsTotalMinimum,
        meetsDesignMinimum,
        belowMinimum,
        minimumTotalBudgetApplied: rules.minimumTotalBudget,
        minimumDesignAllocationApplied: rules.minimumDesignAllocation,
        businessRulesVersion: rules.version,
        message: belowMinimum ? rules.belowMinimumMessage : "This budget meets our minimum project requirements.",
        nextSteps: belowMinimum ? buildBelowMinimumNextSteps() : []
  };
}

function buildBelowMinimumNextSteps(): NextStep[] {
    return [
      {
              action: "schedule_consultation",
              label: "Schedule a free consultation",
              description: "Talk through your goals and budget with our team to find the best path forward."
      },
      {
              action: "offer_payment_plan",
              label: "Ask about a payment plan",
              description: "Spread the design fee across two or more payments instead of paying it all up front."
      },
      {
              action: "offer_phased_build",
              label: "Start with a smaller phase",
              description: "Launch a focused first phase now and add features later as your budget grows."
      },
      {
              action: "save_for_later",
              label: "Save this plan for later",
              description: "We'll keep your answers on file so you can pick up right where you left off."
      },
      {
              action: "increase_budget",
              label: "Revisit your budget",
              description: "See what's possible if you're able to allocate a bit more toward the project."
      },
      {
              action: "check_promotions",
              label: "Ask about current promotions",
              description: "Our team can let you know about any active offers you may qualify for."
      }
        ];
}

// ---------------------------------------------------------------------------
// Discounts - admin-authorized only, never invented, never auto-applied
// ---------------------------------------------------------------------------

export function isDiscountRuleCurrentlyValid(rule: DiscountRule, now: Date = new Date()): boolean {
    if (!rule.is_active) return false;
    const validFrom = new Date(rule.valid_from);
    if (Number.isFinite(validFrom.getTime()) && now < validFrom) return false;
    if (rule.valid_until) {
          const validUntil = new Date(rule.valid_until);
          if (Number.isFinite(validUntil.getTime()) && now > validUntil) return false;
    }
    return true;
}

/** Computes the discount a given, already-approved rule would produce, capped by the rule's own cap and the global ceiling. */
export function computeDiscountAmount(rule: DiscountRule, subtotal: number, maximumDiscountPercent: number): number {
    const safeSubtotal = sanitizeAmount(subtotal);
    const rawDiscount =
          rule.discount_type === "percent"
        ? Math.round((safeSubtotal * clampPercent(rule.discount_value)) / 100)
            : Math.round(Math.max(0, rule.discount_value));

  const ruleCapped = rule.max_discount_amount != null ? Math.min(rawDiscount, rule.max_discount_amount) : rawDiscount;
    const globalCeiling = Math.round((safeSubtotal * clampPercent(maximumDiscountPercent)) / 100);
    return Math.max(0, Math.min(ruleCapped, globalCeiling, safeSubtotal));
}

/**
 * Validates a discount amount someone is attempting to apply. A discount is
 * only ever valid if it traces back to an active, currently-valid,
 * admin-authorized sales_discount_rules row and does not exceed what that
 * rule (and the global ceiling) allow. There is no path in this function
 * that lets a discount be invented from a friction score, urgency, or any
 * other client-supplied signal.
 */
export function validateAppliedDiscount(
    input: DiscountValidationInput,
    activeRules: DiscountRule[],
    maximumDiscountPercent: number,
    now: Date = new Date()
  ): DiscountValidationResult {
    if (!input.discountAmount) {
          return {
                  valid: input.discountRuleId == null,
                  reason: input.discountRuleId != null ? "Discount amount is zero but a discount rule was referenced." : undefined
          };
    }

  if (!input.discountRuleId) {
        return { valid: false, reason: "A discount amount was set without referencing an approved discount rule." };
  }

  const rule = activeRules.find((candidate) => candidate.id === input.discountRuleId);
    if (!rule) {
          return { valid: false, reason: "Referenced discount rule was not found among active, admin-approved rules." };
    }

  if (!isDiscountRuleCurrentlyValid(rule, now)) {
        return { valid: false, reason: "Referenced discount rule is not currently active or is outside its valid date range." };
  }

  const maxAllowed = computeDiscountAmount(rule, input.subtotal, maximumDiscountPercent);
    if (input.discountAmount > maxAllowed) {
          return {
                  valid: false,
                  reason: `Discount amount exceeds the maximum allowed by this rule (${maxAllowed}).`,
                  cappedAmount: maxAllowed
          };
    }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Payment plan eligibility
// ---------------------------------------------------------------------------

export function isPaymentPlanEligible(totalDesignCost: number, plan: PaymentPlanRule): boolean {
    if (!plan.is_active) return false;
    return sanitizeAmount(totalDesignCost) >= plan.minimum_eligible_total;
}

export function eligiblePaymentPlans(totalDesignCost: number, plans: PaymentPlanRule[]): PaymentPlanRule[] {
    return plans.filter((plan) => isPaymentPlanEligible(totalDesignCost, plan));
}

// ---------------------------------------------------------------------------
// Total launch cost breakdown - keeps Fusion fees and portal products
// clearly separated, per the platform's core pricing-transparency rule.
// ---------------------------------------------------------------------------

export function buildLaunchCostBreakdown(
    fusionDesignTotal: number,
    fusionMonthlyTotal: number,
    portalSelections: PortalProductSelectionInput[]
  ): LaunchCostBreakdown {
    let portalOneTimeTotal = 0;
    let portalMonthlyTotal = 0;
    let portalAnnualTotal = 0;

  for (const selection of portalSelections) {
        const lineTotal = sanitizeAmount(selection.estimated_price) * Math.max(1, Math.round(selection.quantity));
        if (selection.price_unit === "one_time") portalOneTimeTotal += lineTotal;
        else if (selection.price_unit === "monthly") portalMonthlyTotal += lineTotal;
        else portalAnnualTotal += lineTotal;
  }

  const safeFusionDesignTotal = sanitizeAmount(fusionDesignTotal);

  return {
        fusionDesignTotal: safeFusionDesignTotal,
        fusionMonthlyTotal: sanitizeAmount(fusionMonthlyTotal),
        portalOneTimeTotal,
        portalMonthlyTotal,
        portalAnnualTotal,
        grandLaunchEstimate: safeFusionDesignTotal + portalOneTimeTotal + portalAnnualTotal
  };
}

// ---------------------------------------------------------------------------
// Purchase verification guard
// ---------------------------------------------------------------------------

/**
 * A portal product selection may only be marked 'purchased' when this
 * returns true - i.e. there is a genuinely verified purchase-verification
 * record. Clicking the portal link is never sufficient on its own.
 */
export function canMarkPortalProductPurchased(verification: PurchaseVerificationInput): boolean {
    if (!verification) return false;
    return verification.verified === true;
}

// ---------------------------------------------------------------------------
// Versioned pricing snapshots
// ---------------------------------------------------------------------------

export function snapshotServicePackage(
    pkg: ServicePackageSnapshotInput,
    takenAt: Date = new Date()
  ): ServicePackageSnapshot {
    return {
          ...pkg,
          inclusions: [...pkg.inclusions],
          snapshot_taken_at: takenAt.toISOString()
    };
}

// ---------------------------------------------------------------------------
// Supabase-backed loaders (server-only; no pricing logic lives here beyond
// delegating to the pure functions above)
// ---------------------------------------------------------------------------

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient<any> | null = null;

function getServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    if (!cachedClient) {
          cachedClient = createClient<any>(url, key, {
                  auth: { persistSession: false, autoRefreshToken: false }
          });
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

export async function loadBusinessRules(organizationId?: string): Promise<BusinessRules> {
    const supabase = getServiceClient();
    if (!supabase) return resolveBusinessRules([]);
    const orgId = organizationId || (await getDefaultOrganizationId(supabase));
    if (!orgId) return resolveBusinessRules([]);

  const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("sales_business_rules")
      .select("rule_key, rule_value, version, is_active")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .lte("effective_from", nowIso)
      .or(`effective_until.is.null,effective_until.gt.${nowIso}`);

  if (error || !data) return resolveBusinessRules([]);
    return resolveBusinessRules(data as BusinessRuleRow[]);
}

export async function loadActiveDiscountRules(organizationId?: string): Promise<DiscountRule[]> {
    const supabase = getServiceClient();
    if (!supabase) return [];
    const orgId = organizationId || (await getDefaultOrganizationId(supabase));
    if (!orgId) return [];

  const { data, error } = await supabase
      .from("sales_discount_rules")
      .select(
              "id, rule_code, rule_name, discount_type, discount_value, max_discount_amount, requires_manual_approval, is_active, valid_from, valid_until"
            )
      .eq("organization_id", orgId)
      .eq("is_active", true);

  if (error || !data) return [];
    return data as DiscountRule[];
}

export async function loadPaymentPlanRules(organizationId?: string): Promise<PaymentPlanRule[]> {
    const supabase = getServiceClient();
    if (!supabase) return [];
    const orgId = organizationId || (await getDefaultOrganizationId(supabase));
    if (!orgId) return [];

  const { data, error } = await supabase
      .from("sales_payment_plan_rules")
      .select("id, plan_code, plan_name, deposit_percent, number_of_installments, installment_interval, minimum_eligible_total, is_active")
      .eq("organization_id", orgId)
      .eq("is_active", true);

  if (error || !data) return [];
    return data as PaymentPlanRule[];
}

export async function loadPortalProductCatalog(organizationId?: string) {
    const supabase = getServiceClient();
    if (!supabase) return [];
    const orgId = organizationId || (await getDefaultOrganizationId(supabase));
    if (!orgId) return [];

  const { data, error } = await supabase
      .from("sales_portal_products")
      .select("id, product_key, product_name, category, description, estimated_price, price_unit, is_required_default, portal_url, is_active, sort_order")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

  if (error || !data) return [];
    return data;
}

export async function assessBudgetForOrganization(
    input: BudgetAssessmentInput,
    organizationId?: string
  ): Promise<BudgetAssessmentResult> {
    const rules = await loadBusinessRules(organizationId);
    return assessBudget(input, rules);
}
