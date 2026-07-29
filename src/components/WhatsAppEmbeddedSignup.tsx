"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogIn, Loader2 } from "lucide-react";
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

type SignupStatus = "idle" | "loading-sdk" | "waiting" | "connecting" | "success" | "error";

export function WhatsAppEmbeddedSignup({ appId, configId }: { appId: string; configId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<SignupStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const signupDataRef = useRef<{ phoneNumberId?: string; wabaId?: string }>({});

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
          wabaId: data.data?.waba_id
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

  const loadSdk = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (window.FB) {
        resolve();
        return;
      }

      window.fbAsyncInit = function () {
        window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: "v21.0" });
        resolve();
      };

      if (document.getElementById("facebook-jssdk")) return;

      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = SDK_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    });
  }, [appId]);

  async function handleConnect() {
    setError(null);
    setStatus("loading-sdk");
    signupDataRef.current = {};

    await loadSdk();
    setStatus("waiting");

    window.FB?.login(
      async (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setStatus("error");
          setError("WhatsApp setup was cancelled.");
          return;
        }

        setStatus("connecting");
        const { phoneNumberId, wabaId } = signupDataRef.current;
        const result = await connectWhatsAppEmbeddedSignup({ code, phoneNumberId, wabaId });

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
          featureType: "",
          sessionInfoVersion: "3"
        }
      }
    );
  }

  const busy = status === "loading-sdk" || status === "waiting" || status === "connecting";

  return (
    <div className="whatsapp-embedded-signup">
      <button className="primary-button compact-button" disabled={busy} onClick={handleConnect} type="button">
        {status === "connecting" ? (
          <>
            <Loader2 className="spin" size={16} /> Finishing setup...
          </>
        ) : status === "loading-sdk" || status === "waiting" ? (
          <>
            <Loader2 className="spin" size={16} /> Opening Facebook...
          </>
        ) : (
          <>
            <LogIn size={16} /> Connect WhatsApp with Facebook
          </>
        )}
      </button>

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
