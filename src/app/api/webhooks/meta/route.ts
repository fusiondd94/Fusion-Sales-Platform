import { NextRequest, NextResponse } from "next/server";
import { ingestInboundMessage, verifyChannelToken } from "@/lib/messages";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const matchesMessenger = await verifyChannelToken("messenger", token);
  const matchesInstagram = await verifyChannelToken("instagram", token);

  if (matchesMessenger || matchesInstagram) {
    return new NextResponse(challenge || "", { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

type MetaMessagingEvent = {
  sender?: { id?: string };
  message?: { mid?: string; text?: string; is_echo?: boolean };
};
type MetaEntry = { id?: string; messaging?: MetaMessagingEvent[] };

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: true });

  const channelType = payload.object === "instagram" ? "instagram" : "messenger";

  try {
    const entries = (payload.entry || []) as MetaEntry[];

    for (const entry of entries) {
      const pageId = String(entry.id || "");
      const messagingEvents = entry.messaging || [];

      for (const event of messagingEvents) {
        if (!event.message || event.message.is_echo) continue;
        const senderId = event.sender?.id;
        const text = event.message.text;
        if (!senderId || !text) continue;

        await ingestInboundMessage({
          channelType,
          externalAccountId: pageId,
          externalThreadId: String(senderId),
          externalMessageId: event.message.mid,
          body: text
        });
      }
    }
  } catch (error) {
    console.error("Meta webhook error", error);
  }

  return NextResponse.json({ ok: true });
}
