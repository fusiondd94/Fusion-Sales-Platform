import { Zap } from "lucide-react";
import {
  createFusionAutomation,
  deleteFusionAutomation,
  toggleFusionAutomation,
  updateFusionAutomation
} from "@/app/fusionadmin/actions";
import { AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS, getAutomationsWorkspace } from "@/lib/automations";
import { AutomationBuilder } from "@/components/AutomationBuilder";
import { EmptyState, formatDate, PageHeader } from "../crm-ui";

export default async function FusionAutomationsPage() {
  const { automations, runs, emailTemplates } = await getAutomationsWorkspace();
  const triggerLabel = (value: string) => AUTOMATION_TRIGGERS.find((trigger) => trigger.value === value)?.label || value;
  const runsByAutomation = new Map<string, typeof runs>();
  for (const run of runs) {
    if (!run.automation_id) continue;
    const list = runsByAutomation.get(run.automation_id) || [];
    list.push(run);
    runsByAutomation.set(run.automation_id, list);
  }

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Automation"
        title="Automate anything in the platform"
        description="Wire trigger events (a lead is captured, a deal moves stage, a task is completed) to actions (create a contact, link a business, send an email) without touching code."
      />

      <section className="admin-two-column">
        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><Zap size={20} /> Active automations</h2>
            <span className="status-pill">{automations.length} rules</span>
          </div>

          {!automations.length ? <EmptyState>No automations yet. Create your first one to the right.</EmptyState> : null}

          <div className="automation-list">
            {automations.map((automation) => {
              const recentRuns = runsByAutomation.get(automation.id) || [];
              return (
                <details className="automation-card" key={automation.id}>
                  <summary>
                    <span>
                      <strong>{automation.name}</strong>
                      <small className="muted">{triggerLabel(automation.trigger_type)} &middot; {automation.actions.length} action{automation.actions.length === 1 ? "" : "s"}</small>
                    </span>
                    <span className="automation-summary-meta">
                      <span className={automation.is_active ? "status-pill" : "status-pill status-pill-muted"}>
                        {automation.is_active ? "Active" : "Paused"}
                      </span>
                      <span className="muted">{automation.run_count} run{automation.run_count === 1 ? "" : "s"}</span>
                    </span>
                  </summary>

                  <div className="automation-card-body">
                    {automation.description ? <p className="muted">{automation.description}</p> : null}

                    <AutomationBuilder
                      actionTypes={AUTOMATION_ACTIONS}
                      emailTemplates={emailTemplates}
                      formAction={updateFusionAutomation}
                      initial={{
                        automationId: automation.id,
                        name: automation.name,
                        description: automation.description || "",
                        triggerType: automation.trigger_type,
                        isActive: automation.is_active,
                        conditions: automation.conditions.map((condition) => ({
                          field: condition.field,
                          operator: condition.operator,
                          value: condition.value || ""
                        })),
                        actions: automation.actions.map((action) => ({ type: action.type, config: action.config as Record<string, string> }))
                      }}
                      triggers={AUTOMATION_TRIGGERS}
                    />

                    <div className="automation-card-footer">
                      <form action={toggleFusionAutomation}>
                        <input name="automationId" type="hidden" value={automation.id} />
                        <input name="isActive" type="hidden" value={automation.is_active ? "" : "on"} />
                        <button className="secondary-button compact-button" type="submit">
                          {automation.is_active ? "Pause" : "Activate"}
                        </button>
                      </form>
                      <form action={deleteFusionAutomation}>
                        <input name="automationId" type="hidden" value={automation.id} />
                        <button className="ghost-button compact-button" type="submit">Delete</button>
                      </form>
                    </div>

                    {recentRuns.length ? (
                      <div className="automation-runs">
                        <p className="muted">Recent runs</p>
                        {recentRuns.slice(0, 5).map((run) => (
                          <p key={run.id}>
                            <span className={`status-pill ${run.status === "error" ? "status-pill-error" : run.status === "skipped" ? "status-pill-muted" : ""}`}>
                              {run.status}
                            </span>
                            <span className="muted"> {formatDate(run.created_at)}</span>
                            {run.error_message ? <><br /><span className="muted">{run.error_message}</span></> : null}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
        </article>

        <article className="admin-panel">
          <h2><Zap size={20} /> New automation</h2>
          <AutomationBuilder
            actionTypes={AUTOMATION_ACTIONS}
            emailTemplates={emailTemplates}
            formAction={createFusionAutomation}
            triggers={AUTOMATION_TRIGGERS}
          />
        </article>
      </section>
    </div>
  );
}
