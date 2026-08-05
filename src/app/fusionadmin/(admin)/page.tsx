import { Activity, ArrowUpRight, Bell, BriefcaseBusiness, CalendarCheck, Clock, FileText, ListChecks, MessageCircle, Search, Send, TrendingUp, UsersRound } from "lucide-react";
import Link from "next/link";
import { getFusionCrmWorkspace } from "@/lib/crm";
import { getSalesOpsWorkspace } from "@/lib/sales-ops";
import { getMarketingWorkspace } from "@/lib/marketing-dashboard";
import { EmptyState, formatCurrency, formatDate, PageHeader } from "./crm-ui";

type PageProps = {
  searchParams?: Promise<{ q?: string; status?: string; view?: string }>;
};

export default async function FusionAdminDashboard({ searchParams }: PageProps) {
  const filters = (await searchParams) || {};
  const view = filters.view === "marketing" ? "marketing" : "sales";

  return (
    <div className="admin-content dashboard-content">
      <PageHeader
        eyebrow="Command center"
        title={view === "marketing" ? "Marketing" : "Sales and client operations"}
        description={
          view === "marketing"
            ? "Messaging activity, channel health, and content publishing performance across Facebook, Instagram, and WhatsApp."
            : "A focused view of lead flow, pipeline value, priority tasks, and recent CRM activity."
        }
        action={
          <div className="dashboard-view-toggle-wrap">
            <div className="dashboard-view-toggle">
              <Link className={"dashboard-view-tab" + (view === "sales" ? " dashboard-view-tab--active" : "")} href="/fusionadmin?view=sales">
                Sales and client operations
              </Link>
              <Link className={"dashboard-view-tab" + (view === "marketing" ? " dashboard-view-tab--active" : "")} href="/fusionadmin?view=marketing">
                Marketing
              </Link>
            </div>
            {view === "sales" ? (
              <form className="admin-search" action="/fusionadmin">
                <Search size={17} />
                <input aria-label="Search leads or companies" defaultValue={filters.q || ""} name="q" placeholder="Search leads or companies" />
                <input name="view" type="hidden" value="sales" />
                <button type="submit">Search</button>
              </form>
            ) : null}
          </div>
        }
      />

      {view === "marketing" ? <MarketingDashboard /> : <SalesDashboard filters={filters} />}
    </div>
  );
}

async function SalesDashboard({ filters }: { filters: { q?: string; status?: string } }) {
  const [crm, salesOps] = await Promise.all([getFusionCrmWorkspace(filters), getSalesOpsWorkspace()]);
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

  return (
    <>
      <section className="dashboard-brief">
        <article className="dashboard-brief-card">
          <p className="eyebrow">Current focus</p>
          <h2>{openDeals.length} active opportunities</h2>
          <p className="muted">Pipeline value is {formatCurrency(pipelineValue)} across open deals, with {crm.leads.length} leads available for follow-up.</p>
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
        {dashboardMetrics.map((item) => (
          <article className="admin-metric" key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <small>{item.detail}</small>
          </article>
        ))}
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
    </>
  );
}

async function MarketingDashboard() {
  const marketing = await getMarketingWorkspace();

  if (!marketing.configured) {
    return <EmptyState>Connect Supabase to see marketing analytics here.</EmptyState>;
  }

  const { totals, channels, contentByPlatform, recentPublished, upcomingScheduled } = marketing;

  const marketingMetrics = [
    { label: "Messages (30 days)", value: totals.messagesLast30d, detail: `${totals.inboundLast30d} inbound · ${totals.outboundLast30d} outbound` },
    { label: "Active conversations", value: totals.activeThreads, detail: `${totals.unreadThreads} awaiting a reply` },
    { label: "Posts published", value: totals.postsPublished, detail: `${totals.postsFailed} failed` },
    {
      label: "Publish success rate",
      value: totals.publishSuccessRate === null ? "—" : `${totals.publishSuccessRate}%`,
      detail: `${totals.postsScheduled} upcoming`
    }
  ];

  return (
    <>
      <section className="dashboard-brief">
        <article className="dashboard-brief-card">
          <p className="eyebrow">Current focus</p>
          <h2>{totals.messagesLast30d} messages in the last 30 days</h2>
          <p className="muted">
            {totals.activeThreads} conversations across WhatsApp, Messenger, and Instagram, with {totals.unreadThreads} waiting on a reply.
          </p>
          <div className="dashboard-brief-actions">
            <a className="secondary-button compact-button" href="/fusionadmin/messages">Open inbox <ArrowUpRight size={15} /></a>
            <a className="secondary-button compact-button" href="/fusionadmin/content">Open content calendar <ArrowUpRight size={15} /></a>
          </div>
        </article>
        <article className="dashboard-focus-card">
          <div>
            <Send size={19} />
            <span>{totals.postsPublished}</span>
            <small>posts published</small>
          </div>
          <div>
            <TrendingUp size={19} />
            <span>{totals.publishSuccessRate === null ? "—" : `${totals.publishSuccessRate}%`}</span>
            <small>publish success</small>
          </div>
        </article>
      </section>

      <section className="admin-metrics dashboard-metrics">
        {marketingMetrics.map((item) => (
          <article className="admin-metric" key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="admin-dashboard-grid">
        <article className="admin-panel dashboard-panel panel-span-2">
          <div className="panel-heading">
            <h2><MessageCircle size={20} /> Messaging by channel</h2>
            <span className="status-pill">{totals.activeThreads} conversations</span>
          </div>
          <div className="marketing-channel-grid">
            {channels.map((channel) => (
              <article className={"marketing-channel-card marketing-channel-card--" + channel.status} key={channel.channelType}>
                <div className="marketing-channel-card__head">
                  <strong>{channel.label}</strong>
                  <span className={"status-pill status-pill--" + channel.status}>{channel.status}</span>
                </div>
                <div className="marketing-channel-card__stats">
                  <div>
                    <strong>{channel.messagesLast30d}</strong>
                    <small>messages (30d)</small>
                  </div>
                  <div>
                    <strong>{channel.threadCount}</strong>
                    <small>conversations</small>
                  </div>
                  <div>
                    <strong>{channel.unreadCount}</strong>
                    <small>unread</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="admin-panel dashboard-panel">
          <div className="panel-heading">
            <h2><Send size={20} /> Content by platform</h2>
            <span className="status-pill">{totals.postsPublished + totals.postsFailed} attempted</span>
          </div>
          <div className="stack-list marketing-platform-list">
            {contentByPlatform.map((item) => (
              <p key={item.platform}>
                <strong>{item.label}</strong><br />
                <span className="muted">{item.published} published · {item.failed} failed · {item.pending} pending</span>
              </p>
            ))}
          </div>
        </article>

        <article className="admin-panel dashboard-panel panel-span-2">
          <div className="panel-heading">
            <h2><Activity size={20} /> Recently published</h2>
            <span className="status-pill">{recentPublished.length}</span>
          </div>
          <div className="stack-list">
            {recentPublished.map((post) => (
              <p key={post.id}>
                <strong>{post.title || post.caption.slice(0, 60) || "Untitled post"}</strong><br />
                <span className="muted">{formatDate(post.scheduledAt)} · {post.platforms.join(", ") || "No platforms"}</span>
              </p>
            ))}
            {!recentPublished.length ? <EmptyState>Nothing published yet.</EmptyState> : null}
          </div>
        </article>

        <article className="admin-panel dashboard-panel panel-span-2">
          <div className="panel-heading">
            <h2><CalendarCheck size={20} /> Upcoming content</h2>
            <span className="status-pill">{upcomingScheduled.length}</span>
          </div>
          <div className="stack-list">
            {upcomingScheduled.map((post) => (
              <p key={post.id}>
                <strong>{post.title || post.caption.slice(0, 60) || "Untitled post"}</strong><br />
                <span className="muted">{formatDate(post.scheduledAt)} · {post.platforms.join(", ") || "No platforms"}</span>
              </p>
            ))}
            {!upcomingScheduled.length ? <EmptyState>Nothing scheduled yet.</EmptyState> : null}
          </div>
        </article>
      </section>
    </>
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

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
