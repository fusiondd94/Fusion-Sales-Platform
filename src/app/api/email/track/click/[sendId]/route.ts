import { NextRequest, NextResponse } from "next/server";
import { markEmailSendClicked } from "@/lib/email-marketing";

export async function GET(req: NextRequest, { params }: { params: Promise<{ sendId: string }> }) {
  const { sendId } = await params;
  const target = req.nextUrl.searchParams.get("u") || "/";

  if (sendId) {
    await markEmailSendClicked(sendId).catch(() => {});
  }

  let destination = target;
  try {
    const parsed = new URL(target);
    destination = parsed.toString();
  } catch {
    destination = "/";
  }

  return NextResponse.redirect(destination, { status: 302 });
}
