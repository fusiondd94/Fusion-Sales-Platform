import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createContentPost, getOrganizationIdForContent, uploadContentMedia, type ContentPlatform, type ContentType } from "@/lib/content";

export type BulkCadence = "daily" | "every_two_days" | "every_n_days" | "weekly" | "monthly";
export type BulkPostType = "image" | "story" | "reel";

const VIDEO_EXTENSION_RE = /\.(mp4|mov|m4v|webm)$/i;

export type BulkScheduleFile = {
  name: string;
  type: string;
  buffer: ArrayBuffer;
};

export type BulkScheduleInput = {
  actorId: string;
  files: BulkScheduleFile[];
  cadence: BulkCadence;
  intervalDays: number;
  startDate: string; // "YYYY-MM-DD"
  timeOfDay: string; // "HH:mm"
  platforms: ContentPlatform[];
  postType: BulkPostType;
  batchNote: string;
};

export type BulkScheduleResult = {
  ok: boolean;
  error?: string;
  scheduledCount: number;
  failedCount: number;
  aiCaptionCount: number;
  templateCaptionCount: number;
  firstScheduledAt?: string;
  lastScheduledAt?: string;
  fileErrors: string[];
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

// ---------------------------------------------------------------------------
// Scheduling math — pure date-part arithmetic, no timezone library required.
// ---------------------------------------------------------------------------

function cadenceStepDays(cadence: BulkCadence, intervalDays: number): number {
  if (cadence === "daily") return 1;
  if (cadence === "every_two_days") return 2;
  if (cadence === "weekly") return 7;
  if (cadence === "every_n_days") return Math.max(1, Math.floor(intervalDays) || 1);
  return 1; // monthly is handled separately
}

function addStepToDateParts(year: number, month: number, day: number, index: number, cadence: BulkCadence, intervalDays: number) {
  if (cadence === "monthly") {
    const totalMonths = month + index;
    const targetYear = year + Math.floor(totalMonths / 12);
    const targetMonth = ((totalMonths % 12) + 12) % 12;
    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    return { year: targetYear, month: targetMonth, day: Math.min(day, daysInTargetMonth) };
  }

  const step = cadenceStepDays(cadence, intervalDays);
  const base = new Date(Date.UTC(year, month, day));
  base.setUTCDate(base.getUTCDate() + index * step);
  return { year: base.getUTCFullYear(), month: base.getUTCMonth(), day: base.getUTCDate() };
}

// Converts a wall-clock date + time in a given IANA time zone to a UTC ISO string,
// without pulling in a date library — uses the standard double round-trip through
// Intl so it stays correct across DST boundaries.
function zonedDateTimeToUtcIso(dateStr: string, timeStr: string, timeZone: string): string {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  const asZoned = new Date(naiveUtc.toLocaleString("en-US", { timeZone }));
  const asUtc = new Date(naiveUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = asUtc.getTime() - asZoned.getTime();
  return new Date(naiveUtc.getTime() + offsetMs).toISOString();
}

export function computeBulkScheduleDates(input: {
  startDate: string;
  timeOfDay: string;
  timeZone: string;
  cadence: BulkCadence;
  intervalDays: number;
  count: number;
}): string[] {
  const [year, month, day] = input.startDate.split("-").map((part) => Number(part));
  const dates: string[] = [];

  for (let index = 0; index < input.count; index += 1) {
    const parts = addStepToDateParts(year, (month || 1) - 1, day || 1, index, input.cadence, input.intervalDays);
    const dateStr = `${parts.year}-${String(parts.month + 1).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
    dates.push(zonedDateTimeToUtcIso(dateStr, input.timeOfDay, input.timeZone));
  }

  return dates;
}

// ---------------------------------------------------------------------------
// Business context — pulled fresh from the CRM so captions stay accurate.
// ---------------------------------------------------------------------------

type CaptionContext = {
  businessName: string;
  website: string;
  timeZone: string;
  services: { name: string; description: string }[];
  campaigns: { name: string; subject: string }[];
};

async function getCaptionContext(supabase: SupabaseClient<any>, organizationId: string): Promise<CaptionContext> {
  const { data: org } = await supabase
    .from("crm_organizations")
    .select("name, website, default_time_zone")
    .eq("id", organizationId)
    .maybeSingle<{ name: string; website: string; default_time_zone: string }>();

  const { data: serviceRows } = await supabase
    .from("crm_services")
    .select("service_name, short_description")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("public_visibility", true)
    .order("display_order", { ascending: true })
    .limit(6);

  const { data: campaignRows } = await supabase
    .from("crm_email_campaigns")
    .select("campaign_name, subject, status, updated_at")
    .eq("organization_id", organizationId)
    .in("status", ["scheduled", "sending", "sent"])
    .order("updated_at", { ascending: false })
    .limit(3);

  return {
    businessName: org?.name || "our business",
    website: org?.website || "",
    timeZone: org?.default_time_zone || "America/New_York",
    services: ((serviceRows || []) as { service_name: string; short_description: string }[]).map((row) => ({
      name: row.service_name,
      description: row.short_description || ""
    })),
    campaigns: ((campaignRows || []) as { campaign_name: string; subject: string }[]).map((row) => ({
      name: row.campaign_name,
      subject: row.subject || ""
    }))
  };
}

// ---------------------------------------------------------------------------
// Caption generation — Claude vision when configured, template fallback otherwise.
// ---------------------------------------------------------------------------

const TEMPLATE_OPENERS = [
  "Take a look at what we've been working on.",
  "Here's a closer look at what we offer.",
  "New week, same commitment to quality.",
  "Just another example of what we do best.",
  "Sharing a look behind the scenes."
];

function buildTemplateCaption(context: CaptionContext, batchNote: string, seedIndex: number): string {
  const opener = TEMPLATE_OPENERS[seedIndex % TEMPLATE_OPENERS.length];
  const service = context.services[seedIndex % Math.max(context.services.length, 1)];
  const campaign = context.campaigns[0];

  const parts = [opener];

  if (service) {
    parts.push(service.description ? `${service.name} — ${service.description}` : service.name);
  }

  if (campaign) {
    parts.push(`Ask us about ${campaign.name}.`);
  }

  if (batchNote.trim()) {
    parts.push(batchNote.trim());
  }

  parts.push(`— ${context.businessName}`);

  return parts.join(" ");
}

async function generateAiCaption(input: {
  imageBuffer: ArrayBuffer;
  mediaType: string;
  context: CaptionContext;
  batchNote: string;
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const base64 = Buffer.from(input.imageBuffer).toString("base64");
  const serviceLines = input.context.services.map((service) => `- ${service.name}${service.description ? `: ${service.description}` : ""}`).join("\n");
  const campaignLines = input.context.campaigns.map((campaign) => `- ${campaign.name}${campaign.subject ? `: ${campaign.subject}` : ""}`).join("\n");

  const promptParts = [
    `You are a social media copywriter for ${input.context.businessName}${input.context.website ? ` (${input.context.website})` : ""}, writing a single Facebook/Instagram caption optimized for maximum engagement, shares, and reach.`,
    "Look closely at the attached image and write a caption that reflects what's actually shown in it — virality comes from how it's written, never from exaggerating what's true.",
    "Structure it like this: open with a scroll-stopping first line (a question, bold statement, or relatable moment — not a generic greeting or 'check this out'). Follow with 1-3 more sentences that build interest. End the caption body with a clear call to action (comment, share, tag a friend, save this, visit the link, message us — whichever fits naturally). Keep the caption body concise and punchy, not a wall of text.",
    "Write like a real person, not corporate copy. A few emojis are fine if on-brand (roughly 0-4), but don't overdo it.",
    "After the caption body, add a line break, then 8-15 hashtags: mix a couple of broad high-traffic tags, several niche/industry tags relevant to the image, and 1-2 branded or local tags. Vary the mix based on what's actually in the image — don't reuse the same hashtag set every time. Avoid banned or spammy tags like #like4like or #follow4follow.",
    "Do not use markdown formatting, and do not invent prices, offers, or claims that aren't visible in the image or listed below.",
    serviceLines ? `Services this business offers (mention one only if genuinely relevant to the image):\n${serviceLines}` : "",
    campaignLines ? `Currently active campaigns (mention only if genuinely relevant):\n${campaignLines}` : "",
    input.batchNote.trim() ? `Context for this whole batch of images: ${input.batchNote.trim()}` : "",
    "Reply with the caption and hashtags only — no preamble, no labels like \"Caption:\", no quotation marks."
  ].filter(Boolean);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: input.mediaType || "image/jpeg", data: base64 } },
              { type: "text", text: promptParts.join("\n\n") }
            ]
          }
        ]
      })
    });

    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const text = payload?.content?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) return null;
    return text.trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function bulkScheduleContent(input: BulkScheduleInput): Promise<BulkScheduleResult> {
  const empty: BulkScheduleResult = {
    ok: false,
    scheduledCount: 0,
    failedCount: 0,
    aiCaptionCount: 0,
    templateCaptionCount: 0,
    fileErrors: []
  };

  if (!input.files.length) return { ...empty, error: "Choose at least one file to schedule." };
  if (!input.platforms.length) return { ...empty, error: "Choose at least one platform." };

  if (input.postType === "reel") {
    const nonVideo = input.files.filter((file) => !VIDEO_EXTENSION_RE.test(file.name));
    if (nonVideo.length) {
      return { ...empty, error: `Reels need video files (mp4, mov, or webm). ${nonVideo.map((file) => file.name).join(", ")} ${nonVideo.length === 1 ? "isn't" : "aren't"} a video.` };
    }
  }

  if ((input.postType === "story" || input.postType === "reel") && input.platforms.includes("whatsapp_broadcast")) {
    return { ...empty, error: "Stories and Reels can't go to WhatsApp broadcasts — choose Facebook or Instagram." };
  }

  const supabase = getServiceClient();
  if (!supabase) return { ...empty, error: "Supabase CRM is not configured." };

  const organizationId = await getOrganizationIdForContent();
  if (!organizationId) return { ...empty, error: "CRM organization is not configured." };

  const context = await getCaptionContext(supabase, organizationId);

  const scheduledDates = computeBulkScheduleDates({
    startDate: input.startDate,
    timeOfDay: input.timeOfDay,
    timeZone: context.timeZone,
    cadence: input.cadence,
    intervalDays: input.intervalDays,
    count: input.files.length
  });

  let scheduledCount = 0;
  let aiCaptionCount = 0;
  let templateCaptionCount = 0;
  const fileErrors: string[] = [];

  for (let index = 0; index < input.files.length; index += 1) {
    const file = input.files[index];
    const scheduledAt = scheduledDates[index];

    const uploadResult = await uploadContentMedia({
      organizationId,
      fileName: file.name,
      contentType: file.type || "image/jpeg",
      data: file.buffer
    });

    if (!uploadResult.ok || !uploadResult.url) {
      fileErrors.push(`${file.name}: ${uploadResult.error || "upload failed"}`);
      continue;
    }

    // Claude's vision captioning needs an actual image — video files (always
    // true for reels, sometimes true for stories) fall back to the template.
    const isVideoFile = VIDEO_EXTENSION_RE.test(file.name);
    const aiCaption = isVideoFile
      ? null
      : await generateAiCaption({
          imageBuffer: file.buffer,
          mediaType: file.type || "image/jpeg",
          context,
          batchNote: input.batchNote
        });

    const caption = aiCaption || buildTemplateCaption(context, input.batchNote, index);
    if (aiCaption) aiCaptionCount += 1;
    else templateCaptionCount += 1;

    const createResult = await createContentPost({
      actorId: input.actorId,
      title: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
      caption,
      contentType: input.postType as ContentType,
      mediaUrls: [uploadResult.url],
      platforms: input.platforms,
      scheduledAt
    });

    if (!createResult.ok) {
      fileErrors.push(`${file.name}: ${createResult.error || "could not schedule"}`);
      continue;
    }

    scheduledCount += 1;
  }

  return {
    ok: scheduledCount > 0,
    error: scheduledCount === 0 ? "None of the images could be scheduled." : undefined,
    scheduledCount,
    failedCount: fileErrors.length,
    aiCaptionCount,
    templateCaptionCount,
    firstScheduledAt: scheduledDates[0],
    lastScheduledAt: scheduledDates[input.files.length - 1],
    fileErrors
  };
}
