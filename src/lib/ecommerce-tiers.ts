/**
 * src/lib/ecommerce-tiers.ts
 *
 * Pure, no-I/O tier definitions for the homepage's quick-buy e-commerce
 * website design packages. Kept separate from src/lib/sales-orders.ts (the
 * I/O layer that turns a tier into a live Stripe Checkout session) so the
 * same tier data can be rendered on the homepage without importing any
 * server-only Supabase/Stripe code.
 */

export type EcommerceTierKey = "starter" | "growth" | "premium";

export type EcommerceTier = {
  key: EcommerceTierKey;
  name: string;
  priceDollars: number;
  tagline: string;
  features: string[];
};

export const ECOMMERCE_TIERS: Record<EcommerceTierKey, EcommerceTier> = {
  starter: {
    key: "starter",
    name: "Starter Storefront",
    priceDollars: 799.99,
    tagline: "A clean, ready-to-sell store to get your products online fast.",
    features: [
      "Up to 25 products",
      "Mobile-friendly storefront design",
      "Secure checkout setup",
      "Basic SEO configuration"
    ]
  },
  growth: {
    key: "growth",
    name: "Growth Storefront",
    priceDollars: 1150,
    tagline: "A stronger build for stores ready to scale their catalog and marketing.",
    features: [
      "Up to 100 products",
      "Custom brand styling",
      "Email capture and basic marketing setup",
      "Product filtering and search",
      "Analytics dashboard connection"
    ]
  },
  premium: {
    key: "premium",
    name: "Premium Storefront",
    priceDollars: 1500,
    tagline: "Our most complete e-commerce build for brands ready to go all in.",
    features: [
      "Unlimited products",
      "Custom homepage and landing pages",
      "Advanced SEO setup",
      "Upsell and cross-sell product blocks",
      "Priority build timeline"
    ]
  }
};

export const ECOMMERCE_TIER_ORDER: EcommerceTierKey[] = ["starter", "growth", "premium"];
