import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type MarketingChannelSnapshot = {
  channelType: "whatsapp" | "messenger" | "instagram";
  label: string;
  status: "disconnected" | "connected" | "error";
  threadCount: number;
  messagesLast30d: number;
  unreadCount: number;
};

export type MarketingContentPlatformStat = {
  platform: "facebook_page" | "instagram" | "whatsapp_broadcast";
  label: string;
  published: number;
  failed: number;
  pending: number;
};

export type MarketingRecentPost = {
  id: string;
  title: string;
  caption: string;
  status: string;
  scheduledAt: string;
  platforms: string[];
};

export type MarketingWorkspace = {
  configured: boolean;
  totals: {
    messagesLast30d: number;
    inboundLast30d: number;
    outboundLast30d: number;
    activeThreads: number;
    unreadThreads: number;
    postsPublished: number;
    postsFailed: number;
    postsScheduled: number;
    publishSuccessRate: number | null;
  };
  channels: MarketingChannelSnapshot[];
  contentByPlatform: MarketingContentPlatformStat[];
  recentPublished: MarketingRecentPost[];
  upcomingScheduled: MarketingRecentPost[];
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  instagram: "Instagram"
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook_page: "Facebook Page",
  instagram: "Instagram",
  whatsapp_broadcast: "WhatsApp broadcast"
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

const emptyWorkspace: MarketingWorkspace = {
  configured: false,
  totals: {
    messagesLast30d: 0,
    inboundLast30d: 0,
    outboundLast30d: 0,
    activeThreads: 0,
    unreadThreads: 0,
    postsPublished: 0,
    postsFailed: 0,
    postsScheduled: 0,
    publishSuccessRate: null
  },
  channels: [],
  contentByPlatform: [],
  recentPublished: [],
  upcomingScheduled: []
};

export async function getMarketingWorkspace(): Promise<MarketingWorkspace> {
  const supabase = getServiceClient();
  if (!supabase) return emptyWorkspace;

  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return emptyWorkspace;

  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [channelRowsRes, threadRowsRes, postRowsRes] = await Promise.all([
    supabase.from("crm_message_channels").select("channel_type, status").eq("organization_id", organizationId),
    supabase
      .from("crm_message_threads")
      .select("id, channel_type, unread_count")
      .eq("organization_id", organizationId),
    supabase
      .from("crm_content_posts")
      .select("id, title, caption, status, scheduled_at")
      .eq("organization_id", organizationId)
      .order("scheduled_at", { ascending: false })
      .limit(200)
  ]);

  const channelRows = (channelRowsRes.data || []) as { channel_type: string; status: string }[];
  const threadRows = (threadRowsRes.data || []) as { id: string; channel_type: string; unread_count: number }[];
  const postRows = (postRowsRes.data || []) as { id: string; title: string; caption: string; status: string; scheduled_at: string }[];
  const postIds = postRows.map((post) => post.id);
  const threadIds = threadRows.map((thread) => thread.id);

  const [messageRowsRes, targetRowsRes] = await Promise.all([
    threadIds.length
      ? supabase
          .from("crm_messages")
          .select("id, direction, created_at, thread_id")
          .in("thread_id", threadIds)
          .gte("created_at", thirtyDaysAgoIso)
      : Promise.resolve({ data: [] as any[] }),
    postIds.length
      ? supabase
          .from("crm_content_post_targets")
          .select("post_id, platform, status")
          .in("post_id", postIds)
      : Promise.resolve({ data: [] as any[] })
  ]);

  const messageRows = (messageRowsRes.data || []) as { id: string; direction: string; created_at: string; thread_id: string }[];
  const targetRows = (targetRowsRes.data || []) as { post_id: string; platform: string; status: string }[];

  const threadChannelById = new Map(threadRows.map((thread) => [thread.id, thread.channel_type]));
  const channelByType = new Map(channelRows.map((row) => [row.channel_type, row.status]));

  const channels: MarketingChannelSnapshot[] = (["whatsapp", "messenger", "instagram"] as const).map((type) => {
    const threadsForChannel = threadRows.filter((thread) => thread.channel_type === type);
    const messagesForChannel = messageRows.filter((message) => threadChannelById.get(message.thread_id) === type);
    return {
      channelType: type,
      label: CHANNEL_LABELS[type],
      status: (channelByType.get(type) as MarketingChannelSnapshot["status"]) || "disconnected",
      threadCount: threadsForChannel.length,
      messagesLast30d: messagesForChannel.length,
      unreadCount: threadsForChannel.reduce((sum, thread) => sum + (thread.unread_count || 0), 0)
    };
  });

  const inboundLast30d = messageRows.filter((message) => message.direction === "inbound").length;
  const outboundLast30d = messageRows.filter((message) => message.direction === "outbound").length;
  const unreadThreads = threadRows.filter((thread) => (thread.unread_count || 0) > 0).length;

  const postsByPlatform = new Map<string, { published: number; failed: number; pending: number }>();
  for (const platform of ["facebook_page", "instagram", "whatsapp_broadcast"]) {
    postsByPlatform.set(platform, { published: 0, failed: 0, pending: 0 });
  }
  for (const target of targetRows) {
    const bucket = postsByPlatform.get(target.platform) || { published: 0, failed: 0, pending: 0 };
    if (target.status === "published") bucket.published += 1;
    else if (target.status === "failed") bucket.failed += 1;
    else bucket.pending += 1;
    postsByPlatform.set(target.platform, bucket);
  }

  const contentByPlatform: MarketingContentPlatformStat[] = ["facebook_page", "instagram", "whatsapp_broadcast"].map((platform) => {
    const bucket = postsByPlatform.get(platform) || { published: 0, failed: 0, pending: 0 };
    return { platform: platform as MarketingContentPlatformStat["platform"], label: PLATFORM_LABELS[platform], ...bucket };
  });

  const totalPublishedTargets = targetRows.filter((target) => target.status === "published").length;
  const totalFailedTargets = targetRows.filter((target) => target.status === "failed").length;
  const totalAttemptedTargets = totalPublishedTargets + totalFailedTargets;

  const postsPublished = postRows.filter((post) => post.status === "published" || post.status === "partially_published").length;
  const postsFailed = postRows.filter((post) => post.status === "failed").length;
  const postsScheduled = postRows.filter((post) => post.status === "scheduled" || post.status === "draft").length;

  const targetsByPost = new Map<string, string[]>();
  for (const target of targetRows) {
    const list = targetsByPost.get(target.post_id) || [];
    list.push(PLATFORM_LABELS[target.platform] || target.platform);
    targetsByPost.set(target.post_id, list);
  }

  const toSummary = (post: { id: string; title: string; caption: string; status: string; scheduled_at: string }): MarketingRecentPost => ({
    id: post.id,
    title: post.title,
    caption: post.caption,
    status: post.status,
    scheduledAt: post.scheduled_at,
    platforms: targetsByPost.get(post.id) || []
  });

  const recentPublished = postRows
    .filter((post) => post.status === "published" || post.status === "partially_published")
    .slice(0, 6)
    .map(toSummary);

  const upcomingScheduled = postRows
    .filter((post) => post.status === "scheduled" || post.status === "draft")
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 6)
    .map(toSummary);

  return {
    configured: true,
    totals: {
      messagesLast30d: messageRows.length,
      inboundLast30d,
      outboundLast30d,
      activeThreads: threadRows.length,
      unreadThreads,
      postsPublished,
      postsFailed,
      postsScheduled,
      publishSuccessRate: totalAttemptedTargets ? Math.round((totalPublishedTargets / totalAttemptedTargets) * 100) : null
    },
    channels,
    contentByPlatform,
    recentPublished,
    upcomingScheduled
  };
}
