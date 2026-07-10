import { MailPlus, ShieldCheck, UserRoundCog } from "lucide-react";
import { inviteFusionTeamMember } from "@/app/fusionadmin/actions";
import { getFusionAdminSettings } from "@/lib/crm";
import { EmptyState, formatDate, PageHeader } from "../crm-ui";

export default async function FusionTeamPage() {
  const admin = await getFusionAdminSettings();

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
          <form className="quick-form" action={inviteFusionTeamMember}>
            <input name="displayName" placeholder="Full name" />
            <input name="email" placeholder="Email address" type="email" required />
            <input name="title" placeholder="Title or responsibility" />
            <select name="roleId" defaultValue="">
              <option value="">Select role</option>
              {admin.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            <button className="primary-button" type="submit">Send invite</button>
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

        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><UserRoundCog size={20} /> Current team</h2>
            <span className="status-pill">{admin.members.length}</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {admin.members.map((member) => (
                  <tr key={member.id}>
                    <td>{member.crm_profiles?.display_name || "Team member"}</td>
                    <td>{member.crm_profiles?.email || member.user_id}</td>
                    <td>{member.title || "Not set"}</td>
                    <td><span className="status-pill">{member.status}</span></td>
                    <td>{formatDate(member.created_at)}</td>
                  </tr>
                ))}
                {!admin.members.length ? (
                  <tr><td colSpan={5}><EmptyState>No teammates have been added yet.</EmptyState></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
