"use client";

import { useActionState } from "react";
import { previewFusionAutomation } from "@/app/fusionadmin/actions";
import { FormError, SubmitButton } from "@/components/ui";

export function AutomationTestPanel({ automationId }: { automationId: string }) {
  const [state, formAction] = useActionState(previewFusionAutomation, undefined);

  return (
    <details className="automation-test-panel">
      <summary>Test this automation</summary>
      <form action={formAction} className="automation-test-form">
        <input type="hidden" name="automationId" value={automationId} />
        <div className="automation-test-grid">
          <label>
            Contact name
            <input name="sampleContactName" placeholder="Jane Doe" />
          </label>
          <label>
            Contact email
            <input name="sampleContactEmail" placeholder="jane@example.com" />
          </label>
          <label>
            Contact phone
            <input name="sampleContactPhone" placeholder="555-0100" />
          </label>
          <label>
            Company name
            <input name="sampleCompanyName" placeholder="Acme Co" />
          </label>
          <label>
            Deal value
            <input name="sampleDealValue" type="number" placeholder="5000" />
          </label>
          <label>
            Deal stage
            <input name="sampleDealStage" placeholder="Negotiation" />
          </label>
          <label>
            Task title
            <input name="sampleTaskTitle" placeholder="Follow up call" />
          </label>
          <label>
            Proposal total
            <input name="sampleProposalTotal" type="number" placeholder="1200" />
          </label>
        </div>
        <SubmitButton pendingLabel="Testing...">Run test</SubmitButton>
        <FormError message={state?.error} />
      </form>

      {state?.result ? (
        <div className="automation-test-results">
          <p className={state.result.passes ? "automation-test-pass" : "automation-test-fail"}>
            {state.result.passes ? "Conditions would pass with this sample data." : "Conditions would NOT pass with this sample data."}
          </p>

          {state.result.groups.length ? (
            <div className="automation-test-groups">
              {state.result.groups.map((group) => (
                <div key={group.group} className="automation-test-group">
                  <p className="muted">Group {group.group + 1}: {group.passed ? "pass" : "fail"}</p>
                  <ul>
                    {group.conditions.map((condition, index) => (
                      <li key={index} className={condition.passed ? "automation-test-condition-pass" : "automation-test-condition-fail"}>
                        {condition.field} {condition.operator} {condition.value || ""} (actual: {condition.actual || "empty"}) - {condition.passed ? "pass" : "fail"}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No conditions configured - this automation always runs.</p>
          )}

          <div className="automation-test-actions">
            <p className="muted">Actions that would run</p>
            <ul>
              {state.result.actions.map((action, index) => (
                <li key={index}>{action.summary}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </details>
  );
}
