"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireFusionAdmin } from "@/lib/auth";
import { createContentPost, getOrganizationIdForContent, uploadContentMedia, type ContentPlatform, type ContentType } from "@/lib/content";

const ALLOWED_PLATFORMS: ContentPlatform[] = ["facebook_page", "instagram", "whatsapp_broadcast"];
const ALLOWED_POST_TYPES: ContentType[] = ["image", "story", "reel"];
const VIDEO_EXTENSION_RE = /\.(mp4|mov|m4v|webm)$/i;

// Dedicated action for the "click a calendar day → schedule one post" modal.
// Kept separate from the large shared fusionadmin/actions.ts file so this new
// capability (post type + video support) doesn't require editing that file.
export async function scheduleSingleContentPost(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const postTypeRaw = String(formData.get("postType") || "image");
  const postType = ALLOWED_POST_TYPES.includes(postTypeRaw as ContentType) ? (postTypeRaw as ContentType) : "image";

  const title = String(formData.get("title") || "");
  const caption = String(formData.get("caption") || "");
  const scheduledAt = String(formData.get("scheduledAt") || "");

  const platforms = formData
    .getAll("platforms")
    .map((value) => String(value))
    .filter((value): value is ContentPlatform => ALLOWED_PLATFORMS.includes(value as ContentPlatform));

  const file = formData.get("media");
  let mediaUrls: string[] = [];

  if (file instanceof File && file.size > 0) {
    const organizationId = await getOrganizationIdForContent();
    if (!organizationId) {
      redirect(`/fusionadmin/content?contentError=${encodeURIComponent("CRM organization is not configured.")}`);
    }

    const buffer = await file.arrayBuffer();
    const uploadResult = await uploadContentMedia({
      organizationId: organizationId as string,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      data: buffer
    });

    if (!uploadResult.ok || !uploadResult.url) {
      redirect(`/fusionadmin/content?contentError=${encodeURIComponent(uploadResult.error || "Upload failed.")}`);
    }

    mediaUrls = [uploadResult.url as string];

    if (postType === "reel" && !VIDEO_EXTENSION_RE.test(file.name)) {
      redirect(`/fusionadmin/content?contentError=${encodeURIComponent("Reels require a video file (mp4, mov, or webm).")}`);
    }
  }

  if ((postType === "story" || postType === "reel") && !mediaUrls.length) {
    redirect(`/fusionadmin/content?contentError=${encodeURIComponent(postType === "reel" ? "Reels need a video file." : "Stories need an image or video file.")}`);
  }

  const result = await createContentPost({
    actorId: user.id,
    title,
    caption,
    contentType: postType,
    mediaUrls,
    platforms,
    scheduledAt
  });

  revalidatePath("/fusionadmin/content");

  if (!result.ok) {
    redirect(`/fusionadmin/content?contentError=${encodeURIComponent(result.error || "Could not schedule post.")}`);
  }

  redirect("/fusionadmin/content");
}
