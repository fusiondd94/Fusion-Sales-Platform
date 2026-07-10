import { Building2, Search, UserRoundPlus, UsersRound } from "lucide-react";
import { createFusionContact, updateFusionClientProject, updateFusionContact } from "@/app/fusionadmin/actions";
import { getFusionCrmWorkspace } from "@/lib/crm";
import { getAdminPortalClients } from "@/lib/portal";
import { EmptyState, formatCurrency, optionList, PageHeader } from "../crm-ui";

type PageProps = {
  searchParams?: Promise<{ q?: string; status?: string }>;
};

export default async function FusionClientsPage({ searchParams }: PageProps) {
  const filters = (await searchParams) || {};
  const [crm, portalClients] = await Promise.all([
    getFusionCrmWorkspace(filters),
    getAdminPortalClients()
  ]);
  const leadSources = optionList(crm.settings?.lead_sources);
  const contactStatuses = Array.from(new Set(["new", "prospect", "qualified", "client", "inactive", ...(crm.settings?.lead_statuses || [])]));
  const projectStatuses = ["not_started", "in_progress", "review", "done", "on_hold"];

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Clients"
        title="Manage leads, contacts, and companies"
        description="Keep the people and businesses coming through the platform organized for follow-up and delivery."
        action={
          <form className="admin-search" action="/fusionadmin/clients">
            <Search size={17} />
            <input defaultValue={filters.q || ""} name="q" placeholder="Search clients" />
            <button type="submit">Search</button>
          </form>
        }
      />

      <section className="admin-two-column">
        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><UsersRound size={20} /> Platform leads</h2>
            <span className="status-pill">{crm.leads.length} records</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Contact</th>
                  <th>Offer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {crm.leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.company}<br /><span className="muted">{lead.lead_code} · {lead.website || "No website"}</span></td>
                    <td>{lead.customer_name}<br /><span className="muted">{lead.customer_email} · {lead.customer_phone}</span></td>
                    <td>{lead.package_name}<br /><span className="muted">{formatCurrency(lead.total_today)} + ${lead.monthly_due}/mo</span></td>
                    <td><span className="status-pill">{lead.status}</span></td>
                  </tr>
                ))}
                {!crm.leads.length ? (
                  <tr><td colSpan={4}><EmptyState>No matching leads yet.</EmptyState></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="admin-panel">
          <h2><UserRoundPlus size={20} /> Add contact</h2>
          <form className="quick-form" action={createFusionContact}>
            <input name="firstName" placeholder="First name" required />
            <input name="lastName" placeholder="Last name" />
            <input name="email" placeholder="Email" type="email" />
            <input name="phone" placeholder="Phone" />
            <input name="companyName" placeholder="Company" />
            <select name="leadSource" defaultValue="Manual">
              <option>Manual</option>
              {leadSources.map((source) => <option key={source}>{source}</option>)}
            </select>
            <button className="primary-button" type="submit">Create contact</button>
          </form>
        </article>

        <article className="admin-panel">
          <div className="panel-heading">
            <h2><Building2 size={20} /> Companies</h2>
            <span className="status-pill">{crm.companies.length}</span>
          </div>
          <div className="stack-list">
            {crm.companies.map((company) => (
              <p key={company.id}><strong>{company.company_name}</strong><br /><span className="muted">{company.industry || "Industry not set"} · {company.lifecycle_status}</span></p>
            ))}
            {!crm.companies.length ? <EmptyState>Companies are created from contacts, deals, and paid leads.</EmptyState> : null}
          </div>
        </article>

        <article className="admin-panel">
          <div className="panel-heading">
            <h2><UsersRound size={20} /> Contacts</h2>
            <span className="status-pill">{crm.contacts.length}</span>
          </div>
          <div className="stack-list">
            {crm.contacts.map((contact) => (
              <form key={contact.id} className="record-edit-card" action={updateFusionContact}>
                <input name="contactId" type="hidden" value={contact.id} />
                <div className="record-edit-heading">
                  <strong>{contact.display_name}</strong>
                  <span className="status-pill">{contact.lifecycle_status}</span>
                </div>
                <div className="record-edit-grid">
                  <label>
                    Name
                    <input name="displayName" defaultValue={contact.display_name} required />
                  </label>
                  <label>
                    Email
                    <input name="email" defaultValue={contact.email || ""} type="email" />
                  </label>
                  <label>
                    Phone
                    <input name="phone" defaultValue={contact.phone || ""} />
                  </label>
                  <label>
                    Company
                    <input name="companyName" defaultValue={contact.crm_companies?.company_name || ""} />
                  </label>
                  <label>
                    Role
                    <input name="jobTitle" defaultValue={contact.job_title || ""} />
                  </label>
                  <label>
                    Status
                    <select name="lifecycleStatus" defaultValue={contact.lifecycle_status || "new"}>
                      {contactStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  <label>
                    Lead source
                    <select name="leadSource" defaultValue={contact.lead_source || "Manual"}>
                      <option>Manual</option>
                      {leadSources.map((source) => <option key={source}>{source}</option>)}
                    </select>
                  </label>
                  <label>
                    Next follow-up
                    <input name="nextFollowUpAt" type="datetime-local" defaultValue={toDateTimeLocal(contact.next_follow_up_at)} />
                  </label>
                </div>
                <button className="secondary-button compact-button" type="submit">Save contact</button>
              </form>
            ))}
            {!crm.contacts.length ? <EmptyState>No contacts yet. Create the first one from the form.</EmptyState> : null}
          </div>
        </article>

        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><Building2 size={20} /> Client portal projects</h2>
            <span className="status-pill">{portalClients.length}</span>
          </div>
          <div className="portal-admin-grid">
            {portalClients.map((client) => (
              <form key={client.id} className="record-edit-card" action={updateFusionClientProject}>
                <input name="clientId" type="hidden" value={client.id} />
                <div className="record-edit-heading">
                  <strong>{client.company}</strong>
                  <span className="status-pill">{client.project?.project_status || "in_progress"}</span>
                </div>
                <p className="muted">
                  {client.customer_name} · {client.customer_email} · {client.commentCount || 0} comments · {client.fileCount || 0} files
                </p>
                <div className="record-edit-grid">
                  <label>
                    Project name
                    <input name="projectName" defaultValue={client.project?.project_name || "Website Project"} />
                  </label>
                  <label>
                    Project status
                    <select name="projectStatus" defaultValue={client.project?.project_status || "in_progress"}>
                      {projectStatuses.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
                    </select>
                  </label>
                  <label>
                    Current phase
                    <input name="currentPhase" defaultValue={client.project?.current_phase || "Design Review"} />
                  </label>
                  <label>
                    Preview URL for client
                    <input name="previewUrl" defaultValue={client.project?.preview_url || ""} placeholder="https://preview-domain.com" />
                  </label>
                  <label>
                    Final live URL
                    <input name="liveUrl" defaultValue={client.project?.live_url || ""} placeholder="https://client-domain.com" />
                  </label>
                  <label>
                    Portal access
                    <input readOnly value={client.portal_user_id ? "Client account connected" : "Waiting for client login"} />
                  </label>
                  <label className="full-field">
                    Client instructions
                    <textarea name="clientInstructions" defaultValue={client.project?.client_instructions || ""} placeholder="Tell the client what to review or upload next." />
                  </label>
                </div>
                {client.recentComments?.length ? (
                  <div className="portal-admin-comments">
                    {client.recentComments.map((comment) => (
                      <p key={comment.id}>
                        <strong>{comment.author_name}</strong>
                        <span>{comment.body}</span>
                      </p>
                    ))}
                  </div>
                ) : null}
                <button className="secondary-button compact-button" type="submit">Save portal project</button>
              </form>
            ))}
            {!portalClients.length ? <EmptyState>Paid client records will appear here after checkout creates the client profile.</EmptyState> : null}
          </div>
        </article>
      </section>
    </div>
  );
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}
