import { describe, expect, it } from "vitest";
import {
    assessBudget,
    buildLaunchCostBreakdown,
    canMarkPortalProductPurchased,
    computeDiscountAmount,
    eligiblePaymentPlans,
    isDiscountRuleCurrentlyValid,
    isPaymentPlanEligible,
    resolveBusinessRules,
    snapshotServicePackage,
    validateAppliedDiscount,
    type BusinessRuleRow,
    type DiscountRule,
    type PaymentPlanRule
} from "./sales-rules";

function activeRule(overrides: Partial<BusinessRuleRow> = {}): BusinessRuleRow {
    return {
          rule_key: "minimum_total_budget",
          rule_value: { amount: 300, currency: "USD" },
          version: 1,
          is_active: true,
          ...overrides
    };
}

describe("resolveBusinessRules", () => {
    it("falls back to the $300 absolute minimums when no rows are configured", () => {
          const rules = resolveBusinessRules([]);
          expect(rules.minimumTotalBudget).toBe(300);
          expect(rules.minimumDesignAllocation).toBe(300);
    });

           it("fails closed on discounts when no rule row exists (max discount = 0%)", () => {
                 const rules = resolveBusinessRules([]);
                 expect(rules.maximumDiscountPercent).toBe(0);
           });

           it("lets an admin raise the minimum budget above $300", () => {
                 const rules = resolveBusinessRules([
                         activeRule({ rule_key: "minimum_total_budget", rule_value: { amount: 500 } })
                       ]);
                 expect(rules.minimumTotalBudget).toBe(500);
           });

           it("never lets a configured minimum drop below the $300 absolute floor", () => {
                 const rules = resolveBusinessRules([
                         activeRule({ rule_key: "minimum_total_budget", rule_value: { amount: 100 } }),
                         activeRule({ rule_key: "minimum_design_allocation", rule_value: { amount: 0 } })
                       ]);
                 expect(rules.minimumTotalBudget).toBe(300);
                 expect(rules.minimumDesignAllocation).toBe(300);
           });

           it("uses the highest version among active rows for a given key", () => {
                 const rules = resolveBusinessRules([
                         activeRule({ rule_key: "maximum_discount_percent", rule_value: { percent: 50 }, version: 1 }),
                         activeRule({ rule_key: "maximum_discount_percent", rule_value: { percent: 65 }, version: 2 })
                       ]);
                 expect(rules.maximumDiscountPercent).toBe(65);
                 expect(rules.version).toBe(2);
           });

           it("ignores inactive rows entirely", () => {
                 const rules = resolveBusinessRules([
                         activeRule({ rule_key: "minimum_total_budget", rule_value: { amount: 900 }, is_active: false })
                       ]);
                 expect(rules.minimumTotalBudget).toBe(300);
           });
});

describe("assessBudget - $300 minimum business rule", () => {
    const rules = resolveBusinessRules([
          activeRule({ rule_key: "minimum_total_budget", rule_value: { amount: 300 } }),
          activeRule({ rule_key: "minimum_design_allocation", rule_value: { amount: 300 } })
        ]);

           it("accepts exactly $300 as meeting the minimum", () => {
                 const result = assessBudget({ statedTotalBudget: 300, designAllocation: 300, budgetType: "one_time" }, rules);
                 expect(result.meetsTotalMinimum).toBe(true);
                 expect(result.meetsDesignMinimum).toBe(true);
                 expect(result.belowMinimum).toBe(false);
                 expect(result.nextSteps).toHaveLength(0);
           });

           it("rejects $299 and returns constructive next steps, not a dead end", () => {
                 const result = assessBudget({ statedTotalBudget: 299, designAllocation: 299, budgetType: "one_time" }, rules);
                 expect(result.belowMinimum).toBe(true);
                 expect(result.nextSteps.length).toBeGreaterThan(0);
                 expect(result.nextSteps.map((step) => step.action)).toEqual(
                         expect.arrayContaining([
                                   "schedule_consultation",
                                   "offer_payment_plan",
                                   "offer_phased_build",
                                   "save_for_later",
                                   "increase_budget",
                                   "check_promotions"
                                 ])
                       );
                 expect(result.message.length).toBeGreaterThan(0);
           });

           it("rejects $0 and negative budgets safely without throwing", () => {
                 const zero = assessBudget({ statedTotalBudget: 0, designAllocation: 0, budgetType: "unsure" }, rules);
                 expect(zero.belowMinimum).toBe(true);

                  const negative = assessBudget({ statedTotalBudget: -50, designAllocation: -50, budgetType: "unsure" }, rules);
                 expect(negative.belowMinimum).toBe(true);
                 expect(negative.meetsTotalMinimum).toBe(false);
           });

           it("flags below-minimum even when total budget is fine but design allocation is not", () => {
                 const result = assessBudget({ statedTotalBudget: 5000, designAllocation: 100, budgetType: "combined" }, rules);
                 expect(result.meetsTotalMinimum).toBe(true);
                 expect(result.meetsDesignMinimum).toBe(false);
                 expect(result.belowMinimum).toBe(true);
           });

           it("accepts a well-above-minimum budget cleanly", () => {
                 const result = assessBudget({ statedTotalBudget: 10000, designAllocation: 8000, budgetType: "one_time" }, rules);
                 expect(result.belowMinimum).toBe(false);
                 expect(result.nextSteps).toHaveLength(0);
           });

           it("records which business rules version produced the assessment", () => {
                 const result = assessBudget({ statedTotalBudget: 300, designAllocation: 300, budgetType: "one_time" }, rules);
                 expect(result.businessRulesVersion).toBe(rules.version);
                 expect(result.minimumTotalBudgetApplied).toBe(300);
           });
});

describe("discounts are never invented or auto-applied", () => {
    const maximumDiscountPercent = 75;
    const activeDiscount: DiscountRule = {
          id: "rule-1",
          rule_code: "SPRING20",
          rule_name: "Spring 20% Off",
          discount_type: "percent",
          discount_value: 20,
          max_discount_amount: null,
          requires_manual_approval: true,
          is_active: true,
          valid_from: "2020-01-01T00:00:00.000Z",
          valid_until: null
    };

           it("treats a zero discount with no rule reference as valid (the default, honest state)", () => {
                 const result = validateAppliedDiscount(
                   { discountRuleId: null, discountAmount: 0, subtotal: 1000 },
                         [],
                         maximumDiscountPercent
                       );
                 expect(result.valid).toBe(true);
           });

           it("rejects a non-zero discount that references no rule at all", () => {
                 const result = validateAppliedDiscount(
                   { discountRuleId: null, discountAmount: 100, subtotal: 1000 },
                         [],
                         maximumDiscountPercent
                       );
                 expect(result.valid).toBe(false);
                 expect(result.reason).toMatch(/without referencing an approved discount rule/i);
           });

           it("rejects a discount referencing a rule id that does not exist among active rules", () => {
                 const result = validateAppliedDiscount(
                   { discountRuleId: "does-not-exist", discountAmount: 100, subtotal: 1000 },
                         [activeDiscount],
                         maximumDiscountPercent
                       );
                 expect(result.valid).toBe(false);
                 expect(result.reason).toMatch(/not found among active/i);
           });

           it("rejects a discount referencing a rule that is outside its valid date range", () => {
                 const expired: DiscountRule = { ...activeDiscount, id: "rule-2", valid_until: "2021-01-01T00:00:00.000Z" };
                 expect(isDiscountRuleCurrentlyValid(expired, new Date("2026-01-01T00:00:00.000Z"))).toBe(false);

                  const result = validateAppliedDiscount(
                    { discountRuleId: "rule-2", discountAmount: 100, subtotal: 1000 },
                          [expired],
                          maximumDiscountPercent,
                          new Date("2026-01-01T00:00:00.000Z")
                        );
                 expect(result.valid).toBe(false);
           });

           it("computes and validates a correct percent discount against an approved active rule", () => {
                 const computed = computeDiscountAmount(activeDiscount, 1000, maximumDiscountPercent);
                 expect(computed).toBe(200); // 20% of $1000

                  const valid = validateAppliedDiscount(
                    { discountRuleId: "rule-1", discountAmount: 200, subtotal: 1000 },
                          [activeDiscount],
                          maximumDiscountPercent
                        );
                 expect(valid.valid).toBe(true);
           });

           it("rejects a discount amount larger than what the approved rule allows", () => {
                 const result = validateAppliedDiscount(
                   { discountRuleId: "rule-1", discountAmount: 500, subtotal: 1000 },
                         [activeDiscount],
                         maximumDiscountPercent
                       );
                 expect(result.valid).toBe(false);
                 expect(result.cappedAmount).toBe(200);
           });

           it("caps a rule's discount at the global maximum-discount-percent ceiling", () => {
                 const aggressiveRule: DiscountRule = { ...activeDiscount, id: "rule-3", discount_value: 90 };
                 const computed = computeDiscountAmount(aggressiveRule, 1000, 75);
                 expect(computed).toBe(750); // capped at 75% of subtotal, not 90%
           });

           it("caps a fixed discount at the rule's own max_discount_amount", () => {
                 const fixedRule: DiscountRule = {
                         ...activeDiscount,
                         id: "rule-4",
                         discount_type: "fixed",
                         discount_value: 400,
                         max_discount_amount: 150
                 };
                 const computed = computeDiscountAmount(fixedRule, 1000, 75);
                 expect(computed).toBe(150);
           });
});

describe("payment plan eligibility", () => {
    const plan: PaymentPlanRule = {
          id: "plan-1",
          plan_code: "standard-2pay",
          plan_name: "Two-Payment Plan",
          deposit_percent: 50,
          number_of_installments: 2,
          installment_interval: "monthly",
          minimum_eligible_total: 300,
          is_active: true
    };

           it("is eligible once the design total meets the plan minimum", () => {
                 expect(isPaymentPlanEligible(300, plan)).toBe(true);
                 expect(isPaymentPlanEligible(299, plan)).toBe(false);
           });

           it("is never eligible for an inactive plan, regardless of amount", () => {
                 expect(isPaymentPlanEligible(10000, { ...plan, is_active: false })).toBe(false);
           });

           it("filters a list down to only eligible plans", () => {
                 const smallPlan: PaymentPlanRule = { ...plan, id: "plan-2", plan_code: "tiny", minimum_eligible_total: 5000 };
                 const eligible = eligiblePaymentPlans(1000, [plan, smallPlan]);
                 expect(eligible.map((p) => p.id)).toEqual(["plan-1"]);
           });
});

describe("buildLaunchCostBreakdown keeps Fusion fees and portal products separate", () => {
    it("never mixes portal product estimates into the Fusion design total", () => {
          const breakdown = buildLaunchCostBreakdown(900, 0, [
            { price_unit: "one_time", estimated_price: 0, quantity: 1 },
            { price_unit: "annual", estimated_price: 20, quantity: 1 },
            { price_unit: "annual", estimated_price: 120, quantity: 1 },
            { price_unit: "monthly", estimated_price: 20, quantity: 1 }
                ]);

           expect(breakdown.fusionDesignTotal).toBe(900);
          expect(breakdown.portalAnnualTotal).toBe(140);
          expect(breakdown.portalMonthlyTotal).toBe(20);
          expect(breakdown.grandLaunchEstimate).toBe(900 + 140); // monthly recurring is not folded into the one-time grand estimate
    });

           it("multiplies quantity into each portal product line", () => {
                 const breakdown = buildLaunchCostBreakdown(0, 0, [{ price_unit: "one_time", estimated_price: 50, quantity: 3 }]);
                 expect(breakdown.portalOneTimeTotal).toBe(150);
           });
});

describe("canMarkPortalProductPurchased - purchases require real verification", () => {
    it("is false when there is no verification record at all", () => {
          expect(canMarkPortalProductPurchased(null)).toBe(false);
    });

           it("is false for an unverified client submission (clicking the portal link is not enough)", () => {
                 expect(
                         canMarkPortalProductPurchased({ verified: false, verification_method: "client_submitted_pending_review" })
                       ).toBe(false);
           });

           it("is true once an admin has verified a client submission", () => {
                 expect(
                         canMarkPortalProductPurchased({ verified: true, verification_method: "client_submitted_pending_review" })
                       ).toBe(true);
           });

           it("is true for a verified portal API sync or admin manual verification", () => {
                 expect(canMarkPortalProductPurchased({ verified: true, verification_method: "portal_api_sync" })).toBe(true);
                 expect(canMarkPortalProductPurchased({ verified: true, verification_method: "admin_manual_verification" })).toBe(
                         true
                       );
           });
});

describe("snapshotServicePackage - versioned pricing", () => {
    it("captures a point-in-time copy that is unaffected by later mutation of the source", () => {
          const source = {
                  id: "pkg-1",
                  package_key: "launch",
                  package_name: "Launch Foundation",
                  setup_price: 900,
                  monthly_price: 89,
                  inclusions: ["5 pages", "Contact form"]
          };
          const snapshot = snapshotServicePackage(source, new Date("2026-07-31T00:00:00.000Z"));
          source.inclusions.push("Mutated after snapshot");

           expect(snapshot.inclusions).toEqual(["5 pages", "Contact form"]);
          expect(snapshot.snapshot_taken_at).toBe("2026-07-31T00:00:00.000Z");
          expect(snapshot.setup_price).toBe(900);
    });
});
