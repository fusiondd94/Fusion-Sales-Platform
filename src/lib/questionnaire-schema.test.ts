import { describe, expect, it } from "vitest";
import {
  MAX_REASONABLE_BUDGET,
  QUESTION_DEFINITIONS,
  computeProgress,
  evaluateCondition,
  getNextQuestion,
  getVisibleQuestions,
  hasContactInfo,
  isValidEmail,
  isValidPhone,
  parseBudgetInput,
  validateAnswerForQuestion,
  type AnswerMap,
  type QuestionDefinition
} from "./questionnaire-schema";

describe("parseBudgetInput - required budget test cases", () => {
  it("accepts $0 as a valid (if insufficient) amount", () => {
    expect(parseBudgetInput("0")).toEqual({ kind: "amount", amountUsd: 0 });
  });

  it("accepts $1", () => {
    expect(parseBudgetInput("1")).toEqual({ kind: "amount", amountUsd: 1 });
  });

  it("accepts $299 (below minimum, but a valid parse)", () => {
    expect(parseBudgetInput("299")).toEqual({ kind: "amount", amountUsd: 299 });
  });

  it("accepts exactly $300", () => {
    expect(parseBudgetInput("300")).toEqual({ kind: "amount", amountUsd: 300 });
  });

  it("accepts $301", () => {
    expect(parseBudgetInput("301")).toEqual({ kind: "amount", amountUsd: 301 });
  });

  it("accepts values with commas", () => {
    expect(parseBudgetInput("2,600")).toEqual({ kind: "amount", amountUsd: 2600 });
  });

  it("accepts values with a leading currency symbol", () => {
    expect(parseBudgetInput("$1,000")).toEqual({ kind: "amount", amountUsd: 1000 });
  });

  it("rounds decimal values to the nearest whole dollar", () => {
    expect(parseBudgetInput("399.60")).toEqual({ kind: "amount", amountUsd: 400 });
    expect(parseBudgetInput("399.40")).toEqual({ kind: "amount", amountUsd: 399 });
  });

  it("rejects negative values", () => {
    const result = parseBudgetInput("-500");
    expect(result.kind).toBe("invalid");
  });

  it("rejects empty input", () => {
    const result = parseBudgetInput("");
    expect(result.kind).toBe("invalid");
  });

  it("rejects invalid text", () => {
    const result = parseBudgetInput("banana");
    expect(result.kind).toBe("invalid");
  });

  it("rejects letters disguised as an amount", () => {
    const result = parseBudgetInput("5OO");
    expect(result.kind).toBe("invalid");
  });

  it("rejects extremely large / impossible values", () => {
    const result = parseBudgetInput(String(MAX_REASONABLE_BUDGET + 1));
    expect(result.kind).toBe("invalid");
  });

  it("accepts a very large but plausible value ($10,000)", () => {
    expect(parseBudgetInput("10000")).toEqual({ kind: "amount", amountUsd: 10000 });
  });

  it("maps 'I am not sure' to the not_sure token", () => {
    expect(parseBudgetInput("I am not sure")).toEqual({ kind: "not_sure" });
    expect(parseBudgetInput("not sure")).toEqual({ kind: "not_sure" });
  });

  it("maps 'I need a payment plan' to the payment_plan token", () => {
    expect(parseBudgetInput("I need a payment plan")).toEqual({ kind: "payment_plan" });
  });

  it("maps 'I want to speak with someone' to the talk_to_someone token", () => {
    expect(parseBudgetInput("I want to speak with someone")).toEqual({ kind: "talk_to_someone" });
  });

  it("is case-insensitive for special phrases", () => {
    expect(parseBudgetInput("NOT SURE")).toEqual({ kind: "not_sure" });
  });
});

describe("contact validation", () => {
  it("validates well-formed emails", () => {
    expect(isValidEmail("jane@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing@domain")).toBe(false);
  });

  it("validates phone numbers by digit count", () => {
    expect(isValidPhone("555-123-4567")).toBe(true);
    expect(isValidPhone("(804) 245-6575")).toBe(true);
    expect(isValidPhone("123")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});

describe("evaluateCondition - branching logic", () => {
  it("evaluates a simple equals condition", () => {
    const answers: AnswerMap = { website_purpose: "ecommerce" };
    expect(evaluateCondition({ key: "website_purpose", equals: "ecommerce" }, answers)).toBe(true);
    expect(evaluateCondition({ key: "website_purpose", equals: "blog" }, answers)).toBe(false);
  });

  it("evaluates notEquals against an unanswered key as false (not vacuously true)", () => {
    expect(evaluateCondition({ key: "website_purpose", notEquals: "blog" }, {})).toBe(false);
  });

  it("evaluates an 'in' condition against multi-select answers", () => {
    const answers: AnswerMap = { marketing_consent: ["marketing_email", "marketing_sms"] };
    expect(evaluateCondition({ key: "marketing_consent", in: ["marketing_sms"] }, answers)).toBe(true);
    expect(evaluateCondition({ key: "marketing_consent", in: ["marketing_calls"] }, answers)).toBe(false);
  });

  it("evaluates AND (all) groups", () => {
    const answers: AnswerMap = { a: "yes", b: "yes" };
    const condition = { all: [{ key: "a", equals: "yes" }, { key: "b", equals: "yes" }] } as const;
    expect(evaluateCondition(condition, answers)).toBe(true);
    expect(evaluateCondition(condition, { a: "yes", b: "no" })).toBe(false);
  });

  it("evaluates OR (any) groups", () => {
    const condition = { any: [{ key: "a", equals: "yes" }, { key: "b", equals: "yes" }] } as const;
    expect(evaluateCondition(condition, { a: "no", b: "yes" })).toBe(true);
    expect(evaluateCondition(condition, { a: "no", b: "no" })).toBe(false);
  });
});

describe("questionnaire branching - real question examples from the spec", () => {
  it("does not ask shipping questions for a service-only (non-sellable-purpose) site", () => {
    const answers: AnswerMap = { website_purpose: "informational" };
    const visible = getVisibleQuestions(answers);
    expect(visible.some((question) => question.key === "needs_shipping")).toBe(false);
    expect(visible.some((question) => question.key === "sells_physical_products")).toBe(false);
  });

  it("asks digital-download-protection only when the client sells digital products", () => {
    const withoutDigital: AnswerMap = { website_purpose: "ecommerce", sells_digital_products: "no" };
    const withDigital: AnswerMap = { website_purpose: "ecommerce", sells_digital_products: "yes" };
    expect(getVisibleQuestions(withoutDigital).some((q) => q.key === "digital_download_protection")).toBe(false);
    expect(getVisibleQuestions(withDigital).some((q) => q.key === "digital_download_protection")).toBe(true);
  });

  it("asks booking sub-questions only once needs_bookings is yes", () => {
    const notNeeded: AnswerMap = { website_purpose: "informational", needs_bookings: "no" };
    const needed: AnswerMap = { website_purpose: "informational", needs_bookings: "yes" };
    expect(getVisibleQuestions(notNeeded).some((q) => q.key === "booking_staff_calendars")).toBe(false);
    expect(getVisibleQuestions(needed).some((q) => q.key === "booking_staff_calendars")).toBe(true);
  });

  it("does not ask product-count questions for a basic informational site", () => {
    const answers: AnswerMap = { website_purpose: "informational" };
    expect(getVisibleQuestions(answers).some((q) => q.key === "initial_product_count")).toBe(false);
  });

  it("does not show every question to every user (blog hides most commerce/booking/membership questions)", () => {
    const blogVisible = getVisibleQuestions({ website_purpose: "blog" }).length;
    const ecommerceVisible = getVisibleQuestions({ website_purpose: "ecommerce" }).length;
    expect(blogVisible).toBeLessThan(ecommerceVisible);
  });
});

describe("getNextQuestion / progress engine", () => {
  it("always starts with the budget question", () => {
    expect(getNextQuestion({})?.key).toBe("total_budget");
  });

  it("advances through answered questions in definition order", () => {
    const answers: AnswerMap = { total_budget: "500" };
    expect(getNextQuestion(answers)?.key).toBe("business_name");
  });

  it("treats an explicit empty multi-select as answered (not stuck)", () => {
    const answers: AnswerMap = {
      total_budget: "500",
      business_name: "Acme",
      contact_name: "Jane",
      contact_email: "jane@acme.com",
      contact_phone: "5551234567",
      preferred_contact_method: "email",
      marketing_consent: []
    };
    expect(getNextQuestion(answers)?.key).not.toBe("marketing_consent");
  });

  it("returns null once every visible question is answered", () => {
    const allKeys = QUESTION_DEFINITIONS.reduce<AnswerMap>((answers, question: QuestionDefinition) => {
      if (!question.when || evaluateCondition(question.when, answers)) {
        answers[question.key] = question.type === "multi_select" ? [] : question.options?.[0]?.value || "answer";
      }
      return answers;
    }, {});
    // Re-run once more so any newly-revealed conditional questions also get an answer.
    for (const question of QUESTION_DEFINITIONS) {
      if (allKeys[question.key] === undefined && (!question.when || evaluateCondition(question.when, allKeys))) {
        allKeys[question.key] = question.type === "multi_select" ? [] : question.options?.[0]?.value || "answer";
      }
    }
    expect(getNextQuestion(allKeys)).toBeNull();
    expect(computeProgress(allKeys).isComplete).toBe(true);
  });

  it("computes a 0-100 percent range", () => {
    const progress = computeProgress({ total_budget: "500" });
    expect(progress.percent).toBeGreaterThanOrEqual(0);
    expect(progress.percent).toBeLessThanOrEqual(100);
  });
});

describe("hasContactInfo", () => {
  it("is false until all four contact fields are answered", () => {
    expect(hasContactInfo({})).toBe(false);
    expect(hasContactInfo({ business_name: "Acme", contact_name: "Jane" })).toBe(false);
  });

  it("is true once name, contact name, email, and phone are all present", () => {
    expect(
      hasContactInfo({
        business_name: "Acme",
        contact_name: "Jane",
        contact_email: "jane@acme.com",
        contact_phone: "5551234567"
      })
    ).toBe(true);
  });
});

describe("validateAnswerForQuestion", () => {
  const emailQuestion = QUESTION_DEFINITIONS.find((q) => q.key === "contact_email")!;
  const selectQuestion = QUESTION_DEFINITIONS.find((q) => q.key === "website_purpose")!;
  const optionalQuestion = QUESTION_DEFINITIONS.find((q) => q.key === "business_location")!;

  it("rejects an invalid email", () => {
    expect(validateAnswerForQuestion(emailQuestion, "nope").valid).toBe(false);
  });

  it("accepts a valid email", () => {
    expect(validateAnswerForQuestion(emailQuestion, "jane@acme.com").valid).toBe(true);
  });

  it("rejects a single_select value outside the allowed options", () => {
    expect(validateAnswerForQuestion(selectQuestion, "not-a-real-option").valid).toBe(false);
  });

  it("allows an optional question to be left blank", () => {
    expect(validateAnswerForQuestion(optionalQuestion, "").valid).toBe(true);
    expect(validateAnswerForQuestion(optionalQuestion, null).valid).toBe(true);
  });
});
