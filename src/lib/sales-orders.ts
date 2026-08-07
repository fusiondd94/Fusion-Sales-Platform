/**
 * src/lib/sales-orders.ts
 *
 * Server-only Supabase + Stripe I/O for capturing payment immediately after
 * a customer sees their website plan. Mirrors the pure/I-O split used
 * throughout this codebase (sales-recommendation.ts, sales-result.ts,
 * portal.ts): all pricing math here is trivial (percentages, cent
 * conversion) and stays inline rather than spinning up a separate pure
 * module, but every dollar figure this file starts from is read back from
 * the already-persisted sales_website_recommendations row - nothing is
 * trusted from the client.
 *
 * Three payment surfaces are covered:
 *   1. createBudgetCheckoutSession - "Pay in full" / "Pay 50% deposit" on
 *      the public /results/[token] page, based on the customer's own
 *      stated total budget (recommendation.total_planned_budget).
 *   2. createIncrementCheckoutSession - flexible "pay anytime" top-up
 *      payments from the authenticated client portal.
 *   3. createEcommerceTierCheckoutSession - fixed-price quick-buy tiers on
 *      the homepage, no questionnaire required.
 *
 * A fourth surface, admin-created manual charges (createManualClientCharge,
 * near the bottom of this file), covers everything that doesn't start from
 * a questionnaire or checkout flow - retainers, change orders, deposits
 * requested by phone or email, etc. These are plain sales_orders rows an
 * admin creates directly from the client's record in fusionadmin; the
 * client then pays them from the same portal Billing tab and "pay anytime"
 * flow used for every other order (createIncrementCheckoutSession), so
 * there's only one payment code path on the client side regardless of how
 * the order originated.
 *
 * Fulfillment (fulfillOrderPayment) is idempotent via the unique
 * stripe_checkout_session_id column on sales_payments, and is safe to call
 * from both the Stripe webhook and the /order/success page independently -
 * whichever gets there first wins, the other is a no-op. markOrderPaidManually
 * is the equivalent idempotent-in-effect path for payments collected outside
 * Stripe (cash, check, wire) - it still writes a matching sales_payments row
 * so the ledger stays consistent between both payment paths.
 */

import type Stripe from "stripe";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ECOMMERCE_TIERS, type EcommerceTierKey } from "@/lib/ecommerce-tiers";

type ServiceClient = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

type OrderContext = {
  sessionId: string;
  organizationId: string | null;
  leadId: string | null;
  recommendationId: string;
  totalPlannedBudget: number;
  customerEmail: string | null;
  customerName: string | null;
};

async function resolveOrderContextByShareToken(supabase: ServiceClient, shareToken: string): Promise<OrderContext | null> {
  const { data: session } = await supabase
    .from("sales_questionnaire_sessions")
    .select("id, organization_id, lead_id")
    .eq("result_share_token", shareToken)
    .maybeSingle<{ id: string; organization_id: string | null; lead_id: string | null }>();

  if (!session) return null;

  const { data: recommendation } = await supabase
    .from("sales_website_recommendations")
    .select("id, total_planned_budget")
    .eq("session_id", session.id)
    .eq("status", "draft")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; total_planned_budget: number }>();

  if (!recommendation) return null;

  let customerEmail: string | null = null;
  let customerName: string | null = null;

  if (session.lead_id) {
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("customer_email, customer_name")
      .eq("id", session.lead_id)
      .maybeSingle<{ customer_email: string | null; customer_name: string | null }>();
    customerEmail = lead?.customer_email ?? null;
    customerName = lead?.customer_name ?? null;
  }

  return {
    sessionId: session.id,
    organizationId: session.organization_id,
    leadId: session.lead_id,
    recommendationId: recommendation.id,
    totalPlannedBudget: recommendation.total_planned_budget,
    customerEmail,
    customerName
  };
}

async function findOrCreateWebsiteOrder(
  supabase: ServiceClient,
  ctx: OrderContext
): Promise<{ id: string; totalAmountCents: number; customerEmail: string | null }> {
  const { data: existing } = await supabase
    .from("sales_orders")
    .select("id, total_amount_cents, customer_email")
    .eq("session_id", ctx.sessionId)
    .eq("order_kind", "website_project")
    .maybeSingle<{ id: string; total_amount_cents: number; customer_email: string | null }>();

  if (existing) return { id: existing.id, totalAmountCents: existing.total_amount_cents, customerEmail: existing.customer_email };

  const totalAmountCents = Math.max(0, Math.round(ctx.totalPlannedBudget * 100));

  const { data: created, error } = await supabase
    .from("sales_orders")
    .insert({
      organization_id: ctx.organizationId,
      session_id: ctx.sessionId,
      lead_id: ctx.leadId,
      recommendation_id: ctx.recommendationId,
      order_kind: "website_project",
      customer_email: ctx.customerEmail || "pending@checkout.stripe.com",
      customer_name: ctx.customerName,
      total_amount_cents: totalAmountCents,
      status: "pending"
    })
    .select("id, total_amount_cents, customer_email")
    .single<{ id: string; total_amount_cents: number; customer_email: string | null }>();

  if (error || !created) throw new Error("Unable to create order.");
  return { id: created.id, totalAmountCents: created.total_amount_cents, customerEmail: created.customer_email };
}

type CheckoutResult = { ok: true; url: string } | { ok: false; reason: string };

/**
 * "Pay in full" or "Pay 50% deposit now" from the public results page.
 * Amount is always derived from the customer's own stated total budget,
 * never from the recommended package price.
 */
export async function createBudgetCheckoutSession(shareToken: string, paymentType: "full" | "deposit"): Promise<CheckoutResult> {
  const stripe = getStripe();
  const supabase = createSupabaseServiceClient();
  if (!stripe || !supabase) return { ok: false, reason: "Payments are not configured yet. Please contact Fusion directly." };

  const ctx = await resolveOrderContextByShareToken(supabase, shareToken);
  if (!ctx) return { ok: false, reason: "We could not find your plan." };
  if (!ctx.totalPlannedBudget || ctx.totalPlannedBudget <= 0) {
    return { ok: false, reason: "Please enter a project budget before continuing to payment." };
  }

  const order = await findOrCreateWebsiteOrder(supabase, ctx);
  const amountCents = paymentType === "full" ? order.totalAmountCents : Math.round(order.totalAmountCents / 2);

  if (amountCents < 100) return { ok: false, reason: "That amount is too small to process. Please enter a higher budget." };

  const appUrl = getAppUrl();
  const email = ctx.customerEmail && ctx.customerEmail !== "pending@checkout.stripe.com" ? ctx.customerEmail : undefined;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: paymentType === "full" ? "Website project - full payment" : "Website project - 50% deposit to get started"
          },
          unit_amount: amountCents
        },
        quantity: 1
      }
    ],
    metadata: {
      orderKind: "sales_order",
      orderId: order.id,
      paymentType,
      resultToken: shareToken
    },
    success_url: `${appUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/results/${shareToken}?checkout=cancelled`
  });

  if (!session.url) return { ok: false, reason: "Unable to start checkout. Please try again." };

  await supabase.from("sales_payments").insert({
    order_id: order.id,
    stripe_checkout_session_id: session.id,
    amount_cents: amountCents,
    payment_type: paymentType,
    status: "pending"
  });

  return { ok: true, url: session.url };
}

/**
 * Flexible "pay anytime" top-up from the authenticated client portal. The
 * caller (a Server Action in the portal) is responsible for verifying the
 * order actually belongs to the signed-in client before calling this.
 */
export async function createIncrementCheckoutSession(orderId: string, amountDollars: number): Promise<CheckoutResult> {
  const stripe = getStripe();
  const supabase = createSupabaseServiceClient();
  if (!stripe || !supabase) return { ok: false, reason: "Payments are not configured yet. Please contact Fusion directly." };

  if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
    return { ok: false, reason: "Enter a valid payment amount." };
  }

  const { data: order } = await supabase
    .from("sales_orders")
    .select("id, customer_email, total_amount_cents, amount_paid_cents")
    .eq("id", orderId)
    .maybeSingle<{ id: string; customer_email: string | null; total_amount_cents: number; amount_paid_cents: number }>();

  if (!order) return { ok: false, reason: "We could not find that order." };

  const remainingCents = Math.max(order.total_amount_cents - order.amount_paid_cents, 0);
  if (remainingCents <= 0) return { ok: false, reason: "This order is already paid in full." };

  const requestedCents = Math.round(amountDollars * 100);
  const amountCents = Math.min(requestedCents, remainingCents);
  if (amountCents < 100) return { ok: false, reason: "Enter a valid payment amount." };

  const appUrl = getAppUrl();
  const email = order.customer_email && order.customer_email !== "pending@checkout.stripe.com" ? order.customer_email : undefined;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Website project - payment" },
          unit_amount: amountCents
        },
        quantity: 1
      }
    ],
    metadata: {
      orderKind: "sales_order",
      orderId: order.id,
      paymentType: "increment"
    },
    success_url: `${appUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/portal`
  });

  if (!session.url) return { ok: false, reason: "Unable to start checkout. Please try again." };

  await supabase.from("sales_payments").insert({
    order_id: order.id,
    stripe_checkout_session_id: session.id,
    amount_cents: amountCents,
    payment_type: "increment",
    status: "pending"
  });

  return { ok: true, url: session.url };
}

/**
 * Fixed-price quick-buy checkout for the homepage's 3 e-commerce tiers.
 * No questionnaire or account needed - Stripe Checkout collects the
 * customer's email itself.
 */
export async function createEcommerceTierCheckoutSession(tierKey: EcommerceTierKey): Promise<CheckoutResult> {
  const stripe = getStripe();
  const supabase = createSupabaseServiceClient();
  if (!stripe || !supabase) return { ok: false, reason: "Payments are not configured yet. Please contact Fusion directly." };

  const tier = ECOMMERCE_TIERS[tierKey];
  if (!tier) return { ok: false, reason: "That package is not available." };

  const { data: org } = await supabase
    .from("crm_organizations")
    .select("id")
    .eq("slug", "fusion-digital-dynamics")
    .maybeSingle<{ id: string }>();

  const amountCents = Math.round(tier.priceDollars * 100);

  const { data: order, error } = await supabase
    .from("sales_orders")
    .insert({
      organization_id: org?.id || null,
      order_kind: "ecommerce_tier",
      customer_email: "pending@checkout.stripe.com",
      total_amount_cents: amountCents,
      status: "pending"
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !order) return { ok: false, reason: "Unable to start checkout. Please try again." };

  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${tier.name} - e-commerce website design`,
            description: tier.tagline
          },
          unit_amount: amountCents
        },
        quantity: 1
      }
    ],
    metadata: {
      orderKind: "ecommerce_tier",
      orderId: order.id,
      tierKey
    },
    success_url: `${appUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/#ecommerce-tiers`
  });

  if (!session.url) return { ok: false, reason: "Unable to start checkout. Please try again." };

  await supabase.from("sales_payments").insert({
    order_id: order.id,
    stripe_checkout_session_id: session.id,
    amount_cents: amountCents,
    payment_type: "ecommerce_tier",
    status: "pending"
  });

  return { ok: true, url: session.url };
}

// ---------------------------------------------------------------------------
// Fulfillment - idempotent, called from both the Stripe webhook and the
// /order/success page so payment capture never depends on webhook timing.
// ---------------------------------------------------------------------------

export async function fulfillOrderPayment(session: Stripe.Checkout.Session): Promise<void> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return;

  const orderId = session.metadata?.orderId;
  if (!orderId) return;

  const { data: payment } = await supabase
    .from("sales_payments")
    .select("id, status, amount_cents, order_id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle<{ id: string; status: string; amount_cents: number; order_id: string }>();

  if (!payment) return;
  if (payment.status === "completed") return; // Already processed - idempotent no-op.

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const now = new Date().toISOString();

  await supabase
    .from("sales_payments")
    .update({ status: "completed", completed_at: now, stripe_payment_intent_id: paymentIntentId })
    .eq("id", payment.id);

  const { data: order } = await supabase
    .from("sales_orders")
    .select("id, organization_id, lead_id, customer_email, customer_name, total_amount_cents, amount_paid_cents, client_id")
    .eq("id", payment.order_id)
    .maybeSingle<{
      id: string;
      organization_id: string | null;
      lead_id: string | null;
      customer_email: string | null;
      customer_name: string | null;
      total_amount_cents: number;
      amount_paid_cents: number;
      client_id: string | null;
    }>();

  if (!order) return;

  const newAmountPaidCents = order.amount_paid_cents + payment.amount_cents;
  const newStatus = newAmountPaidCents >= order.total_amount_cents ? "paid_in_full" : "deposit_paid";
  const customerEmail =
    order.customer_email && order.customer_email !== "pending@checkout.stripe.com"
      ? order.customer_email
      : session.customer_details?.email || order.customer_email;
  const customerName = order.customer_name || session.customer_details?.name || null;

  await supabase
    .from("sales_orders")
    .update({
      amount_paid_cents: newAmountPaidCents,
      status: newStatus,
      customer_email: customerEmail,
      customer_name: customerName,
      updated_at: now
    })
    .eq("id", order.id);

  if (!order.client_id && customerEmail) {
    const clientId = await provisionClientForOrder(supabase, {
      organizationId: order.organization_id,
      leadId: order.lead_id,
      customerEmail,
      customerName
    });
    if (clientId) {
      await supabase.from("sales_orders").update({ client_id: clientId }).eq("id", order.id);
    }
  }
}

async function provisionClientForOrder(
  supabase: ServiceClient,
  input: { organizationId: string | null; leadId: string | null; customerEmail: string; customerName: string | null }
): Promise<string | null> {
  const { data: existingClient } = await supabase
    .from("crm_clients")
    .select("id, portal_user_id")
    .eq("customer_email", input.customerEmail)
    .maybeSingle<{ id: string; portal_user_id: string | null }>();

  let clientId = existingClient?.id ?? null;

  if (!clientId) {
    const { data: created, error } = await supabase
      .from("crm_clients")
      .insert({
        lead_id: input.leadId,
        customer_email: input.customerEmail,
        customer_name: input.customerName || input.customerEmail,
        company: input.customerName || input.customerEmail,
        organization_id: input.organizationId,
        status: "active",
        onboarding_status: "payment_received"
      })
      .select("id")
      .single<{ id: string }>();

    if (error || !created) {
      console.error("Unable to create Fusion client record for order.", error);
      return null;
    }
    clientId = created.id;
  }

  const { data: clientRow } = await supabase
    .from("crm_clients")
    .select("portal_user_id")
    .eq("id", clientId)
    .maybeSingle<{ portal_user_id: string | null }>();

  if (!clientRow?.portal_user_id) {
    const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(input.customerEmail, {
      data: { full_name: input.customerName || input.customerEmail }
    });

    if (!inviteError && invited?.user) {
      await supabase.from("crm_clients").update({ portal_user_id: invited.user.id, portal_status: "invited" }).eq("id", clientId);
    } else {
      console.error("Unable to invite client to the portal.", inviteError);
    }
  }

  if (input.organizationId) {
    await supabase.from("crm_tasks").insert({
      client_id: clientId,
      organization_id: input.organizationId,
      title: "New paid order - confirm project scope with client",
      owner: "Fusion AI Team",
      status: "open",
      priority: "high",
      task_type: "onboarding",
      due_at: new Date(Date.now() + 1000 * 60 * 60).toISOString()
    });
  }

  return clientId;
}

export type OrderSummary = {
  orderId: string;
  orderKind: string;
  totalAmountCents: number;
  amountPaidCents: number;
  status: string;
  paymentType: string;
  paymentAmountCents: number;
};

/**
 * Used by /order/success to show what was just paid for, independent of
 * whether the webhook has fired yet (fulfillOrderPayment is called first).
 */
export async function getOrderSummaryByCheckoutSessionId(checkoutSessionId: string): Promise<OrderSummary | null> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const { data: payment } = await supabase
    .from("sales_payments")
    .select("order_id, amount_cents, payment_type, status")
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .maybeSingle<{ order_id: string; amount_cents: number; payment_type: string; status: string }>();

  if (!payment) return null;

  const { data: order } = await supabase
    .from("sales_orders")
    .select("id, total_amount_cents, amount_paid_cents, status, order_kind")
    .eq("id", payment.order_id)
    .maybeSingle<{ id: string; total_amount_cents: number; amount_paid_cents: number; status: string; order_kind: string }>();

  if (!order) return null;

  return {
    orderId: order.id,
    orderKind: order.order_kind,
    totalAmountCents: order.total_amount_cents,
    amountPaidCents: order.amount_paid_cents,
    status: order.status,
    paymentType: payment.payment_type,
    paymentAmountCents: payment.amount_cents
  };
}

export type ClientOrderBalance = {
  orderId: string;
  description: string | null;
  totalAmountCents: number;
  amountPaidCents: number;
  remainingCents: number;
  status: string;
};

/**
 * Used by the client portal to show total/paid/remaining and drive the
 * "make a payment" flexible pay-anytime control.
 */
export async function getOrderBalancesForClient(clientId: string): Promise<ClientOrderBalance[]> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("sales_orders")
    .select("id, description, total_amount_cents, amount_paid_cents, status")
    .eq("client_id", clientId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .returns<Array<{ id: string; description: string | null; total_amount_cents: number; amount_paid_cents: number; status: string }>>();

  return (data || []).map((order) => ({
    orderId: order.id,
    description: order.description,
    totalAmountCents: order.total_amount_cents,
    amountPaidCents: order.amount_paid_cents,
    remainingCents: Math.max(order.total_amount_cents - order.amount_paid_cents, 0),
    status: order.status
  }));
}

// ---------------------------------------------------------------------------
// Admin billing controls - manual charges created from fusionadmin, outside
// the questionnaire/checkout flows above. See file header for how these fit
// alongside the Stripe-driven paths.
// ---------------------------------------------------------------------------

async function resolveDefaultOrganizationId(supabase: ServiceClient): Promise<string | null> {
  const { data } = await supabase
    .from("crm_organizations")
    .select("id")
    .eq("slug", "fusion-digital-dynamics")
    .maybeSingle<{ id: string }>();
  return data?.id || null;
}

export type AdminOrderSummary = {
  id: string;
  orderKind: string;
  description: string | null;
  totalAmountCents: number;
  amountPaidCents: number;
  status: string;
  createdAt: string;
};

/**
 * Admin-only order list for a client, including cancelled orders - unlike
 * getOrderBalancesForClient (the client-facing Billing tab), which hides
 * cancelled orders from the customer.
 */
export async function getOrdersForAdminClient(clientId: string): Promise<AdminOrderSummary[]> {
  const supabase = createSupabaseServiceClient();
  if (!supabase || !clientId) return [];

  const { data } = await supabase
    .from("sales_orders")
    .select("id, order_kind, description, total_amount_cents, amount_paid_cents, status, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .returns<
      Array<{
        id: string;
        order_kind: string;
        description: string | null;
        total_amount_cents: number;
        amount_paid_cents: number;
        status: string;
        created_at: string;
      }>
    >();

  return (data || []).map((order) => ({
    id: order.id,
    orderKind: order.order_kind,
    description: order.description,
    totalAmountCents: order.total_amount_cents,
    amountPaidCents: order.amount_paid_cents,
    status: order.status,
    createdAt: order.created_at
  }));
}

/**
 * Admin-created charge for a client outside the questionnaire/checkout
 * flow - e.g. a monthly retainer, a change-order fee, or a deposit
 * requested by phone or email. Creates an unpaid sales_orders row; the
 * client then pays it from their portal Billing tab through the same
 * "pay anytime" flow (createIncrementCheckoutSession) used for every other
 * order, so there's only one payment code path on the client side.
 */
export async function createManualClientCharge(input: {
  clientId: string;
  description: string;
  amountDollars: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!input.clientId) return { ok: false, error: "Client is required." };

  const description = input.description.trim();
  if (!description) return { ok: false, error: "Describe what this charge is for." };

  const amountCents = Math.round(input.amountDollars * 100);
  if (!Number.isFinite(amountCents) || amountCents < 100) return { ok: false, error: "Enter a valid amount." };

  const { data: client } = await supabase
    .from("crm_clients")
    .select("customer_email, customer_name, organization_id")
    .eq("id", input.clientId)
    .maybeSingle<{ customer_email: string | null; customer_name: string | null; organization_id: string | null }>();

  if (!client) return { ok: false, error: "Client not found." };

  const organizationId = client.organization_id || (await resolveDefaultOrganizationId(supabase));

  const { error } = await supabase.from("sales_orders").insert({
    organization_id: organizationId,
    client_id: input.clientId,
    order_kind: "manual_charge",
    description,
    customer_email: client.customer_email || "pending@checkout.stripe.com",
    customer_name: client.customer_name,
    total_amount_cents: amountCents,
    amount_paid_cents: 0,
    status: "pending"
  });

  if (error) return { ok: false, error: "Unable to create the charge." };
  return { ok: true };
}

/**
 * Marks an order paid outside Stripe (cash, check, wire, etc.) and records
 * a matching sales_payments row so the ledger stays consistent with the
 * Stripe-fulfilled path in fulfillOrderPayment().
 */
export async function markOrderPaidManually(input: { orderId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!input.orderId) return { ok: false, error: "Order id is required." };

  const { data: order } = await supabase
    .from("sales_orders")
    .select("id, total_amount_cents, amount_paid_cents")
    .eq("id", input.orderId)
    .maybeSingle<{ id: string; total_amount_cents: number; amount_paid_cents: number }>();

  if (!order) return { ok: false, error: "Order not found." };

  const remainingCents = Math.max(order.total_amount_cents - order.amount_paid_cents, 0);
  const now = new Date().toISOString();

  if (remainingCents > 0) {
    await supabase.from("sales_payments").insert({
      order_id: order.id,
      amount_cents: remainingCents,
      payment_type: "manual",
      status: "completed",
      completed_at: now
    });
  }

  const { error } = await supabase
    .from("sales_orders")
    .update({ amount_paid_cents: order.total_amount_cents, status: "paid_in_full", updated_at: now })
    .eq("id", order.id);

  if (error) return { ok: false, error: "Unable to update the order." };
  return { ok: true };
}

/**
 * Cancels a charge that was created in error. Removes it from both the
 * admin's active view and the client's Billing tab (which excludes
 * cancelled orders via getOrderBalancesForClient).
 */
export async function cancelClientOrder(input: { orderId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!input.orderId) return { ok: false, error: "Order id is required." };

  const { error } = await supabase
    .from("sales_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", input.orderId);

  if (error) return { ok: false, error: "Unable to cancel the order." };
  return { ok: true };
}
