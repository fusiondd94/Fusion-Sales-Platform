"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireFusionAdmin } from "@/lib/auth";
import {
  repostContentPost,
  retryFailedTargets,
  updateContentPost,
  type ContentPlatform,
  type ContentType
} from "@/lib/content";

const ALLOWED_PLATFORMS: ContentPlatform[] = ["facebook_page", "instagram", "whatsapp_broadcast"];
const ALLOWED_CONTENT_TYPES: ContentType[] = ["text", "image", "carousel", "story", "reel"];

function platformsFromFormData(formData: FormData): ContentPlatform[] {
  return formData
    .getAll("platforms")
    .map((value) => String(value))
    .filter((value): value is ContentPlatform => ALLOWED_PLATFORMS.includes(value as ContentPlatform));
}

// A post that already went out (published / partially_published / failed)
// is a historical record — editing it in place would quietly rewrite what
// actually happened. Instead this creates a brand-new scheduled post with
// the same media and a caption/time/platforms the admin can change, leaving
// the original post (and its external_post_id / analytics) untouched.
export async function repostFusionContentPost(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const sourcePostId = String(formData.get("postId") || "");
  const title = String(formData.get("title") || "");
  const caption = String(formData.get("caption") || "");
  const contentTypeRaw = String(formData.get("contentType") || "image");
  const contentType = ALLOWED_CONTENT_TYPES.includes(contentTypeRaw as ContentType) ? (contentTypeRaw as ContentType) : "image";
  const scheduledAt = String(formData.get("scheduledAt") || "");
  const mediaUrls = formData
    .getAll("mediaUrls")
    .map((value) => String(value))
    .filter(Boolean);
  const platforms = platformsFromFormData(formData);

  if (!scheduledAt) {
    redirect(`/fusionadmin/content?contentError=${encodeURIComponent("Choose a date and time to repost.")}#post-${sourcePostId}`);
  }

  const result = await repostContentPost({
    actorId: user.id,
    postId: sourcePostId,
    title,
    caption,
    contentType,
    mediaUrls,
    platforms,
    scheduledAt
  });

  revalidatePath("/fusionadmin/content");

  if (!result.ok) {
    redirect(`/fusionadmin/content?contentError=${encodeURIComponent(result.error || "Unable to repost.")}#post-${sourcePostId}`);
  }

  redirect(`/fusionadmin/content?reposted=1#post-${result.id}`);
}

// Lets an admin edit + reschedule a post that already went out, in place,
// instead of creating a duplicate — useful for e.g. fixing a typo in the
// caption of a post that's about to go stale as "failed". Every remaining
// platform target is reset back to "pending" so the next publish attempt
// (Publish now, or the cron) treats it as fresh rather than skipping a
// stale failed/published result.
export async function editAndRescheduleContentPost(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const postId = String(formData.get("postId") || "");
  const title = String(formData.get("title") || "");
  const caption = String(formData.get("caption") || "");
  const scheduledAt = String(formData.get("scheduledAt") || "");
  const platforms = platformsFromFormData(formData);

  const result = await updateContentPost({
    actorId: user.id,
    postId,
    title,
    caption,
    platforms,
    scheduledAt,
    resetForRepost: true
  });

  revalidatePath("/fusionadmin/content");

  if (!result.ok) {
    redirect(`/fusionadmin/content?contentError=${encodeURIComponent(result.error || "Unable to save changes.")}#post-${postId}`);
  }

  redirect(`/fusionadmin/content?reposted=1#post-${postId}`);
}

// Retries only the platform targets that failed (or never went out) on a
// partially-published or failed post, without touching platforms that
// already succeeded — so a working Facebook post never gets duplicated
// while a failed Instagram target gets a fresh attempt.
export async function retryFusionContentPostTargets(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const postId = String(formData.get("postId") || "");
  const result = await retryFailedTargets(postId);

  revalidatePath("/fusionadmin/content");

  if (!result.ok) {
    redirect(`/fusionadmin/content?contentError=${encodeURIComponent(result.error || "Unable to retry.")}#post-${postId}`);
  }

  redirect(`/fusionadmin/content?retried=1#post-${postId}`);
}
