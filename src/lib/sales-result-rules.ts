/**
 * src/lib/sales-result-rules.ts
 *
 * Pure, server-safe logic for the Phase 6 shareable sales result page.
 * Nothing in this file performs I/O - it validates and formats plain data
 * that src/lib/sales-result.ts (the orchestration/I-O layer) loads from or
 * writes to Supabase. This mirrors the pure/I-O split already used by
 * questionnaire-schema.ts + sales-questionnaire.ts, recommendation-engine.ts
 * + sales-recommendation.ts, and launch-requirements.ts + portal.ts.
 *
 * Per the standing "server-side-only validation" project rule, a public,
 * unauthenticated page must never trust a raw client-submitted value
 * directly - resolveDecisionTransition() and isValidShareToken() are the
 * single places that decide whether an incoming request is well-formed
 * before any database read/write happens.
 */

export const CLIENT_DECISIONS = ["pending", "accepted", "declined"] as const;
export type ClientDecision = (typeof CLIENT_DECISIONS)[number];

const DECISION_LABELS: Record<ClientDecision, string> = {
  pending: "Awaiting your decision",
  accepted: "Accepted",
  declined: "Declined"
};

export function decisionLabel(decision: ClientDecision): string {
  return DECISION_LABELS[decision];
}

/**
 * Share tokens are generated with crypto.randomUUID() (see
 * generateShareToken() in sales-result.ts) - this checks the shape of an
 * incoming URL param before it is ever used in a Supabase query, rejecting
 * anything that isn't a plausible token rather than passing arbitrary
 * user-controlled strings straight into a filter.
 */
export function isValidShareToken(token: unknown): token is string {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  return trimmed.length >= 16 && trimmed.length <= 64 && /^[a-f0-9-]+$/i.test(trimmed);
}

export type DecisionTransitionResult = { ok: true; decision: "accepted" | "declined" } | { ok: false; reason: string };

/**
 * Validates a client-submitted accept/decline action before any database
 * write happens. Per the "never trust frontend calculations/values" rule,
 * the raw form value is treated as untrusted input - only "accepted" or
 * "declined" are ever accepted, regardless of what a modified request might
 * send.
 */
export function resolveDecisionTransition(requestedDecision: unknown): DecisionTransitionResult {
  if (requestedDecision !== "accepted" && requestedDecision !== "declined") {
    return { ok: false, reason: "Invalid decision." };
  }
  return { ok: true, decision: requestedDecision };
}

export type ResultViewState = {
  decision: ClientDecision;
  decisionLabel: string;
  isDecided: boolean;
  hasBeenViewedBefore: boolean;
};

/**
 * Formats the persisted decision/view-count fields into the flags the
 * results page UI needs (e.g. disabling the Accept/Decline buttons once a
 * decision has already been recorded).
 */
export function computeResultViewState(input: { decision: ClientDecision; viewCountBeforeThisView: number }): ResultViewState {
  return {
    decision: input.decision,
    decisionLabel: decisionLabel(input.decision),
    isDecided: input.decision !== "pending",
    hasBeenViewedBefore: input.viewCountBeforeThisView > 0
  };
}

/**
 * First-name-only greeting, used so the results page can say "Hi Sadrac"
 * without needing a full-name-parsing library. Falls back gracefully for
 * missing/blank names.
 */
export function firstNameFrom(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const trimmed = fullName.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}
