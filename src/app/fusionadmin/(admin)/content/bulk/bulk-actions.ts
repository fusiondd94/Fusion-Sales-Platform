"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireFusionAdmin } from "@/lib/auth";
import { bulkScheduleContent, type BulkCadence, type BulkPostType } from "@/lib/bulk-content";
import type { ContentPlatform } from "@/lib/content";

const ALLOWED_CADENCE: BulkCadence[] = ["daily", "every_two_days", "every_n_days", "weekly", "monthly"];
const ALLOWED_POST_TYPES: BulkPostType[] = ["image", "story", "reel"];
const ALLOWED_PLATFORMS: ContentPlatform[] = ["facebook_page", "instagram", "whatsapp_broadcast"];

export async function bulkScheduleFusionContent(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const files = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const cadenceRaw = String(formData.get("cadence") || "daily");
  const cadence = ALLOWED_CADENCE.includes(cadenceRaw as BulkCadence) ? (cadenceRaw as BulkCadence) : "daily";
  const postTypeRaw = String(formData.get("postType") || "image");
  const postType = ALLOWED_POST_TYPES.includes(postTypeRaw as BulkPostType) ? (postTypeRaw as BulkPostType) : "image";
  const intervalDays = Number(formData.get("intervalDays") || 1);
  const startDate = String(formData.get("startDate") || "");
  const timeOfDay = String(formData.get("timeOfDay") || "09:00");
  const batchNote = String(formData.get("batchNote") || "");

  const platforms = formData
    .getAll("platforms")
    .map((value) => String(value))
    .filter((value): value is ContentPlatform => ALLOWED_PLATFORMS.includes(value as ContentPlatform));

  if (!files.length) {
    redirect(`/fusionadmin/content/bulk?bulkError=${encodeURIComponent("Choose at least one file to schedule.")}`);
  }

  if (!startDate) {
    redirect(`/fusionadmin/content/bulk?bulkError=${encodeURIComponent("Choose a start date.")}`);
  }

  const bufferedFiles = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      type: file.type,
      buffer: await file.arrayBuffer()
    }))
  );

  const result = await bulkScheduleContent({
    actorId: user.id,
    files: bufferedFiles,
    cadence,
    intervalDays,
    startDate,
    timeOfDay,
    platforms,
    postType,
    batchNote
  });

  revalidatePath("/fusionadmin/content");
  revalidatePath("/fusionadmin/content/bulk");

  if (!result.ok || !result.batchId) {
    redirect(`/fusionadmin/content/bulk?bulkError=${encodeURIComponent(result.error || "Nothing could be scheduled.")}`);
  }

  // Nothing is actually scheduled yet — the batch was created as drafts.
  // Send the admin to review the generated captions before anything goes on
  // the calendar.
  const params = new URLSearchParams({
    batch: result.batchId,
    draftFailed: String(result.failedCount),
    draftAi: String(result.aiCaptionCount),
    draftTemplate: String(result.templateCaptionCount)
  });
  if (result.fileErrors.length) params.set("draftErrors", result.fileErrors.slice(0, 5).join(" | "));

  redirect(`/fusionadmin/content/bulk/review?${params.toString()}`);
}
