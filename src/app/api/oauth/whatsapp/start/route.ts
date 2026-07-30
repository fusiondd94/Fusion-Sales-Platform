import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireFusionAdmin } from "@/lib/auth";

export async function GET() {
  const user = await requireFusionAdmin();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  if (!user.isAllowed) {
    return NextResponse.redirect(`${appUrl}/fusionadmin`);
  }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID;

  if (!appId || !appUrl || !configId) {
    return NextResponse.redirect(
      `${appUrl}/fusionadmin/settings/connections?metaError=${encodeURIComponent(
        "Set NEXT_PUBLIC_META_APP_ID, NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID, and NEXT_PUBLIC_APP_URL before connecting WhatsApp."
      )}`
    );
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${appUrl}/api/oauth/whatsapp/callback`;

  // "extras" tells Meta's OAuth dialog to render the WhatsApp Embedded Signup
  // wizard (pick/verify a phone number) instead of a plain permission screen.
  // This is the same payload the Facebook JS SDK sends internally when you
  // call FB.login with these options — sending it directly on the OAuth
  // dialog URL works without the SDK and without a popup.
  const extras = JSON.stringify({ setup: {}, featureType: "", sessionInfoVersion: "3" });

  const dialogUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  dialogUrl.searchParams.set("client_id", appId);
  dialogUrl.searchParams.set("redirect_uri", redirectUri);
  dialogUrl.searchParams.set("state", state);
  dialogUrl.searchParams.set("config_id", configId);
  dialogUrl.searchParams.set("response_type", "code");
  dialogUrl.searchParams.set("extras", extras);

  const response = NextResponse.redirect(dialogUrl.toString());
  response.cookies.set("whatsapp_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/"
  });
  return response;
}
