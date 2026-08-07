import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

let cachedServiceClient: ReturnType<typeof createClient<any>> | null = null;

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot set cookies. Middleware and actions refresh sessions.
          }
        }
      }
    }
  );
}

export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  if (!cachedServiceClient) {
    cachedServiceClient = createClient<any>(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        // Next.js's fetch patch caches GET requests indefinitely by default,
        // even on dynamically-rendered admin/portal routes. Without this,
        // reads made through this service-role client (used almost
        // everywhere in fusionadmin and the client portal) can keep
        // returning stale data after a write - e.g. an admin edit that
        // saves successfully to the database but the page (and any other
        // page reading the same row) keeps rendering the old value until
        // the underlying Data Cache entry happens to expire. Force every
        // request from this client to bypass that cache so admins always
        // see the record they just saved.
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" })
      }
    });
  }

  return cachedServiceClient;
}
