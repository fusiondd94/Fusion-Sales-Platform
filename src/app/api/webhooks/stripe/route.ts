import { NextResponse } from "next/server";
import Stripe from "stripe";
import { fulfillCheckout, recordStripeEvent } from "@/lib/crm";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret); } catch { return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 }); }
  await recordStripeEvent(event);
  if (event.type === "checkout.session.completed") await fulfillCheckout(event.data.object as Stripe.Checkout.Session);
  if (event.type === "invoice.payment_failed") console.info("Create revenue recovery task for Fusion sales follow-up", event.data.object.id);
  return NextResponse.json({ received: true });
}
