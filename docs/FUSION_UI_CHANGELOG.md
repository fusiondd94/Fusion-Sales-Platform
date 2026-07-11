# Fusion UI Changelog

Phase-by-phase record of the Fusion UI modernization effort described in `docs/FUSION_UI_MODERNIZATION_PLAN.md`. Every phase preserved existing routes, authentication, Supabase/Stripe integrations, server actions, and business logic; only presentation and front-end quality changed unless noted.

## Phase 1 — Audit and modernization plan
Documentation-only. Produced `docs/FUSION_UI_MODERNIZATION_PLAN.md`: full architecture, styling, component, accessibility, and responsive audit, plus the 12-phase roadmap this changelog follows.

## Phase 2 — Design tokens and Fusion UI foundation
Introduced the `--fusion-*` token system (teal/gold/charcoal/gray scales, surface, text, border, status, radius, shadow, spacing, control-height tokens) in `src/app/globals.css`, and the first pass of the local component kit in `src/components/ui/FusionUI.tsx`.

## Phase 3 — Application shell, sidebar, and top navigation
Commit: `3c60800` ("Modernize Fusion admin shell navigation"). Grouped `AdminShell.tsx` navigation into Core / CRM / Sales / Operations / Insights / Administration sections using only existing routes, improved active-state and mobile behavior, preserved `requireFusionAdmin()` and sign-out.

## Phase 4 — Dashboard visual refresh
Commit: `c614502` ("Refresh Fusion admin dashboard"). Modernized the `/fusionadmin` dashboard hierarchy, KPI cards, pipeline, and recent-activity panels using existing data only.

## Phase 5 — Tables, list pages, and data management screens
Commit: `70cbf57` ("Add Fusion data table system"). Introduced `src/components/ui/DataTable.tsx` (priority-column responsive pattern) and rolled it out to the CRM list pages, preserving existing search params and filters.

## Phase 6 — Forms, create/edit screens, and validation
Commits `f0ff23c` → `208d8c8` (SubmitButton, FormSection/FormActions/FormError, then a page-by-page rollout across proposals, email templates, forms, team, settings, tasks, services, and clients) plus the click-to-edit + backend update pass (`38fe585` → `32aec35`, "Add update functions for company, deal, team member, and more") that added `updateCrmCompany`, `updateCrmDeal`, `updateCrmTeamMember`, `updateSalesService`, `updateSalesEmailTemplate`, and `updateSalesCrmForm`. All server-action field names and redirect behavior were preserved. A follow-up pass (`8211397` → `d2351b5`) fixed several files that had silently failed to commit in an earlier session and broken the Vercel build; root-caused by cross-referencing raw GitHub content against expected file contents.

## Phase 7 — Detail pages, modals, drawers, and activity views
Commits `255854f` → `288df77`. Added `src/components/ui/Dialog.tsx` (`Dialog` + `ConfirmDialog`, full focus-trap/Escape/backdrop-close accessibility) and `src/components/ui/SignOutButton.tsx`, then wired `SignOutButton` into `AdminShell.tsx` in place of the raw sign-out form — the first real use of the confirm-before-destructive-action pattern.

## Phase 8 — Email templates and communication UI
Commit: `fc61841` ("Modernize email template workflow"). Improved the `/fusionadmin/email-templates` workflow; preserved supported merge tags and added no fabricated analytics, per the plan's explicit constraint.

## Phase 9 — Global feedback, states, and product polish
Commit: `b678a59` ("Add global feedback states"). Added `src/components/ui/GlobalFeedback.tsx` (`AdminFeedbackBoundary`: offline/online toasts and unsaved-changes warning via `data-track-unsaved`), and the shared route-level states `src/app/error.tsx`, `src/app/loading.tsx`, `src/app/not-found.tsx`, and `src/app/fusionadmin/(admin)/error.tsx` using the `ErrorState` / `LoadingState` / `EmptyState` components from Phase 2.

## Phase 10 — Responsive, accessibility, and cross-browser pass
Commit: `50e7224` ("Harden responsive accessibility pass"). Added `aria-label`s to unlabeled search/quick-form inputs across nine admin pages and the login form, fixed button/table text overflow (`overflow-wrap`, `max-width: 100%`), made action buttons full-width on mobile, and tightened `.footer-col a` touch targets.

## Front-page relight (user-requested, outside the original 12-phase CRM/admin track)
The plan explicitly deferred the public landing page to "its own focused phase." Done in two passes at the user's request:

1. **Apple.com-style motion** — added `src/components/Reveal.tsx` (IntersectionObserver-driven fade/slide-in, reduced-motion safe) and rebuilt `src/app/page.tsx` around it: customer-facing hero copy, a new "How it works" process section, a closing CTA band, and a new site footer, all while leaving `SalesFlow.tsx` (the questionnaire, pricing engine, lead capture, and Stripe checkout) completely untouched. Commits `4b50309` → `06c73b2`.
2. **Clean, light theme** — at the user's follow-up request for something closer to actual Apple.com and less "glowy," rebuilt the front page's visual theme as a white background with deep-teal accents and sparing gold, scoped entirely under a new `.shell-light` class on `<main>` so the shared `.primary-button` / `.nav` / `.hero` styles used by the admin login and client portal were never touched. Commits `df59cb1` → `8fa1116`. Caught and fixed a CSS syntax error (stray brace from an over-eager keyframe removal) and a specificity bug (a blanket `.shell-light h2` rule was overriding the CTA band's intended white text) before the build went green.

## Phase 11 — Performance and front-end quality
Commit: `5ef5967` ("Clean up unused styles in globals.css"). Audited all 12 client components in the codebase — every one genuinely needs its `"use client"` boundary (hooks or browser APIs), so no unnecessary client-side bloat existed. Removed dead CSS left over from the front-page relight: the `.hero::before` rotating frame and its `floatFrame` usage on that element, `.hero-panel::after` and `sheen`, and the `.pulse-bar` gradient animation and `moveBar` — all provably unreachable once the public page always carries `.shell-light`. Confirmed `.login-layout::before` still needed `floatFrame` before deleting the keyframe and restored it after an initial over-removal.

## Phase 12 — Final production audit and documentation
This document, plus `docs/FUSION_UI_SYSTEM.md`. Final audit confirmed the latest build green and spot-checked `/`, `/fusionadmin/login`, and the client portal login for regressions across all prior phases.

## Reference: components introduced across all phases

| Component | File | Introduced |
| --- | --- | --- |
| `Button`, `IconButton`, `Card`, `PageContainer`, `PageHeader`, `SectionHeader`, `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Badge`, `Avatar`, `Tooltip`, `Divider`, `Skeleton`, `Spinner`, `EmptyState`, `ErrorState`, `LoadingState` | `src/components/ui/FusionUI.tsx` | Phase 2 |
| `FormSection`, `FormActions`, `FormError` | `src/components/ui/FusionUI.tsx` | Phase 6 |
| `SubmitButton` | `src/components/ui/SubmitButton.tsx` | Phase 6 |
| `DataTable` | `src/components/ui/DataTable.tsx` | Phase 5 |
| `Dialog`, `ConfirmDialog` | `src/components/ui/Dialog.tsx` | Phase 7 |
| `SignOutButton` | `src/components/ui/SignOutButton.tsx` | Phase 7 |
| `AdminFeedbackBoundary` | `src/components/ui/GlobalFeedback.tsx` | Phase 9 |
| `Reveal` | `src/components/Reveal.tsx` | Front-page relight |
