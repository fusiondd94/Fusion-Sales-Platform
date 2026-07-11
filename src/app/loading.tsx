import { LoadingState } from "@/components/ui";

export default function Loading() {
  return (
    <main className="state-shell">
      <LoadingState
        title="Loading Fusion"
        description="Preparing the latest workspace for you."
      />
    </main>
  );
}
