import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type ContentPlatform = "facebook_page" | "instagram" | "whatsapp_broadcast";
export type ContentType = "text" | "image" | "carousel" | "story" | "reel";
export type ContentPostStatus = "draft" | "scheduled" | "publishing" | "published" | "partially_published" | "failed" | "canceled";
export type ContentTargetStatus = "pending" | "publishing" | "published" | "failed";

export const CONTENT_PLATFORMS: ContentPlatform[] = ["facebook_page", "instagram", "whatsapp_broadcast"];

const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  facebook_page: "Facebook Page",
  instagram: "Instagram",
  whatsapp_broadcast: "WhatsApp broadcast"
};

export type ContentPostTarget = {
  id: string;
  post_id: string;
  platform: ContentPlatform;
  status: ContentTargetStatus;
  external_post_id: string | null;
  recipient_count: number | null;
  error: string | null;
  published_at: string | null;
};

export type ContentPost = {
  id: string;
  organization_id: string;
  title: string;
  caption: string;
  content_type: ContentType;
  media_urls: string[];
  scheduled_at: string;
  status: ContentPostStatus;
  created_at: string;
  updated_at: string;
  targets: ContentPostTarget[];
};

let cachedClient: SupabaseClient<any> | null = null;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  if (!cachedClient) {
    cachedClient = createClient<any>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  return cachedClient;
}

async function getDefaultOrganizationId(supabase: SupabaseClient<any>) {
  const { data } = await supabase
    .from("crm_organizations")
    .select("id")
    .eq("slug", "fusion-digital-dynamics")
    .single<{ id: string }>();
  return data?.id || null;
}

const POST_SELECT = "id, organization_id, title, caption, content_type, media_urls, scheduled_at, status, created_at, updated_at";
const TARGET_SELECT = "id, post_id, platform, status, external_post_id, recipient_count, error, published_at";

async function attachTargets(supabase: SupabaseClient<any>, posts: Omit<ContentPost, "targets">[]): Promise<ContentPost[]> {
  if (!posts.length) return [];
  const { data: targetRows } = await supabase
    .from("crm_content_post_targets")
    .select(TARGET_SELECT)
    .in("post_id", posts.map((post) => post.id));

  const targetsByPost = new Map<string, ContentPostTarget[]>();
  for (const target of (targetRows || []) as ContentPostTarget[]) {
    const list = targetsByPost.get(target.post_id) || [];
    list.push(target);
    targetsByPost.set(target.post_id, list);
  }

  return posts.map((post) => ({ ...post, targets: targetsByPost.get(post.id) || [] }));
}

export async function getContentCalendarWorkspace() {
  const empty = { posts: [] as ContentPost[], channelStatus: {} as Record<ContentPlatform, boolean> };
  const supabase = getServiceClient();
  if (!supabase) return empty;

  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return empty;

  const { data: postRows } = await supabase
    .from("crm_content_posts")
    .select(POST_SELECT)
    .eq("organization_id", organizationId)
    .order("scheduled_at", { ascending: true })
    .limit(500);

  const posts = await attachTargets(supabase, (postRows || []) as Omit<ContentPost, "targets">[]);

  const { data: channelRows } = await supabase
    .from("crm_message_channels")
    .select("channel_type, status")
    .eq("organization_id", organizationId);

  const channelByType = new Map((channelRows || []).map((row: { channel_type: string; status: string }) => [row.channel_type, row.status]));

  const channelStatus: Record<ContentPlatform, boolean> = {
    facebook_page: channelByType.get("messenger") === "connected",
    instagram: channelByType.get("instagram") === "connected",
    whatsapp_broadcast: channelByType.get("whatsapp") === "connected"
  };

  return { posts, channelStatus };
}

// The business operates in a single timezone today — matches the fallback
// already used elsewhere (bulk-content.ts, crm_organizations.default_time_zone).
const ORG_TIME_ZONE = "America/New_York";

// Converts a wall-clock date + time in a given IANA timezone to a UTC ISO
// string via the standard double round-trip through Intl, so it stays correct
// across DST boundaries without pulling in a date library.
function zonedDateTimeToUtcIso(dateStr: string, timeStr: string, timeZone: string): string {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  const asZoned = new Date(naiveUtc.toLocaleString("en-US", { timeZone }));
  const asUtc = new Date(naiveUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = asUtc.getTime() - asZoned.getTime();
  return new Date(naiveUtc.getTime() + offsetMs).toISOString();
}

// Forms across this app submit "scheduledAt" two different ways: a bare
// "YYYY-MM-DDTHH:mm" string with no timezone info (from a plain
// <input type="datetime-local">, used by the quick-schedule panel, the edit
// form, and the calendar-click modal), or a full UTC ISO string already
// ending in "Z" (built by the bulk scheduler, which already knows to convert
// from the org's timezone). A bare string with no timezone marker would
// otherwise get parsed as the SERVER's local time (UTC on Vercel) by
// `new Date(...)`, silently shifting the intended publish time by several
// hours. Treat anything without an explicit offset as wall-clock time in the
// business's own timezone instead; leave anything with an offset untouched.
function parseScheduledAt(raw: string): Date {
  const trimmed = raw.trim();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return new Date(trimmed);
  const [, y, mo, d, h, mi] = match;
  return new Date(zonedDateTimeToUtcIso(`${y}-${mo}-${d}`, `${h}:${mi}`, ORG_TIME_ZONE));
}

function validatePostInput(input: { caption: string; contentType: ContentType; mediaUrls: string[]; platforms: ContentPlatform[] }) {
  if (!input.platforms.length) return "Choose at least one platform.";
  if (input.contentType === "text" && !input.caption.trim()) return "Write a caption for a text post.";
  if (input.contentType !== "text" && !input.mediaUrls.length) return "Upload at least one image.";
  if (input.contentType === "carousel" && input.mediaUrls.length < 2) return "A carousel needs at least two images.";
  if (input.contentType === "reel" && !input.mediaUrls.length) return "Reels need a video file.";
  if (input.contentType === "story" && !input.mediaUrls.length) return "Stories need an image or video file.";
  if ((input.contentType === "story" || input.contentType === "reel") && input.platforms.includes("whatsapp_broadcast")) {
    return "Stories and Reels can't be sent as WhatsApp broadcasts — choose Facebook or Instagram.";
  }
  if (input.platforms.includes("instagram") && input.contentType === "text") {
    return "Instagram requires at least one image — it doesn't support text-only posts.";
  }
  return null;
}

export async function createContentPost(input: {
  actorId: string;
  title: string;
  caption: string;
  contentType: ContentType;
  mediaUrls: string[];
  platforms: ContentPlatform[];
  scheduledAt: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const validationError = validatePostInput(input);
  if (validationError) return { ok: false, error: validationError };

  const scheduledDate = parseScheduledAt(input.scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) return { ok: false, error: "Choose a valid date and time." };

  const { data: post, error } = await supabase
    .from("crm_content_posts")
    .insert({
      organization_id: organizationId,
      title: input.title.trim(),
      caption: input.caption,
      content_type: input.contentType,
      media_urls: input.mediaUrls,
      scheduled_at: scheduledDate.toISOString(),
      status: "scheduled",
      created_by: input.actorId,
      updated_by: input.actorId
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !post) return { ok: false, error: "Unable to create post: " + (error?.message || "unknown error") };

  const { error: targetError } = await supabase.from("crm_content_post_targets").insert(
    input.platforms.map((platform) => ({ post_id: post.id, platform, status: "pending" as ContentTargetStatus }))
  );

  if (targetError) return { ok: false, error: "Post created, but could not set platforms: " + targetError.message };

  return { ok: true, id: post.id };
}

export async function updateContentPost(input: {
  actorId: string;
  postId: string;
  title: string;
  caption: string;
  contentType?: ContentType;
  mediaUrls?: string[];
  platforms: ContentPlatform[];
  scheduledAt: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };

  const { data: existing } = await supabase
    .from("crm_content_posts")
    .select("id, status, content_type, media_urls")
    .eq("id", input.postId)
    .maybeSingle<{ id: string; status: ContentPostStatus; content_type: ContentType; media_urls: string[] }>();

  if (!existing) return { ok: false, error: "Post not found." };
  if (existing.status === "publishing" || existing.status === "published") {
    return { ok: false, error: "This post has already gone out and can no longer be edited." };
  }

  const contentType = input.contentType ?? existing.content_type;
  const mediaUrls = input.mediaUrls ?? existing.media_urls;

  const validationError = validatePostInput({ caption: input.caption, contentType, mediaUrls, platforms: input.platforms });
  if (validationError) return { ok: false, error: validationError };

  const scheduledDate = parseScheduledAt(input.scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) return { ok: false, error: "Choose a valid date and time." };

  const { error } = await supabase
    .from("crm_content_posts")
    .update({
      title: input.title.trim(),
      caption: input.caption,
      content_type: contentType,
      media_urls: mediaUrls,
      scheduled_at: scheduledDate.toISOString(),
      status: "scheduled",
      updated_by: input.actorId,
      updated_at: new Date().toISOString()
    })
    .eq("id", input.postId);

  if (error) return { ok: false, error: "Unable to save changes: " + error.message };

  const { data: currentTargets } = await supabase
    .from("crm_content_post_targets")
    .select("platform")
    .eq("post_id", input.postId);

  const currentPlatforms = new Set((currentTargets || []).map((row: { platform: ContentPlatform }) => row.platform));
  const nextPlatforms = new Set(input.platforms);

  const toAdd = input.platforms.filter((platform) => !currentPlatforms.has(platform));
  const toRemove = [...currentPlatforms].filter((platform) => !nextPlatforms.has(platform));

  if (toAdd.length) {
    await supabase.from("crm_content_post_targets").insert(
      toAdd.map((platform) => ({ post_id: input.postId, platform, status: "pending" as ContentTargetStatus }))
    );
  }

  if (toRemove.length) {
    await supabase
      .from("crm_content_post_targets")
      .delete()
      .eq("post_id", input.postId)
      .in("platform", toRemove);
  }

  return { ok: true };
}

export async function deleteContentPost(input: { postId: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };

  const { data: existing } = await supabase
    .from("crm_content_posts")
    .select("status")
    .eq("id", input.postId)
    .maybeSingle<{ status: ContentPostStatus }>();

  if (existing?.status === "publishing") return { ok: false, error: "This post is publishing right now — try again in a moment." };

  const { error } = await supabase.from("crm_content_posts").delete().eq("id", input.postId);
  if (error) return { ok: false, error: "Unable to delete post: " + error.message };
  return { ok: true };
}

export async function cancelContentPost(input: { actorId: string; postId: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };

  const { error } = await supabase
    .from("crm_content_posts")
    .update({ status: "canceled", updated_by: input.actorId, updated_at: new Date().toISOString() })
    .eq("id", input.postId)
    .in("status", ["draft", "scheduled", "failed"]);

  if (error) return { ok: false, error: "Unable to cancel post: " + error.message };
  return { ok: true };
}

type ChannelRow = { channel_type: string; status: string; external_account_id: string | null; credentials: Record<string, string> };

async function getConnectedChannels(supabase: SupabaseClient<any>, organizationId: string) {
  const { data } = await supabase
    .from("crm_message_channels")
    .select("channel_type, status, external_account_id, credentials")
    .eq("organization_id", organizationId);

  const rows = (data || []) as ChannelRow[];
  return new Map(rows.map((row) => [row.channel_type, row]));
}

function graphError(payload: unknown): string {
  const error = (payload as { error?: { message?: string } })?.error;
  return error?.message || "Meta API error.";
}

// A video file keeps its extension through upload (see uploadContentMedia's
// safeName sanitizer), so a simple extension check is enough to tell photo
// vs. video media apart without storing a separate column for it.
function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
}

// Video-based Instagram containers (Reels, video Stories) are processed
// asynchronously by Meta — poll until status_code flips to FINISHED before
// calling media_publish, or the publish call fails with "media not ready".
async function pollIgContainerStatus(containerId: string, accessToken: string, base: string): Promise<{ ok: boolean; error?: string }> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const res = await fetch(`${base}${containerId}?fields=status_code&access_token=${accessToken}`);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: graphError(payload) };
    const statusCode = (payload as { status_code?: string }).status_code;
    if (statusCode === "FINISHED") return { ok: true };
    if (statusCode === "ERROR" || statusCode === "EXPIRED") return { ok: false, error: "Meta could not process the video." };
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  return { ok: false, error: "Timed out waiting for Meta to finish processing the video." };
}

async function publishFacebookReel(pageId: string, accessToken: string, post: ContentPost): Promise<{ ok: boolean; error?: string; externalId?: string }> {
  const videoUrl = post.media_urls[0];
  if (!videoUrl) return { ok: false, error: "Reels need a video file." };
  if (!isVideoUrl(videoUrl)) return { ok: false, error: "Reels require a video file (mp4, mov, or webm)." };

  const base = "https://graph.facebook.com/v19.0/";

  try {
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) return { ok: false, error: "Could not read the uploaded video." };
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    const startRes = await fetch(base + pageId + "/video_reels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upload_phase: "start", access_token: accessToken })
    });
    const startPayload = await startRes.json().catch(() => ({}));
    if (!startRes.ok) return { ok: false, error: graphError(startPayload) };
    const videoId = (startPayload as { video_id?: string }).video_id;
    if (!videoId) return { ok: false, error: "Facebook did not return a video id to start the reel upload." };

    const uploadRes = await fetch(`https://rupload.facebook.com/video-upload/v19.0/${videoId}`, {
      method: "POST",
      headers: {
        "Authorization": `OAuth ${accessToken}`,
        "offset": "0",
        "file_size": String(videoBuffer.byteLength),
        "Content-Type": "application/octet-stream"
      },
      body: videoBuffer
    });
    if (!uploadRes.ok) {
      const uploadPayload = await uploadRes.json().catch(() => ({}));
      return { ok: false, error: graphError(uploadPayload) || "Uploading the reel video to Facebook failed." };
    }

    const finishRes = await fetch(base + pageId + "/video_reels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        upload_phase: "finish",
        video_id: videoId,
        video_state: "PUBLISHED",
        description: post.caption,
        access_token: accessToken
      })
    });
    const finishPayload = await finishRes.json().catch(() => ({}));
    if (!finishRes.ok) return { ok: false, error: graphError(finishPayload) };
    return { ok: true, externalId: videoId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unexpected error publishing the Facebook reel." };
  }
}

async function publishFacebookPage(channel: ChannelRow, post: ContentPost): Promise<{ ok: boolean; error?: string; externalId?: string }> {
  const pageId = channel.external_account_id;
  const accessToken = channel.credentials?.accessToken;
  if (!pageId || !accessToken) return { ok: false, error: "Facebook Page is not connected." };

  const base = "https://graph.facebook.com/v19.0/";

  try {
    if (post.content_type === "text") {
      const res = await fetch(base + pageId + "/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: post.caption, access_token: accessToken })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: graphError(payload) };
      return { ok: true, externalId: (payload as { id?: string }).id };
    }

    if (post.content_type === "image") {
      const res = await fetch(base + pageId + "/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: post.media_urls[0], caption: post.caption, access_token: accessToken })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: graphError(payload) };
      const externalId = (payload as { post_id?: string; id?: string }).post_id || (payload as { id?: string }).id;
      return { ok: true, externalId };
    }

    if (post.content_type === "story") {
      const mediaUrl = post.media_urls[0];
      if (isVideoUrl(mediaUrl)) {
        return { ok: false, error: "Facebook video stories aren't supported yet — use an image, or post this story to Instagram instead." };
      }

      const photoRes = await fetch(base + pageId + "/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: mediaUrl, published: false, access_token: accessToken })
      });
      const photoPayload = await photoRes.json().catch(() => ({}));
      if (!photoRes.ok) return { ok: false, error: graphError(photoPayload) };
      const photoId = (photoPayload as { id?: string }).id;
      if (!photoId) return { ok: false, error: "Facebook did not return a photo id for the story." };

      const storyRes = await fetch(base + pageId + "/photo_stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_id: photoId, access_token: accessToken })
      });
      const storyPayload = await storyRes.json().catch(() => ({}));
      if (!storyRes.ok) return { ok: false, error: graphError(storyPayload) };
      const externalId = (storyPayload as { post_id?: string; id?: string }).post_id || (storyPayload as { id?: string }).id;
      return { ok: true, externalId };
    }

    if (post.content_type === "reel") {
      return publishFacebookReel(pageId, accessToken, post);
    }

    // Carousel: upload each photo unpublished, then attach them to one feed post.
    const mediaFbids: string[] = [];
    for (const url of post.media_urls) {
      const res = await fetch(base + pageId + "/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, published: false, access_token: accessToken })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: graphError(payload) };
      const id = (payload as { id?: string }).id;
      if (id) mediaFbids.push(id);
    }

    if (!mediaFbids.length) return { ok: false, error: "None of the images could be uploaded to Facebook." };

    const feedRes = await fetch(base + pageId + "/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: post.caption,
        attached_media: mediaFbids.map((id) => ({ media_fbid: id })),
        access_token: accessToken
      })
    });
    const feedPayload = await feedRes.json().catch(() => ({}));
    if (!feedRes.ok) return { ok: false, error: graphError(feedPayload) };
    return { ok: true, externalId: (feedPayload as { id?: string }).id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unexpected error publishing to Facebook." };
  }
}

async function publishInstagram(channel: ChannelRow, post: ContentPost): Promise<{ ok: boolean; error?: string; externalId?: string }> {
  const igId = channel.external_account_id;
  const accessToken = channel.credentials?.accessToken;
  if (!igId || !accessToken) return { ok: false, error: "Instagram is not connected." };
  if (!post.media_urls.length) return { ok: false, error: "Instagram requires at least one image." };

  const base = "https://graph.facebook.com/v19.0/";

  try {
    let creationId: string | undefined;

    if (post.content_type === "story") {
      const mediaUrl = post.media_urls[0];
      const body: Record<string, unknown> = { media_type: "STORIES", access_token: accessToken };
      if (isVideoUrl(mediaUrl)) body.video_url = mediaUrl;
      else body.image_url = mediaUrl;

      const res = await fetch(base + igId + "/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: graphError(payload) };
      creationId = (payload as { id?: string }).id;

      if (creationId && isVideoUrl(mediaUrl)) {
        const status = await pollIgContainerStatus(creationId, accessToken, base);
        if (!status.ok) return { ok: false, error: status.error };
      }
    } else if (post.content_type === "reel") {
      const videoUrl = post.media_urls[0];
      if (!videoUrl || !isVideoUrl(videoUrl)) return { ok: false, error: "Reels require a video file (mp4, mov, or webm)." };

      const res = await fetch(base + igId + "/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "REELS",
          video_url: videoUrl,
          caption: post.caption,
          share_to_feed: true,
          access_token: accessToken
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: graphError(payload) };
      creationId = (payload as { id?: string }).id;

      if (creationId) {
        const status = await pollIgContainerStatus(creationId, accessToken, base);
        if (!status.ok) return { ok: false, error: status.error };
      }
    } else if (post.content_type === "image") {
      const res = await fetch(base + igId + "/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: post.media_urls[0], caption: post.caption, access_token: accessToken })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: graphError(payload) };
      creationId = (payload as { id?: string }).id;
    } else {
      const childIds: string[] = [];
      for (const url of post.media_urls) {
        const res = await fetch(base + igId + "/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: accessToken })
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: graphError(payload) };
        const id = (payload as { id?: string }).id;
        if (id) childIds.push(id);
      }
      if (childIds.length < 2) return { ok: false, error: "Instagram carousels need at least two images to upload successfully." };

      const parentRes = await fetch(base + igId + "/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          children: childIds,
          caption: post.caption,
          access_token: accessToken
        })
      });
      const parentPayload = await parentRes.json().catch(() => ({}));
      if (!parentRes.ok) return { ok: false, error: graphError(parentPayload) };
      creationId = (parentPayload as { id?: string }).id;
    }

    if (!creationId) return { ok: false, error: "Instagram did not return a media container." };

    const publishRes = await fetch(base + igId + "/media_publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: creationId, access_token: accessToken })
    });
    const publishPayload = await publishRes.json().catch(() => ({}));
    if (!publishRes.ok) return { ok: false, error: graphError(publishPayload) };
    return { ok: true, externalId: (publishPayload as { id?: string }).id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unexpected error publishing to Instagram." };
  }
}

const WHATSAPP_BROADCAST_RECIPIENT_CAP = 200;

async function publishWhatsAppBroadcast(
  supabase: SupabaseClient<any>,
  channel: ChannelRow,
  organizationId: string,
  post: ContentPost
): Promise<{ ok: boolean; error?: string; recipientCount?: number }> {
  const phoneNumberId = channel.external_account_id;
  const accessToken = channel.credentials?.accessToken;
  if (!phoneNumberId || !accessToken) return { ok: false, error: "WhatsApp is not connected." };

  const { data: channelRow } = await supabase
    .from("crm_message_channels")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("channel_type", "whatsapp")
    .maybeSingle<{ id: string }>();

  if (!channelRow) return { ok: false, error: "WhatsApp channel not found." };

  const { data: threads } = await supabase
    .from("crm_message_threads")
    .select("external_thread_id")
    .eq("channel_id", channelRow.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(WHATSAPP_BROADCAST_RECIPIENT_CAP);

  const recipients = ((threads || []) as { external_thread_id: string }[]).map((row) => row.external_thread_id);
  if (!recipients.length) {
    return { ok: false, error: "No existing WhatsApp conversations to broadcast to yet." };
  }

  let successCount = 0;
  let lastError = "";

  for (const to of recipients) {
    try {
      const res = await fetch("https://graph.facebook.com/v19.0/" + phoneNumberId + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + accessToken },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: post.caption } })
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        successCount += 1;
      } else {
        lastError = graphError(payload);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unexpected error sending message.";
    }
  }

  if (!successCount) {
    return { ok: false, error: lastError || "No messages were delivered. Recipients may be outside the 24-hour messaging window.", recipientCount: recipients.length };
  }

  return { ok: true, recipientCount: successCount };
}

async function publishTarget(
  supabase: SupabaseClient<any>,
  channels: Map<string, ChannelRow>,
  organizationId: string,
  post: ContentPost,
  target: ContentPostTarget
): Promise<void> {
  await supabase.from("crm_content_post_targets").update({ status: "publishing", updated_at: new Date().toISOString() }).eq("id", target.id);

  let result: { ok: boolean; error?: string; externalId?: string; recipientCount?: number };

  if (target.platform === "facebook_page") {
    const channel = channels.get("messenger");
    result = channel ? await publishFacebookPage(channel, post) : { ok: false, error: "Facebook Page is not connected." };
  } else if (target.platform === "instagram") {
    const channel = channels.get("instagram");
    result = channel ? await publishInstagram(channel, post) : { ok: false, error: "Instagram is not connected." };
  } else {
    const channel = channels.get("whatsapp");
    result = channel ? await publishWhatsAppBroadcast(supabase, channel, organizationId, post) : { ok: false, error: "WhatsApp is not connected." };
  }

  await supabase
    .from("crm_content_post_targets")
    .update({
      status: result.ok ? "published" : "failed",
      external_post_id: result.ok ? result.externalId || null : null,
      recipient_count: result.recipientCount ?? null,
      error: result.ok ? null : result.error || "Unknown error",
      published_at: result.ok ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", target.id);
}

async function publishOnePost(supabase: SupabaseClient<any>, post: ContentPost): Promise<void> {
  await supabase.from("crm_content_posts").update({ status: "publishing", updated_at: new Date().toISOString() }).eq("id", post.id);

  const channels = await getConnectedChannels(supabase, post.organization_id);

  for (const target of post.targets) {
    if (target.status === "published") continue;
    await publishTarget(supabase, channels, post.organization_id, post, target);
  }

  const { data: finalTargets } = await supabase
    .from("crm_content_post_targets")
    .select(TARGET_SELECT)
    .eq("post_id", post.id);

  const results = (finalTargets || []) as ContentPostTarget[];
  const allPublished = results.every((target) => target.status === "published");
  const anyPublished = results.some((target) => target.status === "published");
  const finalStatus: ContentPostStatus = allPublished ? "published" : anyPublished ? "partially_published" : "failed";

  await supabase.from("crm_content_posts").update({ status: finalStatus, updated_at: new Date().toISOString() }).eq("id", post.id);
}

export async function publishDuePosts(): Promise<{ checked: number; published: number; failed: number }> {
  const supabase = getServiceClient();
  if (!supabase) return { checked: 0, published: 0, failed: 0 };

  const nowIso = new Date().toISOString();
  // Video-based posts (Reels, video Stories) can take longer than one function
  // invocation to finish processing on Meta's side. If a post is still stuck in
  // "publishing" after 10 minutes — most likely a serverless timeout mid-poll —
  // pick it back up here rather than leaving it stranded forever.
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: dueRows } = await supabase
    .from("crm_content_posts")
    .select(POST_SELECT)
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .limit(25);

  const { data: stuckRows } = await supabase
    .from("crm_content_posts")
    .select(POST_SELECT)
    .eq("status", "publishing")
    .lt("updated_at", staleThreshold)
    .limit(10);

  const duePosts = await attachTargets(supabase, (dueRows || []) as Omit<ContentPost, "targets">[]);
  const stuckPosts = await attachTargets(supabase, (stuckRows || []) as Omit<ContentPost, "targets">[]);
  const allPosts = [...duePosts, ...stuckPosts];

  let published = 0;
  let failed = 0;

  for (const post of allPosts) {
    await publishOnePost(supabase, post);
    const { data: refreshed } = await supabase
      .from("crm_content_posts")
      .select("status")
      .eq("id", post.id)
      .maybeSingle<{ status: ContentPostStatus }>();
    if (refreshed?.status === "published" || refreshed?.status === "partially_published") published += 1;
    else failed += 1;
  }

  return { checked: allPosts.length, published, failed };
}

export async function publishPostNow(postId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };

  const { data: row } = await supabase.from("crm_content_posts").select(POST_SELECT).eq("id", postId).maybeSingle();
  if (!row) return { ok: false, error: "Post not found." };

  const [post] = await attachTargets(supabase, [row as Omit<ContentPost, "targets">]);
  if (post.status === "published") return { ok: false, error: "This post has already been published." };
  if (post.status === "publishing") return { ok: false, error: "This post is already publishing." };

  await publishOnePost(supabase, post);
  return { ok: true };
}

export async function uploadContentMedia(input: { organizationId: string; fileName: string; contentType: string; data: ArrayBuffer }): Promise<{ ok: boolean; url?: string; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase storage is not configured." };

  const safeName = input.fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${input.organizationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  const { error } = await supabase.storage.from("content-media").upload(path, input.data, {
    contentType: input.contentType || "application/octet-stream",
    upsert: false
  });

  if (error) return { ok: false, error: "Unable to upload image: " + error.message };

  const { data: publicUrlData } = supabase.storage.from("content-media").getPublicUrl(path);
  return { ok: true, url: publicUrlData.publicUrl };
}

export async function getOrganizationIdForContent(): Promise<string | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  return getDefaultOrganizationId(supabase);
}

export function platformLabel(platform: ContentPlatform): string {
  return PLATFORM_LABELS[platform];
}
