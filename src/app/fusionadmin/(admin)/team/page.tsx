import { MailPlus, ShieldCheck, UserRoundCog } from "lucide-react";
import { inviteFusionTeamMember, updateFusionTeamMember } from "@/app/fusionadmin/actions";
import { getFusionAdminSettings } from "@/lib/crm";
import { EmptyState, formatDate, FusionDataTable, FusionField, FusionInput, FusionSelect, FusionSubmitButton, PageHeader } from "../crm-ui";

type PageProps = {
  searchParams?: Promise<{ memberId?: string }>;
};

export default async function FusionTeamPage({ searchParams }: PageProps) {
  const filters = (await searchParams) || {};
  const admin = await getFusionAdminSettings();
  const selectedMember = admin.members.find((member) => member.id === filters.memberId);
  const statusOptions = ["active", "inactive", "invited"];

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Team"
        title="Manage teammates and roles"
        description="Invite operators into the backend and assign them a working role for CRM access."
      />

      <section className="admin-two-column">
        <article className="admin-panel">
          <h2><MailPlus size={20} /> Invite teammate</h2>
          <form className="quick-form" action={inviteFusionTeamMember} data-track-unsaved="true">
            <input aria-label="Full name" name="displayName" placeholder="Full name" />
            <input aria-label="Email address" name="email" placeholder="Email address" type="email" required />
            <input aria-label="Title or responsibility" name="title" placeholder="Title or responsibility" />
            <select aria-label="Role" name="roleId" defaultValue="">
              <option value="">Select role</option>
              {admin.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            <FusionSubmitButton pendingLabel="Sending...">Send invite</FusionSubmitButton>
          </form>
        </article>

        <article className="admin-panel">
          <div className="panel-heading">
            <h2><ShieldCheck size={20} /> Roles</h2>
            <span className="status-pill">{admin.roles.length}</span>
          </div>
          <div className="stack-list">
            {admin.roles.map((role) => (
              <p key={role.id}><strong>{role.name}</strong><br /><span className="muted">{role.description || role.slug}</span></p>
            ))}
            {!admin.roles.length ? <EmptyState>Roles will appear after the CRM migration runs.</EmptyState> : null}
          </div>
        </article>

        <article className="admin-panel panel-span-2" id="member-editor">
          <div className="panel-heading">
            <h2><UserRoundCog size={20} /> Current team</h2>
            <span className="status-pill">{admin.members.length}</span>
          </div>
          <FusionDataTable
            aria-label="Current team"
            columns={[
              { header: "Name", priority: "primary" },
              { header: "Email" },
              { header: "Title" },
              { header: "Status" },
              { header: "Added" },
              { header: "Action", className: "table-action-column" }
            ]}
            empty={!admin.members.length ? <EmptyState>No teammates have been added yet.</EmptyState> : null}
          >
            {admin.members.map((member) => (
              <tr key={member.id}>
                <td data-label="Name"><a className="fusion-record-link" href={`/fusionadmin/team?memberId=${member.id}#member-editor`}>{member.crm_profiles?.display_name || "Team member"}</a></td>
                <td data-label="Email">{member.crm_profiles?.email || member.user_id}</td>
                <td data-label="Title">{member.title || "Not set"}</td>
                <td data-label="Status"><span className="status-pill">{member.status}</span></td>
                <td data-label="Added">{formatDate(member.created_at)}</td>
                <td data-label="Action"><a className="secondary-button compact-button table-action-button" href={`/fusionadmin/team?memberId=${member.id}#member-editor`}>Edit</a></td>
              </tr>
            ))}
          </FusionDataTable>

          {selectedMember ? (
            <form action={updateFusionTeamMember} data-track-unsaved="true" style={{ marginTop: "1rem" }}>
              <input name="memberId" type="hidden" value={selectedMember.id} />
              <div className="fusion-form-section__grid">
                <FusionField label="Name">
                  <FusionInput disabled value={selectedMember.crm_profiles?.display_name || "Team member"} />
                </FusionField>
                <FusionField label="Title or responsibility">
                  <FusionInput defaultValue={selectedMember.title || ""} name="title" />
                </FusionField>
                <FusionField label="Status">
                  <FusionSelect defaultValue={selectedMember.status || "active"} name="status">
                    {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                  </FusionSelect>
                </FusionField>
                <FusionField hint="Leave unselected to keep the current role." label="Role">
                  <FusionSelect defaultValue="" name="roleId">
                    <option value="">Keep current role</option>
                    {admin.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                  </FusionSelect>
                </FusionField>
              </div>
              <div className="fusion-form-actions fusion-form-actions--end">
                <a className="ghost-button compact-button" href="/fusionadmin/team">Close</a>
                <FusionSubmitButton className="compact-button" pendingLabel="Saving...">Save teammate</FusionSubmitButton>
              </div>
            </form>
          ) : null}
        </article>
      </section>
    </div>
  );
}
