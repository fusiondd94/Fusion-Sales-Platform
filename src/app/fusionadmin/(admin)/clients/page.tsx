import { Building2, Search, UserRoundPlus, UsersRound } from "lucide-react";
import { createFusionContact, updateFusionClientProject, updateFusionContact, updateFusionLead } from "@/app/fusionadmin/actions";
import { getFusionCrmWorkspace } from "@/lib/crm";
import { getAdminPortalClients } from "@/lib/portal";
import { EmptyState, formatCurrency, FusionDataTable, optionList, PageHeader } from "../crm-ui";

type PageProps = {
  searchParams?: Promise<{ q?: string; status?: string; leadId?: string }>;
};

export default async function FusionClientsPage({ searchParams }: PageProps) {
  const filters = (await searchParams) || {};
  const [crm, portalClients] = await Promise.all([
    getFusionCrmWorkspace(filters),
    getAdminPortalClients()
  ]);
  const leadSources = optionList(crm.settings?.lead_sources);
  const contactStatuses = Array.from(new Set(["new", "prospect", "qualified", "client", "inactive", ...(crm.settings?.lead_statuses || [])]));
  const leadStatuses = Array.from(new Set(["captured", "checkout_started", "paid", "qualified", "proposal_sent", "won", "lost", "unqualified", ...(crm.settings?.lead_statuses || [])]));
  const projectStatuses = ["not_started", "in_progress", "review", "done", "on_hold"];
  const selectedLead = crm.leads.find((lead) => lead.id === filters.leadId);

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
          <FusionDataTable
            aria-label="Platform leads"
            columns={[
              { header: "Lead", priority: "primary" },
              { header: "Contact" },
              { header: "Offer" },
              { header: "Status" },
              { header: "Action", className: "table-action-column" }
            ]}
            empty={!crm.leads.length ? <EmptyState>No matching leads yet.</EmptyState> : null}
          >
            {crm.leads.map((lead) => (
              <tr id={`lead-${lead.id}`} key={lead.id}>
                <td data-label="Lead">
                  <a className="lead-edit-link" href={`/fusionadmin/clients?leadId=${lead.id}#lead-editor`}>
                    {lead.company}
                  </a>
                  <br />
                  <span className="muted">{lead.lead_code} · {lead.website || "No website"}</span>
                </td>
                <td data-label="Contact">{lead.customer_name}<br /><span className="muted">{lead.customer_email} · {lead.customer_phone}</span></td>
                <td data-label="Offer">{lead.package_name}<br /><span className="muted">{formatCurrency(lead.total_today)} + ${lead.monthly_due}/mo</span></td>
                <td data-label="Status"><span className="status-pill">{lead.status}</span></td>
                <td data-label="Action"><a className="secondary-button compact-button table-action-button" href={`/fusionadmin/clients?leadId=${lead.id}#lead-editor`}>Edit</a></td>
              </tr>
            ))}
          </FusionDataTable>
        </article>

        {selectedLead ? (
          <article className="admin-panel panel-span-2" id="lead-editor">
            <div className="panel-heading">
              <h2><UsersRound size={20} /> Edit lead</h2>
              <span className="status-pill">{selectedLead.lead_code}</span>
            </div>
            <form className="record-edit-card lead-editor-card" action={updateFusionLead}>
              <input name="leadId" type="hidden" value={selectedLead.id} />
              <div className="record-edit-grid">
                <label>
                  Company
                  <input name="company" defaultValue={selectedLead.company} required />
                </label>
                <label>
                  Customer name
                  <input name="customerName" defaultValue={selectedLead.customer_name} required />
                </label>
                <label>
                  Email
                  <input name="customerEmail" defaultValue={selectedLead.customer_email} required type="email" />
                </label>
                <label>
                  Phone
                  <input name="customerPhone" defaultValue={selectedLead.customer_phone || ""} />
                </label>
                <label>
                  Website
                  <input name="website" defaultValue={selectedLead.website || ""} />
                </label>
                <label>
                  Industry
                  <input name="industry" defaultValue={selectedLead.industry || ""} />
                </label>
                <label>
                  Status
                  <select name="status" defaultValue={selectedLead.status}>
                    {leadStatuses.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
                  </select>
                </label>
                <label>
                  Package
                  <input name="packageName" defaultValue={selectedLead.package_name || ""} />
                </label>
                <label>
                  Setup due today
                  <input name="totalToday" defaultValue={selectedLead.total_today} min="0" type="number" />
                </label>
                <label>
                  Monthly due
                  <input name="monthlyDue" defaultValue={selectedLead.monthly_due} min="0" type="number" />
                </label>
                <label>
                  Discount %
                  <input name="discountPercent" defaultValue={selectedLead.discount_percent} max="75" min="0" type="number" />
                </label>
                <label>
                  Timeline
                  <input name="timeline" defaultValue={selectedLead.timeline || ""} />
                </label>
                <label>
                  Budget
                  <input name="budget" defaultValue={selectedLead.budget || ""} />
                </label>
                <label>
                  Objection
                  <input name="objection" defaultValue={selectedLead.objection || ""} />
                </label>
                <label className="full-field">
                  Business goal
                  <textarea name="goal" defaultValue={selectedLead.goal || ""} />
                </label>
                <label className="full-field">
                  Project notes
                  <textarea name="projectNotes" defaultValue={selectedLead.project_notes || ""} />
                </label>
              </div>
              <div className="record-edit-actions">
                <a className="ghost-button compact-button" href="/fusionadmin/clients">Close</a>
                <button className="primary-button compact-button" type="submit">Save lead</button>
              </div>
            </form>
          </article>
        ) : null}

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
                <p><a className="text-link" href={`/portal?clientId=${client.id}`}>Open client portal preview</a></p>
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
