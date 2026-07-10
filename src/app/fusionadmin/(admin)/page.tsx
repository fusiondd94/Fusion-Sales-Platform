import { Bell, BriefcaseBusiness, Clock, Search, UsersRound } from "lucide-react";
import { getFusionCrmWorkspace } from "@/lib/crm";
import { EmptyState, formatCurrency, formatDate, PageHeader } from "./crm-ui";

type PageProps = {
  searchParams?: Promise<{ q?: string; status?: string }>;
};

export default async function FusionAdminDashboard({ searchParams }: PageProps) {
  const filters = (await searchParams) || {};
  const crm = await getFusionCrmWorkspace(filters);

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Command center"
        title="Sales and client operations"
        description="A focused view of lead flow, pipeline value, priority tasks, and recent CRM activity."
        action={
          <form className="admin-search" action="/fusionadmin">
            <Search size={17} />
            <input defaultValue={filters.q || ""} name="q" placeholder="Search leads or companies" />
            <button type="submit">Search</button>
          </form>
        }
      />

      <section className="admin-metrics">
        {crm.summary.map((item) => (
          <article className="admin-metric" key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </section>

      <section className="admin-dashboard-grid">
        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><BriefcaseBusiness size={20} /> Pipeline</h2>
            <span className="status-pill">{crm.deals.length} deals</span>
          </div>
          <div className="pipeline-board compact-board">
            {crm.stages.map((stage) => {
              const stageDeals = crm.deals.filter((deal) => deal.crm_pipeline_stages?.name === stage.name);
              return (
                <div className="pipeline-stage" key={stage.id}>
                  <div className="stage-heading">
                    <strong>{stage.name}</strong>
                    <span>{stage.probability}%</span>
                  </div>
                  {stageDeals.slice(0, 3).map((deal) => (
                    <article className="deal-card" key={deal.id}>
                      <strong>{deal.deal_title}</strong>
                      <span>{deal.crm_companies?.company_name || "No company"}</span>
                      <b>{formatCurrency(deal.value)}</b>
                    </article>
                  ))}
                  {!stageDeals.length ? <EmptyState>No deals</EmptyState> : null}
                </div>
              );
            })}
            {!crm.stages.length ? <EmptyState>Pipeline stages will appear after the CRM migration runs.</EmptyState> : null}
          </div>
        </article>

        <article className="admin-panel">
          <div className="panel-heading">
            <h2><Bell size={20} /> Notifications</h2>
            <span className="status-pill">{crm.notifications.filter((item) => !item.read_at).length} unread</span>
          </div>
          <div className="stack-list">
            {crm.notifications.map((item) => (
              <p key={item.id}><strong>{item.title}</strong><br /><span className="muted">{formatDate(item.created_at)}</span></p>
            ))}
            {!crm.notifications.length ? <EmptyState>No notifications yet.</EmptyState> : null}
          </div>
        </article>

        <article className="admin-panel">
          <div className="panel-heading">
            <h2><UsersRound size={20} /> Recent leads</h2>
            <span className="status-pill">{crm.leads.length}</span>
          </div>
          <div className="stack-list">
            {crm.leads.slice(0, 6).map((lead) => (
              <p key={lead.id}>
                <strong>{lead.company}</strong><br />
                <span className="muted">{lead.customer_name} · {formatCurrency(lead.total_today)} · {lead.status}</span>
              </p>
            ))}
            {!crm.leads.length ? <EmptyState>No leads yet.</EmptyState> : null}
          </div>
        </article>

        <article className="admin-panel">
          <div className="panel-heading">
            <h2><Clock size={20} /> Recent activity</h2>
            <span className="status-pill">{crm.activities.length}</span>
          </div>
          <div className="timeline-list">
            {crm.activities.slice(0, 8).map((activity) => (
              <p key={activity.id}><strong>{activity.summary}</strong><br /><span className="muted">{activity.action_type} · {formatDate(activity.created_at)}</span></p>
            ))}
            {!crm.activities.length ? <EmptyState>Activity appears as the CRM is used.</EmptyState> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
