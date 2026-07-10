"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireFusionAdmin } from "@/lib/auth";
import {
  createCrmContact,
  createCrmDeal,
  createCrmNote,
  createCrmTask,
  inviteCrmTeamMember,
  updateCrmBrandSettings,
  updateCrmServicePackage
} from "@/lib/crm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInFusionAdmin(_: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { error: "Supabase Auth is not configured yet." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "The email or password is not correct." };
  }

  redirect("/fusionadmin");
}

export async function signOutFusionAdmin() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/fusionadmin/login");
}

export async function createFusionContact(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await createCrmContact({
    actorId: user.id,
    firstName: String(formData.get("firstName") || ""),
    lastName: String(formData.get("lastName") || ""),
    email: String(formData.get("email") || ""),
    phone: String(formData.get("phone") || ""),
    companyName: String(formData.get("companyName") || ""),
    leadSource: String(formData.get("leadSource") || "Manual"),
    nextFollowUpAt: String(formData.get("nextFollowUpAt") || "")
  });

  revalidatePath("/fusionadmin");
  revalidatePath("/fusionadmin/clients");
}

export async function createFusionDeal(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await createCrmDeal({
    actorId: user.id,
    dealTitle: String(formData.get("dealTitle") || ""),
    companyName: String(formData.get("companyName") || ""),
    service: String(formData.get("service") || ""),
    value: Number(formData.get("value") || 0),
    stageId: String(formData.get("stageId") || ""),
    expectedCloseDate: String(formData.get("expectedCloseDate") || "")
  });

  revalidatePath("/fusionadmin");
  revalidatePath("/fusionadmin/deals");
}

export async function createFusionTask(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await createCrmTask({
    actorId: user.id,
    title: String(formData.get("title") || ""),
    taskType: String(formData.get("taskType") || "Follow-Up"),
    priority: String(formData.get("priority") || "normal"),
    dueAt: String(formData.get("dueAt") || "")
  });

  revalidatePath("/fusionadmin");
  revalidatePath("/fusionadmin/tasks");
}

export async function createFusionNote(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await createCrmNote({
    actorId: user.id,
    body: String(formData.get("body") || ""),
    entityType: String(formData.get("entityType") || "general")
  });

  revalidatePath("/fusionadmin");
}

export async function updateFusionBrandSettings(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await updateCrmBrandSettings({
    actorId: user.id,
    logoUrl: String(formData.get("logoUrl") || ""),
    primaryColor: String(formData.get("primaryColor") || ""),
    accentColor: String(formData.get("accentColor") || "")
  });

  revalidatePath("/fusionadmin/settings");
}

export async function updateFusionServicePackage(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await updateCrmServicePackage({
    actorId: user.id,
    packageId: String(formData.get("packageId") || ""),
    packageName: String(formData.get("packageName") || ""),
    description: String(formData.get("description") || ""),
    setupPrice: Number(formData.get("setupPrice") || 0),
    monthlyPrice: Number(formData.get("monthlyPrice") || 0),
    isActive: formData.get("isActive") === "on"
  });

  revalidatePath("/fusionadmin/settings");
}

export async function inviteFusionTeamMember(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await inviteCrmTeamMember({
    actorId: user.id,
    email: String(formData.get("email") || ""),
    displayName: String(formData.get("displayName") || ""),
    title: String(formData.get("title") || ""),
    roleId: String(formData.get("roleId") || "")
  });

  revalidatePath("/fusionadmin/team");
  revalidatePath("/fusionadmin/settings");
}
