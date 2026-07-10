"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClientProjectComment, uploadClientProjectFile } from "@/lib/portal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInClientPortal(_: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "The email or password is not correct." };
  }

  redirect("/portal");
}

export async function signOutClientPortal() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/portal/login");
}

export async function addProjectComment(formData: FormData) {
  await createClientProjectComment({
    body: String(formData.get("body") || ""),
    pageUrl: String(formData.get("pageUrl") || ""),
    markerX: Number(formData.get("markerX") || 0) || null,
    markerY: Number(formData.get("markerY") || 0) || null,
    clientId: String(formData.get("clientId") || "")
  });

  revalidatePath("/portal");
}

export async function uploadProjectFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) return;

  await uploadClientProjectFile({
    file,
    description: String(formData.get("description") || ""),
    clientId: String(formData.get("clientId") || "")
  });

  revalidatePath("/portal");
}
