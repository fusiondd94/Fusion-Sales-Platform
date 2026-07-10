import { FileText, PlusCircle } from "lucide-react";
import { createFusionProposal } from "@/app/fusionadmin/actions";
import { getSalesOpsWorkspace } from "@/lib/sales-ops";
import { EmptyState, formatCurrency, formatDate, PageHeader } from "../crm-ui";

export default async function FusionProposalsPage() {
  const salesOps = await getSalesOpsWorkspace();

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Proposals"
        title="Create and manage quotes"
        description="Build proposal records from the service catalog with server-side money calculations and line-item snapshots."
      />

      <section className="admin-two-column">
        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><FileText size={20} /> Proposal pipeline</h2>
            <span className="status-pill">{salesOps.proposals.length} proposals</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Proposal</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Recurring</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {salesOps.proposals.map((proposal) => (
                  <tr key={proposal.id}>
                    <td>{proposal.proposal_title}<br /><span className="muted">{proposal.proposal_number}</span></td>
                    <td><span className="status-pill">{proposal.status}</span></td>
                    <td>{formatCurrency(proposal.grand_total)}<br /><span className="muted">Profit {formatCurrency(proposal.estimated_gross_profit)}</span></td>
                    <td>{formatCurrency(proposal.recurring_monthly_total)}/mo</td>
                    <td>{formatDate(proposal.expiration_date)}</td>
                  </tr>
                ))}
                {!salesOps.proposals.length ? (
                  <tr><td colSpan={5}><EmptyState>No proposals yet.</EmptyState></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="admin-panel">
          <h2><PlusCircle size={20} /> Create proposal</h2>
          <form className="quick-form" action={createFusionProposal}>
            <input name="proposalTitle" placeholder="Proposal title" required />
            <select name="serviceId" required defaultValue="">
              <option value="">Select service</option>
              {salesOps.services.map((service) => (
                <option key={service.id} value={service.id}>{service.service_name} - {formatCurrency(service.base_price)}</option>
              ))}
            </select>
            <input min="1" name="quantity" placeholder="Quantity" type="number" defaultValue={1} />
            <select name="discountType" defaultValue="none">
              <option value="none">No discount</option>
              <option value="fixed">Fixed discount</option>
              <option value="percent">Percent discount</option>
            </select>
            <input min="0" name="discountValue" placeholder="Discount value" type="number" defaultValue={0} />
            <input name="expirationDate" type="date" />
            <button className="primary-button" type="submit">Create proposal</button>
          </form>
        </article>
      </section>
    </div>
  );
}
