"use client";

import { AlertOctagon, ArchiveRestore, Inbox, Trash2 } from "lucide-react";
import { deleteFusionThreadForever, moveFusionThreadFolder } from "@/app/fusionadmin/actions";
import type { MessageThreadStatus } from "@/lib/messages";

export function InboxThreadActions({
  threadId,
  status,
  returnFolder,
  returnChannel
}: {
  threadId: string;
  status: MessageThreadStatus;
  returnFolder: MessageThreadStatus;
  returnChannel: string;
}) {
  return (
    <div className="inbox-thread-actions">
      {status !== "spam" ? (
        <form action={moveFusionThreadFolder}>
          <input name="threadId" type="hidden" value={threadId} />
          <input name="newFolder" type="hidden" value="spam" />
          <input name="returnFolder" type="hidden" value={returnFolder} />
          <input name="returnChannel" type="hidden" value={returnChannel} />
          <button className="ghost-button compact-button" title="Mark as spam" type="submit">
            <AlertOctagon size={15} /> Spam
          </button>
        </form>
      ) : null}

      {status !== "trash" ? (
        <form action={moveFusionThreadFolder}>
          <input name="threadId" type="hidden" value={threadId} />
          <input name="newFolder" type="hidden" value="trash" />
          <input name="returnFolder" type="hidden" value={returnFolder} />
          <input name="returnChannel" type="hidden" value={returnChannel} />
          <button className="ghost-button compact-button" title="Move to trash" type="submit">
            <Trash2 size={15} /> Trash
          </button>
        </form>
      ) : null}

      {status !== "inbox" ? (
        <form action={moveFusionThreadFolder}>
          <input name="threadId" type="hidden" value={threadId} />
          <input name="newFolder" type="hidden" value="inbox" />
          <input name="returnFolder" type="hidden" value={returnFolder} />
          <input name="returnChannel" type="hidden" value={returnChannel} />
          <button className="ghost-button compact-button" title="Restore to inbox" type="submit">
            <Inbox size={15} /> Restore
          </button>
        </form>
      ) : null}

      {status === "trash" ? (
        <form
          action={deleteFusionThreadForever}
          onSubmit={(event) => {
            if (!window.confirm("Permanently delete this conversation and all its messages? This can't be undone.")) {
              event.preventDefault();
            }
          }}
        >
          <input name="threadId" type="hidden" value={threadId} />
          <input name="returnChannel" type="hidden" value={returnChannel} />
          <button className="ghost-button compact-button inbox-thread-actions__danger" title="Delete forever" type="submit">
            <Trash2 size={15} /> Delete forever
          </button>
        </form>
      ) : null}
    </div>
  );
}
