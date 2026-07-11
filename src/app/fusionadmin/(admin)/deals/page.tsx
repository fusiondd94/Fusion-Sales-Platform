import { BriefcaseBusiness } from "lucide-react";
import { createFusionDeal, updateFusionDeal } from "@/app/fusionadmin/actions";
import { getFusionCrmWorkspace } from "@/lib/crm";
import {
  EmptyState,
  formatCurrency,
  FusionDataTable,
  FusionField,
  FusionInput,
  FusionSelect,
  FusionSubmitButton,
  PageHeader
} from "../crm-ui";

type PageProps = {
  searchParams?: Promise<{ dealId?: string }>;
};

export default async function FusionDealsPage({ searchParams }: PageProps) {
  const filters = (await searchParams) || {};
  const crm = await getFusionCrmWorkspace();
  const selectedDeal = crm.deals.find((deal) => deal.id === filters.dealId);
  const dealStatuses = ["open", "won", "lost"];

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
                    <a className="deal-card fusion-record-link" href={`/fusionadmin/deals?dealId=${deal.id}#deal-editor`} key={deal.id}>
                      <strong>{deal.deal_title}</strong>
                      <span>{deal.crm_companies?.company_name || "No company"}</span>
                      <span>{deal.service || "Website services"}</span>
                      <b>{formatCurrency(deal.value)}</b>
                    </a>
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
            <FusionSubmitButton pendingLabel="Creating...">Create deal</FusionSubmitButton>
          </form>
        </article>

        <article className="admin-panel panel-span-2" id="deal-editor">
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
              { header: "Status" },
              { header: "Action", className: "table-action-column" }
            ]}
            empty={!crm.deals.length ? <EmptyState>No deals yet.</EmptyState> : null}
          >
            {crm.deals.map((deal) => (
              <tr key={deal.id}>
                <td data-label="Deal">
                  <a className="fusion-record-link" href={`/fusionadmin/deals?dealId=${deal.id}#deal-editor`}>{deal.deal_title}</a>
                  <br /><span className="muted">{deal.service || "Website services"}</span>
                </td>
                <td data-label="Company">{deal.crm_companies?.company_name || "No company"}</td>
                <td data-label="Stage">{deal.crm_pipeline_stages?.name || "No stage"}</td>
                <td data-label="Value">{formatCurrency(deal.value)}</td>
                <td data-label="Status"><span className="status-pill">{deal.status}</span></td>
                <td data-label="Action"><a className="secondary-button compact-button table-action-button" href={`/fusionadmin/deals?dealId=${deal.id}#deal-editor`}>Edit</a></td>
              </tr>
            ))}
          </FusionDataTable>

          {selectedDeal ? (
            <form action={updateFusionDeal} style={{ marginTop: "1rem" }}>
              <input name="dealId" type="hidden" value={selectedDeal.id} />
              <div className="fusion-form-section__grid">
                <FusionField label="Deal title" required>
                  <FusionInput defaultValue={selectedDeal.deal_title} name="dealTitle" required />
                </FusionField>
                <FusionField label="Company">
                  <FusionInput defaultValue={selectedDeal.crm_companies?.company_name || ""} name="companyName" />
                </FusionField>
                <FusionField label="Service interest">
                  <FusionInput defaultValue={selectedDeal.service || ""} name="service" />
                </FusionField>
                <FusionField label="Deal value">
                  <FusionInput defaultValue={selectedDeal.value} min="0" name="value" type="number" />
                </FusionField>
                <FusionField label="Stage">
                  <FusionSelect defaultValue={selectedDeal.stage_id || ""} name="stageId">
                    {crm.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                  </FusionSelect>
                </FusionField>
                <FusionField label="Status">
                  <FusionSelect defaultValue={selectedDeal.status || "open"} name="status">
                    {dealStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </FusionSelect>
                </FusionField>
                <FusionField label="Expected close date">
                  <FusionInput defaultValue={selectedDeal.expected_close_date || ""} name="expectedCloseDate" type="date" />
                </FusionField>
              </div>
              <div className="fusion-form-actions fusion-form-actions--end">
                <a className="ghost-button compact-button" href="/fusionadmin/deals">Close</a>
                <FusionSubmitButton className="compact-button" pendingLabel="Saving deal...">Save deal</FusionSubmitButton>
              </div>
            </form>
          ) : null}
        </article>
      </section>
    </div>
  );
}
