import { ClipboardList, LogOut, ShieldAlert, UsersRound } from "lucide-react";
import { signOutFusionAdmin } from "@/app/fusionadmin/actions";
import { requireFusionAdmin } from "@/lib/auth";
import { getFusionDashboardRecords } from "@/lib/crm";

export const dynamic = "force-dynamic";

export default async function FusionAdminPage() {
  const user = await requireFusionAdmin();

  if (!user.isAllowed) {
    return (
      <main className="shell">
        <section className="login-shell">
          <article className="login-card">
            <div className="login-icon">
              <ShieldAlert size={24} />
            </div>
            <p className="eyebrow">Access denied</p>
            <h1>This account is not allowed into Fusion Admin.</h1>
            <p className="muted">Add {user.email} to FUSION_ADMIN_EMAILS in Vercel to grant backend access.</p>
            <form action={signOutFusionAdmin}>
              <button className="primary-button" type="submit">
                Sign out <LogOut size={17} />
              </button>
            </form>
          </article>
        </section>
      </main>
    );
  }

  const dashboard = await getFusionDashboardRecords();

  return (
    <main className="shell">
      <div className="admin-shell">
        <nav className="nav" style={{ paddingInline: 0 }}>
          <a className="brand" href="/">
            <span className="brand-mark">FDD</span>
            <span>Fusion Admin</span>
          </a>
          <div className="nav-links">
            <a href="/">Sales page</a>
            <form action={signOutFusionAdmin}>
              <button className="ghost-button" type="submit">
                <LogOut size={16} /> Sign out
              </button>
            </form>
          </div>
        </nav>

        <section className="section" style={{ paddingInline: 0, paddingTop: "2rem" }}>
          <p className="eyebrow">Backend command center</p>
          <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 4.8rem)" }}>Clients, deals, and production tasks.</h1>
          <p className="muted">Signed in as {user.email}</p>
          <div className="metric-grid" style={{ marginBottom: "1rem" }}>
            {dashboard.summary.map((item) => (
              <div className="metric" key={item.label}>
                <strong>{item.value}</strong>
                <span className="muted">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="sales-grid">
            <article className="admin-panel">
              <h2><UsersRound size={22} /> CRM Pipeline</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Contact</th>
                    <th>Package</th>
                    <th>Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.company}<br /><span className="muted">{lead.website || "No website yet"}</span></td>
                      <td>{lead.customer_name}<br /><span className="muted">{lead.customer_email} · {lead.customer_phone}</span></td>
                      <td>{lead.package_name}</td>
                      <td>${lead.total_today.toLocaleString()} + ${lead.monthly_due}/mo</td>
                      <td><span className="status-pill">{lead.status}</span></td>
                    </tr>
                  ))}
                  {!dashboard.leads.length ? (
                    <tr>
                      <td colSpan={5}><span className="muted">No leads yet. New funnel submissions will appear here.</span></td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </article>

            <article className="admin-panel">
              <h2><ClipboardList size={22} /> Task Queue</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Owner</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.tasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.title}<br /><span className="muted">{task.company || "Fusion platform"}</span></td>
                      <td>{task.owner}</td>
                      <td><span className="status-pill">{task.due_at ? new Date(task.due_at).toLocaleDateString() : "Open"}</span></td>
                    </tr>
                  ))}
                  {!dashboard.tasks.length ? (
                    <tr>
                      <td colSpan={3}><span className="muted">No open tasks yet.</span></td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
