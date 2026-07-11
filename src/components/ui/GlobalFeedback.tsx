"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, WifiOff } from "lucide-react";

type FeedbackTone = "warning" | "success";

export function AdminFeedbackBoundary({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [recentlyRestored, setRecentlyRestored] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOffline() {
      setIsOnline(false);
      setRecentlyRestored(false);
    }

    function handleOnline() {
      setIsOnline(true);
      setRecentlyRestored(true);
      window.setTimeout(() => setRecentlyRestored(false), 4200);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return (
    <div
      onChangeCapture={(event) => {
        const target = event.target as HTMLElement | null;
        const form = target?.closest("form");
        if (form?.dataset.trackUnsaved === "true") setHasUnsavedChanges(true);
      }}
      onSubmitCapture={() => setHasUnsavedChanges(false)}
    >
      <div className="fusion-toast-region" aria-live="polite" aria-atomic="true">
        {!isOnline ? (
          <FeedbackToast
            description="Your connection is offline. Review your changes before submitting forms again."
            icon={<WifiOff size={18} />}
            tone="warning"
            title="Connection interrupted"
          />
        ) : null}
        {recentlyRestored ? (
          <FeedbackToast
            description="You are back online. You can continue working from the current page."
            icon={<CheckCircle2 size={18} />}
            tone="success"
            title="Connection restored"
          />
        ) : null}
        {hasUnsavedChanges ? (
          <FeedbackToast
            description="Save the form or close it before leaving this admin page."
            icon={<AlertTriangle size={18} />}
            tone="warning"
            title="Unsaved changes"
          />
        ) : null}
      </div>
      {children}
    </div>
  );
}

function FeedbackToast({
  description,
  icon,
  title,
  tone
}: {
  description: string;
  icon: ReactNode;
  title: string;
  tone: FeedbackTone;
}) {
  return (
    <section className={`fusion-toast fusion-toast--${tone}`}>
      <span aria-hidden="true">{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </section>
  );
}
