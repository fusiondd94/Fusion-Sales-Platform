import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="state-shell">
      <EmptyState
        title="Page not found"
        description="This page may have moved, or the address may be incomplete."
        action={<Link className="fusion-button fusion-button--primary" href="/">Go to sales site</Link>}
      />
    </main>
  );
}
