"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
    adminVerifyPortalProductPurchase,
    createClientProjectComment,
    deleteClientProjectFile,
    deleteProjectComment,
    getClientPortalWorkspace,
    markAllNotificationsRead,
    markNotificationRead,
    reorderBoardTasks,
    submitPortalProductConfirmation,
    updateClientTaskStatus,
    uploadClientProjectFile,
} from "@/lib/portal";
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

export async function deleteOwnProjectComment(formData: FormData) {
    const clientId = String(formData.get("clientId") || "");
    const commentId = String(formData.get("commentId") || "");
    const workspace = await getClientPortalWorkspace(clientId);
    if (!workspace) return;

  await deleteProjectComment({
        actorId: workspace.user.id,
        commentId,
        requireOwnership: true
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

export async function deleteOwnProjectFile(formData: FormData) {
    const clientId = String(formData.get("clientId") || "");
    const fileId = String(formData.get("fileId") || "");
    if (!fileId) return;

  await deleteClientProjectFile({ fileId, clientId });

  revalidatePath("/portal");
}

export async function updateOwnClientTaskStatus(formData: FormData) {
    const taskId = String(formData.get("taskId") || "");
    const status = String(formData.get("status") || "");
    if (!taskId || !status) return;

  await updateClientTaskStatus({ taskId, status });

  revalidatePath("/portal");
}


export async function reorderOwnBoardTasks(
    updates: Array<{ taskId: string; sectionId: string | null; position: number }>
  ) {
    await reorderBoardTasks({ updates });
    revalidatePath("/portal");
}

export async function markOwnNotificationRead(formData: FormData) {
    const notificationId = String(formData.get("notificationId") || "");
    if (!notificationId) return;
    await markNotificationRead({ notificationId });
    revalidatePath("/portal");
}

export async function markAllOwnNotificationsRead(formData: FormData) {
    const clientId = String(formData.get("clientId") || "");
    if (!clientId) return;
    await markAllNotificationsRead({ clientId });
    revalidatePath("/portal");
}

export async function submitPurchaseConfirmationAction(formData: FormData) {
    const clientId = String(formData.get("clientId") || "");
    const portalProductId = String(formData.get("portalProductId") || "");
    if (!clientId || !portalProductId) return;

  await submitPortalProductConfirmation({
        clientId,
        portalProductId,
        externalReferenceId: String(formData.get("externalReferenceId") || "") || undefined,
        notes: String(formData.get("notes") || "") || undefined
  });

  revalidatePath("/portal");
}

export async function adminVerifyPurchaseAction(formData: FormData) {
    const clientId = String(formData.get("clientId") || "");
    const portalProductId = String(formData.get("portalProductId") || "");
    if (!clientId || !portalProductId) return;

  await adminVerifyPortalProductPurchase({
        clientId,
        portalProductId,
        externalReferenceId: String(formData.get("externalReferenceId") || "") || undefined,
        notes: String(formData.get("notes") || "") || undefined,
        expiresAt: String(formData.get("expiresAt") || "") || undefined
  });

  revalidatePath("/portal");
}
