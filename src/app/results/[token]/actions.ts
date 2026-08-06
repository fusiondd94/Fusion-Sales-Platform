"use server";

/**
 * src/app/results/[token]/actions.ts
 *
 * Server Actions bridging the public, unauthenticated ResultView client
 * component to the server-only src/lib/sales-result.ts and
 * src/lib/sales-orders.ts orchestration modules. No business logic lives
 * here - every raw form value is still re-validated inside those modules
 * before any database write, since this page has no auth and the token in
 * the URL is the only gate.
 */

import { revalidatePath } from "next/cache";
import { requestCallFromResults, submitResultDecision } from "@/lib/sales-result";
import { createBudgetCheckoutSession } from "@/lib/sales-orders";

export async function submitDecisionAction(
    token: string,
    rawDecision: string
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const result = await submitResultDecision(token, rawDecision);
    if (result.ok) revalidatePath(`/results/${token}`);
    return result;
}

export async function requestCallAction(
    token: string,
    preferredContactMethod: string | null
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const result = await requestCallFromResults(token, preferredContactMethod);
    if (result.ok) revalidatePath(`/results/${token}`);
    return result;
}

/**
 * "Pay in full" / "Pay 50% deposit now" - creates a live Stripe Checkout
 * session priced off the customer's own stated total budget and returns
 * the URL to redirect to. Never trusts a client-supplied amount.
 */
export async function createPaymentCheckoutAction(
    token: string,
    paymentType: "full" | "deposit"
  ): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
    return createBudgetCheckoutSession(token, paymentType);
}
