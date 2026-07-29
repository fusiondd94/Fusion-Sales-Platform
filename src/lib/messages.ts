import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { runAutomations } from "@/lib/automations";

export type MessageChannelType = "whatsapp" | "messenger" | "instagram";

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

export async function getInboxWorkspace(activeThreadId?: string) {
  const empty = { threads: [] as MessageThreadRecord[], messages: [] as MessageRecord[], activeThread: null as MessageThreadRecord | null };
  const supabase = getServiceClient();
  if (!supabase) return empty;

  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return empty;

  const { data: threads } = await supabase
    .from("crm_message_threads")
    .select("id, channel_id, channel_type, external_thread_id, contact_id, contact_name, contact_handle, last_message_at, last_message_preview, last_direction, unread_count, created_at")
    .eq("organization_id", organizationId)
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

  return { threads: threadList, messages, activeThread };
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

export async function ingestInboundMessage(payload: InboundMessagePayload): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };

  const { data: channel } = await supabase
    .from("crm_message_channels")
    .select("id, organization_id")
    .eq("channel_type", payload.channelType)
    .eq("external_account_id", payload.externalAccountId)
    .maybeSingle<{ id: string; organization_id: string }>();

  if (!channel) return { ok: false, error: "No connected channel matches this account." };

  const organizationId = channel.organization_id;

  const { data: existingThread } = await supabase
    .from("crm_message_threads")
    .select("id, contact_id, unread_count")
    .eq("channel_id", channel.id)
    .eq("external_thread_id", payload.externalThreadId)
    .maybeSingle<{ id: string; contact_id: string | null; unread_count: number }>();

  let contactId = existingThread?.contact_id || null;
  if (!contactId) {
    contactId = await findOrCreateContactForMessage(supabase, organizationId, payload);
  }

  const contactName = payload.contactName || payload.contactHandle || CHANNEL_LABELS[payload.channelType] + " contact";
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
        contact_handle: payload.contactHandle || null,
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
        last_message_at: nowIso,
        last_message_preview: payload.body.slice(0, 140),
        last_direction: "inbound",
        unread_count: (existingThread?.unread_count || 0) + 1,
        updated_at: nowIso
      })
      .eq("id", threadId);
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
