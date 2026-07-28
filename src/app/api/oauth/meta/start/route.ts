import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireFusionAdmin } from "@/lib/auth";

const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_messages",
  "business_management"
].join(",");

export async function GET() {
  const user = await requireFusionAdmin();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  if (!user.isAllowed) {
    return NextResponse.redirect(`${appUrl}/fusionadmin`);
  }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;

  if (!appId || !appUrl) {
    return NextResponse.redirect(
      `${appUrl}/fusionadmin/messages/settings?metaError=${encodeURIComponent(
        "Set NEXT_PUBLIC_META_APP_ID and NEXT_PUBLIC_APP_URL before connecting Facebook."
      )}`
    );
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${appUrl}/api/oauth/meta/callback`;

  const dialogUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  dialogUrl.searchParams.set("client_id", appId);
  dialogUrl.searchParams.set("redirect_uri", redirectUri);
  dialogUrl.searchParams.set("state", state);
  dialogUrl.searchParams.set("scope", META_OAUTH_SCOPES);
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
