import { describe, expect, it } from "vitest";
import {
  buildLaunchChecklist,
  VERIFIED_GREEN_STATUSES,
  type PortalProductInfo,
  type RequirementSource,
  type SelectionSource,
  type VerificationSource
} from "./launch-requirements";

const HOSTING_PRODUCT: PortalProductInfo = {
  id: "pp-hosting",
  productKey: "web-hosting",
  productName: "cPanel Web Hosting (Deluxe)",
  category: "hosting",
  estimatedPrice: 15,
  priceUnit: "monthly",
  portalUrl: "https://portal.fddynamics.com/products/cpanel",
  recommendedUseCases: [],
  renewalPriceNote: null,
  taxIncluded: false,
  icannFeeApplies: false
};

const SSL_PRODUCT: PortalProductInfo = {
  id: "pp-ssl",
  productKey: "ssl-certificate",
  productName: "SSL Certificate (Standalone DV)",
  category: "ssl",
  estimatedPrice: 68,
  priceUnit: "annual",
  portalUrl: "https://portal.fddynamics.com/products/ssl",
  recommendedUseCases: [],
  renewalPriceNote: "Renews annually.",
  taxIncluded: false,
  icannFeeApplies: false
};

const EMAIL_PRODUCT: PortalProductInfo = {
  id: "pp-email",
  productKey: "professional-email",
  productName: "Professional Email",
  category: "email",
  estimatedPrice: 5,
  priceUnit: "monthly",
  portalUrl: "https://portal.fddynamics.com/products/professional-email",
  recommendedUseCases: [],
  renewalPriceNote: null,
  taxIncluded: false,
  icannFeeApplies: false
};

function baseInput(overrides: Partial<Parameters<typeof buildLaunchChecklist>[0]> = {}) {
  return {
    requirements: [] as RequirementSource[],
    portalProducts: new Map<string, PortalProductInfo>([
      ["pp-hosting", HOSTING_PRODUCT],
      ["pp-ssl", SSL_PRODUCT],
      ["pp-email", EMAIL_PRODUCT]
    ]),
    selectionsByPortalProductId: new Map<string, SelectionSource>(),
    verificationsBySelectionId: new Map<string, VerificationSource>(),
    ...overrides
  };
}

describe("buildLaunchChecklist - client-provided items", () => {
  it("marks a bundled item (e.g. SSL included with hosting) as connected", () => {
    const requirement: RequirementSource = {
      requirementKey: "ssl-certificate",
      requirementType: "client_provided",
      isRequired: false,
      notes: "Included at no extra cost with the recommended hosting plan.",
      portalProductId: "pp-ssl"
    };
    const [item] = buildLaunchChecklist(baseInput({ requirements: [requirement] }));
    expect(item.status).toBe("connected");
    expect(item.isVerifiedGreen).toBe(true);
  });

  it("marks a genuinely client-owned item as already_owned", () => {
    const requirement: RequirementSource = {
      requirementKey: "web-hosting",
      requirementType: "client_provided",
      isRequired: false,
      notes: "Already owned by the client.",
      portalProductId: "pp-hosting"
    };
    const [item] = buildLaunchChecklist(baseInput({ requirements: [requirement] }));
    expect(item.status).toBe("already_owned");
    expect(item.isVerifiedGreen).toBe(true);
  });
});

describe("buildLaunchChecklist - unpurchased required/optional items", () => {
  it("marks a required, untouched portal product as needs_selection (not green)", () => {
    const requirement: RequirementSource = {
      requirementKey: "web-hosting",
      requirementType: "portal_product",
      isRequired: true,
      notes: null,
      portalProductId: "pp-hosting"
    };
    const [item] = buildLaunchChecklist(baseInput({ requirements: [requirement] }));
    expect(item.status).toBe("needs_selection");
    expect(item.isVerifiedGreen).toBe(false);
    expect(item.estimatedCost).toBe(15);
    expect(item.portalUrl).toBe("https://portal.fddynamics.com/products/cpanel");
  });

  it("marks an optional, untouched portal product as recommended (not green)", () => {
    const requirement: RequirementSource = {
      requirementKey: "professional-email",
      requirementType: "portal_product",
      isRequired: false,
      notes: null,
      portalProductId: "pp-email"
    };
    const [item] = buildLaunchChecklist(baseInput({ requirements: [requirement] }));
    expect(item.status).toBe("recommended");
    expect(item.isVerifiedGreen).toBe(false);
  });
});

describe("buildLaunchChecklist - selection progression", () => {
  const requirement: RequirementSource = {
    requirementKey: "professional-email",
    requirementType: "portal_product",
    isRequired: false,
    notes: null,
    portalProductId: "pp-email"
  };

  it("reflects a 'selected' selection with no verification yet", () => {
    const selection: SelectionSource = { id: "sel-1", portalProductId: "pp-email", status: "selected", selectedAt: "2026-08-01T00:00:00Z" };
    const [item] = buildLaunchChecklist(
      baseInput({ requirements: [requirement], selectionsByPortalProductId: new Map([["pp-email", selection]]) })
    );
    expect(item.status).toBe("selected");
    expect(item.isVerifiedGreen).toBe(false);
  });

  it("reflects a 'purchase_started' selection", () => {
    const selection: SelectionSource = { id: "sel-1", portalProductId: "pp-email", status: "purchase_started", selectedAt: "2026-08-01T00:00:00Z" };
    const [item] = buildLaunchChecklist(
      baseInput({ requirements: [requirement], selectionsByPortalProductId: new Map([["pp-email", selection]]) })
    );
    expect(item.status).toBe("purchase_started");
    expect(item.isVerifiedGreen).toBe(false);
  });

  it("never trusts a bare 'purchased' selection status without a verified verification row", () => {
    const selection: SelectionSource = { id: "sel-1", portalProductId: "pp-email", status: "purchased", selectedAt: "2026-08-01T00:00:00Z" };
    const [item] = buildLaunchChecklist(
      baseInput({ requirements: [requirement], selectionsByPortalProductId: new Map([["pp-email", selection]]) })
    );
    expect(item.status).toBe("verification_pending");
    expect(item.isVerifiedGreen).toBe(false);
  });
});

describe("buildLaunchChecklist - verification records are the only path to a real checkmark", () => {
  const requirement: RequirementSource = {
    requirementKey: "professional-email",
    requirementType: "portal_product",
    isRequired: false,
    notes: null,
    portalProductId: "pp-email"
  };
  const selection: SelectionSource = { id: "sel-1", portalProductId: "pp-email", status: "purchase_started", selectedAt: "2026-08-01T00:00:00Z" };

  it("client self-reporting a purchase never produces a green checkmark on its own", () => {
    const verification: VerificationSource = {
      id: "ver-1",
      portalProductSelectionId: "sel-1",
      verificationMethod: "client_submitted_pending_review",
      verified: false,
      verifiedBy: null,
      verifiedAt: null,
      status: "client_submitted",
      externalReferenceId: null,
      evidenceNotes: "I bought this today.",
      expiresAt: null
    };
    const [item] = buildLaunchChecklist(
      baseInput({
        requirements: [requirement],
        selectionsByPortalProductId: new Map([["pp-email", selection]]),
        verificationsBySelectionId: new Map([["sel-1", verification]])
      })
    );
    expect(item.status).toBe("verification_pending");
    expect(item.isVerifiedGreen).toBe(false);
  });

  it("an admin-verified record produces a real green checkmark", () => {
    const verification: VerificationSource = {
      id: "ver-1",
      portalProductSelectionId: "sel-1",
      verificationMethod: "admin_manual_verification",
      verified: true,
      verifiedBy: "admin-user-id",
      verifiedAt: "2026-08-01T12:00:00Z",
      status: "verified",
      externalReferenceId: "ORDER-123",
      evidenceNotes: null,
      expiresAt: "2027-08-01"
    };
    const [item] = buildLaunchChecklist(
      baseInput({
        requirements: [requirement],
        selectionsByPortalProductId: new Map([["pp-email", selection]]),
        verificationsBySelectionId: new Map([["sel-1", verification]])
      })
    );
    expect(item.status).toBe("purchased");
    expect(item.isVerifiedGreen).toBe(true);
    expect(item.verification?.externalReferenceId).toBe("ORDER-123");
  });

  it("a rejected verification surfaces as action_required, never green", () => {
    const verification: VerificationSource = {
      id: "ver-1",
      portalProductSelectionId: "sel-1",
      verificationMethod: "client_submitted_pending_review",
      verified: false,
      verifiedBy: "admin-user-id",
      verifiedAt: null,
      status: "rejected",
      externalReferenceId: null,
      evidenceNotes: "Order number did not match any Fusion portal purchase.",
      expiresAt: null
    };
    const [item] = buildLaunchChecklist(
      baseInput({
        requirements: [requirement],
        selectionsByPortalProductId: new Map([["pp-email", selection]]),
        verificationsBySelectionId: new Map([["sel-1", verification]])
      })
    );
    expect(item.status).toBe("action_required");
    expect(item.isVerifiedGreen).toBe(false);
  });
});

describe("VERIFIED_GREEN_STATUSES", () => {
  it("only allows purchased, connected, and already_owned to be green", () => {
    expect(VERIFIED_GREEN_STATUSES.has("purchased")).toBe(true);
    expect(VERIFIED_GREEN_STATUSES.has("connected")).toBe(true);
    expect(VERIFIED_GREEN_STATUSES.has("already_owned")).toBe(true);
    expect(VERIFIED_GREEN_STATUSES.has("selected")).toBe(false);
    expect(VERIFIED_GREEN_STATUSES.has("verification_pending")).toBe(false);
    expect(VERIFIED_GREEN_STATUSES.has("purchase_started")).toBe(false);
    expect(VERIFIED_GREEN_STATUSES.has("needs_selection")).toBe(false);
    expect(VERIFIED_GREEN_STATUSES.has("recommended")).toBe(false);
    expect(VERIFIED_GREEN_STATUSES.has("action_required")).toBe(false);
    expect(VERIFIED_GREEN_STATUSES.has("not_required")).toBe(false);
  });
});
