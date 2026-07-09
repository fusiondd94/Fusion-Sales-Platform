import { NextResponse } from "next/server";
import { z } from "zod";
import { customerSchema } from "@/lib/customer";
import { getAppUrl, getStripe } from "@/lib/stripe";

const checkoutSchema = z.object({
  customer: customerSchema,
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
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const appUrl = configuredAppUrl || new URL(request.url).origin || getAppUrl();

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
      customerEmail: customer.email,
      customerPhone: customer.phone,
      company: customer.company,
      website: customer.website || "",
      packageKey: recommendation.packageKey,
      packageName: recommendation.packageName,
      discountPercent: String(recommendation.discountPercent),
      projectNotes: (customer.projectNotes || "").slice(0, 450),
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
