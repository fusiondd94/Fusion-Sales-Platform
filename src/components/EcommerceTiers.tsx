"use client";

/**
 * src/components/EcommerceTiers.tsx
 *
 * Homepage quick-buy section: 3 fixed-price e-commerce website design
 * tiers, rendered directly below the "Let's build something elegant" CTA
 * band. Each button creates a live Stripe Checkout session server-side
 * (src/app/order/actions.ts -> src/lib/sales-orders.ts) and redirects
 * straight to Stripe - no questionnaire or account required.
 */

import { useState, useTransition } from "react";
import { Check, CreditCard, ShoppingCart } from "lucide-react";
import { ECOMMERCE_TIERS, ECOMMERCE_TIER_ORDER, type EcommerceTierKey } from "@/lib/ecommerce-tiers";
import { createEcommerceTierCheckoutAction } from "@/app/order/actions";

export function EcommerceTiers() {
  const [pendingTier, setPendingTier] = useState<EcommerceTierKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleBuy(tierKey: EcommerceTierKey) {
    setError(null);
    setPendingTier(tierKey);
    startTransition(async () => {
      const outcome = await createEcommerceTierCheckoutAction(tierKey);
      if (!outcome.ok) {
        setError(outcome.reason);
        setPendingTier(null);
        return;
      }
      window.location.href = outcome.url;
    });
  }

  return (
    <section className="section ecommerce-tiers" id="ecommerce-tiers">
      <p className="eyebrow">Quick start</p>
      <h2>E-commerce website design, ready to buy today.</h2>
      <p className="muted">Pick a tier and check out with Stripe right now - no questionnaire required.</p>

      <div className="next-steps-grid">
        {ECOMMERCE_TIER_ORDER.map((tierKey) => {
          const tier = ECOMMERCE_TIERS[tierKey];
          return (
            <div className="next-step-card" key={tier.key}>
              <h3>{tier.name}</h3>
              <p className="muted">{tier.tagline}</p>
              <span className="status-pill">
                <ShoppingCart size={15} /> ${tier.priceDollars.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <ul className="tier-feature-list">
                {tier.features.map((feature) => (
                  <li key={feature}>
                    <Check size={14} /> {feature}
                  </li>
                ))}
              </ul>
              <button className="primary-button" disabled={pending} onClick={() => handleBuy(tier.key)} type="button">
                <CreditCard size={17} /> Buy now{pendingTier === tier.key ? "..." : ""}
              </button>
            </div>
          );
        })}
      </div>

      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
