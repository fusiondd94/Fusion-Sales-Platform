"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireFusionAdmin } from "@/lib/auth";
import { deleteContentPost, discardDraftBatch, publishDraftBatch, updateDraftCaption } from "@/lib/content";

export async function publishBulkDraftBatch(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const batchId = String(formData.get("batchId") || "");
  const postIds = String(formData.get("postIds") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!batchId) redirect("/fusionadmin/content/bulk");

  // Save any caption edits made during review before flipping the batch to
  // scheduled.
  for (const postId of postIds) {
    const caption = formData.get(`caption__${postId}`);
    if (typeof caption === "string") {
      await updateDraftCaption({ postId, caption });
    }
  }

  const result = await publishDraftBatch({ batchId, actorId: user.id });

  revalidatePath("/fusionadmin/content");
  revalidatePath("/fusionadmin/content/bulk");

  if (!result.ok) {
    redirect(`/fusionadmin/content/bulk/review?batch=${encodeURIComponent(batchId)}&publishError=${encodeURIComponent(result.error || "Could not publish this batch.")}`);
  }

  redirect(`/fusionadmin/content?published=${result.publishedCount}`);
}

export async function removeDraftPostFromBatch(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const postId = String(formData.get("postId") || "");
  const batchId = String(formData.get("batchId") || "");

  if (postId) await deleteContentPost({ postId });

  revalidatePath("/fusionadmin/content/bulk/review");
  redirect(`/fusionadmin/content/bulk/review?batch=${encodeURIComponent(batchId)}`);
}

export async function discardBulkDraftBatch(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const batchId = String(formData.get("batchId") || "");
  if (batchId) await discardDraftBatch(batchId);

  revalidatePath("/fusionadmin/content/bulk");
  redirect("/fusionadmin/content/bulk");
}
