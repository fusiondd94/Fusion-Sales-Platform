import { NextResponse } from "next/server";
import Stripe from "stripe";
import { fulfillCheckout, recordStripeEvent } from "@/lib/crm";
import { fulfillOrderPayment } from "@/lib/sales-orders";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await recordStripeEvent(event);

    const orderKind = session.metadata?.orderKind;

    if (orderKind === "sales_order" || orderKind === "ecommerce_tier") {
      // New immediate-payment-capture flow: budget deposits/full payments
      // from the results page, portal pay-anytime top-ups, and homepage
      // e-commerce tier quick-buys. Idempotent - safe even if
      // /order/success already fulfilled this same session.
      await fulfillOrderPayment(session);
    } else {
      // Legacy subscription-based checkout flow.
      await fulfillCheckout(session);
      console.info("Create Fusion client portal, CRM deal, and onboarding tasks", {
        customer: session.customer,
        subscription: session.subscription,
        metadata: session.metadata
      });
    }
  }

  if (event.type === "invoice.payment_failed") {
    await recordStripeEvent(event);
    console.info("Create revenue recovery task for Fusion sales follow-up", event.data.object.id);
  }

  return NextResponse.json({ received: true });
}
