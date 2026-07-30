import Link from "next/link";
import { ArrowLeft, PlusCircle, Trash2, UserPlus, Users } from "lucide-react";
import {
  addFusionAudienceMember,
  createFusionEmailAudience,
  deleteFusionEmailAudience,
  removeFusionAudienceMember,
  updateFusionAudienceMemberCategory,
  updateFusionEmailAudience
} from "@/app/fusionadmin/actions";
import { getAudienceDetail, getEmailMarketingWorkspace } from "@/lib/email-marketing";
import { EmptyState, formatDate, FusionDataTable, FusionSubmitButton, PageHeader } from "../../crm-ui";

export default async function FusionEmailAudiencesPage({ searchParams }: { searchParams?: Promise<{ audienceId?: string }> }) {
  const filters = (await searchParams) || {};
  const workspace = await getEmailMarketingWorkspace();
  const selectedId = filters.audienceId || workspace.audiences[0]?.id || "";
  const detail = selectedId ? await getAudienceDetail(selectedId) : { audience: null, members: [], availableContacts: [] };

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Email marketing"
        title="Audiences"
        description="Group your contacts into audiences, categorize them, and target campaigns at the right people."
        action={
          <Link className="secondary-button compact-button" href="/fusionadmin/email">
            <ArrowLeft size={16} /> Back to email
          </Link>
        }
      />

      <section className="admin-two-column">
        <article className="admin-panel">
          <div className="panel-heading">
            <h2><Users size={20} /> Audiences</h2>
            <span className="status-pill">{workspace.audiences.length} total</span>
          </div>
          <FusionDataTable
            aria-label="Audiences"
            columns={[{ header: "Name", priority: "primary" }, { header: "Contacts" }]}
            empty={!workspace.audiences.length ? <EmptyState>No audiences yet. Create one below.</EmptyState> : null}
          >
            {workspace.audiences.map((audience) => (
              <tr key={audience.id} className={audience.id === selectedId ? "table-row-active" : ""}>
                <td data-label="Name">
                  <Link href={`/fusionadmin/email/audiences?audienceId=${audience.id}`}>
                    <strong>{audience.name}</strong>
                  </Link>
                  {audience.description ? <><br /><span className="muted">{audience.description}</span></> : null}
                </td>
                <td data-label="Contacts">{audience.member_count}</td>
              </tr>
            ))}
          </FusionDataTable>

          <div className="panel-heading" style={{ marginTop: "1.5rem" }}>
            <h2><PlusCircle size={18} /> New audience</h2>
          </div>
          <form className="quick-form" action={createFusionEmailAudience} data-track-unsaved="true">
            <input aria-label="Audience name" name="name" placeholder="Audience name (e.g. Newsletter subscribers)" required />
            <input aria-label="Description" name="description" placeholder="Description (optional)" />
            <FusionSubmitButton pendingLabel="Creating...">Create audience</FusionSubmitButton>
          </form>
        </article>

        <article className="admin-panel panel-span-2">
          {detail.audience ? (
            <>
              <div className="panel-heading">
                <h2>{detail.audience.name}</h2>
                <span className="status-pill">{detail.members.length} contacts</span>
              </div>

              <form className="record-edit-grid" action={updateFusionEmailAudience} data-track-unsaved="true">
                <input name="audienceId" type="hidden" value={detail.audience.id} />
                <label>
                  <span>Name</span>
                  <input defaultValue={detail.audience.name} name="name" required />
                </label>
                <label>
                  <span>Description</span>
                  <input defaultValue={detail.audience.description || ""} name="description" />
                </label>
                <FusionSubmitButton pendingLabel="Saving...">Save audience</FusionSubmitButton>
              </form>

              <form action={deleteFusionEmailAudience} style={{ marginTop: "0.75rem" }}>
                <input name="audienceId" type="hidden" value={detail.audience.id} />
                <button className="ghost-button compact-button content-delete-button" type="submit">
                  <Trash2 size={14} /> Delete audience
                </button>
              </form>

              <div className="panel-heading" style={{ marginTop: "2rem" }}>
                <h2><UserPlus size={18} /> Add contact</h2>
              </div>
              <form className="quick-form" action={addFusionAudienceMember} data-track-unsaved="true">
                <input name="audienceId" type="hidden" value={detail.audience.id} />
                <select aria-label="Contact" defaultValue="" name="contactId" required>
                  <option disabled value="">Choose a contact</option>
                  {detail.availableContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.display_name}{contact.email ? ` (${contact.email})` : ""}</option>
                  ))}
                </select>
                <input aria-label="Category" name="category" placeholder="Category (e.g. VIP, Lead, Customer)" />
                <FusionSubmitButton pendingLabel="Adding...">Add to audience</FusionSubmitButton>
              </form>

              <div className="panel-heading" style={{ marginTop: "1.5rem" }}>
                <h3>Members</h3>
              </div>
              <FusionDataTable
                aria-label="Audience members"
                columns={[{ header: "Contact", priority: "primary" }, { header: "Category" }, { header: "Added" }, { header: "" }]}
                empty={!detail.members.length ? <EmptyState>No contacts in this audience yet.</EmptyState> : null}
              >
                {detail.members.map((member) => (
                  <tr key={member.id}>
                    <td data-label="Contact">
                      <strong>{member.contact?.display_name || "Unknown contact"}</strong>
                      {member.contact?.email ? <><br /><span className="muted">{member.contact.email}</span></> : null}
                    </td>
                    <td data-label="Category">
                      <form action={updateFusionAudienceMemberCategory} className="inline-status-form">
                        <input name="audienceId" type="hidden" value={detail.audience.id} />
                        <input name="memberId" type="hidden" value={member.id} />
                        <input aria-label="Category" defaultValue={member.category || ""} name="category" placeholder="Uncategorized" />
                        <button className="ghost-button compact-button" type="submit">Save</button>
                      </form>
                    </td>
                    <td data-label="Added">{formatDate(member.added_at)}</td>
                    <td data-label="">
                      <form action={removeFusionAudienceMember}>
                        <input name="audienceId" type="hidden" value={detail.audience.id} />
                        <input name="memberId" type="hidden" value={member.id} />
                        <button aria-label="Remove from audience" className="ghost-button compact-button content-delete-button" type="submit">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </FusionDataTable>
            </>
          ) : (
            <EmptyState>Create an audience to start adding contacts.</EmptyState>
          )}
        </article>
      </section>
    </div>
  );
}
