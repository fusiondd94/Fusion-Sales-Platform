import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { fulfillOrderPayment, getOrderSummaryByCheckoutSessionId } from "@/lib/sales-orders";
import { getFusionAdminSettings } from "@/lib/crm";
import "@/app/results/[token]/results.css";

export const metadata = {
  title: "Payment received | Fusion Digital Dynamics",
  description: "Your payment was received. Here's what happens next."
};

export default async function OrderSuccessPage({
  searchParams
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const admin = await getFusionAdminSettings();
  const logoUrl = admin.settings?.logo_url;

  if (!sessionId) {
    return (
      <main className="shell shell-light questionnaire-page">
        <nav className="nav">
          <a className="brand" href="/">
            {logoUrl ? <img alt="Brand logo" className="brand-mark brand-mark--logo" src={logoUrl} /> : <span className="brand-mark">FDD</span>}
            <span>Fusion Digital Dynamics</span>
          </a>
        </nav>
        <div className="section questionnaire-container">
          <section className="flow-panel">
            <p className="eyebrow">Fusion Digital Dynamics</p>
            <h2>We couldn&apos;t find that payment.</h2>
            <p className="muted">If you just paid, check your email for a receipt, or reach out and we&apos;ll confirm it manually.</p>
          </section>
        </div>
      </main>
    );
  }

  const stripe = getStripe();
  let paymentConfirmed = false;
  let customerEmail: string | null = null;

  if (stripe) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid" || session.status === "complete") {
        paymentConfirmed = true;
        customerEmail = session.customer_details?.email || null;
        // Independently fulfill here so payment capture never depends on
        // webhook delivery timing - fulfillOrderPayment is idempotent, so
        // this is safe even if the webhook already ran (or runs moments
        // after this page loads).
        await fulfillOrderPayment(session as Stripe.Checkout.Session);
      }
    } catch {
      paymentConfirmed = false;
    }
  }

  const summary = await getOrderSummaryByCheckoutSessionId(sessionId);
  const remainingCents = summary ? Math.max(summary.totalAmountCents - summary.amountPaidCents, 0) : 0;

  return (
    <main className="shell shell-light questionnaire-page">
      <nav className="nav">
        <a className="brand" href="/">
          {logoUrl ? <img alt="Brand logo" className="brand-mark brand-mark--logo" src={logoUrl} /> : <span className="brand-mark">FDD</span>}
          <span>Fusion Digital Dynamics</span>
        </a>
      </nav>
      <div className="section questionnaire-container">
        <section className="flow-panel questionnaire-complete">
          <p className="eyebrow">Fusion Digital Dynamics</p>
          <h2>{paymentConfirmed ? "Payment received - thank you!" : "We're confirming your payment..."}</h2>
          {paymentConfirmed ? (
            <p className="muted">
              {customerEmail ? `A receipt is on its way to ${customerEmail}. ` : ""}
              Our team has been notified and will reach out shortly to kick off your project.
            </p>
          ) : (
            <p className="muted">
              This can take a few seconds. If this page doesn&apos;t update, check your email for a receipt or contact us directly.
            </p>
          )}

          {summary ? (
            <div className="metric-grid">
              <div className="metric">
                <span className="muted">This payment</span>
                <strong>${(summary.paymentAmountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
              </div>
              <div className="metric">
                <span className="muted">Total paid so far</span>
                <strong>${(summary.amountPaidCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
              </div>
              {remainingCents > 0 ? (
                <div className="metric">
                  <span className="muted">Remaining balance</span>
                  <strong>${(remainingCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                </div>
              ) : (
                <div className="metric">
                  <span className="muted">Status</span>
                  <strong>Paid in full</strong>
                </div>
              )}
            </div>
          ) : null}

          <div className="result-actions">
            <h3>What&apos;s next?</h3>
            <p className="muted">
              {remainingCents > 0
                ? "You can pay the rest whenever you're ready from your client portal - no fixed schedule, pay any amount at any time."
                : "You're all set. Our team will be in touch to kick off your project."}
            </p>
            <div className="flow-actions">
              <a className="primary-button" href="/portal">
                Go to your client portal
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
