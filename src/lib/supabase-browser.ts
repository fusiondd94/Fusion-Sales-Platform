import { createClient } from "@supabase/supabase-js";

// A plain, unauthenticated browser client used only for Storage uploads.
// It never touches a session — uploads are authorized by the one-time
// signed-upload token issued server-side (see createBulkUploadTargets in
// src/lib/content.ts), not by who's calling this. Keeping it separate from
// the server-side service-role client is what lets the bulk scheduler send
// file bytes directly from the browser to Supabase Storage instead of
// through a Vercel serverless function, which has a hard 4.5MB request body
// limit that real photo batches blow past almost immediately.
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase browser client is not configured (missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
