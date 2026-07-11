import { NextResponse } from "next/server";
import { checkOverdueTasks } from "@/lib/automations";

// Triggered by Vercel Cron (see vercel.json). Protects against public
// invocation by requiring the same secret Vercel sends in the Authorization
// header when CRON_SECRET is configured.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const result = await checkOverdueTasks();
  return NextResponse.json({ ok: true, ...result });
}
