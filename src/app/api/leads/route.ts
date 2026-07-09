import { NextResponse } from "next/server";
import { z } from "zod";
import { customerSchema } from "@/lib/customer";

const leadSchema = z.object({
  customer: customerSchema,
  answers: z.record(z.union([z.string(), z.array(z.string())])),
  recommendation: z.object({ packageKey: z.string(), packageName: z.string(), totalToday: z.number().int().nonnegative(), monthlyDue: z.number().int().nonnegative(), discountPercent: z.number().int().min(0).max(75) })
});

export async function POST(request: Request) {
  const parsed = leadSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid lead payload.", details: parsed.error.flatten() }, { status: 400 });
  const leadId = `FDD-${Date.now().toString(36).toUpperCase()}`;
  console.info("Fusion sales lead captured", { leadId, customer: parsed.data.customer, recommendation: parsed.data.recommendation, answers: parsed.data.answers });
  return NextResponse.json({ leadId, status: "captured", nextAction: "checkout" });
}
