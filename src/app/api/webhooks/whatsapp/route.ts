import { NextRequest, NextResponse } from "next/server";
import {
  applySmbStateSync,
  ingestHistoryThreads,
  ingestInboundMessage,
  ingestSmbMessageEcho,
  verifyChannelToken
} from "@/lib/messages";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && (await verifyChannelToken("whatsapp", token))) {
    return new NextResponse(challenge || "", { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

type WhatsAppContact = { wa_id?: string; profile?: { name?: string } };
type WhatsAppMessage = { from?: string; id?: string; type?: string; text?: { body?: string } };
type WhatsAppChangeValue = {
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  state_sync?: Array<{
    type?: string;
    action?: "add" | "remove";
    contact?: { full_name?: string; first_name?: string; phone_number?: string };
  }>;
  message_echoes?: Array<{
    from?: string;
    to?: string;
    id?: string;
    timestamp?: string;
    type?: string;
    text?: { body?: string };
  }>;
  history?: Array<{
    metadata?: { phase?: number; chunk_order?: number; progress?: number };
    threads?: Array<{
      id: string;
      messages: Array<{ from: string; id: string; timestamp: string; type: string; text?: { body?: string } }>;
    }>;
    errors?: Array<{ code?: number; title?: string; message?: string }>;
  }>;
};

async function handleMessagesField(value: WhatsAppChangeValue) {
  const phoneNumberId = value.metadata?.phone_number_id;
  const messages = value.messages || [];
  const contacts = value.contacts || [];

  for (const message of messages) {
    if (!message.text?.body || !message.from) continue;

    const contact = contacts.find((item) => item.wa_id === message.from);

    await ingestInboundMessage({
      channelType: "whatsapp",
      externalAccountId: String(phoneNumberId || ""),
      externalThreadId: String(message.from),
      externalMessageId: message.id,
      body: message.text.body,
      contactName: contact?.profile?.name,
      contactHandle: message.from
    });
  }
}

// The `smb_app_state_sync` webhook describes the business customer's phone
// contacts — sent once after the SMB App Data API sync call, and again any
// time the business adds, edits, or removes a contact in the WhatsApp
// Business app going forward.
async function handleSmbAppStateSync(value: WhatsAppChangeValue) {
  const entries = (value.state_sync || [])
    .filter((entry) => entry.contact?.phone_number)
    .map((entry) => ({
      fullName: entry.contact?.full_name,
      firstName: entry.contact?.first_name,
      phoneNumber: String(entry.contact?.phone_number),
      action: entry.action === "remove" ? ("remove" as const) : ("add" as const)
    }));

  if (entries.length) await applySmbStateSync(entries);
}

// The `smb_message_echoes` webhook fires every time the business sends a
// message from the WhatsApp Business mobile app (or a linked companion
// device) after being onboarded to Cloud API. We mirror it into the same
// thread as an outbound message so the unified inbox stays in sync with
// what the business actually sent, regardless of which app they used.
async function handleSmbMessageEchoes(value: WhatsAppChangeValue) {
  const phoneNumberId = value.metadata?.phone_number_id;
  const echoes = value.message_echoes || [];

  for (const echo of echoes) {
    if (!echo.text?.body || !echo.to) continue;

    const sentAt = echo.timestamp ? new Date(Number(echo.timestamp) * 1000).toISOString() : undefined;

    await ingestSmbMessageEcho({
      externalAccountId: String(phoneNumberId || ""),
      externalThreadId: String(echo.to),
      externalMessageId: echo.id,
      body: echo.text.body,
      sentAt
    });
  }
}

// The `history` webhook delivers up to 180 days of prior WhatsApp Business
// app chat history in phased, chunked batches shortly after onboarding, or
// a single webhook with an `errors` array if the business declined to share
// their history. A separate history webhook shape (no `history[]`, just a
// bare `messages[]` array like the standard messages field) also arrives
// for media message contents — those are skipped here since only text
// history is imported today.
async function handleHistoryField(value: WhatsAppChangeValue) {
  const phoneNumberId = value.metadata?.phone_number_id;
  const businessPhoneNumber = value.metadata?.display_phone_number || "";
  const historyChunks = value.history || [];

  for (const chunk of historyChunks) {
    if (chunk.errors?.length) {
      console.info("WhatsApp history sync declined or errored", chunk.errors);
      continue;
    }

    const threads = chunk.threads || [];
    if (threads.length) {
      await ingestHistoryThreads(String(phoneNumberId || ""), businessPhoneNumber, threads);
    }
  }
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: true });

  try {
    const entries = (payload.entry || []) as Array<{ changes?: Array<{ value?: WhatsAppChangeValue; field?: string }> }>;

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};

        if (change.field === "smb_app_state_sync") {
          await handleSmbAppStateSync(value);
        } else if (change.field === "smb_message_echoes") {
          await handleSmbMessageEchoes(value);
        } else if (change.field === "history") {
          await handleHistoryField(value);
        } else {
          // Default to standard message handling for the "messages" field
          // (and for any unrecognized field, since the payload shape matches).
          await handleMessagesField(value);
        }
      }
    }
  } catch (error) {
    console.error("WhatsApp webhook error", error);
  }

  return NextResponse.json({ ok: true });
}
