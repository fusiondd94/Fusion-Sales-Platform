"use client";

import { ErrorState } from "@/components/ui";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="state-shell">
      <ErrorState
        title="We could not load this page"
        description="Refresh the page and try again. If the issue continues, check the latest deployment logs before retrying sensitive actions."
        action={<button className="fusion-button fusion-button--primary" onClick={reset} type="button">Try again</button>}
      />
    </main>
  );
}
