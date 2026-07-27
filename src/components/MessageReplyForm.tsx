"use client";

import { useActionState } from "react";
import { sendFusionMessage } from "@/app/fusionadmin/actions";
import { FormError, SubmitButton } from "@/components/ui";

export function MessageReplyForm({ threadId }: { threadId: string }) {
  const [state, formAction] = useActionState(sendFusionMessage, undefined);

  return (
    <form action={formAction} className="inbox-reply-form">
      <input type="hidden" name="threadId" value={threadId} />
      <textarea name="body" placeholder="Write a reply..." rows={2} required />
      <div className="inbox-reply-actions">
        <SubmitButton pendingLabel="Sending...">Send</SubmitButton>
      </div>
      <FormError message={state?.error} />
    </form>
  );
}
