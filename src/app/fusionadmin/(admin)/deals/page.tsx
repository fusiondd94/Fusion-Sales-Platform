import { BriefcaseBusiness } from "lucide-react";
import { createFusionDeal } from "@/app/fusionadmin/actions";
import { getFusionCrmWorkspace } from "@/lib/crm";
import { EmptyState, formatCurrency, FusionDataTable, PageHeader } from "../crm-ui";

export default async function FusionDealsPage() {
  const crm = await getFusionCrmWorkspace();

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Deals"
        title="Manage sales pipeline"
        description="Track opportunities by stage, expected value, service interest, and close probability."
      />

      <section className="admin-two-column">
        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><BriefcaseBusiness size={20} /> Pipeline board</h2>
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
                      <span>{deal.service || "Website services"}</span>
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
          <h2><BriefcaseBusiness size={20} /> Add deal</h2>
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

        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2>Deal list</h2>
            <span className="status-pill">{crm.deals.length}</span>
          </div>
          <FusionDataTable
            aria-label="Deal list"
            columns={[
              { header: "Deal", priority: "primary" },
              { header: "Company" },
              { header: "Stage" },
              { header: "Value" },
              { header: "Status" }
            ]}
            empty={!crm.deals.length ? <EmptyState>No deals yet.</EmptyState> : null}
          >
            {crm.deals.map((deal) => (
              <tr key={deal.id}>
                <td data-label="Deal">{deal.deal_title}<br /><span className="muted">{deal.service || "Website services"}</span></td>
                <td data-label="Company">{deal.crm_companies?.company_name || "No company"}</td>
                <td data-label="Stage">{deal.crm_pipeline_stages?.name || "No stage"}</td>
                <td data-label="Value">{formatCurrency(deal.value)}</td>
                <td data-label="Status"><span className="status-pill">{deal.status}</span></td>
              </tr>
            ))}
          </FusionDataTable>
        </article>
      </section>
    </div>
  );
}
