"use client";

import { ErrorState } from "@/components/ui";

export default function FusionAdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="admin-content">
      <ErrorState
        title="Admin workspace could not refresh"
        description="Your session is still protected. Try again, then review Vercel or Supabase logs if the problem continues."
        action={<button className="fusion-button fusion-button--primary" onClick={reset} type="button">Retry workspace</button>}
      />
    </div>
  );
}
