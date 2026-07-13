import { Building2, CheckCircle2, Search, Trash2, UserRoundPlus, UsersRound } from "lucide-react";
import {
  assignFusionClientTask,
  createFusionClient,
  createFusionContact,
  deleteFusionProjectComment,
  resolveFusionProjectComment,
  updateFusionClientProject,
  updateFusionCompany,
  updateFusionContact,
  updateFusionLead
} from "@/app/fusionadmin/actions";
import { getFusionCrmWorkspace } from "@/lib/crm";
import { getAdminPortalClients } from "@/lib/portal";
import {
  EmptyState,
  formatCurrency,
  FusionDataTable,
  FusionField,
  FusionInput,
  FusionSelect,
  FusionSubmitButton,
  FusionTextarea,
  optionList,
  PageHeader
} from "../crm-ui";

type PageProps = {
  searchParams?: Promise<{ q?: string; status?: string; leadId?: string; companyId?: string; contactId?: string; clientId?: string }>;
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
  const paymentStatuses = ["unpaid", "partial", "paid"];
  const selectedLead = crm.leads.find((lead) => lead.id === filters.leadId);
  const selectedCompany = crm.companies.find((company) => company.id === filters.companyId);
  const selectedContact = crm.contacts.find((contact) => contact.id === filters.contactId);
  const selectedPortalClient = portalClients.find((client) => client.id === filters.clientId);

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Clients"
        title="Manage leads, contacts, and companies"
        description="Keep the people and businesses coming through the platform organized for follow-up and delivery."
        action={
          <form className="admin-search" action="/fusionadmin/clients">
            <Search size={17} />
            <input aria-label="Search clients" defaultValue={filters.q || ""} name="q" placeholder="Search clients" />
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
                  <a className="lead-edit-link fusion-record-link" href={`/fusionadmin/clients?leadId=${lead.id}#lead-editor`}>
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
            <form className="record-edit-card lead-editor-card" action={updateFusionLead} data-track-unsaved="true">
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
                <FusionSubmitButton className="compact-button" pendingLabel="Saving lead...">Save lead</FusionSubmitButton>
              </div>
            </form>
          </article>
        ) : null}

        <article className="admin-panel">
          <h2><UserRoundPlus size={20} /> Add contact</h2>
          <form className="quick-form" action={createFusionContact} data-track-unsaved="true">
            <input aria-label="First name" name="firstName" placeholder="First name" required />
            <input aria-label="Last name" name="lastName" placeholder="Last name" />
            <input aria-label="Email" name="email" placeholder="Email" type="email" />
            <input aria-label="Phone" name="phone" placeholder="Phone" />
            <input aria-label="Company" name="companyName" placeholder="Company" />
            <select aria-label="Lead source" name="leadSource" defaultValue="Manual">
              <option>Manual</option>
              {leadSources.map((source) => <option key={source}>{source}</option>)}
            </select>
            <FusionSubmitButton pendingLabel="Creating...">Create contact</FusionSubmitButton>
          </form>
        </article>

        <article className="admin-panel panel-span-2" id="company-editor">
          <div className="panel-heading">
            <h2><Building2 size={20} /> Companies</h2>
            <span className="status-pill">{crm.companies.length}</span>
          </div>
          <FusionDataTable
            aria-label="Companies"
            columns={[
              { header: "Company", priority: "primary" },
              { header: "Industry" },
              { header: "Status" },
              { header: "Action", className: "table-action-column" }
            ]}
            empty={!crm.companies.length ? <EmptyState>Companies are created from contacts, deals, and paid leads.</EmptyState> : null}
          >
            {crm.companies.map((company) => (
              <tr key={company.id}>
                <td data-label="Company">
                  <a className="fusion-record-link" href={`/fusionadmin/clients?companyId=${company.id}#company-editor`}>{company.company_name}</a>
                </td>
                <td data-label="Industry">{company.industry || "Not set"}</td>
                <td data-label="Status"><span className="status-pill">{company.lifecycle_status}</span></td>
                <td data-label="Action"><a className="secondary-button compact-button table-action-button" href={`/fusionadmin/clients?companyId=${company.id}#company-editor`}>Edit</a></td>
              </tr>
            ))}
          </FusionDataTable>

          {selectedCompany ? (
            <form action={updateFusionCompany} data-track-unsaved="true" style={{ marginTop: "1rem" }}>
              <input name="companyId" type="hidden" value={selectedCompany.id} />
              <div className="fusion-form-section__grid">
                <FusionField label="Company name" required>
                  <FusionInput defaultValue={selectedCompany.company_name} name="companyName" required />
                </FusionField>
                <FusionField label="Industry">
                  <FusionInput defaultValue={selectedCompany.industry || ""} name="industry" />
                </FusionField>
                <FusionField label="Website">
                  <FusionInput defaultValue={selectedCompany.website || ""} name="website" />
                </FusionField>
                <FusionField label="Main phone">
                  <FusionInput defaultValue={selectedCompany.main_phone || ""} name="mainPhone" />
                </FusionField>
                <FusionField label="General email">
                  <FusionInput defaultValue={selectedCompany.general_email || ""} name="generalEmail" type="email" />
                </FusionField>
                <FusionField label="Status">
                  <FusionSelect defaultValue={selectedCompany.lifecycle_status || "new"} name="lifecycleStatus">
                    {contactStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </FusionSelect>
                </FusionField>
                <FusionField label="Lead source">
                  <FusionSelect defaultValue={selectedCompany.lead_source || "Manual"} name="leadSource">
                    <option>Manual</option>
                    {leadSources.map((source) => <option key={source}>{source}</option>)}
                  </FusionSelect>
                </FusionField>
              </div>
              <div className="fusion-form-actions fusion-form-actions--end">
                <a className="ghost-button compact-button" href="/fusionadmin/clients">Close</a>
                <FusionSubmitButton className="compact-button" pendingLabel="Saving company...">Save company</FusionSubmitButton>
              </div>
            </form>
          ) : null}
        </article>

        <article className="admin-panel panel-span-2" id="contact-editor">
          <div className="panel-heading">
            <h2><UsersRound size={20} /> Contacts</h2>
            <span className="status-pill">{crm.contacts.length}</span>
          </div>
          <FusionDataTable
            aria-label="Contacts"
            columns={[
              { header: "Contact", priority: "primary" },
              { header: "Company" },
              { header: "Status" },
              { header: "Action", className: "table-action-column" }
            ]}
            empty={!crm.contacts.length ? <EmptyState>No contacts yet. Create the first one from the form.</EmptyState> : null}
          >
            {crm.contacts.map((contact) => (
              <tr key={contact.id}>
                <td data-label="Contact">
                  <a className="fusion-record-link" href={`/fusionadmin/clients?contactId=${contact.id}#contact-editor`}>{contact.display_name}</a>
                  <br />
                  <span className="muted">{contact.email || "No email"} · {contact.phone || "No phone"}</span>
                </td>
                <td data-label="Company">{contact.crm_companies?.company_name || "No company"}</td>
                <td data-label="Status"><span className="status-pill">{contact.lifecycle_status}</span></td>
                <td data-label="Action"><a className="secondary-button compact-button table-action-button" href={`/fusionadmin/clients?contactId=${contact.id}#contact-editor`}>Edit</a></td>
              </tr>
            ))}
          </FusionDataTable>

          {selectedContact ? (
            <form action={updateFusionContact} data-track-unsaved="true" style={{ marginTop: "1rem" }}>
              <input name="contactId" type="hidden" value={selectedContact.id} />
              <div className="fusion-form-section__grid">
                <FusionField label="Name" required>
                  <FusionInput defaultValue={selectedContact.display_name} name="displayName" required />
                </FusionField>
                <FusionField label="Email">
                  <FusionInput defaultValue={selectedContact.email || ""} name="email" type="email" />
                </FusionField>
                <FusionField label="Phone">
                  <FusionInput defaultValue={selectedContact.phone || ""} name="phone" />
                </FusionField>
                <FusionField label="Company">
                  <FusionInput defaultValue={selectedContact.crm_companies?.company_name || ""} name="companyName" />
                </FusionField>
                <FusionField label="Role">
                  <FusionInput defaultValue={selectedContact.job_title || ""} name="jobTitle" />
                </FusionField>
                <FusionField label="Status">
                  <FusionSelect defaultValue={selectedContact.lifecycle_status || "new"} name="lifecycleStatus">
                    {contactStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </FusionSelect>
                </FusionField>
                <FusionField label="Lead source">
                  <FusionSelect defaultValue={selectedContact.lead_source || "Manual"} name="leadSource">
                    <option>Manual</option>
                    {leadSources.map((source) => <option key={source}>{source}</option>)}
                  </FusionSelect>
                </FusionField>
                <FusionField label="Next follow-up">
                  <FusionInput name="nextFollowUpAt" type="datetime-local" defaultValue={toDateTimeLocal(selectedContact.next_follow_up_at)} />
                </FusionField>
              </div>
              <div className="fusion-form-actions fusion-form-actions--end">
                <a className="ghost-button compact-button" href="/fusionadmin/clients">Close</a>
                <FusionSubmitButton className="compact-button" pendingLabel="Saving contact...">Save contact</FusionSubmitButton>
              </div>
            </form>
          ) : null}
        </article>

        <article className="admin-panel panel-span-2" id="add-client-editor">
          <div className="panel-heading">
            <h2><UserRoundPlus size={20} /> Add client</h2>
            <span className="status-pill">Manual / demo</span>
          </div>
          <p className="muted">Create a client account outside the normal checkout flow — useful for demos, manually-paid clients, or onboarding help. This creates their portal login, marks them active, and sets up their review project in one step.</p>
          <form action={createFusionClient} data-track-unsaved="true">
            <div className="fusion-form-section__grid">
              <FusionField label="Full name" required>
                <FusionInput name="customerName" placeholder="Jane Doe" required />
              </FusionField>
              <FusionField label="Email" required>
                <FusionInput name="customerEmail" placeholder="jane@example.com" required type="email" />
              </FusionField>
              <FusionField label="Company">
                <FusionInput name="company" placeholder="Company name" />
              </FusionField>
              <FusionField label="Portal password" required>
                <FusionInput name="password" placeholder="Set a login password for the client" required />
              </FusionField>
              <FusionField label="Project name">
                <FusionInput name="projectName" placeholder="Website Project" />
              </FusionField>
              <FusionField label="Preview / review URL">
                <FusionInput name="previewUrl" placeholder="https://your-preview-site.com" />
              </FusionField>
              <FusionField label="Live URL">
                <FusionInput name="liveUrl" placeholder="https://client-domain.com" />
              </FusionField>
              <FusionField className="fusion-field--full" label="Client instructions">
                <FusionTextarea name="clientInstructions" placeholder="Tell the client what to review or click through." />
              </FusionField>
            </div>
            <div className="fusion-form-actions fusion-form-actions--end">
              <FusionSubmitButton className="compact-button" pendingLabel="Creating client...">Create client</FusionSubmitButton>
            </div>
          </form>
        </article>

        <article className="admin-panel panel-span-2" id="portal-editor">
          <div className="panel-heading">
            <h2><Building2 size={20} /> Client portal projects</h2>
            <span className="status-pill">{portalClients.length}</span>
          </div>
          <FusionDataTable
            aria-label="Client portal projects"
            columns={[
              { header: "Client", priority: "primary" },
              { header: "Project status" },
              { header: "Activity" },
              { header: "Action", className: "table-action-column" }
            ]}
            empty={!portalClients.length ? <EmptyState>Paid client records will appear here after checkout creates the client profile.</EmptyState> : null}
          >
            {portalClients.map((client) => (
              <tr key={client.id}>
                <td data-label="Client">
                  <a className="fusion-record-link" href={`/fusionadmin/clients?clientId=${client.id}#portal-editor`}>{client.company}</a>
                  <br />
                  <span className="muted">{client.customer_name} · {client.customer_email}</span>
                </td>
                <td data-label="Project status"><span className="status-pill">{client.project?.project_status || "in_progress"}</span></td>
                <td data-label="Activity">{client.commentCount || 0} comments · {client.fileCount || 0} files</td>
                <td data-label="Action"><a className="secondary-button compact-button table-action-button" href={`/fusionadmin/clients?clientId=${client.id}#portal-editor`}>Edit</a></td>
              </tr>
            ))}
          </FusionDataTable>

          {selectedPortalClient ? (
            <>
            <form action={updateFusionClientProject} data-track-unsaved="true" style={{ marginTop: "1rem" }}>
              <input name="clientId" type="hidden" value={selectedPortalClient.id} />
              <p><a className="text-link" href={`/portal?clientId=${selectedPortalClient.id}`}>Open client portal preview</a></p>
              <div className="fusion-form-section__grid">
                <FusionField label="Project name">
                  <FusionInput defaultValue={selectedPortalClient.project?.project_name || "Website Project"} name="projectName" />
                </FusionField>
                <FusionField label="Project status">
                  <FusionSelect defaultValue={selectedPortalClient.project?.project_status || "in_progress"} name="projectStatus">
                    {projectStatuses.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
                  </FusionSelect>
                </FusionField>
                <FusionField label="Current phase">
                  <FusionInput defaultValue={selectedPortalClient.project?.current_phase || "Design Review"} name="currentPhase" />
                </FusionField>
                <FusionField label="Portal access">
                  <FusionInput readOnly value={selectedPortalClient.portal_user_id ? "Client account connected" : "Waiting for client login"} />
                </FusionField>
                <FusionField label="Preview URL for client">
                  <FusionInput defaultValue={selectedPortalClient.project?.preview_url || ""} name="previewUrl" placeholder="https://preview-domain.com" />
                </FusionField>
                <FusionField label="Final live URL">
                  <FusionInput defaultValue={selectedPortalClient.project?.live_url || ""} name="liveUrl" placeholder="https://client-domain.com" />
                </FusionField>
                <FusionField className="fusion-field--full" label="Client instructions">
                  <FusionTextarea defaultValue={selectedPortalClient.project?.client_instructions || ""} name="clientInstructions" placeholder="Tell the client what to review or upload next." />
                </FusionField>
                <FusionField label="Payment status">
                  <FusionSelect defaultValue={selectedPortalClient.project?.payment_status || "unpaid"} name="paymentStatus">
                    {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </FusionSelect>
                </FusionField>
              </div>
              {selectedPortalClient.recentComments?.length ? (
                <div className="portal-admin-comments">
                  {selectedPortalClient.recentComments.map((comment) => (
                    <div className="portal-admin-comment" key={comment.id}>
                      <p>
                        <strong>{comment.author_name}</strong>
                        <span>{comment.body}</span>
                      </p>
                      <div className="portal-admin-comment__meta">
                        <span className="muted">
                          {comment.marker_x !== null && comment.marker_y !== null
                            ? `Pinned at ${Math.round(comment.marker_x)}%, ${Math.round(comment.marker_y)}% on ${comment.page_url || "the preview"}`
                            : `General comment${comment.page_url ? ` on ${comment.page_url}` : ""}`}
                        </span>
                        <div className="portal-admin-comment__actions">
                          <a className="text-link" href={`/portal?clientId=${selectedPortalClient.id}&highlightComment=${comment.id}`} rel="noreferrer" target="_blank">Locate on preview</a>
{comment.status !== "resolved" ? (
                            <form action={resolveFusionProjectComment}>
                              <input name="commentId" type="hidden" value={comment.id} />
                              <button className="text-link" type="submit"><CheckCircle2 size={13} /> Mark resolved</button>
                            </form>
                          ) : null}
                                                    <form action={deleteFusionProjectComment}>
                            <input name="commentId" type="hidden" value={comment.id} />
                            <button className="text-link text-link--danger" type="submit"><Trash2 size={13} /> Delete</button>
                          </form>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="fusion-form-actions fusion-form-actions--end">
                <a className="ghost-button compact-button" href="/fusionadmin/clients">Close</a>
                <FusionSubmitButton className="compact-button" pendingLabel="Saving project...">Save portal project</FusionSubmitButton>
              </div>
            </form>
              <form action={assignFusionClientTask} data-track-unsaved="true" style={{ marginTop: "1.5rem" }}>
                <input name="clientId" type="hidden" value={selectedPortalClient.id} />
                <h3 style={{ marginBottom: "0.5rem" }}>Assign a task to this client</h3>
                <div className="fusion-form-section__grid">
                  <FusionField className="fusion-field--full" label="Task title">
                    <FusionInput name="title" placeholder="Upload your logo files" required />
                  </FusionField>
                  <FusionField className="fusion-field--full" label="Description">
                    <FusionTextarea name="description" placeholder="Add any details the client needs to complete this task." />
                  </FusionField>
                  <FusionField label="Due date">
                    <FusionInput name="dueAt" type="date" />
                  </FusionField>
                </div>
                <div className="fusion-form-actions fusion-form-actions--end">
                  <FusionSubmitButton className="compact-button" pendingLabel="Assigning task...">Assign task</FusionSubmitButton>
                </div>
              </form>
            </>
          ) : null}
        </article>
      </section>
    </div>
  );
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}
