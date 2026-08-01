"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, LogIn, Loader2 } from "lucide-react";
import { connectWhatsAppEmbeddedSignup } from "@/app/fusionadmin/actions";

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        options: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const SDK_LOAD_TIMEOUT_MS = 8000;

type SdkState = "loading" | "ready" | "blocked";
type SignupStatus = "idle" | "waiting" | "connecting" | "success" | "error";

export function WhatsAppEmbeddedSignup({ appId, configId }: { appId: string; configId: string }) {
  const router = useRouter();
  const [sdkState, setSdkState] = useState<SdkState>("loading");
  const [status, setStatus] = useState<SignupStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const signupDataRef = useRef<{ phoneNumberId?: string; wabaId?: string; isCoexistence?: boolean }>({});

  // Preload the Facebook SDK as soon as this card mounts, well before the user
  // clicks anything. If we wait until the click handler to load it, the
  // browser sees a gap between the click and the popup opening and silently
  // blocks the popup as if it were an unrequested ad.
  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled && !window.FB) setSdkState("blocked");
    }, SDK_LOAD_TIMEOUT_MS);

    if (window.FB) {
      setSdkState("ready");
      clearTimeout(timeoutId);
      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
      };
    }

    window.fbAsyncInit = function () {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: "v21.0" });
      if (!cancelled) {
        setSdkState("ready");
        clearTimeout(timeoutId);
      }
    };

    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = SDK_SRC;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        if (!cancelled) setSdkState("blocked");
      };
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [appId]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;

      let data: any = event.data;
      try {
        if (typeof data === "string") data = JSON.parse(data);
      } catch {
        return;
      }

      if (!data || data.type !== "WA_EMBEDDED_SIGNUP") return;

      if (data.event === "FINISH" || String(data.event || "").startsWith("FINISH")) {
        signupDataRef.current = {
          phoneNumberId: data.data?.phone_number_id,
          wabaId: data.data?.waba_id,
          isCoexistence: data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
        };
      }

      if (data.event === "CANCEL") {
        setStatus("error");
        setError("WhatsApp setup was closed before it finished. Try again and complete every step in the popup.");
      }

      if (data.event === "ERROR") {
        setStatus("error");
        setError(data.data?.error_message || "Something went wrong during WhatsApp setup.");
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function handleConnect() {
    setError(null);
    signupDataRef.current = {};

    if (!window.FB) {
      setSdkState("blocked");
      setStatus("error");
      setError(
        "Facebook's login popup was blocked before it could open. This is almost always an ad blocker or privacy extension (uBlock Origin, Brave Shields, tracking protection) blocking connect.facebook.net — turn that off for this page, or allow pop-ups for this site, then try again."
      );
      return;
    }

    // Calling FB.login here, synchronously inside the click handler with no
    // await before it, is what keeps the browser's popup blocker from
    // stepping in.
    setStatus("waiting");
    window.FB.login(
      async (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setStatus("error");
          setError("WhatsApp setup was cancelled or the popup was blocked. Check your browser's pop-up blocker and try again.");
          return;
        }

        setStatus("connecting");
        const { phoneNumberId, wabaId, isCoexistence } = signupDataRef.current;
        const result = await connectWhatsAppEmbeddedSignup({ code, phoneNumberId, wabaId, isCoexistence });

        if (!result.ok) {
          setStatus("error");
          setError(result.error || "Unable to finish connecting WhatsApp.");
          return;
        }

        setStatus("success");
        router.refresh();
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3"
        }
      }
    );
  }

  const busy = status === "waiting" || status === "connecting";

  return (
    <div className="whatsapp-embedded-signup">
      <button className="primary-button compact-button" disabled={busy} onClick={handleConnect} type="button">
        {status === "connecting" ? (
          <>
            <Loader2 className="spin" size={16} /> Finishing setup...
          </>
        ) : status === "waiting" ? (
          <>
            <Loader2 className="spin" size={16} /> Waiting for Facebook...
          </>
        ) : (
          <>
            <LogIn size={16} /> Connect WhatsApp with Facebook
          </>
        )}
      </button>

      {sdkState === "blocked" && status !== "error" ? (
        <p className="whatsapp-expiry-warning" role="status">
          <AlertTriangle aria-hidden="true" size={16} />
          <span>
            Facebook&apos;s login SDK didn&apos;t load — an ad blocker or privacy extension may be blocking
            connect.facebook.net. Disable it for this page, or allow pop-ups for this site, then try the button
            again.
          </span>
        </p>
      ) : null}

      {status === "success" ? (
        <p className="fusion-form-success" role="status">
          <CheckCircle2 aria-hidden="true" size={16} />
          <span>WhatsApp connected.</span>
        </p>
      ) : null}

      {error ? <p className="fusion-form-error">{error}</p> : null}
    </div>
  );
}
