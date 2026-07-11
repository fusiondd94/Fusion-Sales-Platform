import { FormInput, PlusCircle } from "lucide-react";
import { createFusionCrmForm, updateFusionCrmForm } from "@/app/fusionadmin/actions";
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
  searchParams?: Promise<{ formId?: string }>;
};

const FORM_TYPE_OPTIONS = [
  "Lead Inquiry",
  "Contact Form",
  "Discovery Form",
  "Website Project Intake",
  "E-Commerce Intake",
  "Consultation Request",
  "Referral Form"
];

export default async function FusionFormsPage({ searchParams }: PageProps) {
  const filters = (await searchParams) || {};
  const salesOps = await getSalesOpsWorkspace();
  const selectedForm = salesOps.forms.find((form) => form.id === filters.formId);

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="CRM forms"
        title="Build lead capture and intake forms"
        description="Create secure internal or public forms that can later feed contacts, leads, tasks, and notifications."
      />

      <section className="admin-two-column">
        <article className="admin-panel panel-span-2" id="form-editor">
          <div className="panel-heading">
            <h2><FormInput size={20} /> Forms</h2>
            <span className="status-pill">{salesOps.forms.length} forms</span>
          </div>
          <FusionDataTable
            aria-label="CRM forms"
            columns={[
              { header: "Form", priority: "primary" },
              { header: "Type" },
              { header: "Slug" },
              { header: "Published" },
              { header: "Status" },
              { header: "Action", className: "table-action-column" }
            ]}
            empty={!salesOps.forms.length ? <EmptyState>No forms yet.</EmptyState> : null}
          >
            {salesOps.forms.map((form) => (
              <tr key={form.id}>
                <td data-label="Form"><a className="fusion-record-link" href={`/fusionadmin/forms?formId=${form.id}#form-editor`}>{form.form_name}</a></td>
                <td data-label="Type">{form.form_type}</td>
                <td data-label="Slug">{form.form_slug}</td>
                <td data-label="Published">{form.is_published ? "Published" : "Draft"}</td>
                <td data-label="Status"><span className="status-pill">{form.is_active ? "active" : "inactive"}</span></td>
                <td data-label="Action"><a className="secondary-button compact-button table-action-button" href={`/fusionadmin/forms?formId=${form.id}#form-editor`}>Edit</a></td>
              </tr>
            ))}
          </FusionDataTable>

          {selectedForm ? (
            <form action={updateFusionCrmForm} style={{ marginTop: "1rem" }}>
              <input name="formId" type="hidden" value={selectedForm.id} />
              <div className="fusion-form-section__grid">
                <FusionField label="Form name" required>
                  <FusionInput defaultValue={selectedForm.form_name} name="formName" required />
                </FusionField>
                <FusionField label="Form type">
                  <FusionSelect defaultValue={selectedForm.form_type} name="formType">
                    {FORM_TYPE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                  </FusionSelect>
                </FusionField>
                <FusionField className="fusion-field--full" label="Description">
                  <FusionTextarea defaultValue={selectedForm.description || ""} name="description" />
                </FusionField>
              </div>
              <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", margin: "0.5rem 0 1rem" }}>
                <FusionSwitch defaultChecked={selectedForm.is_published} label="Published" name="isPublished" />
                <FusionSwitch defaultChecked={selectedForm.is_active} label="Active" name="isActive" />
              </div>
              <div className="fusion-form-actions fusion-form-actions--end">
                <a className="ghost-button compact-button" href="/fusionadmin/forms">Close</a>
                <FusionSubmitButton className="compact-button" pendingLabel="Saving form...">Save form</FusionSubmitButton>
              </div>
            </form>
          ) : null}
        </article>

        <article className="admin-panel">
          <h2><PlusCircle size={20} /> Create form</h2>
          <form className="quick-form" action={createFusionCrmForm}>
            <input name="formName" placeholder="Form name" required />
            <select name="formType" defaultValue="Lead Inquiry">
              {FORM_TYPE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
            <textarea name="description" placeholder="Description" />
            <label className="toggle-row"><input name="isPublished" type="checkbox" /> <span>Publish form</span></label>
            <FusionSubmitButton pendingLabel="Creating...">Create form</FusionSubmitButton>
          </form>
        </article>
      </section>
    </div>
  );
}
