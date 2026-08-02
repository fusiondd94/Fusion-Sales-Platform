"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireFusionAdmin } from "@/lib/auth";
import { bulkScheduleContent, type BulkCadence } from "@/lib/bulk-content";
import type { ContentPlatform } from "@/lib/content";

const ALLOWED_CADENCE: BulkCadence[] = ["daily", "every_two_days", "every_n_days", "weekly", "monthly"];
const ALLOWED_PLATFORMS: ContentPlatform[] = ["facebook_page", "instagram", "whatsapp_broadcast"];

export async function bulkScheduleFusionContent(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const files = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const cadenceRaw = String(formData.get("cadence") || "daily");
  const cadence = ALLOWED_CADENCE.includes(cadenceRaw as BulkCadence) ? (cadenceRaw as BulkCadence) : "daily";
  const intervalDays = Number(formData.get("intervalDays") || 1);
  const startDate = String(formData.get("startDate") || "");
  const timeOfDay = String(formData.get("timeOfDay") || "09:00");
  const batchNote = String(formData.get("batchNote") || "");

  const platforms = formData
    .getAll("platforms")
    .map((value) => String(value))
    .filter((value): value is ContentPlatform => ALLOWED_PLATFORMS.includes(value as ContentPlatform));

  if (!files.length) {
    redirect(`/fusionadmin/content/bulk?bulkError=${encodeURIComponent("Choose at least one image to schedule.")}`);
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
    batchNote
  });

  revalidatePath("/fusionadmin/content");
  revalidatePath("/fusionadmin/content/bulk");

  if (!result.ok) {
    redirect(`/fusionadmin/content/bulk?bulkError=${encodeURIComponent(result.error || "Nothing could be scheduled.")}`);
  }

  const params = new URLSearchParams({
    bulkScheduled: String(result.scheduledCount),
    bulkFailed: String(result.failedCount),
    bulkAi: String(result.aiCaptionCount),
    bulkTemplate: String(result.templateCaptionCount)
  });
  if (result.firstScheduledAt) params.set("bulkFrom", result.firstScheduledAt);
  if (result.lastScheduledAt) params.set("bulkTo", result.lastScheduledAt);
  if (result.fileErrors.length) params.set("bulkErrors", result.fileErrors.slice(0, 5).join(" | "));

  redirect(`/fusionadmin/content/bulk?${params.toString()}`);
}
