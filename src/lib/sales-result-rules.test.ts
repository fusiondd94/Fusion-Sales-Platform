import { describe, expect, it } from "vitest";
import {
  computeResultViewState,
  decisionLabel,
  firstNameFrom,
  isValidShareToken,
  resolveDecisionTransition
} from "@/lib/sales-result-rules";

describe("isValidShareToken", () => {
  it("accepts a UUID-shaped token", () => {
    expect(isValidShareToken("3fa85f64-5717-4562-b3fc-2c963f66afa6")).toBe(true);
  });

  it("rejects non-string input", () => {
    expect(isValidShareToken(12345)).toBe(false);
    expect(isValidShareToken(null)).toBe(false);
    expect(isValidShareToken(undefined)).toBe(false);
  });

  it("rejects tokens that are too short", () => {
    expect(isValidShareToken("abc123")).toBe(false);
  });

  it("rejects tokens with characters outside hex/dash", () => {
    expect(isValidShareToken("'; DROP TABLE sales_website_recommendations; --")).toBe(false);
    expect(isValidShareToken("3fa85f64-5717-4562-b3fc-2c963f66afa6<script>")).toBe(false);
  });

  it("rejects an empty or whitespace-only token", () => {
    expect(isValidShareToken("")).toBe(false);
    expect(isValidShareToken("   ")).toBe(false);
  });
});

describe("resolveDecisionTransition", () => {
  it("accepts 'accepted'", () => {
    expect(resolveDecisionTransition("accepted")).toEqual({ ok: true, decision: "accepted" });
  });

  it("accepts 'declined'", () => {
    expect(resolveDecisionTransition("declined")).toEqual({ ok: true, decision: "declined" });
  });

  it("rejects any other string, never trusting client-submitted values", () => {
    expect(resolveDecisionTransition("pending")).toEqual({ ok: false, reason: "Invalid decision." });
    expect(resolveDecisionTransition("maybe")).toEqual({ ok: false, reason: "Invalid decision." });
    expect(resolveDecisionTransition("")).toEqual({ ok: false, reason: "Invalid decision." });
  });

  it("rejects non-string values", () => {
    expect(resolveDecisionTransition(null)).toEqual({ ok: false, reason: "Invalid decision." });
    expect(resolveDecisionTransition(undefined)).toEqual({ ok: false, reason: "Invalid decision." });
    expect(resolveDecisionTransition(1)).toEqual({ ok: false, reason: "Invalid decision." });
    expect(resolveDecisionTransition({ decision: "accepted" })).toEqual({ ok: false, reason: "Invalid decision." });
  });
});

describe("computeResultViewState", () => {
  it("marks a pending, never-viewed recommendation correctly", () => {
    const state = computeResultViewState({ decision: "pending", viewCountBeforeThisView: 0 });
    expect(state).toEqual({
      decision: "pending",
      decisionLabel: "Awaiting your decision",
      isDecided: false,
      hasBeenViewedBefore: false
    });
  });

  it("marks an accepted, previously-viewed recommendation correctly", () => {
    const state = computeResultViewState({ decision: "accepted", viewCountBeforeThisView: 3 });
    expect(state.isDecided).toBe(true);
    expect(state.hasBeenViewedBefore).toBe(true);
    expect(state.decisionLabel).toBe("Accepted");
  });

  it("marks a declined recommendation as decided", () => {
    const state = computeResultViewState({ decision: "declined", viewCountBeforeThisView: 1 });
    expect(state.isDecided).toBe(true);
  });
});

describe("decisionLabel", () => {
  it("returns the expected label for every decision value", () => {
    expect(decisionLabel("pending")).toBe("Awaiting your decision");
    expect(decisionLabel("accepted")).toBe("Accepted");
    expect(decisionLabel("declined")).toBe("Declined");
  });
});

describe("firstNameFrom", () => {
  it("extracts the first token of a full name", () => {
    expect(firstNameFrom("Sadrac Brusma")).toBe("Sadrac");
  });

  it("handles a single-word name", () => {
    expect(firstNameFrom("Sadrac")).toBe("Sadrac");
  });

  it("trims surrounding whitespace", () => {
    expect(firstNameFrom("  Sadrac Brusma  ")).toBe("Sadrac");
  });

  it("returns null for null, undefined, or blank input", () => {
    expect(firstNameFrom(null)).toBeNull();
    expect(firstNameFrom(undefined)).toBeNull();
    expect(firstNameFrom("")).toBeNull();
    expect(firstNameFrom("   ")).toBeNull();
  });
});
