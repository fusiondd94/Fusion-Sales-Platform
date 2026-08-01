import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { runAutomations } from "@/lib/automations";

export type MessageChannelType = "whatsapp" | "messenger" | "instagram";

export type MessageThreadStatus = "inbox" | "spam" | "trash";

export type MessageChannel = {
  id: string;
  channel_type: MessageChannelType;
  display_name: string;
  status: "disconnected" | "connected" | "error";
  external_account_id: string | null;
  credentials: Record<string, string>;
  verify_token: string;
  last_error: string | null;
  last_connected_at: string | null;
  updated_at: string;
};

export type MessageThreadRecord = {
  id: string;
  channel_id: string;
  channel_type: MessageChannelType;
  external_thread_id: string;
  contact_id: string | null;
  contact_name: string | null;
  contact_handle: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_direction: string | null;
  unread_count: number;
  status: MessageThreadStatus;
  created_at: string;
};

export type MessageRecord = {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  message_type: string;
  status: string;
  sender_label: string | null;
  created_at: string;
};

export type InboundMessagePayload = {
  channelType: MessageChannelType;
  externalAccountId: string;
  externalThreadId: string;
  externalMessageId?: string;
  body: string;
  contactName?: string;
  contactHandle?: string;
};

export type ChannelHistorySyncResult = {
  ok: boolean;
  error?: string;
  imported?: number;
};

const CHANNEL_LABELS: Record<MessageChannelType, string> = {
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  instagram: "Instagram"
};

export const MESSAGE_CHANNEL_TYPES: MessageChannelType[] = ["whatsapp", "messenger", "instagram"];

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

const CHANNEL_SELECT = "id, channel_type, display_name, status, external_account_id, credentials, verify_token, last_error, last_connected_at, updated_at";

export async function getMessagingWorkspace() {
  const supabase = getServiceClient();
  if (!supabase) return { channels: [] as MessageChannel[] };

  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { channels: [] as MessageChannel[] };

  const { data: existingRows } = await supabase
    .from("crm_message_channels")
    .select(CHANNEL_SELECT)
    .eq("organization_id", organizationId);

  const rows = (existingRows || []) as MessageChannel[];
  const byType = new Map(rows.map((row) => [row.channel_type, row]));
  const missing = MESSAGE_CHANNEL_TYPES.filter((type) => !byType.has(type));

  if (missing.length) {
    await supabase.from("crm_message_channels").insert(
      missing.map((type) => ({
        organization_id: organizationId,
        channel_type: type,
        display_name: CHANNEL_LABELS[type],
        status: "disconnected"
      }))
    );

    const { data: refreshed } = await supabase
      .from("crm_message_channels")
      .select(CHANNEL_SELECT)
      .eq("organization_id", organizationId);

    return { channels: (refreshed || []) as MessageChannel[] };
  }

  return { channels: rows };
}

export async function saveMessageChannel(input: {
  actorId: string;
  channelType: MessageChannelType;
  displayName: string;
  externalAccountId: string;
  credentials: Record<string, string>;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data: existing } = await supabase
    .from("crm_message_channels")
    .select("credentials")
    .eq("organization_id", organizationId)
    .eq("channel_type", input.channelType)
    .maybeSingle<{ credentials: Record<string, string> }>();

  const mergedCredentials: Record<string, string> = { ...(existing?.credentials || {}) };
  for (const [key, value] of Object.entries(input.credentials)) {
    if (value && value.trim()) {
      mergedCredentials[key] = value.trim();
    } else if (!(key in mergedCredentials)) {
      mergedCredentials[key] = "";
    }
  }

  const hasCredentials = Object.values(mergedCredentials).some((value) => value && value.trim());

  const { error } = await supabase
    .from("crm_message_channels")
    .upsert(
      {
        organization_id: organizationId,
        channel_type: input.channelType,
        display_name: input.displayName || CHANNEL_LABELS[input.channelType],
        external_account_id: input.externalAccountId || null,
        credentials: mergedCredentials,
        status: hasCredentials ? "connected" : "disconnected",
        last_error: null,
        updated_by: input.actorId,
        updated_at: new Date().toISOString()
      },
      { onConflict: "organization_id,channel_type" }
    );

  if (error) return { ok: false, error: "Unable to save channel: " + error.message };
  return { ok: true };
}

export async function disconnectMessageChannel(input: { actorId: string; channelType: MessageChannelType }): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { error } = await supabase
    .from("crm_message_channels")
    .update({
      status: "disconnected",
      credentials: {},
      last_error: null,
      updated_by: input.actorId,
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("channel_type", input.channelType);

  if (error) return { ok: false, error: "Unable to disconnect channel: " + error.message };
  return { ok: true };
}

export async function verifyChannelToken(channelType: MessageChannelType, token: string): Promise<boolean> {
  const supabase = getServiceClient();
  if (!supabase || !token) return false;

  const { data } = await supabase
    .from("crm_message_channels")
    .select("id")
    .eq("channel_type", channelType)
    .eq("verify_token", token)
    .maybeSingle<{ id: string }>();

  return !!data;
}

export type InboxFolderCounts = Record<MessageThreadStatus, number>;
export type InboxChannelCounts = Record<"all" | MessageChannelType, number>;

export async function getInboxWorkspace(
  activeThreadId?: string,
  filters?: { channelType?: MessageChannelType; folder?: MessageThreadStatus }
) {
  const empty = {
    threads: [] as MessageThreadRecord[],
    messages: [] as MessageRecord[],
    activeThread: null as MessageThreadRecord | null,
    folder: (filters?.folder || "inbox") as MessageThreadStatus,
    folderCounts: { inbox: 0, spam: 0, trash: 0 } as InboxFolderCounts,
    channelCounts: { all: 0, whatsapp: 0, messenger: 0, instagram: 0 } as InboxChannelCounts
  };
  const supabase = getServiceClient();
  if (!supabase) return empty;

  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return empty;

  const folder: MessageThreadStatus = filters?.folder || "inbox";

  const { data: allThreadMeta } = await supabase
    .from("crm_message_threads")
    .select("channel_type, status")
    .eq("organization_id", organizationId);

  const folderCounts: InboxFolderCounts = { inbox: 0, spam: 0, trash: 0 };
  const channelCounts: InboxChannelCounts = { all: 0, whatsapp: 0, messenger: 0, instagram: 0 };
  for (const row of (allThreadMeta || []) as Array<{ channel_type: MessageChannelType; status: MessageThreadStatus }>) {
    if (row.status in folderCounts) folderCounts[row.status] += 1;
    if (row.status === folder) {
      channelCounts.all += 1;
      if (row.channel_type in channelCounts) channelCounts[row.channel_type] += 1;
    }
  }

  let threadsQuery = supabase
    .from("crm_message_threads")
    .select(
      "id, channel_id, channel_type, external_thread_id, contact_id, contact_name, contact_handle, last_message_at, last_message_preview, last_direction, unread_count, status, created_at"
    )
    .eq("organization_id", organizationId)
    .eq("status", folder);

  if (filters?.channelType) {
    threadsQuery = threadsQuery.eq("channel_type", filters.channelType);
  }

  const { data: threads } = await threadsQuery
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);

  const threadList = (threads || []) as MessageThreadRecord[];
  const activeThread = activeThreadId
    ? threadList.find((thread) => thread.id === activeThreadId) || null
    : threadList[0] || null;

  let messages: MessageRecord[] = [];
  if (activeThread) {
    const { data: messageRows } = await supabase
      .from("crm_messages")
      .select("id, thread_id, direction, body, message_type, status, sender_label, created_at")
      .eq("thread_id", activeThread.id)
      .order("created_at", { ascending: true })
      .limit(200);
    messages = (messageRows || []) as MessageRecord[];

    if (activeThread.unread_count > 0) {
      await supabase.from("crm_message_threads").update({ unread_count: 0 }).eq("id", activeThread.id);
    }
  }

  return { threads: threadList, messages, activeThread, folder, folderCounts, channelCounts };
}

export async function moveThreadFolder(input: {
  actorId: string;
  threadId: string;
  folder: MessageThreadStatus;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };

  const { error } = await supabase
    .from("crm_message_threads")
    .update({ status: input.folder, updated_at: new Date().toISOString() })
    .eq("id", input.threadId);

  if (error) return { ok: false, error: "Unable to move conversation: " + error.message };
  return { ok: true };
}

export async function permanentlyDeleteThread(input: { actorId: string; threadId: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };

  await supabase.from("crm_messages").delete().eq("thread_id", input.threadId);
  const { error } = await supabase.from("crm_message_threads").delete().eq("id", input.threadId);

  if (error) return { ok: false, error: "Unable to delete conversation: " + error.message };
  return { ok: true };
}

export async function sendMessage(input: { actorId: string; threadId: string; body: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const body = input.body.trim();
  if (!body) return { ok: false, error: "Message body is required." };

  const { data: thread } = await supabase
    .from("crm_message_threads")
    .select("id, channel_id, channel_type, external_thread_id")
    .eq("organization_id", organizationId)
    .eq("id", input.threadId)
    .maybeSingle<{ id: string; channel_id: string; channel_type: MessageChannelType; external_thread_id: string }>();

  if (!thread) return { ok: false, error: "Conversation not found." };

  const { data: channel } = await supabase
    .from("crm_message_channels")
    .select("id, credentials, status")
    .eq("id", thread.channel_id)
    .maybeSingle<{ id: string; credentials: Record<string, string>; status: string }>();

  if (!channel || channel.status !== "connected") return { ok: false, error: "This channel is not connected." };

  const sendResult = await dispatchOutboundMessage(thread.channel_type, thread.external_thread_id, body, channel.credentials);

  const nowIso = new Date().toISOString();

  await supabase.from("crm_messages").insert({
    organization_id: organizationId,
    thread_id: thread.id,
    direction: "outbound",
    external_message_id: sendResult.externalId || null,
    body,
    status: sendResult.ok ? "sent" : "failed",
    sender_label: "Agent"
  });

  if (!sendResult.ok) {
    await supabase
      .from("crm_message_channels")
      .update({ status: "error", last_error: sendResult.error || "Unable to send message." })
      .eq("id", channel.id);
    return { ok: false, error: sendResult.error || "Unable to send message." };
  }

  await supabase
    .from("crm_message_threads")
    .update({
      last_message_at: nowIso,
      last_message_preview: body.slice(0, 140),
      last_direction: "outbound",
      updated_at: nowIso
    })
    .eq("id", thread.id);

  return { ok: true };
}

async function dispatchOutboundMessage(
  channelType: MessageChannelType,
  externalThreadId: string,
  body: string,
  credentials: Record<string, string>
): Promise<{ ok: boolean; error?: string; externalId?: string }> {
  try {
    if (channelType === "whatsapp") {
      const phoneNumberId = credentials.phoneNumberId;
      const accessToken = credentials.accessToken;
      if (!phoneNumberId || !accessToken) return { ok: false, error: "WhatsApp is missing a phone number ID or access token." };

      const response = await fetch("https://graph.facebook.com/v19.0/" + phoneNumberId + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + accessToken },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: externalThreadId,
          type: "text",
          text: { body }
        })
      });
      const payload = await response.json().catch(() => ({}) as Record<string, unknown>);
      if (!response.ok) return { ok: false, error: extractGraphError(payload) };
      const messages = (payload as { messages?: Array<{ id?: string }> }).messages;
      return { ok: true, externalId: messages?.[0]?.id };
    }

    if (channelType === "messenger" || channelType === "instagram") {
      const accessToken = credentials.accessToken;
      const label = channelType === "messenger" ? "Messenger" : "Instagram";
      if (!accessToken) return { ok: false, error: label + " is missing an access token." };

      const response = await fetch("https://graph.facebook.com/v19.0/me/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + accessToken },
        body: JSON.stringify({
          recipient: { id: externalThreadId },
          message: { text: body }
        })
      });
      const payload = await response.json().catch(() => ({}) as Record<string, unknown>);
      if (!response.ok) return { ok: false, error: extractGraphError(payload) };
      const messageId = (payload as { message_id?: string }).message_id;
      return { ok: true, externalId: messageId };
    }

    return { ok: false, error: "Unsupported channel." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unexpected error sending message." };
  }
}

function extractGraphError(payload: unknown): string {
  const error = (payload as { error?: { message?: string } })?.error;
  return error?.message || "Meta API error.";
}

// Messenger and Instagram webhooks only ever send the sender's numeric
// PSID/IGSID, never a name — unlike WhatsApp, which includes a profile name
// right in the webhook payload. Look the sender up via the Graph API using
// the connected channel's access token so real conversations show a real
// name/username instead of a generic "Messenger contact" placeholder.
async function resolveChannelProfileName(
  channelType: MessageChannelType,
  externalId: string,
  accessToken: string | undefined
): Promise<{ name: string | null; handle: string | null }> {
  if (!accessToken || channelType === "whatsapp") return { name: null, handle: null };

  try {
    const fields = channelType === "instagram" ? "name,username" : "first_name,last_name,name";
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${externalId}?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`
    );
    const body = await response.json().catch(() => ({}) as Record<string, unknown>);
    if (!response.ok) return { name: null, handle: null };

    if (channelType === "instagram") {
      const p = body as { name?: string; username?: string };
      return { name: p.name || p.username || null, handle: p.username || null };
    }

    const p = body as { first_name?: string; last_name?: string; name?: string };
    const name = p.name || [p.first_name, p.last_name].filter(Boolean).join(" ") || null;
    return { name, handle: null };
  } catch {
    return { name: null, handle: null };
  }
}

export async function ingestInboundMessage(payload: InboundMessagePayload): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };

  const { data: channel } = await supabase
    .from("crm_message_channels")
    .select("id, organization_id, credentials")
    .eq("channel_type", payload.channelType)
    .eq("external_account_id", payload.externalAccountId)
    .maybeSingle<{ id: string; organization_id: string; credentials: Record<string, string> }>();

  if (!channel) return { ok: false, error: "No connected channel matches this account." };

  const organizationId = channel.organization_id;

  const { data: existingThread } = await supabase
    .from("crm_message_threads")
    .select("id, contact_id, unread_count")
    .eq("channel_id", channel.id)
    .eq("external_thread_id", payload.externalThreadId)
    .maybeSingle<{ id: string; contact_id: string | null; unread_count: number }>();

  let resolvedName = payload.contactName || null;
  let resolvedHandle = payload.contactHandle || null;
  if (!resolvedName) {
    const profile = await resolveChannelProfileName(payload.channelType, payload.externalThreadId, channel.credentials?.accessToken);
    resolvedName = profile.name;
    resolvedHandle = resolvedHandle || profile.handle;
  }
  const resolvedPayload: InboundMessagePayload = {
    ...payload,
    contactName: resolvedName || undefined,
    contactHandle: resolvedHandle || undefined
  };

  let contactId = existingThread?.contact_id || null;
  if (!contactId) {
    contactId = await findOrCreateContactForMessage(supabase, organizationId, resolvedPayload);
  }

  const contactName = resolvedName || resolvedHandle || CHANNEL_LABELS[payload.channelType] + " contact";
  const nowIso = new Date().toISOString();
  let threadId = existingThread?.id || "";

  if (!threadId) {
    const { data: newThread } = await supabase
      .from("crm_message_threads")
      .insert({
        organization_id: organizationId,
        channel_id: channel.id,
        channel_type: payload.channelType,
        external_thread_id: payload.externalThreadId,
        contact_id: contactId,
        contact_name: contactName,
        contact_handle: resolvedHandle || null,
        last_message_at: nowIso,
        last_message_preview: payload.body.slice(0, 140),
        last_direction: "inbound",
        unread_count: 1
      })
      .select("id")
      .single<{ id: string }>();
    threadId = newThread?.id || "";
  } else {
    await supabase
      .from("crm_message_threads")
      .update({
        contact_id: contactId,
        contact_name: contactName,
        contact_handle: resolvedHandle || null,
        last_message_at: nowIso,
        last_message_preview: payload.body.slice(0, 140),
        last_direction: "inbound",
        unread_count: (existingThread?.unread_count || 0) + 1,
        updated_at: nowIso
      })
      .eq("id", threadId);

    // The thread already had a contact before — if we only just now managed to
    // resolve their real name (this message succeeded where an earlier one
    // didn't), carry it over to the contact record too, but only if the
    // contact still has the generic placeholder name an admin hasn't touched.
    if (contactId && resolvedName) {
      const placeholder = CHANNEL_LABELS[payload.channelType] + " contact";
      const { data: existingContact } = await supabase
        .from("crm_contacts")
        .select("display_name")
        .eq("id", contactId)
        .maybeSingle<{ display_name: string }>();
      if (existingContact && (existingContact.display_name === placeholder || existingContact.display_name === resolvedHandle)) {
        const nameParts = resolvedName.split(/\s+/).filter(Boolean);
        await supabase
          .from("crm_contacts")
          .update({
            first_name: nameParts[0] || resolvedName,
            last_name: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
            display_name: resolvedName,
            updated_at: nowIso
          })
          .eq("id", contactId);
      }
    }
  }

  if (!threadId) return { ok: false, error: "Unable to create conversation thread." };

  await supabase.from("crm_messages").insert({
    organization_id: organizationId,
    thread_id: threadId,
    direction: "inbound",
    external_message_id: payload.externalMessageId || null,
    body: payload.body,
    status: "received",
    sender_label: contactName
  });

  await runAutomations({
    trigger: "message.received",
    entityType: "message",
    entityId: threadId,
    organizationId,
    contact: {
      name: contactName,
      phone: payload.channelType === "whatsapp" ? payload.contactHandle : undefined
    },
    message: {
      body: payload.body,
      channel: payload.channelType
    },
    raw: { channelType: payload.channelType, body: payload.body }
  });

  return { ok: true };
}

async function findOrCreateContactForMessage(
  supabase: SupabaseClient<any>,
  organizationId: string,
  payload: InboundMessagePayload
): Promise<string | null> {
  if (payload.channelType === "whatsapp" && payload.contactHandle) {
    const normalizedPhone = payload.contactHandle.replace(/[^\d+]/g, "");

    const { data: existing } = await supabase
      .from("crm_contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("phone", normalizedPhone)
      .is("deleted_at", null)
      .maybeSingle<{ id: string }>();

    if (existing) return existing.id;

    const displayName = payload.contactName || normalizedPhone;
    const { data: created } = await supabase
      .from("crm_contacts")
      .insert({
        organization_id: organizationId,
        first_name: displayName.split(/\s+/)[0] || displayName,
        display_name: displayName,
        phone: normalizedPhone,
        normalized_phone: normalizedPhone,
        lead_source: "WhatsApp",
        contact_type: "prospect",
        lifecycle_status: "new"
      })
      .select("id")
      .single<{ id: string }>();

    return created?.id || null;
  }

  const displayName = payload.contactName || CHANNEL_LABELS[payload.channelType] + " contact";
  const { data: created } = await supabase
    .from("crm_contacts")
    .insert({
      organization_id: organizationId,
      first_name: displayName.split(/\s+/)[0] || displayName,
      display_name: displayName,
      lead_source: CHANNEL_LABELS[payload.channelType],
      contact_type: "prospect",
      lifecycle_status: "new"
    })
    .select("id")
    .single<{ id: string }>();

  return created?.id || null;
}

export async function syncChannelHistory(channelType: MessageChannelType): Promise<ChannelHistorySyncResult> {
  if (channelType !== "messenger" && channelType !== "instagram") {
    return { ok: false, error: "Message history sync is only available for Messenger and Instagram." };
  }

  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data: channelRow } = await supabase
    .from("crm_message_channels")
    .select("id, status, external_account_id, credentials")
    .eq("organization_id", organizationId)
    .eq("channel_type", channelType)
    .maybeSingle<{ id: string; status: string; external_account_id: string | null; credentials: Record<string, string> }>();

  if (!channelRow || channelRow.status !== "connected") {
    return { ok: false, error: "Connect this channel before syncing message history." };
  }

  const accessToken = channelRow.credentials?.accessToken;
  const accountId = channelRow.external_account_id;
  if (!accessToken || !accountId) {
    return { ok: false, error: "Missing an access token or account ID for this channel." };
  }

  let imported = 0;
  let url =
    "https://graph.facebook.com/v19.0/" + accountId + "/conversations" +
    "?fields=participants,messages.limit(200){id,message,from,created_time}" +
    "&limit=50" +
    (channelType === "instagram" ? "&platform=instagram" : "") +
    "&access_token=" + encodeURIComponent(accessToken);

  try {
    let pageCount = 0;
    while (url && pageCount < 20) {
      pageCount++;
      const response = await fetch(url);
      const payload = await response.json().catch(() => ({}) as Record<string, unknown>);

      if (!response.ok) {
        return { ok: false, error: extractGraphError(payload), imported };
      }

      const conversations = ((payload as { data?: unknown[] }).data || []) as Array<{
        id: string;
        participants?: { data?: Array<{ id: string; name?: string; username?: string }> };
        messages?: { data?: Array<{ id: string; message?: string; from?: { id: string; name?: string }; created_time: string }> };
      }>;

      for (const conversation of conversations) {
        const otherParticipant = (conversation.participants?.data || []).find((participant) => participant.id !== accountId);
        const externalThreadId = otherParticipant?.id || conversation.id;
        const contactName = otherParticipant?.name || otherParticipant?.username || null;

        const messages = [...(conversation.messages?.data || [])].sort(
          (a, b) => new Date(a.created_time).getTime() - new Date(b.created_time).getTime()
        );

        for (const message of messages) {
          const wasImported = await importHistoricalMessage(supabase, organizationId, channelRow.id, channelType, {
            externalThreadId,
            externalMessageId: message.id,
            body: message.message || "",
            createdAt: message.created_time,
            direction: message.from?.id === accountId ? "outbound" : "inbound",
            contactName
          });
          if (wasImported) imported++;
        }
      }

      url = ((payload as { paging?: { next?: string } }).paging || {}).next || "";
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unexpected error syncing message history.", imported };
  }

  return { ok: true, imported };
}

async function importHistoricalMessage(
  supabase: SupabaseClient<any>,
  organizationId: string,
  channelId: string,
  channelType: MessageChannelType,
  input: {
    externalThreadId: string;
    externalMessageId: string;
    body: string;
    createdAt: string;
    direction: "inbound" | "outbound";
    contactName: string | null;
  }
): Promise<boolean> {
  if (!input.body.trim()) return false;

  const { data: existingMessage } = await supabase
    .from("crm_messages")
    .select("id")
    .eq("external_message_id", input.externalMessageId)
    .maybeSingle<{ id: string }>();
  if (existingMessage) return false;

  const { data: existingThread } = await supabase
    .from("crm_message_threads")
    .select("id, contact_id")
    .eq("channel_id", channelId)
    .eq("external_thread_id", input.externalThreadId)
    .maybeSingle<{ id: string; contact_id: string | null }>();

  let threadId = existingThread?.id || "";
  let contactId = existingThread?.contact_id || null;

  if (!contactId) {
    const displayName = input.contactName || CHANNEL_LABELS[channelType] + " contact";
    const { data: created } = await supabase
      .from("crm_contacts")
      .insert({
        organization_id: organizationId,
        first_name: displayName.split(/\s+/)[0] || displayName,
        display_name: displayName,
        lead_source: CHANNEL_LABELS[channelType],
        contact_type: "prospect",
        lifecycle_status: "new"
      })
      .select("id")
      .single<{ id: string }>();
    contactId = created?.id || null;
  }

  if (!threadId) {
    const { data: newThread } = await supabase
      .from("crm_message_threads")
      .insert({
        organization_id: organizationId,
        channel_id: channelId,
        channel_type: channelType,
        external_thread_id: input.externalThreadId,
        contact_id: contactId,
        contact_name: input.contactName,
        last_message_at: input.createdAt,
        last_message_preview: input.body.slice(0, 140),
        last_direction: input.direction,
        unread_count: 0
      })
      .select("id")
      .single<{ id: string }>();
    threadId = newThread?.id || "";
  } else {
    await supabase
      .from("crm_message_threads")
      .update({
        contact_id: contactId,
        contact_name: input.contactName,
        last_message_at: input.createdAt,
        last_message_preview: input.body.slice(0, 140),
        last_direction: input.direction,
        updated_at: input.createdAt
      })
      .eq("id", threadId);
  }

  if (!threadId) return false;

  await supabase.from("crm_messages").insert({
    organization_id: organizationId,
    thread_id: threadId,
    direction: input.direction,
    external_message_id: input.externalMessageId,
    body: input.body,
    status: input.direction === "inbound" ? "received" : "sent",
    sender_label: input.direction === "inbound" ? input.contactName || "Contact" : "Agent",
    created_at: input.createdAt
  });

  return true;
}

export type ContactNameBackfillResult = { ok: boolean; checked: number; updated: number; error?: string };

// One-off cleanup for conversations that came in before name resolution
// existed (or before a channel's token could resolve a given sender) — finds
// every Messenger/Instagram thread still showing the generic "<Channel>
// contact" placeholder and looks the sender up again via the Graph API.
export async function backfillContactNames(): Promise<ContactNameBackfillResult> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, checked: 0, updated: 0, error: "Supabase CRM is not configured." };

  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, checked: 0, updated: 0, error: "CRM organization is not configured." };

  const { data: channels } = await supabase
    .from("crm_message_channels")
    .select("id, channel_type, credentials")
    .eq("organization_id", organizationId)
    .in("channel_type", ["messenger", "instagram"]);

  const channelById = new Map(
    ((channels || []) as Array<{ id: string; channel_type: MessageChannelType; credentials: Record<string, string> }>).map((c) => [c.id, c])
  );

  const { data: threads } = await supabase
    .from("crm_message_threads")
    .select("id, channel_id, channel_type, external_thread_id, contact_id, contact_name")
    .eq("organization_id", organizationId)
    .in("channel_type", ["messenger", "instagram"]);

  let checked = 0;
  let updated = 0;

  for (const thread of (threads || []) as Array<{
    id: string;
    channel_id: string;
    channel_type: MessageChannelType;
    external_thread_id: string;
    contact_id: string | null;
    contact_name: string | null;
  }>) {
    const placeholder = CHANNEL_LABELS[thread.channel_type] + " contact";
    if (thread.contact_name !== placeholder) continue;
    checked++;

    const channel = channelById.get(thread.channel_id);
    const profile = await resolveChannelProfileName(thread.channel_type, thread.external_thread_id, channel?.credentials?.accessToken);
    if (!profile.name) continue;

    const nowIso = new Date().toISOString();
    await supabase
      .from("crm_message_threads")
      .update({ contact_name: profile.name, contact_handle: profile.handle || null, updated_at: nowIso })
      .eq("id", thread.id);

    if (thread.contact_id) {
      const nameParts = profile.name.split(/\s+/).filter(Boolean);
      await supabase
        .from("crm_contacts")
        .update({
          first_name: nameParts[0] || profile.name,
          last_name: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
          display_name: profile.name,
          updated_at: nowIso
        })
        .eq("id", thread.contact_id);
    }

    updated++;
  }

  return { ok: true, checked, updated };
}

// --- WhatsApp Coexistence ingestion -----------------------------------------
//
// A number onboarded with Coexistence keeps working in the customer's
// WhatsApp Business mobile app alongside our Cloud API integration. Meta
// mirrors that activity to us through three extra webhook fields:
//   - smb_app_state_sync: the business's phone contacts (so we can attach
//     real names/leads even for people who never messaged through Cloud API)
//   - smb_message_echoes: messages the business sends from the mobile app,
//     which we must mirror into the same thread so the inbox stays complete
//   - history: a one-time backfill of up to 180 days of prior chat history,
//     delivered in phased/chunked webhooks after onboarding
//
// These three helpers are intentionally separate from ingestInboundMessage
// because none of them represent a new inbound message from a WhatsApp user
// arriving through Cloud API — they are sync/mirror events with their own
// direction and dedupe rules, and historical imports must not fire
// "message.received" automations for messages that are days or months old.

export type SmbStateSyncEntry = {
  fullName?: string;
  firstName?: string;
  phoneNumber: string;
  action: "add" | "remove";
};

export async function applySmbStateSync(entries: SmbStateSyncEntry[]): Promise<{ ok: boolean; updated: number; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, updated: 0, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, updated: 0, error: "CRM organization is not configured." };

  let updated = 0;

  for (const entry of entries) {
    if (entry.action === "remove") continue;

    const normalizedPhone = entry.phoneNumber.replace(/[^\d+]/g, "");
    if (!normalizedPhone) continue;

    const displayName = entry.fullName || entry.firstName || normalizedPhone;

    const { data: existing } = await supabase
      .from("crm_contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("phone", normalizedPhone)
      .is("deleted_at", null)
      .maybeSingle<{ id: string }>();

    if (existing) {
      await supabase
        .from("crm_contacts")
        .update({
          display_name: displayName,
          first_name: entry.firstName || displayName,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
      updated++;
      continue;
    }

    const { error } = await supabase.from("crm_contacts").insert({
      organization_id: organizationId,
      first_name: entry.firstName || displayName,
      display_name: displayName,
      phone: normalizedPhone,
      normalized_phone: normalizedPhone,
      lead_source: "WhatsApp",
      contact_type: "prospect",
      lifecycle_status: "new"
    });
    if (!error) updated++;
  }

  return { ok: true, updated };
}

export type SmbMessageEchoPayload = {
  externalAccountId: string;
  externalThreadId: string;
  externalMessageId?: string;
  body: string;
  sentAt?: string;
};

export async function ingestSmbMessageEcho(payload: SmbMessageEchoPayload): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };

  const { data: channel } = await supabase
    .from("crm_message_channels")
    .select("id, organization_id")
    .eq("channel_type", "whatsapp")
    .eq("external_account_id", payload.externalAccountId)
    .maybeSingle<{ id: string; organization_id: string }>();

  if (!channel) return { ok: false, error: "No connected WhatsApp channel matches this account." };

  if (payload.externalMessageId) {
    const { data: existingMessage } = await supabase
      .from("crm_messages")
      .select("id")
      .eq("external_message_id", payload.externalMessageId)
      .maybeSingle<{ id: string }>();
    if (existingMessage) return { ok: true };
  }

  const organizationId = channel.organization_id;
  const nowIso = payload.sentAt || new Date().toISOString();

  const { data: existingThread } = await supabase
    .from("crm_message_threads")
    .select("id, contact_id")
    .eq("channel_id", channel.id)
    .eq("external_thread_id", payload.externalThreadId)
    .maybeSingle<{ id: string; contact_id: string | null }>();

  let threadId = existingThread?.id || "";
  let contactId = existingThread?.contact_id || null;

  if (!contactId) {
    contactId = await findOrCreateContactForMessage(supabase, organizationId, {
      channelType: "whatsapp",
      externalAccountId: payload.externalAccountId,
      externalThreadId: payload.externalThreadId,
      body: payload.body,
      contactHandle: payload.externalThreadId
    });
  }

  if (!threadId) {
    const { data: newThread } = await supabase
      .from("crm_message_threads")
      .insert({
        organization_id: organizationId,
        channel_id: channel.id,
        channel_type: "whatsapp",
        external_thread_id: payload.externalThreadId,
        contact_id: contactId,
        last_message_at: nowIso,
        last_message_preview: payload.body.slice(0, 140),
        last_direction: "outbound",
        unread_count: 0
      })
      .select("id")
      .single<{ id: string }>();
    threadId = newThread?.id || "";
  } else {
    await supabase
      .from("crm_message_threads")
      .update({
        contact_id: contactId,
        last_message_at: nowIso,
        last_message_preview: payload.body.slice(0, 140),
        last_direction: "outbound",
        updated_at: nowIso
      })
      .eq("id", threadId);
  }

  if (!threadId) return { ok: false, error: "Unable to create conversation thread." };

  await supabase.from("crm_messages").insert({
    organization_id: organizationId,
    thread_id: threadId,
    direction: "outbound",
    external_message_id: payload.externalMessageId || null,
    body: payload.body,
    status: "sent",
    sender_label: "WhatsApp Business App"
  });

  return { ok: true };
}

export type HistoryThreadMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
};

export type HistoryThread = {
  id: string;
  messages: HistoryThreadMessage[];
};

export async function ingestHistoryThreads(
  externalAccountId: string,
  businessPhoneNumber: string,
  threads: HistoryThread[]
): Promise<{ ok: boolean; imported: number; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, imported: 0, error: "Supabase CRM is not configured." };

  const { data: channel } = await supabase
    .from("crm_message_channels")
    .select("id, organization_id")
    .eq("channel_type", "whatsapp")
    .eq("external_account_id", externalAccountId)
    .maybeSingle<{ id: string; organization_id: string }>();

  if (!channel) return { ok: false, imported: 0, error: "No connected WhatsApp channel matches this account." };

  const organizationId = channel.organization_id;
  let imported = 0;

  for (const thread of threads) {
    const externalThreadId = thread.id;

    for (const message of thread.messages) {
      if (message.type !== "text" || !message.text?.body) continue;

      const direction: "inbound" | "outbound" = message.from === businessPhoneNumber ? "outbound" : "inbound";
      const timestampMs = Number(message.timestamp) * 1000;
      const createdAt = Number.isFinite(timestampMs) && timestampMs > 0 ? new Date(timestampMs).toISOString() : new Date().toISOString();

      const { data: existingMessage } = await supabase
        .from("crm_messages")
        .select("id")
        .eq("external_message_id", message.id)
        .maybeSingle<{ id: string }>();
      if (existingMessage) continue;

      const { data: existingThread } = await supabase
        .from("crm_message_threads")
        .select("id, contact_id")
        .eq("channel_id", channel.id)
        .eq("external_thread_id", externalThreadId)
        .maybeSingle<{ id: string; contact_id: string | null }>();

      let threadId = existingThread?.id || "";
      let contactId = existingThread?.contact_id || null;

      if (!contactId) {
        contactId = await findOrCreateContactForMessage(supabase, organizationId, {
          channelType: "whatsapp",
          externalAccountId,
          externalThreadId,
          body: message.text.body,
          contactHandle: externalThreadId
        });
      }

      if (!threadId) {
        const { data: newThread } = await supabase
          .from("crm_message_threads")
          .insert({
            organization_id: organizationId,
            channel_id: channel.id,
            channel_type: "whatsapp",
            external_thread_id: externalThreadId,
            contact_id: contactId,
            last_message_at: createdAt,
            last_message_preview: message.text.body.slice(0, 140),
            last_direction: direction,
            unread_count: 0
          })
          .select("id")
          .single<{ id: string }>();
        threadId = newThread?.id || "";
      } else {
        await supabase
          .from("crm_message_threads")
          .update({
            contact_id: contactId,
            last_message_at: createdAt,
            last_message_preview: message.text.body.slice(0, 140),
            last_direction: direction,
            updated_at: createdAt
          })
          .eq("id", threadId);
      }

      if (!threadId) continue;

      await supabase.from("crm_messages").insert({
        organization_id: organizationId,
        thread_id: threadId,
        direction,
        external_message_id: message.id,
        body: message.text.body,
        status: direction === "inbound" ? "received" : "sent",
        sender_label: direction === "inbound" ? "Contact" : "WhatsApp Business App (history)",
        created_at: createdAt
      });

      imported++;
    }
  }

  return { ok: true, imported };
}

export async function triggerSmbAppDataSync(businessPhoneNumberId: string, accessToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const contactsResponse = await fetch(
      `https://graph.facebook.com/v21.0/${businessPhoneNumberId}/smb_app_data`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + accessToken },
        body: JSON.stringify({ messaging_product: "whatsapp", sync_type: "smb_app_state_sync" })
      }
    );
    if (!contactsResponse.ok) {
      const payload = await contactsResponse.json().catch(() => ({}) as Record<string, unknown>);
      return { ok: false, error: extractGraphError(payload) };
    }

    const historyResponse = await fetch(
      `https://graph.facebook.com/v21.0/${businessPhoneNumberId}/smb_app_data`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + accessToken },
        body: JSON.stringify({ messaging_product: "whatsapp", sync_type: "history" })
      }
    );
    if (!historyResponse.ok) {
      const payload = await historyResponse.json().catch(() => ({}) as Record<string, unknown>);
      return { ok: false, error: extractGraphError(payload) };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unexpected error triggering SMB App Data sync." };
  }
}
