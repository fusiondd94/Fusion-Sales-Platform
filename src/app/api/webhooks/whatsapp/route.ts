import { NextRequest, NextResponse } from "next/server";
import { ingestInboundMessage, verifyChannelToken } from "@/lib/messages";

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
  metadata?: { phone_number_id?: string };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
};

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: true });

  try {
    const entries = (payload.entry || []) as Array<{ changes?: Array<{ value?: WhatsAppChangeValue }> }>;

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
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
    }
  } catch (error) {
    console.error("WhatsApp webhook error", error);
  }

  return NextResponse.json({ ok: true });
}
