import { Mail, PlusCircle } from "lucide-react";
import { createFusionEmailTemplate } from "@/app/fusionadmin/actions";
import { getSalesOpsWorkspace } from "@/lib/sales-ops";
import { EmptyState, FusionDataTable, PageHeader } from "../crm-ui";

export default async function FusionEmailTemplatesPage() {
  const salesOps = await getSalesOpsWorkspace();

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Email templates"
        title="Manage reusable sales messages"
        description="Create safe template content for lead follow-up, proposals, reminders, and onboarding. Sending waits for an approved email provider."
      />

      <section className="admin-two-column">
        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><Mail size={20} /> Templates</h2>
            <span className="status-pill">{salesOps.emailTemplates.length} templates</span>
          </div>
          <FusionDataTable
            aria-label="Email templates"
            columns={[
              { header: "Template", priority: "primary" },
              { header: "Subject" },
              { header: "Category" },
              { header: "Visibility" },
              { header: "Status" }
            ]}
            empty={!salesOps.emailTemplates.length ? <EmptyState>No templates yet.</EmptyState> : null}
          >
            {salesOps.emailTemplates.map((template) => (
              <tr key={template.id}>
                <td data-label="Template">{template.template_name}</td>
                <td data-label="Subject">{template.subject}</td>
                <td data-label="Category">{template.category}</td>
                <td data-label="Visibility">{template.visibility}</td>
                <td data-label="Status"><span className="status-pill">{template.is_active ? "active" : "inactive"}</span></td>
              </tr>
            ))}
          </FusionDataTable>
        </article>

        <article className="admin-panel">
          <h2><PlusCircle size={20} /> Create template</h2>
          <form className="quick-form" action={createFusionEmailTemplate}>
            <input name="templateName" placeholder="Template name" required />
            <input name="subject" placeholder="Subject" required />
            <select name="category" defaultValue="General Sales">
              <option>Lead Follow-Up</option>
              <option>Discovery Call</option>
              <option>Proposal Sent</option>
              <option>Proposal Reminder</option>
              <option>Appointment Confirmation</option>
              <option>Welcome</option>
              <option>General Sales</option>
            </select>
            <select name="visibility" defaultValue="shared">
              <option value="shared">Shared</option>
              <option value="private">Private</option>
            </select>
            <textarea name="body" placeholder="Body. Allowed variables include {{contact_first_name}}, {{company_name}}, {{proposal_link}}, and {{organization_name}}." required />
            <button className="primary-button" type="submit">Create template</button>
          </form>
        </article>
      </section>
    </div>
  );
}
