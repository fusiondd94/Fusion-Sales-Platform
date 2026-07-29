import Link from "next/link";
import { Inbox as InboxIcon, MessageCircle, Settings, ShieldAlert, Trash2 } from "lucide-react";
import { getInboxWorkspace, MessageChannelType, MessageThreadStatus } from "@/lib/messages";
import { MessageReplyForm } from "@/components/MessageReplyForm";
import { ChannelIcon, ChannelIconType } from "@/components/ChannelIcon";
import { InboxThreadActions } from "@/components/InboxThreadActions";
import { InboxAutoRefresh } from "@/components/InboxAutoRefresh";
import { EmptyState, formatDate, PageHeader } from "../crm-ui";

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  instagram: "Instagram"
};

const CHANNEL_FILTERS: Array<{ value: MessageChannelType | "all"; label: string; icon: ChannelIconType }> = [
  { value: "all", label: "All Inbox", icon: "all" },
  { value: "whatsapp", label: "WhatsApp", icon: "whatsapp" },
  { value: "messenger", label: "Messenger", icon: "messenger" },
  { value: "instagram", label: "Instagram", icon: "instagram" }
];

const FOLDER_TABS: Array<{ value: MessageThreadStatus; label: string; icon: typeof InboxIcon }> = [
  { value: "inbox", label: "Inbox", icon: InboxIcon },
  { value: "spam", label: "Spam", icon: ShieldAlert },
  { value: "trash", label: "Trash", icon: Trash2 }
];

function isChannelType(value: string | undefined): value is MessageChannelType {
  return value === "whatsapp" || value === "messenger" || value === "instagram";
}

function isFolder(value: string | undefined): value is MessageThreadStatus {
  return value === "inbox" || value === "spam" || value === "trash";
}

function buildHref(params: { folder: MessageThreadStatus; channel?: string; thread?: string }) {
  const search = new URLSearchParams();
  search.set("folder", params.folder);
  if (params.channel && params.channel !== "all") search.set("channel", params.channel);
  if (params.thread) search.set("thread", params.thread);
  return "/fusionadmin/messages?" + search.toString();
}

export default async function MessagesInboxPage({
  searchParams
}: {
  searchParams: Promise<{ thread?: string; channel?: string; folder?: string }>;
}) {
  const { thread, channel: channelParam, folder: folderParam } = await searchParams;
  const folder: MessageThreadStatus = isFolder(folderParam) ? folderParam : "inbox";
  const channel = isChannelType(channelParam) ? channelParam : undefined;

  const { threads, messages, activeThread, folderCounts, channelCounts } = await getInboxWorkspace(thread, {
    channelType: channel,
    folder
  });

  return (
    <div className="admin-content">
      <InboxAutoRefresh />
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

      <div className="inbox-folder-tabs">
        {FOLDER_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.value}
              className={"inbox-folder-tab" + (folder === tab.value ? " inbox-folder-tab--active" : "")}
              href={buildHref({ folder: tab.value, channel })}
            >
              <Icon size={15} /> {tab.label}
              <span className="inbox-folder-tab__count">{folderCounts[tab.value]}</span>
            </Link>
          );
        })}
      </div>

      <div className="inbox-channel-filters">
        {CHANNEL_FILTERS.map((item) => {
          const isActive = item.value === "all" ? !channel : channel === item.value;
          const count = item.value === "all" ? channelCounts.all : channelCounts[item.value as MessageChannelType];
          return (
            <Link
              key={item.value}
              className={"inbox-channel-chip" + (isActive ? " inbox-channel-chip--active" : "")}
              href={buildHref({ folder, channel: item.value })}
            >
              <ChannelIcon size={20} type={item.icon} />
              <span>{item.label}</span>
              <span className="inbox-channel-chip__count">{count}</span>
            </Link>
          );
        })}
      </div>

      <div className="inbox-layout">
        <aside className="inbox-thread-list">
          {threads.length ? (
            threads.map((item) => (
              <Link
                key={item.id}
                href={buildHref({ folder, channel, thread: item.id })}
                className={"inbox-thread-row" + (activeThread?.id === item.id ? " inbox-thread-row--active" : "")}
              >
                <div className="inbox-thread-row-top">
                  <span className="inbox-channel-badge">
                    <ChannelIcon size={16} type={item.channel_type as ChannelIconType} />
                    {CHANNEL_LABELS[item.channel_type] || item.channel_type}
                  </span>
                  {item.unread_count > 0 ? <span className="inbox-unread-badge">{item.unread_count}</span> : null}
                </div>
                <p className="inbox-thread-name">{item.contact_name || item.contact_handle || "Unknown contact"}</p>
                <p className="inbox-thread-preview muted">{item.last_message_preview || "No messages yet"}</p>
                {item.last_message_at ? <p className="muted inbox-thread-time">{formatDate(item.last_message_at)}</p> : null}
              </Link>
            ))
          ) : (
            <EmptyState>
              {folder === "inbox"
                ? "No conversations yet. Connect a channel and messages will show up here automatically."
                : "Nothing here right now."}
            </EmptyState>
          )}
        </aside>

        <section className="inbox-thread-view">
          {activeThread ? (
            <>
              <div className="inbox-thread-header">
                <div>
                  <h2>{activeThread.contact_name || activeThread.contact_handle || "Unknown contact"}</h2>
                  <span className="muted inbox-thread-header__meta">
                    <ChannelIcon size={16} type={activeThread.channel_type as ChannelIconType} />
                    {CHANNEL_LABELS[activeThread.channel_type] || activeThread.channel_type}
                    {activeThread.contact_handle ? " · " + activeThread.contact_handle : ""}
                  </span>
                </div>
                <InboxThreadActions
                  returnChannel={channel || ""}
                  returnFolder={folder}
                  status={activeThread.status}
                  threadId={activeThread.id}
                />
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
                      {message.status === "failed" ? " • Failed to send" : ""}
                    </span>
                  </div>
                ))}
              </div>

              {folder === "inbox" ? (
                <MessageReplyForm threadId={activeThread.id} />
              ) : (
                <p className="muted inbox-reply-disabled">
                  <MessageCircle size={14} /> Restore this conversation to Inbox to reply.
                </p>
              )}
            </>
          ) : (
            <EmptyState>Select a conversation from the list to see the full message history.</EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
