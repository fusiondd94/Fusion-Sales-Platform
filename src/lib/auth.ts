import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function getAdminEmails() {
  return (process.env.FUSION_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export async function getFusionAdminUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  const email = data.user.email.toLowerCase();
  return { id: data.user.id, email, isAllowed: getAdminEmails().includes(email) };
}

export async function requireFusionAdmin() {
  const user = await getFusionAdminUser();
  if (!user) redirect("/fusionadmin/login");
  return user;
}
