import Link from "next/link";
import { cookies } from "next/headers";
import { CheckCircle2, ExternalLink, History, LogIn, MessageCircle, ShieldCheck } from "lucide-react";
import { getMessagingWorkspace } from "@/lib/messages";
import { MessageChannelForm } from "@/components/MessageChannelForm";
import { ChannelIcon } from "@/components/ChannelIcon";
import { PageHeader } from "@/app/fusionadmin/(admin)/crm-ui";
import { FormError } from "@/components/ui";
import { cancelMetaConnect, connectMetaPage, syncFusionMessageChannelHistory } from "@/app/fusionadmin/actions";

type MetaPageOption = {
  id: string;
  name: string;
  accessToken: string;
  instagram: { id: string; username: string } | null;
};

export default async function MessageSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ connect?: string; metaError?: string; synced?: string; syncError?: string }>;
}) {
  const { channels } = await getMessagingWorkspace();
  const { connect, metaError, synced, syncError } = await searchParams;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  function webhookUrlFor(channelType: string) {
    if (!appUrl) return "Set NEXT_PUBLIC_APP_URL to see your webhook URL";
    return appUrl + (channelType === "whatsapp" ? "/api/webhooks/whatsapp" : "/api/webhooks/meta");
  }

  let pendingPages: MetaPageOption[] = [];
  if (connect === "1") {
    const cookieStore = await cookies();
    const raw = cookieStore.get("meta_oauth_pages")?.value;
    if (raw) {
      try {
        pendingPages = JSON.parse(raw) as MetaPageOption[];
      } catch {
        pendingPages = [];
      }
    }
  }

  const syncableChannels = channels.filter(
    (channel) => (channel.channel_type === "messenger" || channel.channel_type === "instagram") && channel.status === "connected"
  );

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Messaging"
        title="Channel connections"
        description="Connect Facebook and Instagram to receive and reply to messages from one inbox."
        action={
          <Link className="secondary-button compact-button" href="/fusionadmin/messages">
            <MessageCircle size={16} /> Go to inbox
          </Link>
        }
      />

      <FormError message={metaError} />
      <FormError message={syncError} />

      {synced !== undefined ? (
        <p className="fusion-form-success" role="status">
          <CheckCircle2 aria-hidden="true" size={16} />
          <span>
            {Number(synced) > 0
              ? `Imported ${synced} message${Number(synced) === 1 ? "" : "s"} from your existing conversation history.`
              : "No new messages found to import — you're already up to date."}
          </span>
        </p>
      ) : null}

      <div className="meta-connect-card">
        <div className="meta-connect-card__copy">
          <span className="meta-connect-card__icon">
            <LogIn size={20} />
          </span>
          <div>
            <h3>Connect with Facebook</h3>
            <p className="muted">
              Sign in with your Facebook account to link a Page for Messenger and its connected Instagram account.
              Your password stays on Facebook &mdash; this app only receives a secure access token, the same way
              &quot;Login with Facebook&quot; works on any site.
            </p>
          </div>
        </div>
        <a className="primary-button compact-button" href="/api/oauth/meta/start">
          <LogIn size={16} /> Connect with Facebook
        </a>
      </div>

      {pendingPages.length ? (
        <div className="admin-panel meta-page-picker">
          <div className="meta-page-picker__header">
            <ShieldCheck size={18} />
            <div>
              <h3>Choose a Page to connect</h3>
              <p className="muted">
                We found {pendingPages.length} Facebook Page{pendingPages.length === 1 ? "" : "s"} you manage. Pick
                the one to use for Messenger{pendingPages.some((page) => page.instagram) ? " and Instagram" : ""}.
              </p>
            </div>
          </div>

          <div className="meta-page-picker__list">
            {pendingPages.map((page) => (
              <form action={connectMetaPage} className="meta-page-option" key={page.id}>
                <input name="pageId" type="hidden" value={page.id} />
                <input name="pageName" type="hidden" value={page.name} />
                <input name="pageToken" type="hidden" value={page.accessToken} />
                {page.instagram ? (
                  <>
                    <input name="igId" type="hidden" value={page.instagram.id} />
                    <input name="igUsername" type="hidden" value={page.instagram.username} />
                  </>
                ) : null}

                <div className="meta-page-option__info">
                  <strong>{page.name}</strong>
                  <span className="muted">
                    {page.instagram
                      ? `Messenger + Instagram @${page.instagram.username}`
                      : "Messenger only — no linked Instagram account"}
                  </span>
                </div>
                <button className="primary-button compact-button" type="submit">
                  Connect
                </button>
              </form>
            ))}
          </div>

          <form action={cancelMetaConnect}>
            <button className="ghost-button compact-button" type="submit">
              Cancel
            </button>
          </form>
        </div>
      ) : null}

      {syncableChannels.length ? (
        <div className="admin-panel meta-sync-panel">
          <div className="meta-sync-panel__header">
            <History size={18} />
            <div>
              <h3>Import existing conversations</h3>
              <p className="muted">
                Pull in messages that were already sent on Facebook or Instagram before you connected this inbox.
              </p>
            </div>
          </div>
          <div className="meta-sync-panel__actions">
            {syncableChannels.map((channel) => (
              <form action={syncFusionMessageChannelHistory} key={channel.channel_type}>
                <input name="channelType" type="hidden" value={channel.channel_type} />
                <button className="secondary-button compact-button" type="submit">
                  <History size={16} /> Sync {channel.channel_type === "messenger" ? "Messenger" : "Instagram"} history
                </button>
              </form>
            ))}
          </div>
        </div>
      ) : null}

      <div className="admin-panel whatsapp-guide-card">
        <div className="whatsapp-guide-card__header">
          <span className="whatsapp-guide-card__icon">
            <ChannelIcon size={30} type="whatsapp" />
          </span>
          <div>
            <h3>Connect WhatsApp</h3>
            <p className="muted">
              WhatsApp doesn&apos;t support one-click Facebook login like Messenger and Instagram &mdash; grab three
              values from Meta&apos;s dashboard and paste them into the WhatsApp card below.
            </p>
          </div>
        </div>
        <ol className="whatsapp-guide-card__steps">
          <li>
            Open{" "}
            <a href="https://developers.facebook.com/apps" rel="noreferrer" target="_blank">
              Meta for Developers <ExternalLink size={12} />
            </a>{" "}
            and select this app.
          </li>
          <li>
            In the left sidebar, go to <strong>WhatsApp &rarr; API Setup</strong>.
          </li>
          <li>
            Copy the <strong>Phone number ID</strong> and <strong>WhatsApp Business Account ID</strong> shown there.
          </li>
          <li>
            Under &quot;Temporary access token,&quot; click <strong>Generate</strong>. For a token that doesn&apos;t
            expire every 24 hours, create a permanent one instead via <strong>System Users</strong> in Business
            Settings.
          </li>
          <li>Paste all three values into the WhatsApp card below and click Save.</li>
        </ol>
      </div>

      <p className="meta-connect-note muted">Prefer to paste tokens manually for Messenger or Instagram instead? Use the advanced setup below.</p>

      <div className="message-channel-grid">
        {channels.map((channel) => (
          <MessageChannelForm key={channel.channel_type} channel={channel} webhookUrl={webhookUrlFor(channel.channel_type)} />
        ))}
      </div>
    </div>
  );
}
