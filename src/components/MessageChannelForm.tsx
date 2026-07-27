"use client";

import { useActionState } from "react";
import { disconnectFusionMessageChannel, saveFusionMessageChannel } from "@/app/fusionadmin/actions";
import { FormError, SubmitButton } from "@/components/ui";
import type { MessageChannel } from "@/lib/messages";

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  instagram: "Instagram"
};

export function MessageChannelForm({ channel, webhookUrl }: { channel: MessageChannel; webhookUrl: string }) {
  const [state, formAction] = useActionState(saveFusionMessageChannel, undefined);
  const label = CHANNEL_LABELS[channel.channel_type] || channel.channel_type;
  const statusClass =
    channel.status === "connected" ? "status-pill-ok" : channel.status === "error" ? "status-pill-error" : "status-pill-muted";

  return (
    <div className="message-channel-card">
      <div className="message-channel-header">
        <h3>{label}</h3>
        <span className={"status-pill " + statusClass}>{channel.status}</span>
      </div>

      {channel.last_error ? <p className="fusion-form-error">{channel.last_error}</p> : null}

      <div className="message-channel-webhook">
        <label>
          Webhook URL
          <input readOnly value={webhookUrl} onFocus={(event) => event.target.select()} />
        </label>
        <label>
          Verify token
          <input readOnly value={channel.verify_token} onFocus={(event) => event.target.select()} />
        </label>
      </div>

      <form action={formAction} className="message-channel-form">
        <input type="hidden" name="channelType" value={channel.channel_type} />
        <label>
          Display name
          <input name="displayName" defaultValue={channel.display_name} placeholder={label} />
        </label>

        {channel.channel_type === "whatsapp" ? (
          <>
            <label>
              Phone number ID
              <input name="phoneNumberId" defaultValue={channel.external_account_id || ""} placeholder="1234567890" />
            </label>
            <label>
              WhatsApp Business Account ID (optional)
              <input name="wabaId" defaultValue={channel.credentials.wabaId || ""} placeholder="1234567890" />
            </label>
            <label>
              Access token
              <input name="accessToken" type="password" placeholder={channel.credentials.accessToken ? "Already saved \u2014 leave blank to keep" : "Paste access token"} />
            </label>
          </>
        ) : null}

        {channel.channel_type === "messenger" ? (
          <>
            <label>
              Page ID
              <input name="pageId" defaultValue={channel.external_account_id || ""} placeholder="1234567890" />
            </label>
            <label>
              Page access token
              <input name="accessToken" type="password" placeholder={channel.credentials.accessToken ? "Already saved \u2014 leave blank to keep" : "Paste page access token"} />
            </label>
          </>
        ) : null}

        {channel.channel_type === "instagram" ? (
          <>
            <label>
              Instagram account ID
              <input name="igAccountId" defaultValue={channel.external_account_id || ""} placeholder="1234567890" />
            </label>
            <label>
              Access token
              <input name="accessToken" type="password" placeholder={channel.credentials.accessToken ? "Already saved \u2014 leave blank to keep" : "Paste access token"} />
            </label>
          </>
        ) : null}

        <div className="message-channel-actions">
          <SubmitButton pendingLabel="Saving...">Save</SubmitButton>
        </div>
        <FormError message={state?.error} />
      </form>

      {channel.status !== "disconnected" ? (
        <form action={disconnectFusionMessageChannel}>
          <input type="hidden" name="channelType" value={channel.channel_type} />
          <button className="ghost-button compact-button" type="submit">Disconnect</button>
        </form>
      ) : null}
    </div>
  );
}
