import {
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  FileText,
  FormInput,
  TrendingUp,
  UsersRound,
  Wallet
} from "lucide-react";
import { getSalesOpsWorkspace } from "@/lib/sales-ops";
import { formatCurrency, PageHeader } from "../crm-ui";

export default async function FusionReportsPage() {
  const salesOps = await getSalesOpsWorkspace();
  const metrics = [
    { label: "Leads created", value: salesOps.reports.leadsCreated, icon: UsersRound },
    { label: "Deals created", value: salesOps.reports.dealsCreated, icon: TrendingUp },
    { label: "Proposals created", value: salesOps.reports.proposalsCreated, icon: FileText },
    { label: "Proposals accepted", value: salesOps.reports.proposalsAccepted, icon: CheckCircle2 },
    { label: "Appointments scheduled", value: salesOps.reports.appointmentsScheduled, icon: CalendarCheck },
    { label: "Published forms", value: salesOps.reports.formsPublished, icon: FormInput },
    { label: "Pipeline value", value: formatCurrency(salesOps.reports.totalPipelineValue), icon: Wallet },
    { label: "Weighted pipeline", value: formatCurrency(salesOps.reports.weightedPipelineValue), icon: BarChart3 },
    { label: "Won revenue", value: formatCurrency(salesOps.reports.wonRevenue), icon: Wallet }
  ];

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Reports"
        title="Sales operations reporting"
        description="Real aggregate metrics from CRM records. Pipeline, weighted pipeline, and won revenue are kept separate."
      />

      <section className="admin-metrics report-metrics">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="admin-metric" key={metric.label}>
              <span className="admin-metric-icon">
                <Icon size={18} />
              </span>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </article>
          );
        })}
      </section>

      <section className="admin-two-column">
        <article className="admin-panel">
          <div className="panel-heading">
            <h2><BarChart3 size={20} /> Lead sources</h2>
            <span className="status-pill">{salesOps.leadSources.length}</span>
          </div>
          <div className="stack-list">
            {salesOps.leadSources.map((source) => (
              <p key={source.id}><strong>{source.name}</strong><br /><span className="muted">{source.default_channel || "No channel"} · {source.is_paid ? "paid" : "organic"}</span></p>
            ))}
          </div>
        </article>

        <article className="admin-panel">
          <div className="panel-heading">
            <h2><BarChart3 size={20} /> Service mix</h2>
            <span className="status-pill">{salesOps.services.length}</span>
          </div>
          <div className="stack-list">
            {salesOps.services.slice(0, 8).map((service) => (
              <p key={service.id}><strong>{service.service_name}</strong><br /><span className="muted">{service.billing_type} · {formatCurrency(service.base_price)}</span></p>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
