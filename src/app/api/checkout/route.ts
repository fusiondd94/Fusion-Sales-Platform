import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUrl, getStripe } from "@/lib/stripe";

const checkoutSchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    company: z.string().min(1)
  }),
  answers: z.record(z.union([z.string(), z.array(z.string())])),
  recommendation: z.object({
    packageKey: z.string(),
    packageName: z.string(),
    totalToday: z.number().int().nonnegative(),
    monthlyDue: z.number().int().nonnegative(),
    discountPercent: z.number().int().min(0).max(75)
  })
});

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout payload." }, { status: 400 });
  }

  const stripe = getStripe();
  const appUrl = getAppUrl();

  if (!stripe) {
    return NextResponse.json({
      error: "Stripe is not configured.",
      url: `${appUrl}/portal?demo=1`
    });
  }

  const { customer, answers, recommendation } = parsed.data;
  const lineItems = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: `${recommendation.packageName} website design`,
          description: `${recommendation.discountPercent}% discount applied at checkout.`
        },
        unit_amount: Math.max(100, recommendation.totalToday * 100)
      },
      quantity: 1
    },
    {
      price_data: {
        currency: "usd",
        recurring: { interval: "month" as const },
        product_data: {
          name: "Fusion managed hosting, security, and growth services"
        },
        unit_amount: Math.max(100, recommendation.monthlyDue * 100)
      },
      quantity: 1
    }
  ];

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: customer.email,
    client_reference_id: customer.company,
    line_items: lineItems,
    metadata: {
      customerName: customer.name,
      company: customer.company,
      packageKey: recommendation.packageKey,
      packageName: recommendation.packageName,
      discountPercent: String(recommendation.discountPercent),
      answers: JSON.stringify(answers).slice(0, 450)
    },
    success_url: `${appUrl}/portal?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/?checkout=cancelled#sales-flow`,
    subscription_data: {
      metadata: {
        company: customer.company,
        packageName: recommendation.packageName
      }
    }
  });

  return NextResponse.json({ url: session.url });
}
