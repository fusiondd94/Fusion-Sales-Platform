/**
 * src/lib/launch-requirements.ts
 *
 * Pure, server-safe logic for the Phase 5 "Website Launch Requirements"
 * client-portal checklist. Nothing in this file performs I/O - it accepts
 * plain data structures (already loaded from Supabase by src/lib/portal.ts)
 * and returns a deterministic list of checklist items. This mirrors the
 * pure/I-O split established in sales-rules.ts, recommendation-engine.ts,
 * and questionnaire-schema.ts.
 *
 * Core rule (from the Phase 5 spec): never a fake green checkmark. An item
 * may only reach a "purchased/connected/already owned" status when backed
 * by one of:
 *   - A verified sales_purchase_verifications row (admin or automated sync)
 *   - The recommendation engine's own ownership classification (the client
 *     told us, during the questionnaire, that they already own the item)
 *   - The recommendation engine's own bundle-inclusion classification
 *     (Phase 4 - e.g. free SSL bundled with the recommended hosting plan)
 * Clicking a "Purchase through Fusion" link is never sufficient on its own.
 */

export const LAUNCH_CHECKLIST_STATUSES = [
  "not_required",
  "needs_selection",
  "recommended",
  "selected",
  "purchase_started",
  "verification_pending",
  "purchased",
  "connected",
  "already_owned",
  "action_required"
] as const;
export type LaunchChecklistStatus = (typeof LAUNCH_CHECKLIST_STATUSES)[number];

/** Statuses that are allowed to render a green checkmark in the UI. Every
 * status in this set is only ever reached through a verified fact (see the
 * module docblock) - deriveStatus() below is the single place that decides
 * which status applies, so there is exactly one path to a checkmark. */
export const VERIFIED_GREEN_STATUSES = new Set<LaunchChecklistStatus>(["purchased", "connected", "already_owned"]);

export type RequirementSource = {
  requirementKey: string;
  requirementType: "portal_product" | "client_provided";
  isRequired: boolean;
  notes: string | null;
  portalProductId: string | null;
};

export type PortalProductInfo = {
  id: string;
  productKey: string;
  productName: string;
  category: string;
  estimatedPrice: number;
  priceUnit: "one_time" | "monthly" | "annual";
  portalUrl: string;
  recommendedUseCases: string[];
  renewalPriceNote: string | null;
  taxIncluded: boolean;
  icannFeeApplies: boolean;
};

export type SelectionSource = {
  id: string;
  portalProductId: string;
  status: "recommended" | "selected" | "purchase_started" | "not_needed" | "purchased";
  selectedAt: string | null;
};

export type VerificationSource = {
  id: string;
  portalProductSelectionId: string;
  verificationMethod: "portal_api_sync" | "admin_manual_verification" | "client_submitted_pending_review";
  verified: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
  status: "verification_pending" | "client_submitted" | "verified" | "rejected";
  externalReferenceId: string | null;
  evidenceNotes: string | null;
  expiresAt: string | null;
};

export type LaunchChecklistItem = {
  requirementKey: string;
  category: string;
  productName: string;
  status: LaunchChecklistStatus;
  isVerifiedGreen: boolean;
  isRequired: boolean;
  reason: string;
  estimatedCost: number | null;
  priceUnit: "one_time" | "monthly" | "annual" | null;
  portalProductId: string | null;
  portalUrl: string | null;
  recommendedUseCases: string[];
  renewalPriceNote: string | null;
  taxIncluded: boolean;
  icannFeeApplies: boolean;
  selectionId: string | null;
  verification: {
    method: VerificationSource["verificationMethod"];
    status: VerificationSource["status"];
    verifiedAt: string | null;
    externalReferenceId: string | null;
    expiresAt: string | null;
    notes: string | null;
  } | null;
};

const STATUS_REASON: Record<LaunchChecklistStatus, string> = {
  not_required: "Not needed for this project.",
  needs_selection: "Required to launch - not yet selected.",
  recommended: "Optional, but recommended for this project.",
  selected: "Selected - purchase this through the Fusion client portal.",
  purchase_started: "Purchase started - waiting on confirmation.",
  verification_pending: "Submitted for review - a Fusion admin will confirm shortly.",
  purchased: "Purchased and verified.",
  connected: "Already owned and connected to this project.",
  already_owned: "Already owned - confirm it can be connected to this project.",
  action_required: "Something needs your attention before this can be verified."
};

function deriveStatus(input: {
  requirement: RequirementSource;
  selection: SelectionSource | null;
  verification: VerificationSource | null;
}): LaunchChecklistStatus {
  const { requirement, selection, verification } = input;

  // Client-provided items were already classified by the recommendation
  // engine (Phase 3/4) as either genuinely owned by the client or bundled
  // for free with another required, verified-necessary product. Either way
  // there is nothing to purchase, so this is the one place a checkmark can
  // appear without a sales_purchase_verifications row - the "verification"
  // already happened during the questionnaire / engine classification.
  if (requirement.requirementType === "client_provided") {
    if (requirement.notes?.toLowerCase().includes("included")) return "connected";
    return "already_owned";
  }

  if (verification?.status === "rejected") return "action_required";
  if (verification?.verified && verification.status === "verified") return "purchased";
  if (verification?.status === "client_submitted") return "verification_pending";
  if (verification?.status === "verification_pending") return "verification_pending";

  if (selection?.status === "not_needed") return "not_required";
  if (selection?.status === "purchase_started") return "purchase_started";
  if (selection?.status === "selected") return "selected";
  if (selection?.status === "purchased") {
    // A selection can only legitimately reach "purchased" once a verified
    // verification row exists - if it doesn't, treat it as still pending
    // rather than trusting the selection status alone.
    return "verification_pending";
  }

  return requirement.isRequired ? "needs_selection" : "recommended";
}

/**
 * Builds the full Website Launch Requirements checklist for a client from
 * the latest recommendation's requirement rows plus any portal-product
 * selections/verifications recorded for that client. Every requirement row
 * from the recommendation produces exactly one checklist item - optional
 * items the client never touched still appear (as "recommended"), per the
 * spec's "show checklist cards for... other recommendation-specific
 * products" instruction.
 */
export function buildLaunchChecklist(input: {
  requirements: RequirementSource[];
  portalProducts: Map<string, PortalProductInfo>;
  selectionsByPortalProductId: Map<string, SelectionSource>;
  verificationsBySelectionId: Map<string, VerificationSource>;
}): LaunchChecklistItem[] {
  const items: LaunchChecklistItem[] = [];

  for (const requirement of input.requirements) {
    const product = requirement.portalProductId ? input.portalProducts.get(requirement.portalProductId) : undefined;
    const selection = requirement.portalProductId ? input.selectionsByPortalProductId.get(requirement.portalProductId) || null : null;
    const verification = selection ? input.verificationsBySelectionId.get(selection.id) || null : null;

    const status = deriveStatus({ requirement, selection, verification });

    items.push({
      requirementKey: requirement.requirementKey,
      category: product?.category || "other",
      productName: product?.productName || requirement.requirementKey,
      status,
      isVerifiedGreen: VERIFIED_GREEN_STATUSES.has(status),
      isRequired: requirement.isRequired,
      reason: requirement.notes || STATUS_REASON[status],
      estimatedCost: product?.estimatedPrice ?? null,
      priceUnit: product?.priceUnit ?? null,
      portalProductId: requirement.portalProductId,
      portalUrl: product?.portalUrl ?? null,
      recommendedUseCases: product?.recommendedUseCases ?? [],
      renewalPriceNote: product?.renewalPriceNote ?? null,
      taxIncluded: product?.taxIncluded ?? false,
      icannFeeApplies: product?.icannFeeApplies ?? false,
      selectionId: selection?.id ?? null,
      verification: verification
        ? {
            method: verification.verificationMethod,
            status: verification.status,
            verifiedAt: verification.verifiedAt,
            externalReferenceId: verification.externalReferenceId,
            expiresAt: verification.expiresAt,
            notes: verification.evidenceNotes
          }
        : null
    });
  }

  return items;
}

export function statusLabel(status: LaunchChecklistStatus): string {
  const labels: Record<LaunchChecklistStatus, string> = {
    not_required: "Not required",
    needs_selection: "Needs selection",
    recommended: "Recommended",
    selected: "Selected",
    purchase_started: "Purchase started",
    verification_pending: "Verification pending",
    purchased: "Purchased",
    connected: "Connected",
    already_owned: "Already owned",
    action_required: "Action required"
  };
  return labels[status];
}
