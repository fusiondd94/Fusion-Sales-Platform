import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FusionAdminUser = {
  id: string;
  email: string;
  displayName: string;
  isAllowed: boolean;
};

export function getAdminEmails() {
  return (process.env.FUSION_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function hasFusionCrmMembership(userId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data, error } = await supabase
    .from("crm_organization_members")
    .select("id, crm_organizations!inner(slug)")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("crm_organizations.slug", "fusion-digital-dynamics")
    .limit(1);

  if (error) {
    console.error("Unable to verify Fusion CRM membership.", error);
    return false;
  }

  return Boolean(data?.length);
}

export async function getFusionAdminUser(): Promise<FusionAdminUser | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.email) return null;

  const email = data.user.email.toLowerCase();
  const adminEmails = getAdminEmails();
  const metadata = data.user.user_metadata as { full_name?: string; name?: string } | null;
  const displayName = metadata?.full_name || metadata?.name || email.split("@")[0];
  const isEnvAdmin = adminEmails.includes(email);
  const isMember = isEnvAdmin ? true : await hasFusionCrmMembership(data.user.id);

  return {
    id: data.user.id,
    email,
    displayName,
    isAllowed: isEnvAdmin || isMember
  };
}

export async function requireFusionAdmin() {
  const user = await getFusionAdminUser();

  if (!user) {
    redirect("/fusionadmin/login");
  }

  return user;
}
