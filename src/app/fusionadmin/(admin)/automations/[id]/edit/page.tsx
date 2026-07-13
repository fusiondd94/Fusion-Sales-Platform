import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Zap } from "lucide-react";
import { updateFusionAutomation } from "@/app/fusionadmin/actions";
import { AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS, getAutomationEditWorkspace } from "@/lib/automations";
import { AutomationBuilder } from "@/components/AutomationBuilder";
import { AutomationTestPanel } from "@/components/AutomationTestPanel";
import { PageHeader } from "@/app/fusionadmin/(admin)/crm-ui";

export default async function EditFusionAutomationPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { automation, emailTemplates } = await getAutomationEditWorkspace(id);

  if (!automation) notFound();

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Automation"
        title={"Edit: " + automation.name}
        description="Adjust the trigger, conditions, and actions below, then save."
        action={
          <Link className="secondary-button compact-button" href="/fusionadmin/automations">
            <ArrowLeft size={16} /> Back to automations
          </Link>
        }
      />

      <article className="admin-panel automation-builder-page">
        <div className="panel-heading">
          <h2><Zap size={20} /> Build automation</h2>
        </div>
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
              value: condition.value || "",
          group: condition.group ?? 0
            })),
            actions: automation.actions.map((action) => ({ type: action.type, config: action.config as Record<string, string> }))
          }}
          triggers={AUTOMATION_TRIGGERS}
        />
      </article>

      <AutomationTestPanel automationId={automation.id} />
    </div>
  );
}
