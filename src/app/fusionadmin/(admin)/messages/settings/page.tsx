import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { getMessagingWorkspace } from "@/lib/messages";
import { MessageChannelForm } from "@/components/MessageChannelForm";
import { PageHeader } from "@/app/fusionadmin/(admin)/crm-ui";

export default async function MessageSettingsPage() {
  const { channels } = await getMessagingWorkspace();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  function webhookUrlFor(channelType: string) {
    if (!appUrl) return "Set NEXT_PUBLIC_APP_URL to see your webhook URL";
    return appUrl + (channelType === "whatsapp" ? "/api/webhooks/whatsapp" : "/api/webhooks/meta");
  }

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Messaging"
        title="Channel connections"
        description="Connect WhatsApp, Messenger, and Instagram to receive and reply to messages from one inbox."
        action={
          <Link className="secondary-button compact-button" href="/fusionadmin/messages">
            <MessageCircle size={16} /> Go to inbox
          </Link>
        }
      />

      <div className="message-channel-grid">
        {channels.map((channel) => (
          <MessageChannelForm key={channel.channel_type} channel={channel} webhookUrl={webhookUrlFor(channel.channel_type)} />
        ))}
      </div>
    </div>
  );
}
