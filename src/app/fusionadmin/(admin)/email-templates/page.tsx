import { Edit3, Eye, Mail, PlusCircle, Search, Send, Tags } from "lucide-react";
import { createFusionEmailTemplate, updateFusionEmailTemplate } from "@/app/fusionadmin/actions";
import { ALLOWED_TEMPLATE_VARIABLES, getSalesOpsWorkspace, type SalesOpsEmailTemplate } from "@/lib/sales-ops";
import {
  EmptyState,
  formatDate,
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
  searchParams?: Promise<{ q?: string; category?: string; templateId?: string }>;
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

const mergeTagGroups = [
  { label: "Contact", variables: ["contact_first_name", "contact_last_name", "contact_full_name"] },
  { label: "Company", variables: ["company_name"] },
  { label: "Deal", variables: ["deal_title", "deal_value"] },
  { label: "Proposal", variables: ["proposal_title", "proposal_number", "proposal_link", "proposal_expiration_date"] },
  { label: "User", variables: ["assigned_user_name"] },
  { label: "Calendar", variables: ["appointment_title", "appointment_date", "appointment_time"] },
  { label: "System", variables: ["organization_name", "organization_phone", "organization_website"] }
].map((group) => ({
  ...group,
  variables: group.variables.filter((variable) => ALLOWED_TEMPLATE_VARIABLES.includes(variable))
})).filter((group) => group.variables.length);

function normalize(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function emailPreviewDocument(template: SalesOpsEmailTemplate) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; background: #f7f8fa; color: #26333b; font-family: Inter, Arial, sans-serif; }
      .wrap { max-width: 620px; margin: 0 auto; padding: 24px; }
      .message { border: 1px solid #dfe5ea; background: #ffffff; padding: 24px; }
      .subject { margin: 0 0 18px; color: #004443; font-size: 18px; line-height: 1.35; }
      .body { color: #36454f; font-size: 15px; line-height: 1.65; }
      a { color: #0e6c6a; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <article class="message">
        <h1 class="subject">${escapeHtml(template.subject)}</h1>
        <div class="body">${template.body}</div>
      </article>
    </main>
  </body>
</html>`;
}

function buildTemplateUrl(templateId: string, filters: { q?: string; category?: string }) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  params.set("templateId", templateId);
  return `/fusionadmin/email-templates?${params.toString()}`;
}

export default async function FusionEmailTemplatesPage({ searchParams }: PageProps) {
  const filters = (await searchParams) || {};
  const salesOps = await getSalesOpsWorkspace();
  const categories = Array.from(new Set([...CATEGORY_OPTIONS, ...salesOps.emailTemplates.map((template) => template.category).filter(Boolean)]));
  const query = normalize(filters.q);
  const filteredTemplates = salesOps.emailTemplates.filter((template) => {
    const matchesQuery = !query || [template.template_name, template.subject, template.category, template.plain_text_body || template.body]
      .some((value) => normalize(value).includes(query));
    const matchesCategory = !filters.category || template.category === filters.category;
    return matchesQuery && matchesCategory;
  });
  const selectedTemplate = filteredTemplates.find((template) => template.id === filters.templateId) || filteredTemplates[0] || salesOps.emailTemplates[0];
  const activeCount = salesOps.emailTemplates.filter((template) => template.is_active).length;

  return (
    <div className="admin-content email-template-page">
      <PageHeader
        eyebrow="Email templates"
        title="Manage reusable sales messages"
        description="Create polished follow-up, proposal, reminder, and onboarding content for the Fusion sales workflow."
        action={
          <form className="admin-search email-template-search" action="/fusionadmin/email-templates">
            <Search size={17} />
            <input aria-label="Search templates" defaultValue={filters.q || ""} name="q" placeholder="Search templates" />
            <select defaultValue={filters.category || ""} name="category" aria-label="Template category">
              <option value="">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <button type="submit">Search</button>
          </form>
        }
      />

      <section className="email-template-summary" aria-label="Email template summary">
        <div>
          <strong>{salesOps.emailTemplates.length}</strong>
          <span>Total templates</span>
        </div>
        <div>
          <strong>{activeCount}</strong>
          <span>Active</span>
        </div>
        <div>
          <strong>{categories.length}</strong>
          <span>Categories</span>
        </div>
        <div>
          <strong>{ALLOWED_TEMPLATE_VARIABLES.length}</strong>
          <span>Supported merge tags</span>
        </div>
      </section>

      <section className="email-template-workspace">
        <article className="admin-panel email-template-list-panel">
          <div className="panel-heading">
            <h2><Mail size={20} /> Template library</h2>
            <span className="status-pill">{filteredTemplates.length} shown</span>
          </div>
          <FusionDataTable
            aria-label="Email templates"
            columns={[
              { header: "Template", priority: "primary" },
              { header: "Category" },
              { header: "Status" },
              { header: "Updated" },
              { header: "Action", className: "table-action-column" }
            ]}
            empty={!filteredTemplates.length ? <EmptyState>No matching templates yet.</EmptyState> : null}
          >
            {filteredTemplates.map((template) => (
              <tr key={template.id}>
                <td data-label="Template">
                  <strong>{template.template_name}</strong>
                  <br />
                  <span className="muted">{template.subject}</span>
                </td>
                <td data-label="Category">{template.category}<br /><span className="muted">{template.visibility}</span></td>
                <td data-label="Status"><span className="status-pill">{template.is_active ? "active" : "inactive"}</span></td>
                <td data-label="Updated">{formatDate(template.updated_at)}</td>
                <td data-label="Action">
                  <a className="secondary-button compact-button table-action-button" href={`${buildTemplateUrl(template.id, filters)}#template-editor`}>
                    <Edit3 size={15} /> Edit
                  </a>
                </td>
              </tr>
            ))}
          </FusionDataTable>
        </article>

        <aside className="admin-panel email-template-preview-panel" id="template-preview">
          <div className="panel-heading">
            <h2><Eye size={20} /> Preview</h2>
            {selectedTemplate ? <span className="status-pill">{selectedTemplate.is_active ? "active" : "inactive"}</span> : null}
          </div>
          {selectedTemplate ? (
            <>
              <div className="template-metadata-grid">
                <p><span>Template</span><strong>{selectedTemplate.template_name}</strong></p>
                <p><span>Category</span><strong>{selectedTemplate.category}</strong></p>
                <p><span>Visibility</span><strong>{selectedTemplate.visibility}</strong></p>
                <p><span>Updated</span><strong>{formatDate(selectedTemplate.updated_at)}</strong></p>
              </div>
              <div className="sender-card">
                <Send size={17} />
                <div>
                  <strong>Fusion Digital Dynamics</strong>
                  <span>Provider setup required before live sending</span>
                </div>
              </div>
              <div className="preview-device-tabs" aria-label="Preview sizes">
                <span>Desktop</span>
                <span>Mobile</span>
              </div>
              <div className="template-preview-grid">
                <iframe
                  className="template-preview-frame template-preview-frame-desktop"
                  sandbox=""
                  srcDoc={emailPreviewDocument(selectedTemplate)}
                  title={`${selectedTemplate.template_name} desktop preview`}
                />
                <iframe
                  className="template-preview-frame template-preview-frame-mobile"
                  sandbox=""
                  srcDoc={emailPreviewDocument(selectedTemplate)}
                  title={`${selectedTemplate.template_name} mobile preview`}
                />
              </div>
              <div className="template-supported-tags">
                <h3><Tags size={17} /> Used merge set</h3>
                <div className="template-chip-list">
                  {(selectedTemplate.supported_variables?.length ? selectedTemplate.supported_variables : ALLOWED_TEMPLATE_VARIABLES).map((variable) => (
                    <code key={variable}>{"{{"}{variable}{"}}"}</code>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <EmptyState>Select or create a template to preview it.</EmptyState>
          )}
        </aside>

        {selectedTemplate ? (
          <article className="admin-panel email-template-edit-panel" id="template-editor">
            <div className="panel-heading">
              <h2><Edit3 size={20} /> Edit template</h2>
              <span className="status-pill">{selectedTemplate.category}</span>
            </div>
            <form action={updateFusionEmailTemplate} data-track-unsaved="true">
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
                    {categories.map((option) => <option key={option}>{option}</option>)}
                  </FusionSelect>
                </FusionField>
                <FusionField label="Visibility">
                  <FusionSelect defaultValue={selectedTemplate.visibility} name="visibility">
                    <option value="shared">Shared</option>
                    <option value="private">Private</option>
                  </FusionSelect>
                </FusionField>
                <FusionField className="fusion-field--full" hint="Allowed variables are listed in the merge-tag panel." label="Body" required>
                  <FusionTextarea defaultValue={selectedTemplate.body} name="body" required rows={9} />
                </FusionField>
              </div>
              <FusionSwitch defaultChecked={selectedTemplate.is_active} label="Active" name="isActive" />
              <div className="fusion-form-actions fusion-form-actions--end">
                <a className="ghost-button compact-button" href="/fusionadmin/email-templates">Close</a>
                <FusionSubmitButton className="compact-button" pendingLabel="Saving template...">Save template</FusionSubmitButton>
              </div>
            </form>
          </article>
        ) : null}

        <article className="admin-panel email-template-create-panel">
          <div className="panel-heading">
            <h2><PlusCircle size={20} /> Create template</h2>
            <span className="status-pill">shared ready</span>
          </div>
          <form className="quick-form template-builder-form" action={createFusionEmailTemplate} data-track-unsaved="true">
            <label>
              Template name
              <input name="templateName" placeholder="Proposal decision follow-up" required />
            </label>
            <label>
              Subject
              <input name="subject" placeholder="Your Fusion website proposal is ready" required />
            </label>
            <div className="form-grid two">
              <label>
                Category
                <select name="category" defaultValue="General Sales">
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label>
                Visibility
                <select name="visibility" defaultValue="shared">
                  <option value="shared">Shared</option>
                  <option value="private">Private</option>
                </select>
              </label>
            </div>
            <label>
              Body
              <textarea
                name="body"
                placeholder="Hi {{contact_first_name}},<br><br>Your proposal is ready: {{proposal_link}}"
                required
              />
            </label>
            <FusionSubmitButton pendingLabel="Creating template...">Create template</FusionSubmitButton>
          </form>
        </article>

        <article className="admin-panel merge-tag-panel">
          <div className="panel-heading">
            <h2><Tags size={20} /> Merge tags</h2>
            <span className="status-pill">{ALLOWED_TEMPLATE_VARIABLES.length}</span>
          </div>
          <div className="merge-tag-groups">
            {mergeTagGroups.map((group) => (
              <section className="merge-tag-group" key={group.label}>
                <h3>{group.label}</h3>
                <div className="template-chip-list">
                  {group.variables.map((variable) => <code key={variable}>{"{{"}{variable}{"}}"}</code>)}
                </div>
              </section>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
