"use server";

/**
 * src/app/order/actions.ts
 *
 * Server Action bridging the homepage's e-commerce quick-buy tier cards to
 * the server-only src/lib/sales-orders.ts orchestration module. No pricing
 * is decided here - createEcommerceTierCheckoutSession looks up the tier's
 * fixed price from src/lib/ecommerce-tiers.ts server-side.
 */

import { createEcommerceTierCheckoutSession } from "@/lib/sales-orders";
import type { EcommerceTierKey } from "@/lib/ecommerce-tiers";

export async function createEcommerceTierCheckoutAction(
  tierKey: EcommerceTierKey
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  return createEcommerceTierCheckoutSession(tierKey);
}
