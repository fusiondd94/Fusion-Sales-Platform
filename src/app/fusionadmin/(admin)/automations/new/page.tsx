import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import { createFusionAutomation } from "@/app/fusionadmin/actions";
import { AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS, getAutomationsWorkspace } from "@/lib/automations";
import { AutomationBuilder } from "@/components/AutomationBuilder";
import { PageHeader } from "@/app/fusionadmin/(admin)/crm-ui";

export default async function NewFusionAutomationPage() {
  const { emailTemplates } = await getAutomationsWorkspace();

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Automation"
        title="New automation"
        description="Wire a trigger to one or more actions. Drag conditions and actions onto the canvas below."
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
          formAction={createFusionAutomation}
          triggers={AUTOMATION_TRIGGERS}
        />
      </article>
    </div>
  );
}
