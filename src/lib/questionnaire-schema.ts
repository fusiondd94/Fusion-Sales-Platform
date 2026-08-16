/**
 * src/lib/questionnaire-schema.ts
 *
 * Pure, server-safe question definitions and branching logic for the Fusion
 * adaptive client questionnaire (Phase 2). Nothing in this file performs any
 * I/O - it is fully unit-testable in isolation, mirroring the pure/I-O split
 * established in src/lib/sales-rules.ts (Phase 1).
 *
 * This module intentionally contains no pricing or business-rule constants.
 * The one exception is a budget INPUT sanity ceiling (MAX_REASONABLE_BUDGET),
 * which is a data-validation guard, not a business price - real minimums and
 * thresholds continue to live in sales_business_rules (see sales-rules.ts).
 *
 * Branching (the "when" condition on each question) is expressed as a small
 * declarative AND/OR condition tree - the same shape already used for
 * automation condition groups elsewhere in this codebase - rather than
 * embedded JSX logic, so a future admin-configuration phase can move this
 * data into the database without a rewrite.
 */

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

export type AnswerValue = string | string[] | null;
export type AnswerMap = Record<string, AnswerValue>;

// ---------------------------------------------------------------------------
// Branching condition tree
// ---------------------------------------------------------------------------

export type QuestionCondition =
  | { key: string; equals: string }
  | { key: string; notEquals: string }
  | { key: string; in: string[] }
  | { all: QuestionCondition[] }
  | { any: QuestionCondition[] };

export function evaluateCondition(condition: QuestionCondition, answers: AnswerMap): boolean {
  if ("all" in condition) return condition.all.every((child) => evaluateCondition(child, answers));
  if ("any" in condition) return condition.any.some((child) => evaluateCondition(child, answers));

  const value = answers[condition.key];
  const asString = Array.isArray(value) ? value : value == null ? [] : [value];

  if ("equals" in condition) return asString.includes(condition.equals);
  if ("notEquals" in condition) return value != null && !asString.includes(condition.notEquals);
  if ("in" in condition) return asString.some((item) => condition.in.includes(item));

  return true;
}

// ---------------------------------------------------------------------------
// Question definitions
// ---------------------------------------------------------------------------

export type QuestionType = "budget" | "text" | "textarea" | "email" | "phone" | "single_select" | "multi_select";

export type QuestionOption = { label: string; value: string };

export type QuestionDefinition = {
  key: string;
  section: string;
  type: QuestionType;
  prompt: string;
  help?: string;
  options?: QuestionOption[];
  required: boolean;
  when?: QuestionCondition;
};

function yesNo(): QuestionOption[] {
  return [
    { label: "Yes", value: "yes" },
    { label: "No", value: "no" }
  ];
}

const SELLABLE_PURPOSES: QuestionCondition = { key: "website_purpose", in: ["ecommerce", "marketplace"] };
const FEATURE_ELIGIBLE_PURPOSES: QuestionCondition = { key: "website_purpose", notEquals: "blog" };

export const QUESTION_DEFINITIONS: QuestionDefinition[] = [
  // --- Budget (always first) -------------------------------------------------
  {
    key: "total_budget",
    section: "budget",
    type: "budget",
    prompt: "What is the total budget you are currently planning for your website project?",
    help: "This may need to cover both the website build and the products needed to launch it (domain, hosting, SSL, etc.). Those products are purchased separately through the Fusion client portal, but we'll estimate them here so you know the full picture.",
    required: true
  },

  // --- Contact -----------------------------------------------------------
  {
    key: "business_name",
    section: "contact",
    type: "text",
    prompt: "What is the name of your business or organization?",
    required: true
  },
  {
    key: "contact_name",
    section: "contact",
    type: "text",
    prompt: "What is your name?",
    required: true
  },
  {
    key: "contact_email",
    section: "contact",
    type: "email",
    prompt: "What is the best email address to reach you?",
    required: true
  },
  {
    key: "contact_phone",
    section: "contact",
    type: "phone",
    prompt: "What is the best phone number to reach you?",
    required: true
  },
  {
    key: "preferred_contact_method",
    section: "contact",
    type: "single_select",
    prompt: "How do you prefer we follow up with you?",
    required: true,
    options: [
      { label: "Email", value: "email" },
      { label: "Phone call", value: "phone" },
      { label: "Text message", value: "text" }
    ]
  },
  {
    key: "marketing_consent",
    section: "contact",
    type: "multi_select",
    prompt: "May we follow up with helpful updates about your project?",
    help: "Choose any that apply. You can unsubscribe at any time, and this has no effect on your website plan.",
    required: false,
    options: [
      { label: "Yes, by email", value: "marketing_email" },
      { label: "Yes, by text message", value: "marketing_sms" },
      { label: "Yes, by phone", value: "marketing_calls" }
    ]
  },

  // --- Business profile ----------------------------------------------------
  {
    key: "industry",
    section: "business",
    type: "text",
    prompt: "What industry is your business in?",
    required: true
  },
  {
    key: "business_location",
    section: "business",
    type: "text",
    prompt: "Where is your business located?",
    required: false
  },
  {
    key: "business_exists",
    section: "business",
    type: "single_select",
    prompt: "Does your business already exist, or are you starting a new one?",
    required: true,
    options: [
      { label: "Already exists", value: "existing" },
      { label: "New / starting soon", value: "new_startup" }
    ]
  },

  // --- Website purpose -----------------------------------------------------
  {
    key: "website_purpose",
    section: "purpose",
    type: "single_select",
    prompt: "What is the main purpose of your website?",
    required: true,
    options: [
      { label: "Informational / brochure site", value: "informational" },
      { label: "Generate leads", value: "lead_generation" },
      { label: "Bookings / appointments", value: "booking" },
      { label: "Membership site", value: "membership" },
      { label: "Nonprofit", value: "nonprofit" },
      { label: "Portfolio", value: "portfolio" },
      { label: "Blog", value: "blog" },
      { label: "Marketplace (multiple vendors)", value: "marketplace" },
      { label: "Online store (e-commerce)", value: "ecommerce" }
    ]
  },
  {
    key: "expected_pages",
    section: "purpose",
    type: "single_select",
    prompt: "About how many pages do you expect the site to need?",
    required: false,
    options: [
      { label: "1-3 pages", value: "1-3" },
      { label: "4-7 pages", value: "4-7" },
      { label: "8-15 pages", value: "8-15" },
      { label: "16+ pages", value: "16+" }
    ]
  },
  {
    key: "initial_product_count",
    section: "purpose",
    type: "text",
    prompt: "About how many products or listings will you start with?",
    required: false,
    when: SELLABLE_PURPOSES
  },

  // --- Commerce --------------------------------------------------------------
  {
    key: "sells_physical_products",
    section: "commerce",
    type: "single_select",
    prompt: "Will you sell physical products that need to be shipped?",
    required: false,
    options: yesNo(),
    when: SELLABLE_PURPOSES
  },
  {
    key: "sells_digital_products",
    section: "commerce",
    type: "single_select",
    prompt: "Will you sell digital products or downloads?",
    required: false,
    options: yesNo(),
    when: SELLABLE_PURPOSES
  },
  {
    key: "digital_download_protection",
    section: "commerce",
    type: "single_select",
    prompt: "Do your digital downloads need protection from unauthorized sharing?",
    required: false,
    options: yesNo(),
    when: { key: "sells_digital_products", equals: "yes" }
  },
  {
    key: "offers_services",
    section: "commerce",
    type: "single_select",
    prompt: "Will you sell or list services (not just physical/digital products)?",
    required: false,
    options: yesNo(),
    when: { all: [FEATURE_ELIGIBLE_PURPOSES, { key: "website_purpose", notEquals: "portfolio" }] }
  },
  {
    key: "offers_subscriptions",
    section: "commerce",
    type: "single_select",
    prompt: "Will customers pay on a recurring subscription basis?",
    required: false,
    options: yesNo(),
    when: { key: "website_purpose", in: ["ecommerce", "marketplace", "membership"] }
  },
  {
    key: "accepts_donations",
    section: "commerce",
    type: "single_select",
    prompt: "Will the site accept donations?",
    required: false,
    options: yesNo(),
    when: { key: "website_purpose", equals: "nonprofit" }
  },
  {
    key: "needs_customer_accounts",
    section: "commerce",
    type: "single_select",
    prompt: "Do customers need their own accounts (order history, saved info, etc.)?",
    required: false,
    options: yesNo(),
    when: { key: "website_purpose", in: ["ecommerce", "marketplace", "membership", "booking"] }
  },
  {
    key: "marketplace_vendors",
    section: "commerce",
    type: "single_select",
    prompt: "Will multiple independent vendors sell through your site?",
    required: false,
    options: yesNo(),
    when: { key: "website_purpose", equals: "marketplace" }
  },
  {
    key: "needs_payment_processing",
    section: "commerce",
    type: "single_select",
    prompt: "Do you need to accept online payments directly through the website?",
    required: false,
    options: yesNo(),
    when: {
      any: [
        { key: "sells_physical_products", equals: "yes" },
        { key: "sells_digital_products", equals: "yes" },
        { key: "offers_subscriptions", equals: "yes" },
        { key: "accepts_donations", equals: "yes" },
        { key: "website_purpose", equals: "booking" }
      ]
    }
  },
  {
    key: "needs_shipping",
    section: "commerce",
    type: "single_select",
    prompt: "Do products need shipping calculated at checkout?",
    required: false,
    options: yesNo(),
    when: { key: "sells_physical_products", equals: "yes" }
  },
  {
    key: "tax_requirements",
    section: "commerce",
    type: "single_select",
    prompt: "Do you need to collect sales tax in more than one state or region?",
    required: false,
    options: [
      { label: "Yes, multiple states/regions", value: "multi_region" },
      { label: "Yes, one state/region only", value: "single_region" },
      { label: "Not sure", value: "not_sure" },
      { label: "No", value: "no" }
    ],
    when: { key: "needs_payment_processing", equals: "yes" }
  },
  {
    key: "inventory_requirements",
    section: "commerce",
    type: "single_select",
    prompt: "Do you need inventory/stock levels tracked automatically?",
    required: false,
    options: yesNo(),
    when: { key: "sells_physical_products", equals: "yes" }
  },

  // --- Bookings ----------------------------------------------------------
  {
    key: "needs_bookings",
    section: "bookings",
    type: "single_select",
    prompt: "Do you need customers to book appointments or reservations online?",
    required: false,
    options: yesNo(),
    when: FEATURE_ELIGIBLE_PURPOSES
  },
  {
    key: "booking_deposits_required",
    section: "bookings",
    type: "single_select",
    prompt: "Should bookings require a deposit to confirm?",
    required: false,
    options: yesNo(),
    when: { key: "needs_bookings", equals: "yes" }
  },
  {
    key: "booking_staff_calendars",
    section: "bookings",
    type: "single_select",
    prompt: "Do you need separate calendars for different staff members?",
    required: false,
    options: yesNo(),
    when: { key: "needs_bookings", equals: "yes" }
  },
  {
    key: "booking_recurring_appointments",
    section: "bookings",
    type: "single_select",
    prompt: "Do you need support for recurring appointments?",
    required: false,
    options: yesNo(),
    when: { key: "needs_bookings", equals: "yes" }
  },

  // --- Membership ----------------------------------------------------------
  {
    key: "needs_memberships",
    section: "membership",
    type: "single_select",
    prompt: "Will your site have paid or gated membership content?",
    required: false,
    options: yesNo(),
    when: FEATURE_ELIGIBLE_PURPOSES
  },
  {
    key: "membership_protected_content",
    section: "membership",
    type: "single_select",
    prompt: "Does membership content need to be hidden from non-members?",
    required: false,
    options: yesNo(),
    when: { key: "needs_memberships", equals: "yes" }
  },
  {
    key: "membership_subscription_billing",
    section: "membership",
    type: "single_select",
    prompt: "Should memberships bill on a recurring basis?",
    required: false,
    options: yesNo(),
    when: { key: "needs_memberships", equals: "yes" }
  },

  // --- Existing assets -----------------------------------------------------
  {
    key: "has_existing_website",
    section: "existing_assets",
    type: "single_select",
    prompt: "Do you already have a website?",
    required: true,
    options: yesNo()
  },
  {
    key: "has_existing_domain",
    section: "existing_assets",
    type: "single_select",
    prompt: "Do you already own a domain name?",
    required: true,
    options: yesNo()
  },
  {
    key: "domain_transferable",
    section: "existing_assets",
    type: "single_select",
    prompt: "Can that domain be transferred to or connected with Fusion?",
    required: false,
    options: [...yesNo(), { label: "Not sure", value: "not_sure" }],
    when: { key: "has_existing_domain", equals: "yes" }
  },
  {
    key: "has_existing_hosting",
    section: "existing_assets",
    type: "single_select",
    prompt: "Do you already have web hosting?",
    required: true,
    options: yesNo()
  },
  {
    key: "hosting_transferable",
    section: "existing_assets",
    type: "single_select",
    prompt: "Can that hosting account be transferred or connected?",
    required: false,
    options: [...yesNo(), { label: "Not sure", value: "not_sure" }],
    when: { key: "has_existing_hosting", equals: "yes" }
  },
  {
    key: "has_existing_ssl",
    section: "existing_assets",
    type: "single_select",
    prompt: "Does your current domain or hosting already include a valid SSL certificate?",
    required: false,
    options: [...yesNo(), { label: "Not sure", value: "not_sure" }],
    when: { any: [{ key: "has_existing_domain", equals: "yes" }, { key: "has_existing_hosting", equals: "yes" }] }
  },
  {
    key: "has_existing_professional_email",
    section: "existing_assets",
    type: "single_select",
    prompt: "Do you already have professional email at your own domain?",
    required: true,
    options: yesNo()
  },
  {
    key: "has_existing_branding",
    section: "existing_assets",
    type: "single_select",
    prompt: "Do you already have established branding (colors, fonts, style)?",
    required: false,
    options: yesNo()
  },
  {
    key: "has_existing_logo",
    section: "existing_assets",
    type: "single_select",
    prompt: "Do you already have a logo?",
    required: true,
    options: yesNo()
  },
  {
    key: "has_existing_written_content",
    section: "existing_assets",
    type: "single_select",
    prompt: "Do you already have written content for the site (about, services, etc.)?",
    required: true,
    options: yesNo()
  },
  {
    key: "has_existing_media",
    section: "existing_assets",
    type: "single_select",
    prompt: "Do you already have photos or videos to use on the site?",
    required: false,
    options: yesNo()
  },

  // --- Content & marketing needs --------------------------------------------
  {
    key: "needs_content_writing",
    section: "needs",
    type: "single_select",
    prompt: "Would you like Fusion to write the site content for you?",
    required: false,
    options: yesNo(),
    when: { key: "has_existing_written_content", equals: "no" }
  },
  {
    key: "needs_logo_design",
    section: "needs",
    type: "single_select",
    prompt: "Would you like Fusion to design a logo for you?",
    required: false,
    options: yesNo(),
    when: { key: "has_existing_logo", equals: "no" }
  },
  {
    key: "needs_seo",
    section: "needs",
    type: "single_select",
    prompt: "Are you interested in search engine optimization (SEO)?",
    required: false,
    options: yesNo()
  },
  {
    key: "needs_email_marketing",
    section: "needs",
    type: "single_select",
    prompt: "Would you like an email marketing / newsletter setup?",
    required: false,
    options: yesNo()
  },
  {
    key: "needs_professional_email",
    section: "needs",
    type: "single_select",
    prompt: "Would you like professional email set up at your own domain?",
    required: false,
    options: yesNo(),
    when: { key: "has_existing_professional_email", equals: "no" }
  },
  {
    key: "needs_microsoft_365",
    section: "needs",
    type: "single_select",
    prompt: "Are you interested in Microsoft 365 (Office apps, cloud storage)?",
    required: false,
    options: yesNo()
  },
  {
    key: "needs_crm",
    section: "needs",
    type: "single_select",
    prompt: "Do you need a CRM to track customers and leads?",
    required: false,
    options: yesNo()
  },
  {
    key: "needs_appointment_scheduling",
    section: "needs",
    type: "single_select",
    prompt: "Would you like an appointment-scheduling tool on the site?",
    required: false,
    options: yesNo()
  },
  {
    key: "needs_forms",
    section: "needs",
    type: "single_select",
    prompt: "Do you need custom forms (contact, intake, applications, etc.)?",
    required: false,
    options: yesNo()
  },
  {
    key: "needs_live_chat",
    section: "needs",
    type: "single_select",
    prompt: "Would you like live chat on the site?",
    required: false,
    options: yesNo()
  },
  {
    key: "needs_ai_chatbot",
    section: "needs",
    type: "single_select",
    prompt: "Would you like an AI chatbot to answer visitor questions?",
    required: false,
    options: yesNo()
  },
  {
    key: "needs_marketing_automations",
    section: "needs",
    type: "single_select",
    prompt: "Are you interested in marketing automations (follow-up sequences, etc.)?",
    required: false,
    options: yesNo()
  },
  {
    key: "needs_multilingual",
    section: "needs",
    type: "single_select",
    prompt: "Does the site need to support more than one language?",
    required: false,
    options: yesNo()
  },
  {
    key: "needs_accessibility",
    section: "needs",
    type: "single_select",
    prompt: "Do you have specific accessibility requirements (e.g. WCAG compliance)?",
    required: false,
    options: yesNo()
  },

  // --- Timeline & decision ---------------------------------------------------
  {
    key: "desired_launch_date",
    section: "timeline",
    type: "text",
    prompt: "When would you like the website to launch?",
    help: "A specific date, or a general timeframe like \"ASAP\" or \"in 2 months\" is fine.",
    required: false
  },
  {
    key: "decision_timeline",
    section: "timeline",
    type: "single_select",
    prompt: "How soon do you expect to make a decision on moving forward?",
    required: true,
    options: [
      { label: "Immediately", value: "immediately" },
      { label: "Within 30 days", value: "within_30_days" },
      { label: "This quarter", value: "this_quarter" },
      { label: "Still exploring", value: "exploring" }
    ]
  },
  {
    key: "is_decision_maker",
    section: "timeline",
    type: "single_select",
    prompt: "Are you the final decision-maker for this project?",
    required: true,
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
      { label: "Shared decision", value: "shared" }
    ]
  },
  {
    key: "payment_plan_interest",
    section: "timeline",
    type: "single_select",
    prompt: "Would a payment plan help you move forward?",
    required: false,
    options: yesNo()
  },
  {
    key: "preferred_investment_level",
    section: "timeline",
    type: "single_select",
    prompt: "Which investment range feels most realistic for ongoing/ancillary costs?",
    required: false,
    options: [
      { label: "Under $750", value: "under_750" },
      { label: "$750 - $1,500", value: "750_1500" },
      { label: "$1,500 - $3,000", value: "1500_3000" },
      { label: "$3,000+", value: "3000_plus" }
    ]
  },

  // --- Priorities --------------------------------------------------------
  {
    key: "must_have_features",
    section: "priorities",
    type: "textarea",
    prompt: "What are your must-have features for this website?",
    required: false
  },
  {
    key: "nice_to_have_features",
    section: "priorities",
    type: "textarea",
    prompt: "Anything that would be nice to have, but isn't essential?",
    required: false
  },
  {
    key: "biggest_business_problem",
    section: "priorities",
    type: "textarea",
    prompt: "What's the biggest problem you're hoping this website solves?",
    required: false
  },
  {
    key: "primary_conversion_goal",
    section: "priorities",
    type: "single_select",
    prompt: "What is the single most important action you want visitors to take?",
    required: false,
    options: [
      { label: "Submit a lead / contact form", value: "get_leads" },
      { label: "Buy a product", value: "sell_products" },
      { label: "Book an appointment", value: "book_appointments" },
      { label: "Build trust / credibility", value: "build_trust" },
      { label: "Something else", value: "other" }
    ]
  },
  {
    key: "referral_source",
    section: "priorities",
    type: "single_select",
    prompt: "How did you hear about Fusion Digital Dynamics?",
    required: false,
    options: [
      { label: "Google / search engine", value: "google_search" },
      { label: "Social media", value: "social_media" },
      { label: "Referral from someone", value: "referral" },
      { label: "Existing Fusion client", value: "existing_client" },
      { label: "Advertisement", value: "advertisement" },
      { label: "Something else", value: "other" }
    ]
  }
];

export const CONTACT_QUESTION_KEYS = ["business_name", "contact_name", "contact_email", "contact_phone"] as const;

// ---------------------------------------------------------------------------
// Engine: visibility, progress, next-question resolution
// ---------------------------------------------------------------------------

function isAnswered(value: AnswerValue | undefined): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return true; // an explicit empty selection still counts as "answered"
  return value.trim().length > 0;
}

export function isQuestionVisible(question: QuestionDefinition, answers: AnswerMap): boolean {
  if (!question.when) return true;
  return evaluateCondition(question.when, answers);
}

/** All questions currently visible given the answers so far, in fixed definition order. */
export function getVisibleQuestions(answers: AnswerMap): QuestionDefinition[] {
  return QUESTION_DEFINITIONS.filter((question) => isQuestionVisible(question, answers));
}

/** The next unanswered visible question, or null once every visible question has been answered. */
export function getNextQuestion(answers: AnswerMap): QuestionDefinition | null {
  const visible = getVisibleQuestions(answers);
  for (const question of visible) {
    if (!(question.key in answers) || answers[question.key] == null) return question;
  }
  return null;
}

export type QuestionnaireProgress = {
  answeredCount: number;
  totalVisible: number;
  percent: number;
  isComplete: boolean;
};

export function computeProgress(answers: AnswerMap): QuestionnaireProgress {
  const visible = getVisibleQuestions(answers);
  const answeredCount = visible.filter((question) => (question.key in answers && answers[question.key] != null).length;
  const totalVisible = visible.length;
  const percent = totalVisible === 0 ? 0 : Math.round((answeredCount / totalVisible) * 100);
  return { answeredCount, totalVisible, percent, isComplete: answeredCount === totalVisible };
}

export function hasContactInfo(answers: AnswerMap): boolean {
  return CONTACT_QUESTION_KEYS.every((key) => (key in answers && answers[key] != null));
}

// ---------------------------------------------------------------------------
// Budget input parsing/validation
// ---------------------------------------------------------------------------

export const BUDGET_SPECIAL_TOKENS = ["not_sure", "payment_plan", "talk_to_someone"] as const;
export type BudgetSpecialToken = (typeof BUDGET_SPECIAL_TOKENS)[number];

/**
 * Input-sanity ceiling only - NOT a business rule/price. Guards against
 * "impossible values" per the Phase 2 spec (e.g. a user pasting a credit
 * card number or a wildly unrealistic figure). The real minimum ($300) is
 * enforced separately by sales-rules.ts's assessBudget(), which is loaded
 * from admin-controlled configuration.
 */
export const MAX_REASONABLE_BUDGET = 10_000_000;

export type BudgetParseResult =
  | { kind: "amount"; amountUsd: number }
  | { kind: BudgetSpecialToken }
  | { kind: "invalid"; reason: string };

const SPECIAL_PHRASES: Record<string, BudgetSpecialToken> = {
  not_sure: "not_sure",
  "not sure": "not_sure",
  "i am not sure": "not_sure",
  "i'm not sure": "not_sure",
  unsure: "not_sure",
  payment_plan: "payment_plan",
  "payment plan": "payment_plan",
  "i need a payment plan": "payment_plan",
  talk_to_someone: "talk_to_someone",
  "talk to someone": "talk_to_someone",
  "i want to speak with someone": "talk_to_someone",
  "speak with someone": "talk_to_someone"
};

export function parseBudgetInput(raw: string): BudgetParseResult {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { kind: "invalid", reason: "Please enter a budget amount." };

  const normalizedPhrase = trimmed.toLowerCase();
  if (normalizedPhrase in SPECIAL_PHRASES) return { kind: SPECIAL_PHRASES[normalizedPhrase] };

  if (/-/.test(trimmed)) return { kind: "invalid", reason: "Budget cannot be a negative number." };

  // Strip a single leading currency symbol and any thousands separators.
  const stripped = trimmed.replace(/^\$\s*/, "").replace(/,/g, "");

  if (!/^\d+(\.\d{1,2})?$/.test(stripped)) {
    return { kind: "invalid", reason: "Please enter a valid dollar amount, like 500 or $1,200." };
  }

  const numeric = Number.parseFloat(stripped);
  if (!Number.isFinite(numeric)) return { kind: "invalid", reason: "Please enter a valid dollar amount." };
  if (numeric < 0) return { kind: "invalid", reason: "Budget cannot be a negative number." };
  if (numeric > MAX_REASONABLE_BUDGET) {
    return { kind: "invalid", reason: "That amount is larger than we can plan for automatically - please contact us directly." };
  }

  return { kind: "amount", amountUsd: Math.round(numeric) };
}

// ---------------------------------------------------------------------------
// Lightweight contact-field validation (kept dependency-free, consistent
// with sales-rules.ts rather than pulling in zod for this module).
// ---------------------------------------------------------------------------

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function validateAnswerForQuestion(question: QuestionDefinition, raw: AnswerValue): { valid: boolean; reason?: string } {
  if (question.type === "budget") return { valid: true }; // handled by parseBudgetInput separately

  if (!isAnswered(raw)) {
    return question.required ? { valid: false, reason: "This question requires an answer." } : { valid: true };
  }

  if (question.type === "email") {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value || !isValidEmail(value)) return { valid: false, reason: "Please enter a valid email address." };
  }

  if (question.type === "phone") {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value || !isValidPhone(value)) return { valid: false, reason: "Please enter a valid phone number." };
  }

  if (question.type === "single_select") {
    const value = Array.isArray(raw) ? raw[0] : raw;
    const allowed = new Set((question.options || []).map((option) => option.value));
    if (!value || !allowed.has(value)) return { valid: false, reason: "Please choose one of the listed options." };
  }

  if (question.type === "multi_select") {
    const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const allowed = new Set((question.options || []).map((option) => option.value));
    if (values.some((value) => !allowed.has(value))) return { valid: false, reason: "One or more selected options are not valid." };
  }

  return { valid: true };
}
