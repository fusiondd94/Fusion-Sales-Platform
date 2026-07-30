import { NextRequest } from "next/server";
import { markEmailSendOpened } from "@/lib/email-marketing";

const TRANSPARENT_PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ sendId: string }> }) {
  const { sendId } = await params;
  if (sendId) {
    await markEmailSendOpened(sendId).catch(() => {});
  }

  return new Response(TRANSPARENT_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}
