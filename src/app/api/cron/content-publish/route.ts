import { NextResponse } from "next/server";
import { publishDuePosts } from "@/lib/content";

// Reels/video Stories can take a while for Meta to process, so give this
// route more headroom than the default function timeout.
export const maxDuration = 60;

// Triggered two ways:
//  1. Vercel Cron once a day (see vercel.json) as a safety net.
//  2. A Supabase pg_cron job calling this every few minutes for near-real-time
//     publishing, since Vercel's Hobby plan only allows daily cron schedules.
// Both send the same CRON_SECRET bearer token when it's configured.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const result = await publishDuePosts();
  return NextResponse.json({ ok: true, ...result });
}
