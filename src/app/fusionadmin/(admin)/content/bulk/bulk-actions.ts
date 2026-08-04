"use server";

import { revalidatePath } from "next/cache";
import { requireFusionAdmin } from "@/lib/auth";
import { bulkScheduleContent, type BulkCadence, type BulkPostType, type BulkScheduleFile } from "@/lib/bulk-content";
import { createBulkUploadTargets, getOrganizationIdForContent, type ContentPlatform } from "@/lib/content";

const ALLOWED_CADENCE: BulkCadence[] = ["daily", "every_two_days", "every_n_days", "weekly", "monthly"];
const ALLOWED_POST_TYPES: BulkPostType[] = ["image", "story", "reel"];
const ALLOWED_PLATFORMS: ContentPlatform[] = ["facebook_page", "instagram", "whatsapp_broadcast"];

// A real batch (20-30 files) calls Claude's vision API for each image during
// scheduling below — give these actions real headroom instead of the
// platform default, which a batch that size would otherwise blow right past.
export const maxDuration = 300;

// Step 1 of the client-driven bulk flow: given just file names/types (no
// bytes), return a signed Supabase Storage upload URL + token per file. The
// browser then uploads each file's actual bytes directly to Storage using
// these, which is what lets a real multi-MB photo batch bypass Vercel's hard
// 4.5MB serverless request body limit — this action's own request/response
// payload stays tiny no matter how large the files are.
export async function getBulkUploadTargets(files: { name: string; type: string }[]): Promise<{
  ok: boolean;
  error?: string;
  targets?: { name: string; type: string; path: string; token: string; signedUrl: string; publicUrl: string }[];
}> {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return { ok: false, error: "Not authorized." };

  if (!files.length) return { ok: false, error: "Choose at least one file to schedule." };

  const organizationId = await getOrganizationIdForContent();
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const result = await createBulkUploadTargets({ organizationId, files });
  if (!result.ok || !result.targets) return { ok: false, error: result.error || "Could not prepare uploads." };

  return { ok: true, targets: result.targets };
}

// Step 2: once the browser has uploaded every file straight to Storage using
// the targets from getBulkUploadTargets, this receives only small metadata
// (names/types/URLs) — never raw file bytes — so it stays comfortably under
// both Vercel's platform limit and this app's own Server Action body cap.
export async function bulkScheduleFusionContent(input: {
  files: BulkScheduleFile[];
  cadence: string;
  intervalDays: number;
  startDate: string;
  timeOfDay: string;
  platforms: string[];
  postType: string;
  batchNote: string;
}): Promise<{ ok: boolean; error?: string; redirectUrl?: string }> {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return { ok: false, error: "Not authorized." };

  const files = (input.files || []).filter((file) => file.name && file.url);
  if (!files.length) return { ok: false, error: "Choose at least one file to schedule." };
  if (!input.startDate) return { ok: false, error: "Choose a start date." };

  const cadence = ALLOWED_CADENCE.includes(input.cadence as BulkCadence) ? (input.cadence as BulkCadence) : "daily";
  const postType = ALLOWED_POST_TYPES.includes(input.postType as BulkPostType) ? (input.postType as BulkPostType) : "image";
  const platforms = (input.platforms || []).filter((value): value is ContentPlatform => ALLOWED_PLATFORMS.includes(value as ContentPlatform));

  const result = await bulkScheduleContent({
    actorId: user.id,
    files,
    cadence,
    intervalDays: input.intervalDays,
    startDate: input.startDate,
    timeOfDay: input.timeOfDay || "09:00",
    platforms,
    postType,
    batchNote: input.batchNote || ""
  });

  revalidatePath("/fusionadmin/content");
  revalidatePath("/fusionadmin/content/bulk");

  if (!result.ok || !result.batchId) {
    return { ok: false, error: result.error || "Nothing could be scheduled." };
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

  return { ok: true, redirectUrl: `/fusionadmin/content/bulk/review?${params.toString()}` };
}
