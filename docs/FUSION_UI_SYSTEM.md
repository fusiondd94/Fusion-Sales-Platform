# Fusion UI System

This document is the Phase 12 design-system reference for the Fusion Digital Dynamics sales platform and CRM. It describes the design tokens, the local component kit, the two theme surfaces the product now runs (Fusion light admin/portal, and the new light public front page), and the conventions future work should follow.

## 1. Design tokens

All tokens live as CSS custom properties in `src/app/globals.css` under `:root`. Two token families coexist: the original public-site palette from Phase 1, and the `--fusion-*` palette introduced in Phase 2 and used everywhere else.

### Legacy public-site palette (Phase 1)

| Token | Value | Used for |
| --- | --- | --- |
| `--ink` | `#08111f` | `.shell` base background (dark funnel look, still the default until `.shell-light` is applied) |
| `--night` | `#0c1728` | Gradient stop |
| `--panel` / `--panel-strong` | `#132238` / `#182b45` | Legacy panel fills |
| `--line` | `rgba(175, 212, 240, 0.24)` | Legacy border color |
| `--muted` / `--muted-strong` | `#bfd0e3` / `#d9e6f4` | Legacy muted text |
| `--text` | `#eef5ff` | Legacy body text (light-on-dark) |
| `--cyan` / `--gold` / `--green` / `--rose` | `#31d7ff` / `#f5b84b` / `#39d98a` / `#ff6b8a` | Legacy accent gradient stops (still used on login and portal, which remain dark) |

### Fusion brand palette (Phase 2+)

| Token | Value |
| --- | --- |
| `--fusion-teal-950` … `--fusion-teal-100` | `#003534` → `#dcefed` |
| `--fusion-gold-700` / `--fusion-gold-600` / `--fusion-gold-100` | `#b98c21` / `#d3a939` / `#fbf3da` |
| `--fusion-charcoal-900` / `800` / `700` | `#26333b` / `#36454f` / `#4b5b65` |
| `--fusion-gray-950` … `--fusion-gray-50` | `#111827` → `#f7f8fa` |
| `--fusion-surface` / `--fusion-surface-muted` / `--fusion-surface-raised` | `#ffffff` / `#f7f8fa` / `#ffffff` |
| `--fusion-text` / `--fusion-text-muted` / `--fusion-text-subtle` | `#26333b` / `#667783` / `#80909b` |
| `--fusion-border` / `--fusion-border-strong` | `#dfe5ea` / `#c8d2da` |
| `--fusion-focus` | `#004443` (also the `:focus-visible` outline color, product-wide) |
| `--fusion-success` / `-soft`, `--fusion-warning` / `-soft`, `--fusion-danger` / `-soft`, `--fusion-info` / `-soft` | Status colors with tinted backgrounds |
| `--fusion-radius-xs/sm/md/lg` | `4px / 6px / 8px / 12px` |
| `--fusion-shadow-sm/md/lg` | Elevation scale, e.g. `0 24px 60px rgba(17, 24, 39, 0.16)` for `lg` |
| `--fusion-space-1` … `--fusion-space-8` | `0.25rem` → `2rem` |
| `--fusion-control-height-sm/md/lg` | `2.25rem / 2.75rem / 3.25rem` |
| `--fusion-container` / `--fusion-container-wide` | `1180px` / `1360px` |
| `--fusion-transition` | `160ms ease` |
| `--fusion-z-dropdown` / `-modal` / `-toast` | `30 / 80 / 100` |

Global base rules worth knowing: `html { scroll-behavior: smooth; }`, a product-wide `:focus-visible` ring using `--fusion-focus`, and a `@media (prefers-reduced-motion: reduce)` block that collapses all animations and transitions to near-zero duration. Any new animation (including `Reveal`, see below) inherits this automatically — no extra reduced-motion handling is needed per component.

## 2. Two theme surfaces

The product intentionally runs two visual surfaces on one shared stylesheet:

**Admin, portal, and login** — light Fusion palette (`--fusion-*` tokens), established in Phase 2 and refined through Phase 10. This is the default look for `/fusionadmin`, `/fusionadmin/login`, `/portal`, and `/portal/login`. It still uses the legacy `--cyan`/`--gold` gradient on `.primary-button`, `.nav-cta`, and the decorative `.login-layout::before` frame, since those routes were kept intentionally dark/premium per the Phase 1 plan.

**Public front page (`/`)** — a separate, later-requested "clean, Apple.com-style" light theme, scoped entirely under a `.shell-light` class added to `<main>` in `src/app/page.tsx`. This was intentionally *not* built by editing the shared `.primary-button` / `.nav` / `.hero` rules directly (those are also used by the admin login form and the client portal), because doing so would have silently re-themed pages far outside the public site. Instead, every override lives as a `.shell-light <selector>` descendant rule near the end of `globals.css`, so:

- Admin, portal, and login are completely unaffected.
- If `.shell-light` is ever removed from `<main>`, the public page instantly falls back to the original Phase 1 dark theme — nothing breaks.
- All animation (see `Reveal`, below) is theme-agnostic and works identically under both surfaces.

When adding new public-page sections, follow the same pattern: write the structural/content rule normally, then add a `.shell-light .your-class { color/background overrides }` rule if it needs to look different in the light theme. Do not edit the base rule's color/background directly unless you have confirmed (via a repo-wide class-name search) that the public page is the only consumer.

## 3. Component kit (`src/components/ui`)

Everything below is exported from `src/components/ui/index.ts`.

### Foundation — `FusionUI.tsx`

- `Button({ variant, size, ...props })` — `variant`: `primary | secondary | ghost | danger`, `size`: `sm | md | lg`. Renders `.fusion-button .fusion-button--{variant} .fusion-button--{size}`.
- `IconButton({ label, variant, size, ...props })` — same variants, requires an accessible `label` (used as `aria-label` and `title`).
- `Card({ elevated, ...props })` — `.fusion-card`, add `elevated` for `.fusion-card--elevated`.
- `PageContainer`, `PageHeader({ eyebrow, title, description, action })`, `SectionHeader({ eyebrow, title, description, action })` — page and section-level heading scaffolding.
- `Field({ label, hint, error, required, children })` — label wrapper; renders a required-asterisk and inline hint/error text.
- `Input`, `Textarea`, `Select` — thin wrappers that apply `.fusion-control` (and `.fusion-control--textarea`).
- `Checkbox`, `Radio`, `Switch` — labeled choice controls (`.fusion-choice` / `.fusion-switch`).
- `Badge({ tone })` — `tone`: `neutral | teal | gold | success | warning | danger | info`.
- `Avatar({ name, src })` — falls back to initials when no `src`.
- `Tooltip({ label, children })`, `Divider`, `Skeleton`, `Spinner({ label })`.
- `EmptyState`, `ErrorState`, `LoadingState` — the three standard "nothing to show" patterns (`.fusion-state--empty|error|loading`). `ErrorState` sets `role="alert"`; `LoadingState` sets `role="status"`.
- `FormSection({ title, description, children })` — wraps a `<fieldset>` + `.fusion-form-section__grid`.
- `FormActions({ align, sticky, children })` — `align`: `start | end | between`; `sticky` pins the action row.
- `FormError({ message })` — renders nothing when `message` is falsy; otherwise an alert row with an icon.

### `SubmitButton.tsx`

Client component built on `useFormStatus()`. Drop it inside any `<form action={serverAction}>` as the submit control — it auto-disables and swaps to a spinner + `pendingLabel` while the action is in flight, with no extra state wiring needed on the page.

### `DataTable.tsx`

`DataTable({ columns, children, empty, aria-label })` renders the shared `.fusion-data-table` markup (with a `.fusion-data-table-wrap` scroll container). Each `column` accepts a `priority` of `primary | secondary | optional`, consumed by the responsive rules that collapse to stacked cards under 700px.

### `Dialog.tsx`

`Dialog({ open, onClose, title, description, children })` — accessible modal: `role="dialog"`, `aria-modal`, labelled/described-by wiring, a Tab/Shift+Tab focus trap, Escape-to-close, backdrop-click-to-close, and focus restoration to the previously focused element on close.

`ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, cancelLabel, tone })` wraps `Dialog` with a standard confirm/cancel action row (`tone: "primary" | "danger"`). Use this before any destructive or hard-to-reverse action.

### `SignOutButton.tsx`

Intercepts a sign-out `<form>` submit and routes it through `ConfirmDialog` before actually submitting. Usage: `<SignOutButton action={signOutFusionAdmin} />` in place of a raw form/button — this is now how both the admin shell and (pattern-wise) any future destructive action should be gated.

### `GlobalFeedback.tsx`

`AdminFeedbackBoundary` wraps the admin app shell and renders a live toast region (`aria-live="polite"`) for three conditions, detected via browser events rather than app state: connection lost (`offline`), connection restored (`online`, auto-dismisses after ~4.2s), and unsaved changes (tracked via `data-track-unsaved="true"` on a `<form>`, cleared on submit). Add `data-track-unsaved="true"` to any admin form whose loss the user should be warned about before navigating away.

### `Reveal.tsx` (`src/components/Reveal.tsx`)

Client component powering the public front page's scroll/entrance animation. `Reveal({ as, className, delayMs, children })` renders `as` (`div | article | aside | section`, default `div`) with a `reveal` class that gains `is-visible` the first time an `IntersectionObserver` reports the element in view (threshold `0.15`, `rootMargin: "0px 0px -10% 0px"`). `delayMs` staggers a group via inline `transition-delay`. The actual fade/slide animation is pure CSS (`.reveal { opacity: 0; transform: translateY(28px); transition: ...; } .reveal.is-visible { opacity: 1; transform: translateY(0); }`), so it is automatically neutralized by the global reduced-motion media query. Above-the-fold content fades in on load because it is already inside the viewport when the observer attaches.

## 4. Global route states

`src/app/error.tsx`, `src/app/loading.tsx`, and `src/app/not-found.tsx` (plus a scoped `src/app/fusionadmin/(admin)/error.tsx`) are Next.js special files that render the shared `ErrorState` / `LoadingState` / `EmptyState` components inside a `.state-shell` wrapper, so every unhandled error, route transition, and 404 gets the same on-brand treatment instead of a blank screen or default Next.js error page.

## 5. Conventions for future work

- Preserve existing class names during any visual change — add new scoped rules rather than repurposing shared ones (see the `.shell-light` pattern above). This keeps rollback to a single reverted commit.
- Before editing any class shared across routes (`.primary-button`, `.secondary-button`, `.nav`, `.admin-panel`, `.quick-form`, `.table`), run a repo-wide search for the class name first and confirm every consumer.
- New client components should only take on `"use client"` when they actually need hooks or browser APIs — Phase 11 audited every existing client component and found no unnecessary boundaries; keep it that way.
- Server actions, field names, and checkout/lead-capture payload shapes are out of scope for UI work per the Phase 1 plan — visual changes should never require touching `src/app/fusionadmin/actions.ts` field names, `src/lib/stripe.ts`, or the Supabase migrations.
- Run `pnpm typecheck` and `pnpm build` (or rely on the Vercel build-on-push check) after any shared CSS or component change; treat a red check as a blocker before moving to the next change.
