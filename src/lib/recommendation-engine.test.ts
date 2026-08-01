import { describe, expect, it } from "vitest";
import {
  buildRecommendation,
  computeComplexityScore,
  type AddOnServiceLite,
  type PortalProductLite,
  type RecommendationEngineInput,
  type ServicePackageLite
} from "./recommendation-engine";
import type { AnswerMap } from "./questionnaire-schema";
import type { BusinessRules } from "./sales-rules";

// ---------------------------------------------------------------------------
// Fixtures - mirror the real seeded data (see supabase/migrations
// 20260731090000_sales_recommendation_foundation.sql and
// 20260710001500_fusion_admin_settings_foundation.sql) rather than inventing
// unrealistic numbers.
// ---------------------------------------------------------------------------

const RULES: BusinessRules = {
  minimumTotalBudget: 300,
  minimumDesignAllocation: 300,
  maximumDiscountPercent: 0,
  depositRequiredPercent: 50,
  salesEscalationThreshold: 5000,
  taxRatePercent: 0,
  taxFeeDisclaimerText: "disclaimer",
  belowMinimumMessage: "below minimum",
  portalPricingDisclaimerText: "portal disclaimer",
  version: 1
};

const PACKAGES: ServicePackageLite[] = [
  { id: "p-launch", package_key: "launch", package_name: "Launch Foundation", setup_price: 900, monthly_price: 89, inclusions: [] },
  { id: "p-growth", package_key: "growth", package_name: "Growth Engine", setup_price: 1800, monthly_price: 149, inclusions: [] },
  { id: "p-commerce", package_key: "commerce", package_name: "Commerce Builder", setup_price: 2600, monthly_price: 229, inclusions: [] },
  { id: "p-authority", package_key: "authority", package_name: "Authority Suite", setup_price: 3400, monthly_price: 299, inclusions: [] }
];

// Phase 4: mirrors the real catalog after the portal.fddynamics.com pricing
// verification (cPanel Deluxe hosting bundles free SSL - see includes_ssl).
const PORTAL_CATALOG: PortalProductLite[] = [
  { id: "pp-domain", product_key: "domain-registration", product_name: "Domain Registration", category: "domain", estimated_price: 20, price_unit: "annual", is_required_default: true, portal_url: "https://portal.fddynamics.com/products/domain-registration" },
  { id: "pp-hosting", product_key: "web-hosting", product_name: "cPanel Web Hosting (Deluxe)", category: "hosting", estimated_price: 15, price_unit: "monthly", is_required_default: true, portal_url: "https://portal.fddynamics.com/products/cpanel", includes_ssl: true },
  { id: "pp-ssl", product_key: "ssl-certificate", product_name: "SSL Certificate (Standalone DV)", category: "ssl", estimated_price: 68, price_unit: "annual", is_required_default: true, portal_url: "https://portal.fddynamics.com/products/ssl" },
  { id: "pp-managed-wp", product_key: "managed-wordpress-hosting", product_name: "Managed WordPress Hosting (Basic)", category: "managed_wordpress_hosting", estimated_price: 13, price_unit: "monthly", is_required_default: false, portal_url: "https://portal.fddynamics.com/products/wordpress", includes_ssl: true, includes_backup: true },
  { id: "pp-email", product_key: "professional-email", product_name: "Professional Email", category: "email", estimated_price: 5, price_unit: "monthly", is_required_default: false, portal_url: "https://portal.fddynamics.com/products/professional-email" },
  { id: "pp-m365", product_key: "microsoft-365", product_name: "Microsoft 365", category: "microsoft_365", estimated_price: 7, price_unit: "monthly", is_required_default: false, portal_url: "https://portal.fddynamics.com/products/microsoft-365" }
];

const ADD_ONS: AddOnServiceLite[] = [
  { id: "s-ecom", slug: "ecommerce-starter", service_name: "E-Commerce Starter Bundle", category_slug: "e-commerce", base_price: 3200, billing_type: "one_time", recurring_interval: null },
  { id: "s-custom", slug: "custom-development", service_name: "Custom Development", category_slug: "custom-development", base_price: 0, billing_type: "custom_quote", recurring_interval: null },
  { id: "s-logo", slug: "logo-design", service_name: "Logo Design", category_slug: "branding", base_price: 450, billing_type: "one_time", recurring_interval: null },
  { id: "s-seo", slug: "seo-services", service_name: "SEO Services", category_slug: "seo", base_price: 350, billing_type: "recurring", recurring_interval: "monthly" },
  { id: "s-ai", slug: "ai-integration", service_name: "AI Integration", category_slug: "ai-integration", base_price: 1500, billing_type: "one_time", recurring_interval: null },
  // Legacy portal-like crm_services rows that must NEVER surface as a Fusion feature.
  { id: "s-hosting", slug: "hosting", service_name: "Hosting", category_slug: "hosting", base_price: 89, billing_type: "recurring", recurring_interval: "monthly" }
];

function baseInput(overrides: Partial<RecommendationEngineInput> = {}): RecommendationEngineInput {
  return {
    answers: {},
    totalPlannedBudgetUsd: null,
    budgetSpecialToken: null,
    businessRules: RULES,
    portalCatalog: PORTAL_CATALOG,
    packages: PACKAGES,
    addOnServices: ADD_ONS,
    ...overrides
  };
}

const MINIMAL_INFORMATIONAL_ANSWERS: AnswerMap = {
  total_budget: "900",
  business_name: "Acme",
  contact_name: "Jane",
  contact_email: "jane@acme.com",
  contact_phone: "5551234567",
  preferred_contact_method: "email",
  industry: "Consulting",
  business_exists: "existing",
  website_purpose: "informational",
  has_existing_website: "no",
  has_existing_domain: "yes",
  domain_transferable: "yes",
  has_existing_hosting: "yes",
  hosting_transferable: "yes",
  has_existing_ssl: "yes",
  has_existing_professional_email: "no",
  has_existing_logo: "yes",
  has_existing_written_content: "yes",
  decision_timeline: "within_30_days",
  is_decision_maker: "yes"
};

// ---------------------------------------------------------------------------
// computeComplexityScore
// ---------------------------------------------------------------------------

describe("computeComplexityScore", () => {
  it("scores a plain informational site near zero", () => {
    expect(computeComplexityScore({ website_purpose: "informational" })).toBeLessThan(10);
  });

  it("scores a marketplace with vendors and subscriptions much higher", () => {
    const score = computeComplexityScore({
      website_purpose: "marketplace",
      marketplace_vendors: "yes",
      offers_subscriptions: "yes",
      needs_customer_accounts: "yes",
      sells_physical_products: "yes",
      needs_shipping: "yes"
    });
    expect(score).toBeGreaterThan(50);
  });

  it("never exceeds 100", () => {
    const answers: AnswerMap = {
      website_purpose: "marketplace",
      marketplace_vendors: "yes",
      sells_physical_products: "yes",
      sells_digital_products: "yes",
      digital_download_protection: "yes",
      offers_subscriptions: "yes",
      needs_customer_accounts: "yes",
      needs_shipping: "yes",
      tax_requirements: "multi_region",
      inventory_requirements: "yes",
      needs_bookings: "yes",
      booking_staff_calendars: "yes",
      booking_recurring_appointments: "yes",
      needs_memberships: "yes",
      membership_protected_content: "yes",
      membership_subscription_billing: "yes",
      needs_crm: "yes",
      needs_ai_chatbot: "yes",
      needs_marketing_automations: "yes",
      needs_multilingual: "yes",
      needs_accessibility: "yes",
      expected_pages: "16+"
    };
    expect(computeComplexityScore(answers)).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Portal product ownership / required-cost math
// ---------------------------------------------------------------------------

describe("buildRecommendation - portal product ownership", () => {
  it("charges nothing for required portal products the client already owns and can transfer", () => {
    const result = buildRecommendation(
      baseInput({ answers: MINIMAL_INFORMATIONAL_ANSWERS, totalPlannedBudgetUsd: 900 })
    );
    expect(result.requiredPortalCost).toBe(0);
    // domain, hosting, managed-wordpress-hosting (shares the same hosting
    // ownership question - see PORTAL_OWNERSHIP_KEY), and ssl.
    expect(result.clientProvidedItems.length).toBe(4);
    expect(result.requiredPortalProducts.length).toBe(0);
  });

  it("charges the full required-portal-cost when nothing is owned (matches the $300 spec example)", () => {
    const answers: AnswerMap = {
      ...MINIMAL_INFORMATIONAL_ANSWERS,
      has_existing_domain: "no",
      has_existing_hosting: "no",
      has_existing_ssl: "no"
    };
    delete (answers as Record<string, unknown>).domain_transferable;
    delete (answers as Record<string, unknown>).hosting_transferable;

    const result = buildRecommendation(baseInput({ answers, totalPlannedBudgetUsd: 300 }));
    // domain($20) + hosting($15/mo * 12 = $180) = $200 required portal cost.
    // SSL is bundled free with the Deluxe hosting tier (includes_ssl), so it
    // is NOT charged separately - see the bundle-skip test below.
    expect(result.requiredPortalCost).toBe(200);
    expect(result.designAllocation).toBe(100); // 300 - 200
    expect(result.totalPlannedBudget).toBe(300);
  });

  it("does not double-count SSL when the client already owns it", () => {
    const answers: AnswerMap = { ...MINIMAL_INFORMATIONAL_ANSWERS, has_existing_ssl: "yes" };
    const result = buildRecommendation(baseInput({ answers, totalPlannedBudgetUsd: 900 }));
    expect(result.clientProvidedItems.some((item) => item.key === "ssl-certificate")).toBe(true);
  });

  it("does not charge a separate SSL line when a required hosting product bundles free SSL (Phase 4)", () => {
    const answers: AnswerMap = {
      ...MINIMAL_INFORMATIONAL_ANSWERS,
      has_existing_domain: "no",
      has_existing_hosting: "no",
      has_existing_ssl: "no"
    };
    delete (answers as Record<string, unknown>).domain_transferable;
    delete (answers as Record<string, unknown>).hosting_transferable;

    const result = buildRecommendation(baseInput({ answers, totalPlannedBudgetUsd: 900 }));
    expect(result.requiredPortalProducts.some((item) => item.key === "ssl-certificate")).toBe(false);
    const bundledSsl = result.clientProvidedItems.find((item) => item.key === "ssl-certificate");
    expect(bundledSsl).toBeTruthy();
    expect(bundledSsl?.estimatedCost).toBe(0);
  });

  it("still charges standalone SSL when the client brings their own hosting (no bundle to rely on)", () => {
    const answers: AnswerMap = {
      ...MINIMAL_INFORMATIONAL_ANSWERS,
      has_existing_domain: "yes",
      domain_transferable: "yes",
      has_existing_hosting: "yes",
      hosting_transferable: "yes",
      has_existing_ssl: "no"
    };
    const result = buildRecommendation(baseInput({ answers, totalPlannedBudgetUsd: 900 }));
    const requiredSsl = result.requiredPortalProducts.find((item) => item.key === "ssl-certificate");
    expect(requiredSsl).toBeTruthy();
    expect(requiredSsl?.estimatedCost).toBe(68);
  });

  it("keeps an optional managed-wordpress-hosting product out of the required list", () => {
    // Use answers where hosting is not already owned, so the product reaches
    // the is_required_default check (false for this product) instead of
    // being short-circuited into clientProvided via the shared ownership key.
    const answers: AnswerMap = { ...MINIMAL_INFORMATIONAL_ANSWERS, has_existing_hosting: "no" };
    delete (answers as Record<string, unknown>).hosting_transferable;
    const result = buildRecommendation(baseInput({ answers, totalPlannedBudgetUsd: 900 }));
    expect(result.requiredPortalProducts.some((item) => item.key === "managed-wordpress-hosting")).toBe(false);
    expect(result.optionalPortalProducts.some((item) => item.key === "managed-wordpress-hosting")).toBe(true);
  });

  it("adds an assumption when ownership is claimed but transferability is unknown", () => {
    const answers: AnswerMap = { ...MINIMAL_INFORMATIONAL_ANSWERS };
    delete (answers as Record<string, unknown>).domain_transferable;
    const result = buildRecommendation(baseInput({ answers, totalPlannedBudgetUsd: 900 }));
    expect(result.assumptions.some((a) => a.includes("domain"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Feasibility statuses
// ---------------------------------------------------------------------------

describe("buildRecommendation - feasibility statuses", () => {
  it("returns READY_TO_PROCEED when the budget fully covers the recommended package", () => {
    const result = buildRecommendation(baseInput({ answers: MINIMAL_INFORMATIONAL_ANSWERS, totalPlannedBudgetUsd: 5000 }));
    expect(result.feasibilityStatus).toBe("READY_TO_PROCEED");
  });

  it("returns BUDGET_INSUFFICIENT when the design allocation falls under the admin minimum", () => {
    const answers: AnswerMap = {
      ...MINIMAL_INFORMATIONAL_ANSWERS,
      has_existing_domain: "no",
      has_existing_hosting: "no",
      has_existing_ssl: "no"
    };
    const result = buildRecommendation(baseInput({ answers, totalPlannedBudgetUsd: 300 }));
    // 300 - 200 required portal cost = 100 design allocation, below the $300 minimum.
    expect(result.feasibilityStatus).toBe("BUDGET_INSUFFICIENT");
    expect(result.designAllocation).toBeLessThan(300);
  });

  it("never leaves a below-minimum budget with an empty result (always includes a next action and paths)", () => {
    const result = buildRecommendation(
      baseInput({
        answers: { ...MINIMAL_INFORMATIONAL_ANSWERS, has_existing_domain: "no", has_existing_hosting: "no", has_existing_ssl: "no" },
        totalPlannedBudgetUsd: 50
      })
    );
    expect(result.feasibilityStatus).toBe("BUDGET_INSUFFICIENT");
    expect(result.recommendedNextAction.length).toBeGreaterThan(0);
    expect(result.paths.length).toBeGreaterThanOrEqual(1);
  });

  it("returns READY_WITH_REDUCED_SCOPE when only the cheapest package fits", () => {
    const answers: AnswerMap = { ...MINIMAL_INFORMATIONAL_ANSWERS, website_purpose: "ecommerce" };
    // Recommended tier for ecommerce is 'commerce' ($2600); budget only covers 'launch' ($900).
    const result = buildRecommendation(baseInput({ answers, totalPlannedBudgetUsd: 1000 }));
    expect(result.feasibilityStatus).toBe("READY_WITH_REDUCED_SCOPE");
  });

  it("returns PAYMENT_PLAN_RECOMMENDED when the client asked about a payment plan instead of a number", () => {
    const result = buildRecommendation(
      baseInput({ answers: MINIMAL_INFORMATIONAL_ANSWERS, totalPlannedBudgetUsd: null, budgetSpecialToken: "payment_plan" })
    );
    expect(result.feasibilityStatus).toBe("PAYMENT_PLAN_RECOMMENDED");
  });

  it("returns CONSULTATION_REQUIRED when the client wants to talk to someone", () => {
    const result = buildRecommendation(
      baseInput({ answers: MINIMAL_INFORMATIONAL_ANSWERS, totalPlannedBudgetUsd: null, budgetSpecialToken: "talk_to_someone" })
    );
    expect(result.feasibilityStatus).toBe("CONSULTATION_REQUIRED");
  });

  it("returns CONSULTATION_REQUIRED when the client is not sure of their budget", () => {
    const result = buildRecommendation(
      baseInput({ answers: MINIMAL_INFORMATIONAL_ANSWERS, totalPlannedBudgetUsd: null, budgetSpecialToken: "not_sure" })
    );
    expect(result.feasibilityStatus).toBe("CONSULTATION_REQUIRED");
  });

  it("escalates to CONSULTATION_REQUIRED once the recommended cost crosses the sales-escalation threshold, even with ample budget", () => {
    const answers: AnswerMap = {
      ...MINIMAL_INFORMATIONAL_ANSWERS,
      website_purpose: "marketplace",
      marketplace_vendors: "yes",
      sells_physical_products: "yes",
      needs_shipping: "yes",
      offers_subscriptions: "yes"
    };
    // Marketplace + vendors recommends the top ('authority', $3400) tier - lower
    // the escalation threshold below that so this scenario actually crosses it.
    const lowThresholdRules: BusinessRules = { ...RULES, salesEscalationThreshold: 3000 };
    const result = buildRecommendation(baseInput({ answers, businessRules: lowThresholdRules, totalPlannedBudgetUsd: 20000 }));
    expect(result.feasibilityStatus).toBe("CONSULTATION_REQUIRED");
  });

  it("returns INFORMATION_INCOMPLETE when required answers are largely missing", () => {
    const result = buildRecommendation(baseInput({ answers: { total_budget: "900" }, totalPlannedBudgetUsd: 900 }));
    expect(result.feasibilityStatus).toBe("INFORMATION_INCOMPLETE");
  });
});

// ---------------------------------------------------------------------------
// Package tier selection - driven by need, not by budget size
// ---------------------------------------------------------------------------

describe("buildRecommendation - package selection is need-driven, not budget-driven", () => {
  it("recommends the launch package for a simple informational site even with a huge budget", () => {
    const result = buildRecommendation(baseInput({ answers: MINIMAL_INFORMATIONAL_ANSWERS, totalPlannedBudgetUsd: 50000 }));
    expect(result.paths[0].packageKey).toBe("launch");
  });

  it("recommends a higher tier for a marketplace with vendors regardless of a modest budget", () => {
    const answers: AnswerMap = { ...MINIMAL_INFORMATIONAL_ANSWERS, website_purpose: "marketplace", marketplace_vendors: "yes" };
    const result = buildRecommendation(baseInput({ answers, totalPlannedBudgetUsd: 900 }));
    expect(result.paths[0].packageKey).not.toBe("launch");
  });

  it("always offers a Growth and a Starter/Phased path alongside the Recommended path", () => {
    const result = buildRecommendation(baseInput({ answers: MINIMAL_INFORMATIONAL_ANSWERS, totalPlannedBudgetUsd: 900 }));
    expect(result.paths.length).toBe(3);
    expect(result.paths.map((p) => p.kind)).toEqual(["recommended", "growth", "starter_phased"]);
  });
});

// ---------------------------------------------------------------------------
// Feature classification - portal-like crm_services rows never leak in
// ---------------------------------------------------------------------------

describe("buildRecommendation - Fusion invoice never includes portal products", () => {
  it("never includes the legacy 'hosting' crm_services row as a Fusion feature", () => {
    const result = buildRecommendation(baseInput({ answers: MINIMAL_INFORMATIONAL_ANSWERS, totalPlannedBudgetUsd: 900 }));
    const allFeatureKeys = [...result.requiredFeatures, ...result.optionalFeatures].map((f) => f.key);
    expect(allFeatureKeys).toEqual(allFeatureKeys.filter((key) => key !== "hosting"));
  });

  it("marks e-commerce as a required Fusion feature for a sellable purpose", () => {
    const answers: AnswerMap = { ...MINIMAL_INFORMATIONAL_ANSWERS, website_purpose: "ecommerce", sells_physical_products: "yes" };
    const result = buildRecommendation(baseInput({ answers, totalPlannedBudgetUsd: 5000 }));
    expect(result.requiredFeatures.some((f) => f.key === "ecommerce-starter")).toBe(true);
  });

  it("marks logo design as optional (never required) even when requested", () => {
    const answers: AnswerMap = { ...MINIMAL_INFORMATIONAL_ANSWERS, has_existing_logo: "no", needs_logo_design: "yes" };
    const result = buildRecommendation(baseInput({ answers, totalPlannedBudgetUsd: 900 }));
    expect(result.optionalFeatures.some((f) => f.key === "logo-design")).toBe(true);
    expect(result.requiredFeatures.some((f) => f.key === "logo-design")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Missing information / confidence
// ---------------------------------------------------------------------------

describe("buildRecommendation - missing information and confidence", () => {
  it("lists unanswered required questions as missing information", () => {
    const { business_name, ...withoutName } = MINIMAL_INFORMATIONAL_ANSWERS;
    const result = buildRecommendation(baseInput({ answers: withoutName, totalPlannedBudgetUsd: 900 }));
    expect(result.missingInformation.length).toBeGreaterThan(0);
  });

  it("has full confidence with a complete, confident answer set", () => {
    const result = buildRecommendation(baseInput({ answers: MINIMAL_INFORMATIONAL_ANSWERS, totalPlannedBudgetUsd: 900 }));
    expect(result.confidenceScore).toBeGreaterThanOrEqual(90);
  });

  it("lowers confidence when the client was not sure of their budget", () => {
    const result = buildRecommendation(
      baseInput({ answers: MINIMAL_INFORMATIONAL_ANSWERS, totalPlannedBudgetUsd: null, budgetSpecialToken: "not_sure" })
    );
    expect(result.confidenceScore).toBeLessThan(90);
  });
});

// ---------------------------------------------------------------------------
// Phase 4: portal pricing disclaimer passthrough
// ---------------------------------------------------------------------------

describe("buildRecommendation - portal pricing disclaimer", () => {
  it("passes the admin-configured portal pricing disclaimer through from business rules, never hard-coded", () => {
    const result = buildRecommendation(baseInput({ answers: MINIMAL_INFORMATIONAL_ANSWERS, totalPlannedBudgetUsd: 900 }));
    expect(result.portalPricingDisclaimer).toBe(RULES.portalPricingDisclaimerText);
  });
});
