import Link from "next/link";
import { MessageCircle, Settings } from "lucide-react";
import { getInboxWorkspace } from "@/lib/messages";
import { MessageReplyForm } from "@/components/MessageReplyForm";
import { EmptyState, formatDate, PageHeader } from "../crm-ui";

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  instagram: "Instagram"
};

export default async function MessagesInboxPage({
  searchParams
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const { thread } = await searchParams;
  const { threads, messages, activeThread } = await getInboxWorkspace(thread);

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Messaging"
        title="Inbox"
        description="WhatsApp, Messenger, and Instagram conversations in one place."
        action={
          <Link className="secondary-button compact-button" href="/fusionadmin/messages/settings">
            <Settings size={16} /> Channel settings
          </Link>
        }
      />

      <div className="inbox-layout">
        <aside className="inbox-thread-list">
          {threads.length ? (
            threads.map((item) => (
              <Link
                key={item.id}
                href={"/fusionadmin/messages?thread=" + item.id}
                className={"inbox-thread-row" + (activeThread?.id === item.id ? " inbox-thread-row--active" : "")}
              >
                <div className="inbox-thread-row-top">
                  <span className="inbox-channel-badge">{CHANNEL_LABELS[item.channel_type] || item.channel_type}</span>
                  {item.unread_count > 0 ? <span className="inbox-unread-badge">{item.unread_count}</span> : null}
                </div>
                <p className="inbox-thread-name">{item.contact_name || item.contact_handle || "Unknown contact"}</p>
                <p className="inbox-thread-preview muted">{item.last_message_preview || "No messages yet"}</p>
                {item.last_message_at ? <p className="muted inbox-thread-time">{formatDate(item.last_message_at)}</p> : null}
              </Link>
            ))
          ) : (
            <EmptyState>No conversations yet. Connect a channel and messages will show up here automatically.</EmptyState>
          )}
        </aside>

        <section className="inbox-thread-view">
          {activeThread ? (
            <>
              <div className="inbox-thread-header">
                <h2>{activeThread.contact_name || activeThread.contact_handle || "Unknown contact"}</h2>
                <span className="muted">
                  {CHANNEL_LABELS[activeThread.channel_type] || activeThread.channel_type}
                  {activeThread.contact_handle ? " \u00b7 " + activeThread.contact_handle : ""}
                </span>
              </div>

              <div className="inbox-message-list">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      "inbox-message-bubble " +
                      (message.direction === "outbound" ? "inbox-message-bubble--outbound" : "inbox-message-bubble--inbound")
                    }
                  >
                    <p>{message.body}</p>
                    <span className="muted inbox-message-time">
                      {formatDate(message.created_at)}
                      {message.status === "failed" ? " \u2022 Failed to send" : ""}
                    </span>
                  </div>
                ))}
              </div>

              <MessageReplyForm threadId={activeThread.id} />
            </>
          ) : (
            <EmptyState>Select a conversation from the list to see the full message history.</EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
