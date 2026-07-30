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
  const configId = process.env.META_LOGIN_CONFIG_ID;

  if (!appId || !appUrl || !configId) {
    return NextResponse.redirect(
      `${appUrl}/fusionadmin/settings/connections?metaError=${encodeURIComponent(
        "Set NEXT_PUBLIC_META_APP_ID, META_LOGIN_CONFIG_ID, and NEXT_PUBLIC_APP_URL before connecting Facebook."
      )}`
    );
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${appUrl}/api/oauth/meta/callback`;

  const dialogUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  dialogUrl.searchParams.set("client_id", appId);
  dialogUrl.searchParams.set("redirect_uri", redirectUri);
  dialogUrl.searchParams.set("state", state);
  dialogUrl.searchParams.set("config_id", configId);
  dialogUrl.searchParams.set("response_type", "code");

  const response = NextResponse.redirect(dialogUrl.toString());
  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/"
  });
  return response;
}
