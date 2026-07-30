import { NextRequest, NextResponse } from "next/server";
import { requireFusionAdmin } from "@/lib/auth";

type MetaPageOption = {
  id: string;
  name: string;
  accessToken: string;
  instagram: { id: string; username: string } | null;
};

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
  const cookieState = request.cookies.get("meta_oauth_state")?.value;

  if (oauthError) {
    return NextResponse.redirect(`${settingsUrl}?metaError=${encodeURIComponent(oauthError)}`);
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(
      `${settingsUrl}?metaError=${encodeURIComponent("Facebook sign-in could not be verified. Please try connecting again.")}`
    );
  }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret || !appUrl) {
    return NextResponse.redirect(
      `${settingsUrl}?metaError=${encodeURIComponent("Meta App ID or App Secret is not configured on the server.")}`
    );
  }

  const redirectUri = `${appUrl}/api/oauth/meta/callback`;

  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`
    );
    const tokenPayload = await tokenRes.json();
    if (!tokenRes.ok || !tokenPayload?.access_token) {
      throw new Error(tokenPayload?.error?.message || "Unable to exchange the Facebook code for an access token.");
    }

    const longRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
        appId
      )}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(tokenPayload.access_token)}`
    );
    const longPayload = await longRes.json();
    const userToken = longPayload?.access_token || tokenPayload.access_token;

    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(
        userToken
      )}`
    );
    const pagesPayload = await pagesRes.json();
    if (!pagesRes.ok) {
      throw new Error(pagesPayload?.error?.message || "Unable to load your Facebook Pages.");
    }

    const rawPages = (pagesPayload?.data || []) as Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username?: string };
    }>;

    const pages: MetaPageOption[] = rawPages.map((page) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
      instagram: page.instagram_business_account
        ? { id: page.instagram_business_account.id, username: page.instagram_business_account.username || "" }
        : null
    }));

    if (!pages.length) {
      return NextResponse.redirect(
        `${settingsUrl}?metaError=${encodeURIComponent(
          "No Facebook Pages were found on that account. You need to be an admin of a Facebook Page to connect Messenger or Instagram."
        )}`
      );
    }

    const response = NextResponse.redirect(`${settingsUrl}?connect=1`);
    response.cookies.set("meta_oauth_pages", JSON.stringify(pages), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/"
    });
    response.cookies.set("meta_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    return NextResponse.redirect(
      `${settingsUrl}?metaError=${encodeURIComponent(
        error instanceof Error ? error.message : "Something went wrong connecting to Facebook."
      )}`
    );
  }
}
