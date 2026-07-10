import {
  Bell,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Clock,
  FileText,
  LogOut,
  Search,
  Settings,
  ShieldAlert,
  UserRoundPlus,
  UsersRound
} from "lucide-react";
import {
  createFusionContact,
  createFusionDeal,
  createFusionNote,
  createFusionTask,
  signOutFusionAdmin
} from "@/app/fusionadmin/actions";
import { requireFusionAdmin } from "@/lib/auth";
import { getFusionCrmWorkspace } from "@/lib/crm";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ q?: string; status?: string }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Open";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function optionList(values?: string[] | null) {
  return values?.length ? values : [];
}

export default async function FusionAdminPage({ searchParams }: PageProps) {
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

  const filters = (await searchParams) || {};
  const crm = await getFusionCrmWorkspace(filters);
  const taskTypes = optionList(crm.settings?.task_types);
  const leadSources = optionList(crm.settings?.lead_sources);

  return (
    <main className="shell">
      <div className="admin-shell crm-shell">
        <nav className="nav admin-nav">
          <a className="brand" href="/">
            <span className="brand-mark">FDD</span>
            <span>Fusion CRM</span>
          </a>
          <div className="admin-nav-actions">
            <span className="admin-user">Signed in as {user.displayName}</span>
            <a className="ghost-button" href="/">Sales page</a>
            <form action={signOutFusionAdmin}>
              <button className="ghost-button" type="submit">
                <LogOut size={16} /> Sign out
              </button>
            </form>
          </div>
        </nav>

        <section className="crm-hero">
          <div>
            <p className="eyebrow">Phase One CRM</p>
            <h1>Fusion operating command center.</h1>
            <p className="muted">
              Manage leads, contacts, companies, deals, tasks, notes, notifications, and recent activity from one admin-only workspace.
            </p>
          </div>
          <form className="crm-search" action="/fusionadmin">
            <label>
              <span>Global search</span>
              <div className="search-control">
                <Search size={17} />
                <input defaultValue={filters.q || ""} name="q" placeholder="Search leads, companies, contacts..." />
              </div>
            </label>
            <label>
              <span>Lead status</span>
              <select defaultValue={filters.status || "all"} name="status">
                <option value="all">All statuses</option>
                <option value="captured">Captured</option>
                <option value="checkout_started">Checkout started</option>
                <option value="paid">Paid</option>
              </select>
            </label>
            <button className="primary-button" type="submit">Apply filters</button>
          </form>
        </section>

        <section className="metric-grid crm-metrics">
          {crm.summary.map((item) => (
            <div className="metric" key={item.label}>
              <strong>{item.value}</strong>
              <span className="muted">{item.label}</span>
            </div>
          ))}
        </section>

        <section className="crm-grid">
          <article className="admin-panel crm-panel-wide">
            <div className="panel-heading">
              <h2><BriefcaseBusiness size={22} /> Sales pipeline</h2>
              <span className="status-pill">{crm.deals.length} deals</span>
            </div>
            <div className="pipeline-board">
              {crm.stages.map((stage) => {
                const stageDeals = crm.deals.filter((deal) => deal.crm_pipeline_stages?.name === stage.name);
                return (
                  <div className="pipeline-stage" key={stage.id}>
                    <div className="stage-heading">
                      <strong>{stage.name}</strong>
                      <span>{stage.probability}%</span>
                    </div>
                    {stageDeals.map((deal) => (
                      <article className="deal-card" key={deal.id}>
                        <strong>{deal.deal_title}</strong>
                        <span>{deal.crm_companies?.company_name || "No company"}</span>
                        <b>{formatCurrency(deal.value)}</b>
                      </article>
                    ))}
                    {!stageDeals.length ? <p className="muted empty-line">No deals</p> : null}
                  </div>
                );
              })}
              {!crm.stages.length ? <p className="muted">Pipeline stages will appear after the CRM migration runs.</p> : null}
            </div>
          </article>

          <article className="admin-panel">
            <div className="panel-heading">
              <h2><Bell size={22} /> Notifications</h2>
              <span className="status-pill">{crm.notifications.filter((item) => !item.read_at).length} unread</span>
            </div>
            <div className="stack-list">
              {crm.notifications.map((item) => (
                <p key={item.id}><strong>{item.title}</strong><br /><span className="muted">{formatDate(item.created_at)}</span></p>
              ))}
              {!crm.notifications.length ? <p className="muted">No notifications yet.</p> : null}
            </div>
          </article>

          <article className="admin-panel crm-panel-wide">
            <div className="panel-heading">
              <h2><UsersRound size={22} /> Leads</h2>
              <span className="status-pill">{crm.leads.length} records</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Contact</th>
                  <th>Offer</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {crm.leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.company}<br /><span className="muted">{lead.lead_code} · {lead.website || "No website"}</span></td>
                    <td>{lead.customer_name}<br /><span className="muted">{lead.customer_email} · {lead.customer_phone}</span></td>
                    <td>{lead.package_name}</td>
                    <td>{formatCurrency(lead.total_today)} + ${lead.monthly_due}/mo</td>
                    <td><span className="status-pill">{lead.status}</span></td>
                  </tr>
                ))}
                {!crm.leads.length ? (
                  <tr><td colSpan={5}><span className="muted">No matching leads yet.</span></td></tr>
                ) : null}
              </tbody>
            </table>
          </article>

          <article className="admin-panel">
            <h2><UserRoundPlus size={22} /> Quick contact</h2>
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
              <h2><Building2 size={22} /> Companies</h2>
              <span className="status-pill">{crm.companies.length}</span>
            </div>
            <div className="stack-list">
              {crm.companies.map((company) => (
                <p key={company.id}><strong>{company.company_name}</strong><br /><span className="muted">{company.industry || "Industry not set"} · {company.lifecycle_status}</span></p>
              ))}
              {!crm.companies.length ? <p className="muted">Companies are created from contacts, deals, and paid leads.</p> : null}
            </div>
          </article>

          <article className="admin-panel">
            <div className="panel-heading">
              <h2><UsersRound size={22} /> Contacts</h2>
              <span className="status-pill">{crm.contacts.length}</span>
            </div>
            <div className="stack-list">
              {crm.contacts.map((contact) => (
                <p key={contact.id}><strong>{contact.display_name}</strong><br /><span className="muted">{contact.email || "No email"} · {contact.crm_companies?.company_name || "No company"}</span></p>
              ))}
              {!crm.contacts.length ? <p className="muted">No contacts yet. Use quick contact to create the first one.</p> : null}
            </div>
          </article>

          <article className="admin-panel">
            <h2><BriefcaseBusiness size={22} /> Quick deal</h2>
            <form className="quick-form" action={createFusionDeal}>
              <input name="dealTitle" placeholder="Deal title" required />
              <input name="companyName" placeholder="Company" />
              <input name="service" placeholder="Service interest" />
              <input min="0" name="value" placeholder="Deal value" type="number" />
              <select name="stageId">
                {crm.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
              </select>
              <input name="expectedCloseDate" type="date" />
              <button className="primary-button" type="submit">Create deal</button>
            </form>
          </article>

          <article className="admin-panel">
            <div className="panel-heading">
              <h2><ClipboardList size={22} /> Tasks</h2>
              <span className="status-pill">{crm.tasks.length}</span>
            </div>
            <form className="quick-form compact" action={createFusionTask}>
              <input name="title" placeholder="New task" required />
              <select name="taskType">
                {taskTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
              <select name="priority" defaultValue="normal">
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="low">Low</option>
              </select>
              <input name="dueAt" type="datetime-local" />
              <button className="primary-button" type="submit">Add task</button>
            </form>
            <div className="stack-list">
              {crm.tasks.slice(0, 8).map((task) => (
                <p key={task.id}><strong>{task.title}</strong><br /><span className="muted">{task.owner} · {formatDate(task.due_at)}</span></p>
              ))}
              {!crm.tasks.length ? <p className="muted">No open tasks yet.</p> : null}
            </div>
          </article>

          <article className="admin-panel">
            <div className="panel-heading">
              <h2><FileText size={22} /> Notes</h2>
              <span className="status-pill">{crm.notes.length}</span>
            </div>
            <form className="quick-form compact" action={createFusionNote}>
              <select name="entityType" defaultValue="general">
                <option value="general">General</option>
                <option value="lead">Lead</option>
                <option value="deal">Deal</option>
                <option value="contact">Contact</option>
                <option value="company">Company</option>
              </select>
              <textarea name="body" placeholder="Internal CRM note" required />
              <button className="primary-button" type="submit">Add note</button>
            </form>
            <div className="stack-list">
              {crm.notes.slice(0, 5).map((note) => (
                <p key={note.id}><strong>{note.entity_type}</strong><br /><span className="muted">{note.body}</span></p>
              ))}
              {!crm.notes.length ? <p className="muted">No notes yet.</p> : null}
            </div>
          </article>

          <article className="admin-panel">
            <div className="panel-heading">
              <h2><Clock size={22} /> Activity timeline</h2>
              <span className="status-pill">{crm.activities.length}</span>
            </div>
            <div className="timeline-list">
              {crm.activities.map((activity) => (
                <p key={activity.id}><strong>{activity.summary}</strong><br /><span className="muted">{activity.action_type} · {formatDate(activity.created_at)}</span></p>
              ))}
              {!crm.activities.length ? <p className="muted">Activity appears as the CRM is used.</p> : null}
            </div>
          </article>

          <article className="admin-panel">
            <div className="panel-heading">
              <h2><Settings size={22} /> Settings foundation</h2>
              <span className="status-pill">{crm.organization?.default_currency || "USD"}</span>
            </div>
            <div className="settings-list">
              <p><strong>Organization</strong><span>{crm.organization?.name || "Fusion Digital Dynamics LLC"}</span></p>
              <p><strong>Time zone</strong><span>{crm.organization?.default_time_zone || "America/New_York"}</span></p>
              <p><strong>Lead statuses</strong><span>{crm.settings?.lead_statuses.join(", ") || "Seed after migration"}</span></p>
              <p><strong>Task types</strong><span>{taskTypes.slice(0, 5).join(", ") || "Seed after migration"}</span></p>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
