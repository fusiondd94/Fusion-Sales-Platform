# Fusion UI Modernization Plan

## Phase 1 Scope

This document is the Phase 1 audit and modernization plan for the Fusion Digital Dynamics sales platform and CRM. Phase 1 is intentionally documentation-only. It preserves all current routes, authentication, Supabase integrations, Stripe integrations, server actions, forms, permissions, and business logic.

## Current Architecture Summary

Fusion is a Next.js App Router application written in TypeScript. It uses server-rendered route segments for the public sales site, admin CRM, client portal, API routes, Supabase-backed server data helpers, and Stripe checkout/webhook flows.

The application areas are:

- Public sales funnel at `/`
- Legacy/admin redirect surface at `/admin`
- Fusion Admin CRM at `/fusionadmin`
- Fusion Admin login at `/fusionadmin/login`
- Client portal at `/portal`
- Client portal login at `/portal/login`
- API routes for checkout, lead capture, and Stripe webhooks under `/api`

The main business modules are split across:

- `src/app` for routes, layouts, server actions, and page components
- `src/components` for the public sales flow client component
- `src/lib` for auth, CRM, sales operations, portal, offer logic, Stripe, customer data, demo records, and Supabase clients
- `supabase/migrations` for database structure

## Existing UI Stack

- Framework: Next.js App Router
- Language: TypeScript
- Package manager: pnpm, based on `pnpm-lock.yaml`
- Styling: single global CSS file at `src/app/globals.css`
- Component model: React Server Components by default, with selected client components
- Icons: `lucide-react`
- Forms: native HTML forms with server actions, plus client-side state in `SalesFlow`
- Auth UI: custom Supabase Auth forms
- Data layer: Supabase service/server clients and Stripe SDK
- Charting library: none currently installed
- Tailwind: not configured
- shadcn/ui or component registry: not configured
- Theme provider: none currently configured

## Existing Styling Approach

The application currently relies on global CSS classes and CSS variables in `src/app/globals.css`. The current palette is dark and high-contrast:

- `--ink`, `--night`, `--panel`, `--panel-strong`
- `--line`
- `--muted`, `--muted-strong`, `--text`
- `--cyan`, `--gold`, `--green`, `--rose`, `--white`

The public site, admin shell, admin panels, forms, tables, portal, and login screens all share the same global namespace. This makes broad visual changes fast, but it also creates risk: changing a class such as `.primary-button`, `.admin-panel`, `.table`, `.quick-form`, or `.status-pill` can affect many unrelated pages.

The requested visual direction is lighter and more business-platform oriented:

- Fusion Deep Teal: `#004443`
- Fusion Gold: `#D3A939`
- Charcoal: `#36454F`
- Soft Background: `#F7F8FA`
- White Surface: `#FFFFFF`

The modernization should therefore move the CRM and portal toward a refined light operating-platform interface while handling the public landing page carefully, because it currently depends on a darker hero/funnel presentation.

## Global Layout Structure

Root layout:

- `src/app/layout.tsx`
- Imports `src/app/globals.css`
- Sets site metadata
- No app-wide theme provider or global shell component

Admin layout:

- `src/app/fusionadmin/(admin)/layout.tsx`
- Enforces `requireFusionAdmin()`
- Renders access-denied state for authenticated but unauthorized users
- Wraps allowed users in `AdminShell`

Admin shell:

- `src/app/fusionadmin/(admin)/AdminShell.tsx`
- Client component using `usePathname`
- Owns sidebar, nav links, sign-out action, top bar, and signed-in user card
- Uses Lucide icons consistently

Portal layout:

- No dedicated shared portal layout file
- `src/app/portal/PortalWorkspace.tsx` contains the portal navigation, admin preview banner, project review, comments, and uploads

Public layout:

- `src/app/page.tsx` contains public navigation and hero
- `src/components/SalesFlow.tsx` contains the interactive offer and checkout flow

## Sidebar And Top Navigation

The admin sidebar is implemented in `AdminShell.tsx` with a flat `navItems` array:

- Dashboard
- Clients
- Deals
- Services
- Proposals
- Calendar
- Email
- Forms
- Reports
- Tasks
- Team
- Settings

Current strengths:

- Routes are explicit and easy to audit
- Icons are all Lucide
- Active state uses `pathname === item.href`
- Sign-out is available in the sidebar footer
- The admin top bar shows the signed-in user name

Current gaps:

- Navigation is not grouped by Core, CRM, Sales, Operations, Insights, and Administration
- Active state only matches exact paths, which is fine now but fragile if detail routes are added
- Mobile sidebar behavior is a responsive stacked menu, not a true mobile drawer
- There is no search entry point, workspace selector, notification menu, or profile menu
- Long navigation lists may become cramped as CRM modules expand

## Shared Component Inventory

Current shared React helpers:

- `PageHeader` in `src/app/fusionadmin/(admin)/crm-ui.tsx`
- `EmptyState` in `src/app/fusionadmin/(admin)/crm-ui.tsx`
- `formatDate`, `formatCurrency`, and `optionList` in `crm-ui.tsx`
- `AdminShell` in `src/app/fusionadmin/(admin)/AdminShell.tsx`
- `SalesFlow` in `src/components/SalesFlow.tsx`
- Login form components:
  - `src/app/fusionadmin/login/LoginForm.tsx`
  - `src/app/portal/login/ClientPortalLoginForm.tsx`
- Portal workspace component:
  - `src/app/portal/PortalWorkspace.tsx`

Current shared CSS patterns:

- Buttons: `.primary-button`, `.secondary-button`, `.ghost-button`, `.icon-button`, `.option-button`, `.nav-cta`
- Containers: `.shell`, `.admin-app`, `.admin-main`, `.admin-content`, `.admin-panel`
- Page headings: `.admin-page-header`, `.section-heading`, `.panel-heading`
- Forms: `.quick-form`, `.form-grid`, `.record-edit-card`, `.record-edit-grid`
- Data display: `.table`, `.table-wrap`, `.stack-list`, `.timeline-list`
- Badges: `.status-pill`, `.discount`
- Metrics: `.metric-grid`, `.admin-metrics`, `.admin-metric`
- Portal: `.portal-hero`, `.portal-workspace-grid`, `.preview-frame`, `.portal-side-stack`
- Calendar: `.calendar-board`, `.calendar-grid`, `.calendar-day`, `.calendar-event`

## Route Inventory

Public and sales:

- `/`
- `/admin`

Authentication:

- `/fusionadmin/login`
- `/portal/login`

Admin CRM:

- `/fusionadmin`
- `/fusionadmin/clients`
- `/fusionadmin/deals`
- `/fusionadmin/services`
- `/fusionadmin/proposals`
- `/fusionadmin/calendar`
- `/fusionadmin/email-templates`
- `/fusionadmin/forms`
- `/fusionadmin/reports`
- `/fusionadmin/tasks`
- `/fusionadmin/team`
- `/fusionadmin/settings`

Client portal:

- `/portal`

API:

- `/api/checkout`
- `/api/leads`
- `/api/webhooks/stripe`

## Repeated One-Off UI Patterns

The admin pages repeat several patterns directly in page files:

- Admin panels with a `panel-heading`
- Table wrappers and table markup
- Quick create forms
- Record edit cards
- Two-column responsive layouts
- Status badges
- Empty messages
- Stack list items with bold title and muted metadata
- Timeline items
- Metric cards

These patterns should become part of a Fusion UI Kit over time. The highest-leverage first extraction is not a large dependency or design framework; it is a small local component layer that wraps the current CSS patterns and stabilizes their APIs.

## Design Inconsistencies

Current inconsistencies to address gradually:

- CRM/admin UI is dark, while the target direction is soft background with white surfaces
- Primary buttons use a cyan-to-gold gradient instead of deep teal
- Gold is sometimes used as part of large gradients; the target direction says gold should be selective
- Page/card spacing varies across pages
- Some page headings use `h1`, some `h2`, and some panel headings use plain text composition
- Form controls are styled globally but not componentized
- Empty states are mostly plain paragraphs
- Status pills use one visual style regardless of semantic status
- Table actions are inconsistently represented across pages
- Login, admin, portal, and public surfaces share visual DNA but not a formal token system

## High-Risk Areas

These areas should be changed carefully and tested broadly:

- `src/app/globals.css`: one global stylesheet controls the whole product
- Button classes: changing `.primary-button`, `.secondary-button`, or `.ghost-button` affects public sales, admin, login, and portal
- `.admin-panel`, `.quick-form`, `.record-edit-grid`, and `.table`: used across many CRM modules
- `AdminShell.tsx`: controls all authenticated admin navigation
- `SalesFlow.tsx`: client-side sales funnel tied to lead capture and checkout
- `PortalWorkspace.tsx`: client portal review, comments, uploads, and admin preview mode
- `fusionadmin/actions.ts`: shared server actions for many forms
- Supabase helper files: UI changes should not require query or schema changes without separate approval
- Stripe checkout and webhook routes: should remain untouched during visual modernization unless a UI bug requires a small integration-safe change

## Components That Must Remain Untouched Without Specific Testing

- `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/checkout/route.ts`
- `src/app/api/leads/route.ts`
- `src/lib/stripe.ts`
- `src/lib/supabase/server.ts`
- Supabase migrations
- Existing server action field names in `src/app/fusionadmin/actions.ts`
- Existing portal upload/comment field names
- Existing checkout payload shape from `SalesFlow`

These can be visually supported by frontend work, but their behavior should not be changed as part of UI modernization phases unless separately approved.

## Accessibility Findings

Current strengths:

- Most form inputs are wrapped in labels
- Tables use semantic table markup
- Buttons are usually actual `button` elements
- Admin nav has an `aria-label`
- Portal iframe has a title
- Error messages exist on login and sales flow forms

Issues and risks:

- Focus states are not consistently defined across links, buttons, form controls, and table actions
- Icon-only or icon-heavy controls do not have a formal tooltip or accessible-name pattern
- Status messages are not consistently announced to screen readers
- Empty states are plain text and may not provide next actions
- Disabled controls do not always explain why they are disabled
- The portal comment-layer pins are visual-only and need stronger accessible review affordances later
- No dialog/dropdown system exists yet, so future modals must include focus trapping and escape behavior
- Color contrast should be rechecked after moving to the light Fusion palette

## Responsive Findings

Current strengths:

- Global media query collapses major grids to one column
- Tables use horizontal scrolling via `.table-wrap`
- The recently added calendar uses horizontal overflow for small screens
- Admin menu becomes a grid on smaller screens

Issues and risks:

- The admin sidebar becomes a top block rather than an intentional mobile drawer
- Large tables rely on horizontal scrolling instead of priority-column strategies
- Some action buttons can become visually crowded in table cells
- Portal preview iframe can dominate mobile height
- The public hero uses very large type and should be checked after token changes
- Long business names, emails, and URLs can stress cards and tables

## Missing Loading, Empty, Success, And Error States

Present:

- Basic empty states exist through `EmptyState` and inline admin-empty messages
- Login forms show errors
- Sales flow shows errors and pending checkout state
- Portal has empty preview/files/comments states

Missing or incomplete:

- No skeleton system
- No shared loading state component
- No shared error state component
- No toast or success feedback after server-action saves
- No confirmation dialog pattern
- No field-level validation summaries for long admin forms
- No permission-denied component outside the specific admin layout case
- No global not-found customization beyond default route

## Visual Baseline

Current baseline before modernization:

- Overall feel: dark, technical, high-contrast, startup-like
- Public site: animated dark hero with gradients, large display type, interactive sales flow
- Admin CRM: dark sidebar and dark cards, compact tables, global panels, simple badges
- Portal: dark admin-like shell with iframe preview, comment pins, uploads, and comment list
- Login screens: custom dark premium style
- Design system maturity: low-to-medium; many reusable CSS classes but few typed UI components

Baseline routes for future visual comparison:

- `/`
- `/fusionadmin/login`
- `/fusionadmin`
- `/fusionadmin/clients`
- `/fusionadmin/calendar`
- `/fusionadmin/settings`
- `/portal/login`
- `/portal`

## Pages With Greatest Visual Impact

Highest-impact modernization order:

1. Admin shell, sidebar, topbar, and page header system
2. Dashboard at `/fusionadmin`
3. Clients/leads page at `/fusionadmin/clients`
4. Calendar at `/fusionadmin/calendar`
5. Settings and team pages because they communicate product maturity
6. Client portal at `/portal`
7. Public sales flow after the CRM foundation is stable
8. Email templates, proposals, services, forms, reports, and tasks list pages

## Quick Wins

- Add centralized tokens for the requested Fusion palette
- Replace gradient primary buttons with deep teal variants in admin/CRM surfaces
- Create shared Button, Card, Badge, Field, Input, Select, Textarea, EmptyState, ErrorState, and LoadingState components
- Improve focus rings globally
- Add status-specific badge variants
- Make `PageHeader` more flexible and visually polished
- Group admin navigation without changing routes
- Add consistent mobile spacing and table action styling
- Improve admin empty states with concise next-step copy
- Create reusable section headers and form action rows

## Fusion UI Kit Candidates

Foundation:

- `Button`
- `IconButton`
- `Card`
- `PageContainer`
- `PageHeader`
- `SectionHeader`
- `Divider`

Forms:

- `Field`
- `Input`
- `Textarea`
- `Select`
- `Checkbox`
- `Radio`
- `Switch`
- `FormActions`
- `FormError`

Data display:

- `Badge`
- `Avatar`
- `MetricCard`
- `DataTable`
- `TableAction`
- `EmptyState`
- `ErrorState`
- `LoadingState`
- `Skeleton`

Navigation and overlays:

- `SidebarNav`
- `Topbar`
- `Tooltip`
- `ConfirmDialog`
- `PopoverMenu`

Product-specific:

- `PipelineBoard`
- `ActivityTimeline`
- `AppointmentCalendar`
- `PortalPreviewFrame`
- `CommentPin`

## Design-System Recommendations

- Keep the UI system local to the app before considering external libraries.
- Introduce tokens first, then components, then page-by-page adoption.
- Use CSS variables for the Fusion palette and semantic aliases.
- Preserve existing class names during transition when possible to reduce risk.
- Use Lucide consistently and define icon sizes per component.
- Prefer light CRM/admin surfaces, but migrate the public landing page more carefully.
- Avoid adding a heavy UI library unless a later phase proves local components are insufficient.
- Keep server actions and submitted field names stable.
- Keep page components server-rendered unless interactivity requires a client boundary.

## Phase-By-Phase Implementation Plan

### Phase 2: Design Tokens And Fusion UI Foundation

Impact: high. Effort: medium.

- Create semantic tokens for Fusion colors, surfaces, borders, shadows, radius, typography, spacing, focus, and status colors.
- Add foundational UI components without fully restyling major pages.
- Preserve existing component APIs where practical.
- Add accessible focus and disabled states.

### Phase 3: Application Shell, Sidebar, And Top Navigation

Impact: high. Effort: medium.

- Group navigation into logical sections using existing routes only.
- Improve active states, user area, mobile behavior, and sidebar spacing.
- Preserve `requireFusionAdmin()` and existing sign-out behavior.

### Phase 4: Dashboard Visual Refresh

Impact: high. Effort: medium.

- Modernize dashboard hierarchy, KPI cards, pipeline, recent leads, proposals, notifications, and activity.
- Use existing data only.
- Do not invent comparison metrics.

### Phase 5: Tables, List Pages, And Data Management Screens

Impact: high. Effort: high.

- Create a reusable table/list pattern.
- Apply first to clients/leads, services, proposals, forms, team, and email templates.
- Preserve search params and existing filters.

### Phase 6: Forms, Create/Edit Screens, And Validation

Impact: high. Effort: high.

- Modernize long forms, field grouping, validation messages, action rows, and mobile stacking.
- Preserve all names, schemas, server actions, and redirect behavior.

### Phase 7: Detail Pages, Modals, Drawers, And Activity Views

Impact: medium. Effort: high.

- Standardize future detail pages and modals.
- Add accessible dialog behavior before destructive or complex actions expand.

### Phase 8: Email Templates And Communication UI

Impact: medium. Effort: medium.

- Improve `/fusionadmin/email-templates` workflow.
- Preserve supported merge tags only.
- Do not show fake analytics.

### Phase 9: Global Feedback, States, And Product Polish

Impact: high. Effort: medium.

- Add shared success, error, loading, empty, permission, and confirmation patterns.
- Replace vague messages with actionable copy.

### Phase 10: Responsive, Accessibility, And Cross-Browser Pass

Impact: high. Effort: medium-to-high.

- Test key routes across desktop, tablet, and mobile.
- Fix overflow, hidden actions, focus states, and contrast issues.

### Phase 11: Performance And Front-End Quality

Impact: medium. Effort: medium.

- Review bundle size, unnecessary client components, unused CSS, and repeated code.
- Keep optimizations measured and conservative.

### Phase 12: Final Production Audit And Documentation

Impact: high. Effort: medium.

- Complete final audit and create `docs/FUSION_UI_SYSTEM.md` and `docs/FUSION_UI_CHANGELOG.md`.

## Testing Strategy

Each phase should run:

- `pnpm typecheck`
- `pnpm build`
- `pnpm lint` if the current Next.js version and script support it

Manual checks should focus on affected routes only for early phases, then expand as shared components spread. Shared CSS or shell changes should include at least:

- `/`
- `/fusionadmin/login`
- `/fusionadmin`
- `/fusionadmin/clients`
- `/fusionadmin/calendar`
- `/portal/login`
- `/portal`

For authenticated admin and portal routes, verify redirect behavior when not signed in and use authenticated browser checks when credentials/session are available.

## Rollback Strategy

- Complete one phase per commit.
- Keep each phase narrowly scoped.
- Avoid schema changes during UI phases unless separately approved.
- If a shared component or token change causes regressions, revert the phase commit rather than patching several unrelated pages at once.
- Prefer additive components and token aliases before replacing existing class behavior globally.
- Preserve old class names during transition so page-by-page rollback remains simple.

## Remaining Concerns

- The app has no dedicated lint configuration, and `next lint` may not be supported by the installed Next.js version.
- There is no automated browser or accessibility test suite yet.
- Current admin UI uses a single global CSS namespace, so token changes must be staged carefully.
- No charting library exists; reports and dashboard visualizations should avoid chart claims until real chart requirements are approved.
- Some forms have server-action submissions without visible success confirmation.
- The target light CRM direction may need to coexist with the current darker public landing page until that page gets its own focused phase.

