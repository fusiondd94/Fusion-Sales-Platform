"use server";

/**
 * src/app/results/[token]/actions.ts
 *
 * Server Actions bridging the public, unauthenticated ResultView client
 * component to the server-only src/lib/sales-result.ts orchestration
 * module. No business logic lives here - every raw form value is still
 * re-validated inside sales-result.ts (via sales-result-rules.ts) before
 * any database write, since this page has no auth and the token in the URL
 * is the only gate.
 */

import { revalidatePath } from "next/cache";
import { requestCallFromResults, submitResultDecision } from "@/lib/sales-result";

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
