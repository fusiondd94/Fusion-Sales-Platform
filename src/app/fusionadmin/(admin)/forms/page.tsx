import { FormInput, PlusCircle } from "lucide-react";
import { createFusionCrmForm } from "@/app/fusionadmin/actions";
import { getSalesOpsWorkspace } from "@/lib/sales-ops";
import { EmptyState, PageHeader } from "../crm-ui";

export default async function FusionFormsPage() {
  const salesOps = await getSalesOpsWorkspace();

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="CRM forms"
        title="Build lead capture and intake forms"
        description="Create secure internal or public forms that can later feed contacts, leads, tasks, and notifications."
      />

      <section className="admin-two-column">
        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><FormInput size={20} /> Forms</h2>
            <span className="status-pill">{salesOps.forms.length} forms</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Form</th>
                  <th>Type</th>
                  <th>Slug</th>
                  <th>Published</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {salesOps.forms.map((form) => (
                  <tr key={form.id}>
                    <td>{form.form_name}</td>
                    <td>{form.form_type}</td>
                    <td>{form.form_slug}</td>
                    <td>{form.is_published ? "Published" : "Draft"}</td>
                    <td><span className="status-pill">{form.is_active ? "active" : "inactive"}</span></td>
                  </tr>
                ))}
                {!salesOps.forms.length ? (
                  <tr><td colSpan={5}><EmptyState>No forms yet.</EmptyState></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="admin-panel">
          <h2><PlusCircle size={20} /> Create form</h2>
          <form className="quick-form" action={createFusionCrmForm}>
            <input name="formName" placeholder="Form name" required />
            <select name="formType" defaultValue="Lead Inquiry">
              <option>Lead Inquiry</option>
              <option>Contact Form</option>
              <option>Discovery Form</option>
              <option>Website Project Intake</option>
              <option>E-Commerce Intake</option>
              <option>Consultation Request</option>
              <option>Referral Form</option>
            </select>
            <textarea name="description" placeholder="Description" />
            <label className="toggle-row"><input name="isPublished" type="checkbox" /> <span>Publish form</span></label>
            <button className="primary-button" type="submit">Create form</button>
          </form>
        </article>
      </section>
    </div>
  );
}
