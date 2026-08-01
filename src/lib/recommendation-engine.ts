/**
 * src/lib/recommendation-engine.ts
 *
 * Pure, server-safe website recommendation engine (Phase 3). Nothing in this
 * file performs I/O - it accepts plain data structures (already loaded from
 * Supabase by src/lib/sales-recommendation.ts, the orchestration layer) and
 * returns a single, deterministic RecommendationResult. This mirrors the
 * pure/I-O split established in sales-rules.ts (Phase 1) and
 * questionnaire-schema.ts (Phase 2).
 *
 * This module intentionally contains no hard-coded prices. Every dollar
 * figure in the output is derived from the packages/portal-catalog/business
 * rules passed in, which the caller loads from the admin-controlled
 * database tables. Feature-to-package mappings below are heuristics over
 * the *existence* of a service/product (which service, whether it's
 * required) - never its price.
 *
 * Do not recommend unnecessary products merely to increase the sale: the
 * primary ("Recommended") path is chosen by business need (category +
 * complexity), never upsized just because the client has a larger budget.
 * A larger budget only ever unlocks the separate "Growth Option" path.
 */

import {
  getVisibleQuestions,
  type AnswerMap,
  type AnswerValue
} from "./questionnaire-schema";
import type { BusinessRules } from "./sales-rules";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export const FEASIBILITY_STATUSES = [
  "READY_TO_PROCEED",
  "READY_WITH_REDUCED_SCOPE",
  "PAYMENT_PLAN_RECOMMENDED",
  "PHASED_BUILD_RECOMMENDED",
  "CONSULTATION_REQUIRED",
  "BUDGET_INSUFFICIENT",
  "INFORMATION_INCOMPLETE"
] as const;
export type FeasibilityStatus = (typeof FEASIBILITY_STATUSES)[number];

export type PortalCategory =
  | "domain"
  | "hosting"
  | "managed_wordpress_hosting"
  | "ssl"
  | "managed_ssl"
  | "email"
  | "microsoft_365"
  | "email_marketing"
  | "backup"
  | "security"
  | "seo"
  | "other";

export type PortalProductLite = {
  id: string;
  product_key: string;
  product_name: string;
  category: PortalCategory;
  estimated_price: number;
  price_unit: "one_time" | "monthly" | "annual";
  is_required_default: boolean;
  portal_url: string;
  /** Phase 4: true when this product already bundles a free/included SSL
   * certificate (e.g. Deluxe+ hosting tiers), so a separate standalone SSL
   * line item should not also be charged. Optional/undefined for any older
   * catalog rows or test fixtures predating Phase 4 - treated as false. */
  includes_ssl?: boolean;
  /** Phase 4: true when this product already bundles professional email. */
  includes_email?: boolean;
  /** Phase 4: true when this product already bundles automated backups. */
  includes_backup?: boolean;
};

export type ServicePackageLite = {
  id: string;
  package_key: string;
  package_name: string;
  setup_price: number;
  monthly_price: number;
  inclusions: string[];
};

export type AddOnServiceLite = {
  id: string;
  slug: string;
  service_name: string;
  category_slug: string | null;
  base_price: number;
  billing_type: "one_time" | "recurring" | "usage_based" | "custom_quote";
  recurring_interval: string | null;
};

export type BudgetSpecialToken = "not_sure" | "payment_plan" | "talk_to_someone" | null;

export type RecommendationEngineInput = {
  answers: AnswerMap;
  /** null when the client answered with a special token instead of a dollar amount. */
  totalPlannedBudgetUsd: number | null;
  budgetSpecialToken: BudgetSpecialToken;
  businessRules: BusinessRules;
  portalCatalog: PortalProductLite[];
  /** Fusion's website-design packages (e.g. launch/growth/commerce/authority). */
  packages: ServicePackageLite[];
  /** A-la-carte add-on services. Domain/hosting/SSL slugs are ignored here on
   * purpose - those are portal products and must never appear as a Fusion
   * design-invoice line item (see Phase 1 pricing-separation rule). */
  addOnServices: AddOnServiceLite[];
};

export type RequirementKind = "fusion_service" | "portal_product" | "client_provided";

export type RecommendationItem = {
  key: string;
  label: string;
  kind: RequirementKind;
  isRequired: boolean;
  estimatedCost: number;
  linkedServiceId?: string;
  linkedPortalProductId?: string;
  notes?: string;
};

export type RecommendationPathKind = "recommended" | "growth" | "starter_phased";

export type RecommendationPath = {
  kind: RecommendationPathKind;
  label: string;
  packageKey: string | null;
  packageName: string | null;
  totalDesignCost: number;
  monthlyCost: number;
  reason: string;
};

export type RecommendationResult = {
  recommendedCategory: string;
  paths: RecommendationPath[]; // [recommended, growth?, starterPhased?]
  requiredFeatures: RecommendationItem[];
  optionalFeatures: RecommendationItem[];
  requiredPortalProducts: RecommendationItem[];
  optionalPortalProducts: RecommendationItem[];
  clientProvidedItems: RecommendationItem[];
  totalPlannedBudget: number;
  requiredPortalCost: number;
  designAllocation: number;
  budgetGap: number;
  remainingCushion: number;
  feasibilityStatus: FeasibilityStatus;
  complexityScore: number;
  confidenceScore: number;
  assumptions: string[];
  missingInformation: string[];
  recommendedNextAction: string;
  /** Phase 4: admin-configurable disclaimer for the estimated portal-product
   * costs above (taxes, ICANN fees, renewal rates, promotions - all
   * confirmed at checkout, not guaranteed by this estimate). */
  portalPricingDisclaimer: string;
};

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

function str(value: AnswerValue | undefined): string {
  if (value == null) return "";
  return Array.isArray(value) ? value[0] || "" : value;
}

function isYes(value: AnswerValue | undefined): boolean {
  return str(value) === "yes";
}

function sanitize(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount);
}

function firstYearCost(product: PortalProductLite): number {
  const price = sanitize(product.estimated_price);
  return product.price_unit === "monthly" ? price * 12 : price;
}

const SELLABLE_PURPOSES = new Set(["ecommerce", "marketplace"]);

// ---------------------------------------------------------------------------
// 1. Recommended category + complexity score
// ---------------------------------------------------------------------------

export function computeComplexityScore(answers: AnswerMap): number {
  let score = 0;

  const purpose = str(answers.website_purpose);
  if (purpose === "marketplace") score += 25;
  else if (purpose === "ecommerce") score += 15;
  else if (purpose === "membership" || purpose === "booking") score += 10;

  if (isYes(answers.sells_physical_products)) score += 8;
  if (isYes(answers.sells_digital_products)) score += 6;
  if (isYes(answers.digital_download_protection)) score += 4;
  if (isYes(answers.offers_subscriptions)) score += 8;
  if (isYes(answers.needs_customer_accounts)) score += 6;
  if (isYes(answers.marketplace_vendors)) score += 15;
  if (isYes(answers.needs_shipping)) score += 5;
  if (str(answers.tax_requirements) === "multi_region") score += 8;
  if (isYes(answers.inventory_requirements)) score += 5;

  if (isYes(answers.needs_bookings)) score += 6;
  if (isYes(answers.booking_staff_calendars)) score += 6;
  if (isYes(answers.booking_recurring_appointments)) score += 4;

  if (isYes(answers.needs_memberships)) score += 8;
  if (isYes(answers.membership_protected_content)) score += 4;
  if (isYes(answers.membership_subscription_billing)) score += 6;

  if (isYes(answers.needs_crm)) score += 5;
  if (isYes(answers.needs_ai_chatbot)) score += 6;
  if (isYes(answers.needs_marketing_automations)) score += 5;
  if (isYes(answers.needs_multilingual)) score += 8;
  if (isYes(answers.needs_accessibility)) score += 5;

  const pages = str(answers.expected_pages);
  if (pages === "8-15") score += 5;
  else if (pages === "16+") score += 10;

  return Math.max(0, Math.min(100, score));
}

const CATEGORY_BASE_TIER: Record<string, number> = {
  informational: 0,
  portfolio: 0,
  blog: 0,
  nonprofit: 0,
  lead_generation: 1,
  booking: 1,
  membership: 1,
  ecommerce: 2,
  marketplace: 2
};

function pickBasePackageIndex(purpose: string, complexityScore: number, tierCount: number): number {
  const baseTier = CATEGORY_BASE_TIER[purpose] ?? 0;
  let tier = baseTier;
  // Escalate one tier for genuinely complex projects - driven by need, not
  // by how much money is on the table.
  if (complexityScore >= 70) tier += 1;
  if (purpose === "marketplace" && complexityScore >= 55) tier += 1;
  return Math.max(0, Math.min(tierCount - 1, tier));
}

// ---------------------------------------------------------------------------
// 2. Portal products (required/optional/already-owned)
// ---------------------------------------------------------------------------

const PORTAL_OWNERSHIP_KEY: Partial<Record<PortalCategory, { ownedKey: string; transferKey?: string }>> = {
  domain: { ownedKey: "has_existing_domain", transferKey: "domain_transferable" },
  hosting: { ownedKey: "has_existing_hosting", transferKey: "hosting_transferable" },
  // Managed WordPress hosting is an alternative flavor of the same "hosting"
  // ownership question from the Phase 2 questionnaire - there isn't a
  // separate WordPress-specific ownership question yet.
  managed_wordpress_hosting: { ownedKey: "has_existing_hosting", transferKey: "hosting_transferable" },
  ssl: { ownedKey: "has_existing_ssl" },
  email: { ownedKey: "has_existing_professional_email" }
};

const PORTAL_INTEREST_KEY: Partial<Record<PortalCategory, string>> = {
  email: "needs_professional_email",
  microsoft_365: "needs_microsoft_365",
  email_marketing: "needs_email_marketing"
};

function ownsAndTransferable(answers: AnswerMap, product: PortalProductLite): { owns: boolean; transferable: boolean; transferKnown: boolean } {
  const ownership = PORTAL_OWNERSHIP_KEY[product.category];
  const ownedAnswer = ownership ? str(answers[ownership.ownedKey]) : "";
  const transferAnswer = ownership?.transferKey ? str(answers[ownership.transferKey]) : "";
  const owns = ownedAnswer === "yes";
  const transferKnown = !ownership?.transferKey || transferAnswer !== "";
  const transferable = !ownership?.transferKey || transferAnswer !== "no";
  return { owns, transferable, transferKnown };
}

/**
 * Phase 4: categories that a required, not-already-owned bundle product can
 * satisfy for free (e.g. Deluxe+ hosting bundling a free SSL certificate).
 * Only *required* products the client doesn't already own count toward the
 * bundle - a client's own external hosting can't be assumed to bundle
 * anything Fusion didn't sell them.
 */
function computeBundleCoverage(answers: AnswerMap, catalog: PortalProductLite[]): Partial<Record<PortalCategory, boolean>> {
  const coverage: Partial<Record<PortalCategory, boolean>> = {};
  for (const product of catalog) {
    if (!product.is_required_default) continue;
    const { owns, transferable } = ownsAndTransferable(answers, product);
    if (owns && transferable) continue;
    if (product.includes_ssl) coverage.ssl = true;
    if (product.includes_email) coverage.email = true;
    if (product.includes_backup) coverage.backup = true;
  }
  return coverage;
}

function classifyPortalProducts(
  answers: AnswerMap,
  catalog: PortalProductLite[]
): {
  required: RecommendationItem[];
  optional: RecommendationItem[];
  clientProvided: RecommendationItem[];
  requiredPortalCost: number;
  assumptions: string[];
} {
  const required: RecommendationItem[] = [];
  const optional: RecommendationItem[] = [];
  const clientProvided: RecommendationItem[] = [];
  const assumptions: string[] = [];
  let requiredPortalCost = 0;

  const bundleCoverage = computeBundleCoverage(answers, catalog);

  for (const product of catalog) {
    const { owns, transferable, transferKnown } = ownsAndTransferable(answers, product);

    if (owns && transferable) {
      clientProvided.push({
        key: product.product_key,
        label: product.product_name,
        kind: "client_provided",
        isRequired: false,
        estimatedCost: 0,
        linkedPortalProductId: product.id,
        notes: "Already owned by the client."
      });
      if (owns && !transferKnown) {
        assumptions.push(
          `Assumed the client's existing ${product.product_name.toLowerCase()} can be connected to Fusion since transferability wasn't confirmed.`
        );
      }
      continue;
    }

    if (product.is_required_default) {
      if (bundleCoverage[product.category]) {
        // Already bundled for free with a required hosting-type product -
        // don't also charge the standalone line item (Phase 4: avoid
        // double-counting included SSL/email/backup).
        clientProvided.push({
          key: product.product_key,
          label: product.product_name,
          kind: "client_provided",
          isRequired: false,
          estimatedCost: 0,
          linkedPortalProductId: product.id,
          notes: "Included at no extra cost with the recommended hosting plan."
        });
        continue;
      }

      const cost = firstYearCost(product);
      requiredPortalCost += cost;
      required.push({
        key: product.product_key,
        label: product.product_name,
        kind: "portal_product",
        isRequired: true,
        estimatedCost: cost,
        linkedPortalProductId: product.id,
        notes: `Estimated ${product.price_unit === "one_time" ? "one-time" : "first-year"} cost, purchased separately through the Fusion client portal.`
      });
      continue;
    }

    const interestKey = PORTAL_INTEREST_KEY[product.category];
    const wanted = interestKey ? isYes(answers[interestKey]) : false;
    optional.push({
      key: product.product_key,
      label: product.product_name,
      kind: "portal_product",
      isRequired: false,
      estimatedCost: firstYearCost(product),
      linkedPortalProductId: product.id,
      notes: wanted ? "Requested by the client." : "Available if wanted - not currently required."
    });
  }

  return { required, optional, clientProvided, requiredPortalCost, assumptions };
}

// ---------------------------------------------------------------------------
// 3. Fusion add-on features (required/optional) - domain/hosting/ssl slugs
//    are deliberately excluded; those are portal products, not Fusion
//    invoice line items, even though a few legacy crm_services rows share
//    those category slugs.
// ---------------------------------------------------------------------------

const PORTAL_LIKE_ADDON_CATEGORIES = new Set(["hosting", "domains", "ssl"]);

type FeatureRule = {
  slug: string;
  fallbackLabel: string;
  when: (answers: AnswerMap) => boolean;
  required: (answers: AnswerMap) => boolean;
};

const FEATURE_RULES: FeatureRule[] = [
  {
    slug: "ecommerce-starter",
    fallbackLabel: "E-Commerce Starter Bundle",
    when: (a) => isYes(a.sells_physical_products) || isYes(a.sells_digital_products) || isYes(a.offers_subscriptions),
    required: (a) => SELLABLE_PURPOSES.has(str(a.website_purpose))
  },
  {
    slug: "custom-development",
    fallbackLabel: "Custom Development",
    when: (a) => isYes(a.marketplace_vendors) || (isYes(a.booking_staff_calendars) && isYes(a.booking_recurring_appointments)) || isYes(a.membership_subscription_billing),
    required: (a) => isYes(a.marketplace_vendors)
  },
  {
    slug: "logo-design",
    fallbackLabel: "Logo Design",
    when: (a) => isYes(a.needs_logo_design),
    required: () => false
  },
  {
    slug: "blog-content",
    fallbackLabel: "Content Writing",
    when: (a) => isYes(a.needs_content_writing),
    required: () => false
  },
  {
    slug: "seo-services",
    fallbackLabel: "SEO Services",
    when: (a) => isYes(a.needs_seo),
    required: () => false
  },
  {
    slug: "ai-integration",
    fallbackLabel: "AI / Automation Integration",
    when: (a) => isYes(a.needs_ai_chatbot) || isYes(a.needs_marketing_automations),
    required: () => false
  }
];

function classifyFeatures(
  answers: AnswerMap,
  addOnServices: AddOnServiceLite[]
): { required: RecommendationItem[]; optional: RecommendationItem[] } {
  const bySlug = new Map(addOnServices.filter((s) => !PORTAL_LIKE_ADDON_CATEGORIES.has(s.category_slug || "")).map((s) => [s.slug, s]));
  const required: RecommendationItem[] = [];
  const optional: RecommendationItem[] = [];

  for (const rule of FEATURE_RULES) {
    if (!rule.when(answers)) continue;
    const service = bySlug.get(rule.slug);
    const item: RecommendationItem = {
      key: rule.slug,
      label: service?.service_name || rule.fallbackLabel,
      kind: "fusion_service",
      isRequired: rule.required(answers),
      estimatedCost: service ? sanitize(service.base_price) : 0,
      linkedServiceId: service?.id,
      notes: service ? undefined : "Not yet in the service catalog - flag for a custom quote."
    };
    if (item.isRequired) required.push(item);
    else optional.push(item);
  }

  if (isYes(answers.needs_multilingual) || isYes(answers.needs_accessibility)) {
    const service = bySlug.get("custom-development");
    optional.push({
      key: "compliance-development",
      label: "Multilingual / accessibility development",
      kind: "fusion_service",
      isRequired: false,
      estimatedCost: 0,
      linkedServiceId: service?.id,
      notes: "Scoped individually - multilingual and accessibility requirements vary widely."
    });
  }

  if (isYes(answers.needs_crm)) {
    optional.push({
      key: "crm-setup",
      label: "CRM setup",
      kind: "fusion_service",
      isRequired: false,
      estimatedCost: 0,
      notes: "Not yet in the service catalog - flag for a custom quote."
    });
  }

  return { required, optional };
}

// ---------------------------------------------------------------------------
// 4. Recommendation paths (Recommended / Growth / Starter-Phased)
// ---------------------------------------------------------------------------

function buildPath(kind: RecommendationPathKind, label: string, pkg: ServicePackageLite | undefined, reason: string): RecommendationPath {
  return {
    kind,
    label,
    packageKey: pkg?.package_key ?? null,
    packageName: pkg?.package_name ?? null,
    totalDesignCost: pkg ? sanitize(pkg.setup_price) : 0,
    monthlyCost: pkg ? sanitize(pkg.monthly_price) : 0,
    reason
  };
}

// ---------------------------------------------------------------------------
// 5. Missing information + confidence
// ---------------------------------------------------------------------------

function isAnsweredValue(value: AnswerValue | undefined): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return value.trim().length > 0;
}

function computeMissingInformation(answers: AnswerMap): string[] {
  const visible = getVisibleQuestions(answers);
  return visible.filter((question) => question.required && !isAnsweredValue(answers[question.key])).map((question) => question.prompt);
}

// ---------------------------------------------------------------------------
// 6. Feasibility + recommended next action
// ---------------------------------------------------------------------------

const NEXT_ACTION_BY_STATUS: Record<FeasibilityStatus, string> = {
  READY_TO_PROCEED: "Your planned budget comfortably covers the recommended website - let's start the project.",
  READY_WITH_REDUCED_SCOPE: "A slightly smaller initial scope fits your budget today, with room to add the rest later.",
  PAYMENT_PLAN_RECOMMENDED: "A payment plan can bridge the gap so the full recommended scope is still within reach.",
  PHASED_BUILD_RECOMMENDED: "We recommend launching the essentials first, then adding the remaining features in a later phase.",
  CONSULTATION_REQUIRED: "This project has enough moving pieces that a short conversation will help us give you an accurate plan.",
  BUDGET_INSUFFICIENT: "Here is the strongest path available at your current budget, along with ways to move forward.",
  INFORMATION_INCOMPLETE: "A few more answers will let us give you a confident, accurate recommendation."
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function buildRecommendation(input: RecommendationEngineInput): RecommendationResult {
  const { answers, businessRules, portalCatalog, addOnServices } = input;
  const purpose = str(answers.website_purpose);
  const recommendedCategory = purpose || "unspecified";

  const complexityScore = computeComplexityScore(answers);

  const sortedPackages = [...input.packages].sort((a, b) => a.setup_price - b.setup_price);
  const baseIndex = sortedPackages.length ? pickBasePackageIndex(purpose, complexityScore, sortedPackages.length) : -1;
  const recommendedPackage = baseIndex >= 0 ? sortedPackages[baseIndex] : undefined;

  const { required: requiredPortalProducts, optional: optionalPortalProducts, clientProvided: clientProvidedItems, requiredPortalCost, assumptions: portalAssumptions } =
    classifyPortalProducts(answers, portalCatalog);

  const { required: requiredFeatures, optional: optionalFeatures } = classifyFeatures(answers, addOnServices);

  const totalPlannedBudget = sanitize(input.totalPlannedBudgetUsd ?? 0);
  const designAllocation = input.totalPlannedBudgetUsd == null ? 0 : Math.max(0, totalPlannedBudget - requiredPortalCost);
  const recommendedCost = recommendedPackage ? sanitize(recommendedPackage.setup_price) : 0;
  const budgetGap = Math.max(0, recommendedCost - designAllocation);
  const remainingCushion = Math.max(0, designAllocation - recommendedCost);

  const missingInformation = computeMissingInformation(answers);

  const assumptions: string[] = [
    "Treated the entered amount as the total planned project budget, covering both the Fusion website-design fee and the launch-required portal products, unless the client indicated otherwise.",
    ...portalAssumptions
  ];
  if (input.budgetSpecialToken === "payment_plan") {
    assumptions.push("The client asked about a payment plan instead of giving a specific number, so no budget math could be computed yet.");
  }
  if (input.budgetSpecialToken === "not_sure") {
    assumptions.push("The client was not sure of their budget, so this recommendation is directional and should be confirmed on a call.");
  }

  // --- Feasibility status -------------------------------------------------
  let feasibilityStatus: FeasibilityStatus;
  const cheapestPackage = sortedPackages[0];

  if (input.budgetSpecialToken === "talk_to_someone") {
    feasibilityStatus = "CONSULTATION_REQUIRED";
  } else if (input.budgetSpecialToken === "not_sure") {
    feasibilityStatus = "CONSULTATION_REQUIRED";
  } else if (input.budgetSpecialToken === "payment_plan") {
    feasibilityStatus = "PAYMENT_PLAN_RECOMMENDED";
  } else if (!purpose || missingInformation.length > 4) {
    feasibilityStatus = "INFORMATION_INCOMPLETE";
  } else if (designAllocation < businessRules.minimumDesignAllocation) {
    feasibilityStatus = "BUDGET_INSUFFICIENT";
  } else if (recommendedCost >= businessRules.salesEscalationThreshold) {
    feasibilityStatus = "CONSULTATION_REQUIRED";
  } else if (budgetGap === 0) {
    feasibilityStatus = "READY_TO_PROCEED";
  } else if (cheapestPackage && cheapestPackage.setup_price <= designAllocation) {
    feasibilityStatus = "READY_WITH_REDUCED_SCOPE";
  } else if (isYes(answers.payment_plan_interest)) {
    feasibilityStatus = "PAYMENT_PLAN_RECOMMENDED";
  } else if (complexityScore >= 50) {
    feasibilityStatus = "PHASED_BUILD_RECOMMENDED";
  } else {
    feasibilityStatus = "CONSULTATION_REQUIRED";
  }

  // --- Confidence score -----------------------------------------------------
  let confidenceScore = 100 - missingInformation.length * 8;
  if (input.budgetSpecialToken === "not_sure") confidenceScore -= 25;
  if (input.budgetSpecialToken === "payment_plan") confidenceScore -= 15;
  confidenceScore = Math.max(10, Math.min(100, confidenceScore));

  // --- Paths -----------------------------------------------------------------
  const paths: RecommendationPath[] = [
    buildPath(
      "recommended",
      "Recommended",
      recommendedPackage,
      `The strongest fit for a ${recommendedCategory.replace(/_/g, " ")} project at this level of complexity.`
    )
  ];

  if (sortedPackages.length > 1) {
    const growthIndex = Math.min(sortedPackages.length - 1, baseIndex + 1);
    if (growthIndex !== baseIndex) {
      paths.push(
        buildPath("growth", "Growth Option", sortedPackages[growthIndex], "A higher-value option with more room to support your goals as you grow.")
      );
    } else {
      // Already at the top tier - offer the same package plus notable optional add-ons instead.
      paths.push(
        buildPath("growth", "Growth Option", recommendedPackage, "The full recommended scope, plus the optional add-ons above for extra reach.")
      );
    }

    const starterIndex = Math.max(0, baseIndex - 1);
    if (starterIndex !== baseIndex) {
      paths.push(
        buildPath(
          "starter_phased",
          "Starter / Phased Option",
          sortedPackages[starterIndex],
          "A reduced initial scope that launches sooner and can expand later without discarding the original work."
        )
      );
    } else {
      paths.push(
        buildPath(
          "starter_phased",
          "Starter / Phased Option",
          recommendedPackage,
          "The same recommended scope, split into a deposit-first phase one and a phase two for later."
        )
      );
    }
  }

  return {
    recommendedCategory,
    paths,
    requiredFeatures,
    optionalFeatures,
    requiredPortalProducts,
    optionalPortalProducts,
    clientProvidedItems,
    totalPlannedBudget,
    requiredPortalCost,
    designAllocation,
    budgetGap,
    remainingCushion,
    feasibilityStatus,
    complexityScore,
    confidenceScore,
    assumptions,
    missingInformation,
    recommendedNextAction: NEXT_ACTION_BY_STATUS[feasibilityStatus],
    portalPricingDisclaimer: businessRules.portalPricingDisclaimerText
  };
}
