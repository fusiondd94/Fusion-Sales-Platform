import { NextRequest, NextResponse } from "next/server";
import { requireFusionAdmin } from "@/lib/auth";
import { saveMessageChannel } from "@/lib/messages";

type GranularScope = { scope: string; target_ids?: string[] };

export async function GET(request: NextRequest) {
  const user = await requireFusionAdmin();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  if (!user.isAllowed) {
    return NextResponse.redirect(`${appUrl}/fusionadmin`);
  }

  const settingsUrl = `${appUrl}/fusionadmin/settings/connections`;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error_description") || searchParams.get("error");
  const cookieState = request.cookies.get("whatsapp_oauth_state")?.value;

  if (oauthError) {
    return NextResponse.redirect(`${settingsUrl}?metaError=${encodeURIComponent(oauthError)}`);
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(
      `${settingsUrl}?metaError=${encodeURIComponent("WhatsApp sign-in could not be verified. Please try connecting again.")}`
    );
  }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret || !appUrl) {
    return NextResponse.redirect(
      `${settingsUrl}?metaError=${encodeURIComponent("Meta App ID or App Secret is not configured on the server.")}`
    );
  }

  const redirectUri = `${appUrl}/api/oauth/whatsapp/callback`;

  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`
    );
    const tokenPayload = await tokenRes.json();
    if (!tokenRes.ok || !tokenPayload?.access_token) {
      throw new Error(tokenPayload?.error?.message || "Unable to exchange the WhatsApp sign-in code for an access token.");
    }
    const accessToken = tokenPayload.access_token as string;

    // Inspect what this token was actually granted access to, so we can find
    // the WhatsApp Business Account id without needing a popup/postMessage.
    const debugRes = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(
        appId + "|" + appSecret
      )}`
    );
    const debugPayload = await debugRes.json();
    const granularScopes = (debugPayload?.data?.granular_scopes || []) as GranularScope[];
    const wabaScope = granularScopes.find(
      (entry) => entry.scope === "whatsapp_business_management" || entry.scope === "whatsapp_business_messaging"
    );
    const wabaId = wabaScope?.target_ids?.[0];

    if (!wabaId) {
      return NextResponse.redirect(
        `${settingsUrl}?metaError=${encodeURIComponent(
          "Meta didn't grant access to a WhatsApp Business Account. Try again and make sure you pick or verify a phone number before finishing."
        )}`
      );
    }

    const phoneRes = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${encodeURIComponent(accessToken)}`
    );
    const phonePayload = await phoneRes.json();
    const phoneNumber = ((phonePayload?.data || []) as Array<{ id: string; display_phone_number?: string; verified_name?: string }>)[0];

    if (!phoneNumber?.id) {
      return NextResponse.redirect(
        `${settingsUrl}?metaError=${encodeURIComponent(
          "That WhatsApp Business Account doesn't have a phone number set up yet. Add one in Meta's WhatsApp Manager, then reconnect."
        )}`
      );
    }

    try {
      await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps?access_token=${encodeURIComponent(accessToken)}`, {
        method: "POST"
      });
    } catch {
      // Non-fatal: the channel is still saved even if the webhook subscription call fails.
    }

    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const result = await saveMessageChannel({
      actorId: user.id,
      channelType: "whatsapp",
      displayName: phoneNumber.verified_name || phoneNumber.display_phone_number || "WhatsApp",
      externalAccountId: phoneNumber.id,
      credentials: {
        phoneNumberId: phoneNumber.id,
        wabaId,
        accessToken,
        tokenExpiresAt: expiresAt,
        connectionMethod: "embedded_signup_redirect"
      }
    });

    if (result.error) {
      return NextResponse.redirect(`${settingsUrl}?metaError=${encodeURIComponent(result.error)}`);
    }

    const response = NextResponse.redirect(`${settingsUrl}?whatsappConnected=1`);
    response.cookies.set("whatsapp_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    return NextResponse.redirect(
      `${settingsUrl}?metaError=${encodeURIComponent(error instanceof Error ? error.message : "Something went wrong connecting WhatsApp.")}`
    );
  }
}
