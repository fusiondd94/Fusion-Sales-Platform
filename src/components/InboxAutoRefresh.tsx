"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 6000;

/**
 * Keeps the inbox near-real-time without a full page reload: while the tab
 * is visible, it periodically asks Next.js to re-fetch the server-rendered
 * inbox data (new inbound messages arrive via the Meta/WhatsApp webhooks,
 * which write straight to Supabase - this just keeps what's on screen in
 * sync with that).
 */
export function InboxAutoRefresh() {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }

    intervalRef.current = setInterval(refreshIfVisible, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router]);

  return null;
}
