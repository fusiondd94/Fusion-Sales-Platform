import Link from "next/link";
import { Zap } from "lucide-react";
import { deleteFusionAutomation, duplicateFusionAutomation, toggleFusionAutomation } from "@/app/fusionadmin/actions";
import { AUTOMATION_TRIGGERS, getAutomationsWorkspace } from "@/lib/automations";
import { EmptyState, formatDate, FusionBadge, PageHeader, statusTone } from "../crm-ui";

type StatusFilter = "active" | "draft" | "paused";

export default async function FusionAutomationsPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab: StatusFilter = tab === "draft" || tab === "paused" ? tab : "active";

  const { automations, runs } = await getAutomationsWorkspace();
  const triggerLabel = (value: string) => AUTOMATION_TRIGGERS.find((trigger) => trigger.value === value)?.label || value;

  const runsByAutomation = new Map<string, typeof runs>();
  for (const run of runs) {
    if (!run.automation_id) continue;
    const list = runsByAutomation.get(run.automation_id) || [];
    list.push(run);
    runsByAutomation.set(run.automation_id, list);
  }

  function statusOf(automation: (typeof automations)[number]): StatusFilter {
    if (automation.is_active) return "active";
    return automation.run_count > 0 ? "paused" : "draft";
  }

  const grouped: Record<StatusFilter, typeof automations> = {
    active: automations.filter((automation) => statusOf(automation) === "active"),
    draft: automations.filter((automation) => statusOf(automation) === "draft"),
    paused: automations.filter((automation) => statusOf(automation) === "paused")
  };

  const visible = grouped[activeTab];

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Automation"
        title="Automate anything in the platform"
        description="Wire trigger events (a lead is captured, a deal moves stage, a task is completed) to actions (create a contact, link a business, send an email) without touching code."
        action={
          <Link className="primary-button" href="/fusionadmin/automations/new">
            <Zap size={16} /> New automation
          </Link>
        }
      />

      <div className="automation-tabs">
        <Link className={activeTab === "active" ? "automation-tab automation-tab--active" : "automation-tab"} href="/fusionadmin/automations?tab=active">
          Active <span className="status-pill">{grouped.active.length}</span>
        </Link>
        <Link className={activeTab === "draft" ? "automation-tab automation-tab--active" : "automation-tab"} href="/fusionadmin/automations?tab=draft">
          Drafts <span className="status-pill">{grouped.draft.length}</span>
        </Link>
        <Link className={activeTab === "paused" ? "automation-tab automation-tab--active" : "automation-tab"} href="/fusionadmin/automations?tab=paused">
          Paused <span className="status-pill">{grouped.paused.length}</span>
        </Link>
      </div>

      <article className="admin-panel">
        <div className="panel-heading">
          <h2>
            <Zap size={20} />
            {activeTab === "active" ? "Active automations" : activeTab === "draft" ? "Drafts" : "Paused automations"}
          </h2>
        </div>

        {!visible.length ? (
          <EmptyState>
            {activeTab === "draft"
              ? "No drafts. New automations you have not activated yet will show up here."
              : activeTab === "paused"
              ? "No paused automations."
              : "No active automations yet. Create your first one."}
          </EmptyState>
        ) : null}

        <div className="automation-list">
          {visible.map((automation) => {
            const recentRuns = runsByAutomation.get(automation.id) || [];
            const status = statusOf(automation);
            return (
              <details className="automation-card" key={automation.id}>
                <summary>
                  <span>
                    <strong>{automation.name}</strong>
                    <small className="muted">
                      {triggerLabel(automation.trigger_type)} &middot; {automation.actions.length} action{automation.actions.length === 1 ? "" : "s"}
                    </small>
                  </span>
                  <span className="automation-summary-meta">
                    <FusionBadge tone={statusTone(status)}>
                      {status === "active" ? "Active" : status === "draft" ? "Draft" : "Paused"}
                    </FusionBadge>
                    <span className="muted">{automation.run_count} run{automation.run_count === 1 ? "" : "s"}</span>
                  </span>
                </summary>

                <div className="automation-card-body">
                  {automation.description ? <p className="muted">{automation.description}</p> : null}

                  <div className="automation-card-footer">
                    <Link className="secondary-button compact-button" href={"/fusionadmin/automations/" + automation.id + "/edit"}>
                      Edit
                    </Link>
                    <form action={toggleFusionAutomation}>
                      <input name="automationId" type="hidden" value={automation.id} />
                      <input name="isActive" type="hidden" value={automation.is_active ? "" : "on"} />
                      <button className="secondary-button compact-button" type="submit">
                        {automation.is_active ? "Pause" : "Activate"}
                      </button>
                    </form>
                    <form action={duplicateFusionAutomation}>
                      <input name="automationId" type="hidden" value={automation.id} />
                      <button className="secondary-button compact-button" type="submit">Duplicate</button>
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
                        <details key={run.id} className="automation-run-detail">
                          <summary>
                            <FusionBadge tone={statusTone(run.status)}>
                              {run.status}
                            </FusionBadge>
                            <span className="muted"> {formatDate(run.created_at)}</span>
                          </summary>
                          {run.error_message ? <p className="muted">{run.error_message}</p> : null}
                          {run.actions_run && run.actions_run.length ? (
                            <ul className="automation-run-actions">
                              {run.actions_run.map((actionRun, index) => (
                                <li key={index} className={actionRun.ok ? "action-run-ok" : "action-run-fail"}>
                                  <strong>{actionRun.type}</strong> {actionRun.ok ? "succeeded" : "failed"}
                                  {actionRun.detail ? <span className="muted"> - {actionRun.detail}</span> : null}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </details>
                      ))}
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      </article>
    </div>
  );
}
