/**
 * Minimal transactional email sender for Fusion CRM automations.
 * Uses Resend's HTTP API (no SDK dependency needed). Configure by setting:
 *   RESEND_API_KEY        - your Resend API key
 *   AUTOMATION_FROM_EMAIL - the "from" address (must be a verified Resend sender/domain)
 *
 * If those aren't set, sends are skipped gracefully (matches the rest of the
 * codebase's "not configured" pattern) so the rest of an automation still runs.
 */
export async function sendCrmEmail(input: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTOMATION_FROM_EMAIL;

  if (!apiKey || !from) {
    console.info("Email sending is not configured (RESEND_API_KEY / AUTOMATION_FROM_EMAIL missing).", { to: input.to, subject: input.subject });
    return { ok: false, error: "Email sending is not configured yet. Add RESEND_API_KEY and AUTOMATION_FROM_EMAIL in your environment variables." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html
      })
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: `Email provider error (${response.status}): ${body.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to send email." };
  }
}
