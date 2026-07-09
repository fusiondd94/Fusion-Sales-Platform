# Fusion Digital Dynamics Sales Platform

Vercel-hosted Next.js platform for selling Fusion Digital Dynamics LLC website design, hosting, domain, SSL/security, marketing, and professional email services.

## Core flows

- Animated landing page for Fusion service offers.
- Guided sales questionnaire with package recommendations.
- Customer intake before checkout: name, email, phone, business, website/domain, and project notes.
- Lead capture API at `/api/leads` for CRM follow-up before payment.
- Discount ladder capped at 75 percent and reserved for high-friction prospects.
- Stripe Checkout API route and webhook endpoint.
- Client portal surface after purchase.
- Internal CRM and task-management dashboard.

## Environment variables

```bash
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
STRIPE_SECRET_KEY=sk_live_or_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_or_test_...
CRM_ADMIN_EMAIL=admin@fddynamics.com
```

The app builds without Stripe keys, but live payment collection requires the Stripe variables above.

## Production wiring still needed

- Database and auth provider for persistent client accounts, admin login, CRM records, and task updates.
- Stripe keys and webhook endpoint secret for live checkout and fulfillment.
- Admin user list or SSO rule so `/admin` is not public once real customer data is connected.
- Email/SMS provider for abandoned-checkout follow-up and onboarding notifications.
