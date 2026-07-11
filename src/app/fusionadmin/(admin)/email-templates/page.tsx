import { Mail, PlusCircle } from "lucide-react";
import { createFusionEmailTemplate, updateFusionEmailTemplate } from "@/app/fusionadmin/actions";
import { getSalesOpsWorkspace } from "@/lib/sales-ops";
import {
  EmptyState,
  FusionDataTable,
  FusionField,
  FusionInput,
  FusionSelect,
  FusionSubmitButton,
  FusionSwitch,
  FusionTextarea,
  PageHeader
} from "../crm-ui";

type PageProps = {
  searchParams?: Promise<{ templateId?: string }>;
};

const CATEGORY_OPTIONS = [
  "Lead Follow-Up",
  "Discovery Call",
  "Proposal Sent",
  "Proposal Reminder",
  "Appointment Confirmation",
  "Welcome",
  "General Sales"
];

export default async function FusionEmailTemplatesPage({ searchParams }: PageProps) {
  const filters = (await searchParams) || {};
  const salesOps = await getSalesOpsWorkspace();
  const selectedTemplate = salesOps.emailTemplates.find((template) => template.id === filters.templateId);

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Email templates"
        title="Manage reusable sales messages"
        description="Create safe template content for lead follow-up, proposals, reminders, and onboarding. Sending waits for an approved email provider."
      />

      <section className="admin-two-column">
        <article className="admin-panel panel-span-2" id="template-editor">
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
              { header: "Status" },
              { header: "Action", className: "table-action-column" }
            ]}
            empty={!salesOps.emailTemplates.length ? <EmptyState>No templates yet.</EmptyState> : null}
          >
            {salesOps.emailTemplates.map((template) => (
              <tr key={template.id}>
                <td data-label="Template"><a className="fusion-record-link" href={`/fusionadmin/email-templates?templateId=${template.id}#template-editor`}>{template.template_name}</a></td>
                <td data-label="Subject">{template.subject}</td>
                <td data-label="Category">{template.category}</td>
                <td data-label="Visibility">{template.visibility}</td>
                <td data-label="Status"><span className="status-pill">{template.is_active ? "active" : "inactive"}</span></td>
                <td data-label="Action"><a className="secondary-button compact-button table-action-button" href={`/fusionadmin/email-templates?templateId=${template.id}#template-editor`}>Edit</a></td>
              </tr>
            ))}
          </FusionDataTable>

          {selectedTemplate ? (
            <form action={updateFusionEmailTemplate} style={{ marginTop: "1rem" }}>
              <input name="templateId" type="hidden" value={selectedTemplate.id} />
              <div className="fusion-form-section__grid">
                <FusionField label="Template name" required>
                  <FusionInput defaultValue={selectedTemplate.template_name} name="templateName" required />
                </FusionField>
                <FusionField label="Subject" required>
                  <FusionInput defaultValue={selectedTemplate.subject} name="subject" required />
                </FusionField>
                <FusionField label="Category">
                  <FusionSelect defaultValue={selectedTemplate.category} name="category">
                    {CATEGORY_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                  </FusionSelect>
                </FusionField>
                <FusionField label="Visibility">
                  <FusionSelect defaultValue={selectedTemplate.visibility} name="visibility">
                    <option value="shared">Shared</option>
                    <option value="private">Private</option>
                  </FusionSelect>
                </FusionField>
                <FusionField className="fusion-field--full" hint="Allowed variables include {{contact_first_name}}, {{company_name}}, {{proposal_link}}, and {{organization_name}}." label="Body" required>
                  <FusionTextarea defaultValue={selectedTemplate.body} name="body" required rows={8} />
                </FusionField>
              </div>
              <FusionSwitch defaultChecked={selectedTemplate.is_active} label="Active" name="isActive" />
              <div className="fusion-form-actions fusion-form-actions--end">
                <a className="ghost-button compact-button" href="/fusionadmin/email-templates">Close</a>
                <FusionSubmitButton className="compact-button" pendingLabel="Saving template...">Save template</FusionSubmitButton>
              </div>
            </form>
          ) : null}
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
            <FusionSubmitButton pendingLabel="Creating...">Create template</FusionSubmitButton>
          </form>
        </article>
      </section>
    </div>
  );
}
