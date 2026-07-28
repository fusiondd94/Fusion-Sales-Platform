import {
  Activity,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarCheck,
  Clock,
  FileText,
  ListChecks,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound
} from "lucide-react";
import { getFusionCrmWorkspace } from "@/lib/crm";
import { getSalesOpsWorkspace } from "@/lib/sales-ops";
import { EmptyState, formatCurrency, formatDate, PageHeader } from "./crm-ui";

type PageProps = {
  searchParams?: Promise<{ q?: string; status?: string }>;
};

export default async function FusionAdminDashboard({ searchParams }: PageProps) {
  const filters = (await searchParams) || {};
  const [crm, salesOps] = await Promise.all([
    getFusionCrmWorkspace(filters),
    getSalesOpsWorkspace()
  ]);
  const now = new Date();
  const openDeals = crm.deals.filter((deal) => !["won", "lost"].includes(deal.status));
  const pipelineValue = openDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  const proposalValue = salesOps.proposals.reduce((sum, proposal) => sum + Number(proposal.grand_total || 0), 0);
  const upcomingAppointments = salesOps.appointments.filter((appointment) => new Date(appointment.starts_at) >= now).slice(0, 4);
  const priorityTasks = crm.tasks.filter((task) => task.status !== "done").slice(0, 5);
  const dashboardMetrics = [
    ...crm.summary.map((item) => ({ ...item, detail: metricDetail(item.label) })),
    { label: "Open pipeline", value: formatCurrency(pipelineValue), detail: `${openDeals.length} active deals` },
    { label: "Proposal value", value: formatCurrency(proposalValue), detail: `${salesOps.proposals.length} proposals` },
    { label: "Appointments", value: salesOps.appointments.length, detail: `${upcomingAppointments.length} upcoming` },
    { label: "Published forms", value: salesOps.forms.filter((form) => form.is_published).length, detail: "Lead capture live" }
  ];

  const stageCounts = crm.stages.map((stage) => ({
    name: stage.name,
    count: crm.deals.filter((deal) => deal.crm_pipeline_stages?.name === stage.name).length
  }));
  const busiestStage = stageCounts.reduce(
    (best, stage) => (stage.count > best.count ? stage : best),
    { name: "", count: 0 }
  );
  const smartInsight = buildSmartInsight({
    openDealsCount: openDeals.length,
    pipelineValue,
    leadsCount: crm.leads.length,
    busiestStage: busiestStage.count > 0 ? busiestStage.name : null
  });

  return (
    <div className="admin-content dashboard-content">
      <PageHeader
        eyebrow="Command center"
        title="Sales and client operations"
        description="A focused view of lead flow, pipeline value, priority tasks, and recent CRM activity."
        action={
          <form className="admin-search" action="/fusionadmin">
            <Search size={17} />
            <input aria-label="Search leads or companies" defaultValue={filters.q || ""} name="q" placeholder="Search leads or companies" />
            <button type="submit">Search</button>
          </form>
        }
      />

      <section className="dashboard-brief">
        <article className="dashboard-brief-card">
          <p className="eyebrow">Current focus</p>
          <h2>{openDeals.length} active opportunities</h2>
          <p className="muted">Pipeline value is {formatCurrency(pipelineValue)} across open deals, with {crm.leads.length} leads available for follow-up.</p>
          <p className="dashboard-smart-insight">
            <Sparkles size={15} /> {smartInsight}
          </p>
          <div className="dashboard-brief-actions">
            <a className="secondary-button compact-button" href="/fusionadmin/clients">Review leads <ArrowUpRight size={15} /></a>
            <a className="secondary-button compact-button" href="/fusionadmin/calendar">Open calendar <ArrowUpRight size={15} /></a>
          </div>
        </article>
        <article className="dashboard-focus-card">
          <div>
            <CalendarCheck size={19} />
            <span>{upcomingAppointments.length}</span>
            <small>upcoming meetings</small>
          </div>
          <div>
            <ListChecks size={19} />
            <span>{priorityTasks.length}</span>
            <small>open tasks</small>
          </div>
        </article>
      </section>

      <section className="admin-metrics dashboard-metrics">
        {dashboardMetrics.map((item) => {
          const Icon = metricIcon(item.label);
          return (
            <article className="admin-metric" key={item.label}>
              <span className="admin-metric-icon">
                <Icon size={18} />
              </span>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
              <small>{item.detail}</small>
            </article>
          );
        })}
      </section>

      <section className="admin-dashboard-grid">
        <article className="admin-panel dashboard-panel panel-span-2">
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
                    <div>
                      <strong>{stage.name}</strong>
                      <small>{stageDeals.length} deals · {formatCurrency(stageDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0))}</small>
                    </div>
                    <span>{stage.probability}%</span>
                  </div>
                  <div className="stage-probability" aria-label={`${stage.name} probability ${stage.probability}%`}>
                    <span style={{ width: `${Math.min(100, Math.max(0, stage.probability))}%` }} />
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

        <article className="admin-panel dashboard-panel">
          <div className="panel-heading">
            <h2><Clock size={20} /> Today and next</h2>
            <span className="status-pill">{upcomingAppointments.length + priorityTasks.length} items</span>
          </div>
          <div className="dashboard-focus-list">
            <h3>Upcoming meetings</h3>
            {upcomingAppointments.map((appointment) => (
              <p key={appointment.id}>
                <strong>{appointment.title}</strong>
                <span>{formatDate(appointment.starts_at)} · {formatTime(appointment.starts_at)}</span>
              </p>
            ))}
            {!upcomingAppointments.length ? <EmptyState>No upcoming meetings.</EmptyState> : null}
            <h3>Open tasks</h3>
            {priorityTasks.map((task) => (
              <p key={task.id}>
                <strong>{task.title}</strong>
                <span>{task.company || task.owner} · {task.due_at ? formatDate(task.due_at) : "No due date"}</span>
              </p>
            ))}
            {!priorityTasks.length ? <EmptyState>No open tasks.</EmptyState> : null}
          </div>
        </article>

        <article className="admin-panel dashboard-panel">
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

        <article className="admin-panel dashboard-panel">
          <div className="panel-heading">
            <h2><FileText size={20} /> Proposals</h2>
            <span className="status-pill">{salesOps.proposals.length}</span>
          </div>
          <div className="stack-list">
            {salesOps.proposals.slice(0, 5).map((proposal) => (
              <p key={proposal.id}><strong>{proposal.proposal_title}</strong><br /><span className="muted">{proposal.status} · {formatCurrency(proposal.grand_total)}</span></p>
            ))}
            {!salesOps.proposals.length ? <EmptyState>No proposals yet.</EmptyState> : null}
          </div>
        </article>

        <article className="admin-panel dashboard-panel">
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

        <article className="admin-panel dashboard-panel">
          <div className="panel-heading">
            <h2><Activity size={20} /> Recent activity</h2>
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

function metricDetail(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("lead")) return "Lead flow";
  if (normalized.includes("pipeline")) return "Sales motion";
  if (normalized.includes("task")) return "Work queue";
  if (normalized.includes("deal")) return "Opportunity health";
  return "CRM signal";
}

function metricIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("lead")) return UsersRound;
  if (normalized.includes("pipeline") || normalized.includes("proposal")) return TrendingUp;
  if (normalized.includes("task")) return ListChecks;
  if (normalized.includes("deal")) return BriefcaseBusiness;
  if (normalized.includes("appointment")) return CalendarCheck;
  if (normalized.includes("form")) return FileText;
  return Target;
}

function buildSmartInsight({
  openDealsCount,
  pipelineValue,
  leadsCount,
  busiestStage
}: {
  openDealsCount: number;
  pipelineValue: number;
  leadsCount: number;
  busiestStage: string | null;
}) {
  if (!openDealsCount && !leadsCount) {
    return "Smart insight: add a lead or deal to start seeing pipeline trends here.";
  }
  if (busiestStage) {
    return `Smart insight: most open deals are sitting in "${busiestStage}" — worth a status check.`;
  }
  if (leadsCount > openDealsCount) {
    return `Smart insight: ${leadsCount} leads haven't converted to deals yet — prioritize follow-up.`;
  }
  return `Smart insight: ${formatCurrency(pipelineValue)} is currently in motion across ${openDealsCount} open deals.`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
