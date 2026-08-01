"use client";

/**
 * src/app/results/[token]/ResultView.tsx
 *
 * Client component for the Phase 6 dedicated shareable sales result page.
 * Reuses the same visual vocabulary (flow-panel, metric-grid,
 * next-steps-grid, status-pill, primary/secondary-button) as
 * QuestionnaireFlow's RecommendationSummaryView so a shared link looks and
 * feels identical to finishing the questionnaire live, plus the
 * accept/decline/schedule-call CTAs this standalone page adds.
 */

import { useState, useTransition } from "react";
import { ArrowRight, Calendar, Check, ShieldCheck, X } from "lucide-react";
import type { RecommendationPathKind } from "@/lib/recommendation-engine";
import type { PublicResultPayload } from "@/lib/sales-result";
import { requestCallAction, submitDecisionAction } from "@/app/results/[token]/actions";

const FEASIBILITY_LABELS: Record<string, string> = {
  READY_TO_PROCEED: "Ready to proceed",
  READY_WITH_REDUCED_SCOPE: "Ready with a smaller starting scope",
  PAYMENT_PLAN_RECOMMENDED: "A payment plan can bridge the gap",
  PHASED_BUILD_RECOMMENDED: "A phased build is recommended",
  CONSULTATION_REQUIRED: "Let's talk it through together",
  BUDGET_INSUFFICIENT: "Below our starting budget - here's what's still possible",
  INFORMATION_INCOMPLETE: "A few more details will sharpen this plan"
};

const PATH_LABELS: Record<RecommendationPathKind, string> = {
  recommended: "Recommended",
  growth: "Growth option",
  starter_phased: "Starter / phased option"
};

const CONTACT_METHODS: Array<{ value: string; label: string }> = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" },
  { value: "text", label: "Text" },
  { value: "video_call", label: "Video call" }
];

export function ResultView({ token, result }: { token: string; result: PublicResultPayload }) {
  const [decision, setDecision] = useState(result.viewState.decision);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [callRequested, setCallRequested] = useState(Boolean(result.callRequestedAt));
  const [callMethod, setCallMethod] = useState("email");
  const [callError, setCallError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDecision(next: "accepted" | "declined") {
    setDecisionError(null);
    startTransition(async () => {
      const outcome = await submitDecisionAction(token, next);
      if (!outcome.ok) {
        setDecisionError(outcome.reason);
        return;
      }
      setDecision(next);
    });
  }

  function handleCallRequest() {
    setCallError(null);
    startTransition(async () => {
      const outcome = await requestCallAction(token, callMethod);
      if (!outcome.ok) {
        setCallError(outcome.reason);
        return;
      }
      setCallRequested(true);
    });
  }

  const greeting = result.contactFirstName ? `Hi ${result.contactFirstName} - ` : "";
  const businessLabel = result.businessName ? ` for ${result.businessName}` : "";

  return (
    <section className="flow-panel questionnaire-complete">
      <p className="eyebrow">Your website plan{businessLabel}</p>
      <h2>
        {greeting}
        {FEASIBILITY_LABELS[result.feasibilityStatus] || result.feasibilityStatus}
      </h2>
      {result.recommendedNextAction ? <p className="muted">{result.recommendedNextAction}</p> : null}

      {decision !== "pending" ? (
        <div className={`decision-banner decision-banner--${decision}`}>
          {decision === "accepted" ? <Check size={17} /> : <X size={17} />}
          <span>{decision === "accepted" ? "You accepted this plan." : "You declined this plan."} A member of the Fusion team has been notified.</span>
        </div>
      ) : null}

      <div className="metric-grid">
        <div className="metric">
          <span className="muted">Total planned budget</span>
          <strong>${result.totalPlannedBudget.toLocaleString()}</strong>
        </div>
        <div className="metric">
          <span className="muted">Estimated required launch products</span>
          <strong>~${result.requiredPortalCost.toLocaleString()}</strong>
        </div>
        <div className="metric">
          <span className="muted">Estimated design allocation</span>
          <strong>${result.designAllocation.toLocaleString()}</strong>
        </div>
        {result.budgetGap > 0 ? (
          <div className="metric">
            <span className="muted">Budget gap</span>
            <strong>${result.budgetGap.toLocaleString()}</strong>
          </div>
        ) : (
          <div className="metric">
            <span className="muted">Remaining cushion</span>
            <strong>${result.remainingCushion.toLocaleString()}</strong>
          </div>
        )}
      </div>

      <div className="next-steps-grid">
        {result.paths.map((path) => (
          <div className="next-step-card" key={path.kind}>
            <h3>{PATH_LABELS[path.kind] || path.label}</h3>
            <p className="muted">{path.packageName || "Custom scope"}</p>
            <p className="muted">{path.reason}</p>
            <span className="status-pill">
              <ShieldCheck size={15} /> ${path.totalDesignCost.toLocaleString()}
              {path.monthlyCost ? ` + $${path.monthlyCost.toLocaleString()}/mo` : ""}
            </span>
          </div>
        ))}
      </div>

      {result.missingInformation.length > 0 ? (
        <p className="muted">A few more details would sharpen this plan - our team may follow up with a couple of quick questions.</p>
      ) : null}

      {result.portalPricingDisclaimer ? <p className="muted">{result.portalPricingDisclaimer}</p> : null}

      <div className="result-actions">
        <h3>Ready to move forward?</h3>
        <div className="flow-actions">
          <button className="primary-button" disabled={pending} onClick={() => handleDecision("accepted")} type="button">
            <Check size={17} /> Accept this plan
          </button>
          <button className="secondary-button" disabled={pending} onClick={() => handleDecision("declined")} type="button">
            <X size={17} /> Not right now
          </button>
        </div>
        {decisionError ? <p className="form-error">{decisionError}</p> : null}
      </div>

      <div className="result-actions">
        <h3>Prefer to talk it through?</h3>
        {callRequested ? (
          <span className="status-pill">
            <Check size={15} /> We&apos;ll be in touch to schedule a call.
          </span>
        ) : (
          <>
            <div className="form-grid">
              <label className="full-field">
                Best way to reach you
                <select onChange={(event) => setCallMethod(event.target.value)} value={callMethod}>
                  {CONTACT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flow-actions">
              <button className="secondary-button" disabled={pending} onClick={handleCallRequest} type="button">
                <Calendar size={17} /> Schedule a call <ArrowRight size={15} />
              </button>
            </div>
            {callError ? <p className="form-error">{callError}</p> : null}
          </>
        )}
      </div>
    </section>
  );
}
