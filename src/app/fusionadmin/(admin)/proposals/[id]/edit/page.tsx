import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { updateFusionProposal } from "@/app/fusionadmin/actions";
import { getSalesProposalForEdit } from "@/lib/sales-ops";
import { formatCurrency, FusionSubmitButton, PageHeader } from "@/app/fusionadmin/(admin)/crm-ui";

export default async function FusionProposalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { proposal, item, contacts, companies } = await getSalesProposalForEdit(id);

  if (!proposal || !item) {
    notFound();
  }

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Proposals"
        title={`Edit ${proposal.proposal_title}`}
        description={`${proposal.proposal_number} · ${item.item_name}`}
        action={
          <Link className="secondary-button compact-button" href="/fusionadmin/proposals">
            <ArrowLeft size={16} /> Back to proposals
          </Link>
        }
      />

      <section className="admin-two-column">
        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><FileText size={20} /> Proposal details</h2>
          </div>
          <form className="record-edit-grid" action={updateFusionProposal} data-track-unsaved="true">
            <input name="proposalId" type="hidden" value={proposal.id} />

            <label>
              <span>Proposal title</span>
              <input defaultValue={proposal.proposal_title} name="proposalTitle" required />
            </label>

            <label>
              <span>Status</span>
              <select defaultValue={proposal.status} name="status">
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
                <option value="expired">Expired</option>
              </select>
            </label>

            <label>
              <span>Contact recipient</span>
              <select defaultValue={proposal.contact_id || ""} name="contactId">
                <option value="">No contact selected</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.display_name}{contact.email ? ` (${contact.email})` : ""}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Client / company recipient</span>
              <select defaultValue={proposal.company_id || ""} name="companyId">
                <option value="">No client selected</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.company_name}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Item</span>
              <input disabled value={item.item_name} />
              <small>Unit price {formatCurrency(item.unit_price)}. Change the service by creating a new proposal.</small>
            </label>

            <label>
              <span>Quantity</span>
              <input defaultValue={item.quantity} min="1" name="quantity" type="number" />
            </label>

            <label>
              <span>Discount type</span>
              <select defaultValue={proposal.discount_type} name="discountType">
                <option value="none">No discount</option>
                <option value="fixed">Fixed discount</option>
                <option value="percent">Percent discount</option>
              </select>
            </label>

            <label>
              <span>Discount value</span>
              <input defaultValue={proposal.discount_value} min="0" name="discountValue" type="number" />
            </label>

            <label>
              <span>Expiration date</span>
              <input defaultValue={proposal.expiration_date ? proposal.expiration_date.slice(0, 10) : ""} name="expirationDate" type="date" />
            </label>

            <p className="muted">Current total: {formatCurrency(proposal.grand_total)} · Saving recalculates the total from quantity and discount.</p>

            <FusionSubmitButton pendingLabel="Saving...">Save proposal</FusionSubmitButton>
          </form>
        </article>
      </section>
    </div>
  );
}
