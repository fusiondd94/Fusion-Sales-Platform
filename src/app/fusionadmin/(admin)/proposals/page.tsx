import Link from "next/link";
import { FileText, PlusCircle, SquarePen } from "lucide-react";
import { createFusionProposal, updateFusionProposalStatus } from "@/app/fusionadmin/actions";
import { getSalesOpsWorkspace } from "@/lib/sales-ops";
import { EmptyState, formatCurrency, formatDate, FusionBadge, FusionDataTable, FusionSubmitButton, PageHeader, statusTone } from "../crm-ui";

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
          <FusionDataTable
            aria-label="Proposal pipeline"
            columns={[
              { header: "Proposal", priority: "primary" },
              { header: "Recipient" },
              { header: "Status" },
              { header: "Total" },
              { header: "Recurring" },
              { header: "Expires" },
              { header: "" }
            ]}
            empty={!salesOps.proposals.length ? <EmptyState>No proposals yet.</EmptyState> : null}
          >
            {salesOps.proposals.map((proposal) => (
              <tr key={proposal.id}>
                <td data-label="Proposal">{proposal.proposal_title}<br /><span className="muted">{proposal.proposal_number}</span></td>
                <td data-label="Recipient">
                  {proposal.contact?.display_name || proposal.company?.company_name ? (
                    <>
                      {proposal.contact?.display_name ? <span>{proposal.contact.display_name}</span> : null}
                      {proposal.contact?.display_name && proposal.company?.company_name ? <br /> : null}
                      {proposal.company?.company_name ? <span className="muted">{proposal.company.company_name}</span> : null}
                    </>
                  ) : (
                    <span className="muted">Not assigned</span>
                  )}
                </td>
                <td data-label="Status">
                  <FusionBadge tone={statusTone(proposal.status)}>{proposal.status}</FusionBadge>
                  <form action={updateFusionProposalStatus} className="inline-status-form">
                    <input name="proposalId" type="hidden" value={proposal.id} />
                    <select aria-label="Update proposal status" defaultValue={proposal.status} name="status">
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="accepted">Accepted</option>
                      <option value="declined">Declined</option>
                      <option value="expired">Expired</option>
                    </select>
                    <button className="ghost-button compact-button" type="submit">Update</button>
                  </form>
                </td>
                <td data-label="Total">{formatCurrency(proposal.grand_total)}<br /><span className="muted">Profit {formatCurrency(proposal.estimated_gross_profit)}</span></td>
                <td data-label="Recurring">{formatCurrency(proposal.recurring_monthly_total)}/mo</td>
                <td data-label="Expires">{formatDate(proposal.expiration_date)}</td>
                <td data-label="">
                  <Link className="ghost-button compact-button" href={`/fusionadmin/proposals/${proposal.id}/edit`}>
                    <SquarePen size={14} /> Edit
                  </Link>
                </td>
              </tr>
            ))}
          </FusionDataTable>
        </article>

        <article className="admin-panel">
          <h2><PlusCircle size={20} /> Create proposal</h2>
          <form className="quick-form" action={createFusionProposal} data-track-unsaved="true">
            <input aria-label="Proposal title" name="proposalTitle" placeholder="Proposal title" required />
            <select aria-label="Proposal service" name="serviceId" required defaultValue="">
              <option value="">Select service</option>
              {salesOps.services.map((service) => (
                <option key={service.id} value={service.id}>{service.service_name} - {formatCurrency(service.base_price)}</option>
              ))}
            </select>
            <input aria-label="Quantity" min="1" name="quantity" placeholder="Quantity" type="number" defaultValue={1} />
            <select aria-label="Discount type" name="discountType" defaultValue="none">
              <option value="none">No discount</option>
              <option value="fixed">Fixed discount</option>
              <option value="percent">Percent discount</option>
            </select>
            <input aria-label="Discount value" min="0" name="discountValue" placeholder="Discount value" type="number" defaultValue={0} />
            <input aria-label="Expiration date" name="expirationDate" type="date" />
            <select aria-label="Contact recipient" name="contactId" defaultValue="">
              <option value="">No contact selected</option>
              {salesOps.contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.display_name}{contact.email ? ` (${contact.email})` : ""}</option>
              ))}
            </select>
            <select aria-label="Client / company recipient" name="companyId" defaultValue="">
              <option value="">No client selected</option>
              {salesOps.companies.map((company) => (
                <option key={company.id} value={company.id}>{company.company_name}</option>
              ))}
            </select>
            <FusionSubmitButton pendingLabel="Creating...">Create proposal</FusionSubmitButton>
          </form>
        </article>
      </section>
    </div>
  );
}
