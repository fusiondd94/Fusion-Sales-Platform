import Link from "next/link";
import { LayoutTemplate, Mail, PlusCircle, SquarePen, Users } from "lucide-react";
import { createFusionEmailCampaign } from "@/app/fusionadmin/actions";
import { getEmailMarketingWorkspace } from "@/lib/email-marketing";
import { EmptyState, formatDate, FusionBadge, FusionDataTable, FusionSubmitButton, PageHeader, statusTone } from "../crm-ui";

export default async function FusionEmailHubPage({ searchParams }: { searchParams?: Promise<{ campaignError?: string }> }) {
  const filters = (await searchParams) || {};
  const workspace = await getEmailMarketingWorkspace();

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Email marketing"
        title="Campaigns and audiences"
        description="Build and send email campaigns to your contact audiences, then track opens and clicks."
        action={
          <div className="admin-page-action-group">
            <Link className="secondary-button compact-button" href="/fusionadmin/email/audiences">
              <Users size={16} /> Audiences
            </Link>
            <Link className="secondary-button compact-button" href="/fusionadmin/email-templates">
              <LayoutTemplate size={16} /> Templates
            </Link>
          </div>
        }
      />

      {filters.campaignError ? <p className="form-error">{filters.campaignError}</p> : null}

      <section className="email-template-summary" aria-label="Email marketing summary">
        <div>
          <strong>{workspace.totals.audiences}</strong>
          <span>Audiences</span>
        </div>
        <div>
          <strong>{workspace.totals.campaigns}</strong>
          <span>Campaigns</span>
        </div>
        <div>
          <strong>{workspace.totals.sent}</strong>
          <span>Sent</span>
        </div>
        <div>
          <strong>{workspace.totals.opened}</strong>
          <span>Opens</span>
        </div>
        <div>
          <strong>{workspace.totals.clicked}</strong>
          <span>Clicks</span>
        </div>
      </section>

      <section className="admin-two-column">
        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><Mail size={20} /> Campaigns</h2>
            <span className="status-pill">{workspace.campaigns.length} total</span>
          </div>
          <FusionDataTable
            aria-label="Email campaigns"
            columns={[
              { header: "Campaign", priority: "primary" },
              { header: "Audience" },
              { header: "Status" },
              { header: "Recipients" },
              { header: "Opens / Clicks" },
              { header: "Sent" },
              { header: "" }
            ]}
            empty={!workspace.campaigns.length ? <EmptyState>No campaigns yet. Create one to get started.</EmptyState> : null}
          >
            {workspace.campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td data-label="Campaign"><strong>{campaign.campaign_name}</strong><br /><span className="muted">{campaign.subject}</span></td>
                <td data-label="Audience">{campaign.audience?.name || <span className="muted">Not assigned</span>}</td>
                <td data-label="Status"><FusionBadge tone={statusTone(campaign.status)}>{campaign.status}</FusionBadge></td>
                <td data-label="Recipients">{campaign.recipient_count}</td>
                <td data-label="Opens / Clicks">{campaign.opened_count} / {campaign.clicked_count}</td>
                <td data-label="Sent">{campaign.sent_at ? formatDate(campaign.sent_at) : <span className="muted">Not sent</span>}</td>
                <td data-label="">
                  <Link className="ghost-button compact-button" href={`/fusionadmin/email/campaigns/${campaign.id}/edit`}>
                    <SquarePen size={14} /> {campaign.status === "draft" ? "Edit" : "View"}
                  </Link>
                </td>
              </tr>
            ))}
          </FusionDataTable>
        </article>

        <article className="admin-panel">
          <h2><PlusCircle size={20} /> Create campaign</h2>
          <form className="quick-form" action={createFusionEmailCampaign} data-track-unsaved="true">
            <input aria-label="Campaign name" name="campaignName" placeholder="Campaign name" required />
            <input aria-label="Subject line" name="subject" placeholder="Subject line" required />
            <input aria-label="From name" name="fromName" placeholder="From name (Fusion Digital Dynamics)" />
            <input aria-label="From email" name="fromEmail" placeholder="From email (no-reply@yourdomain.com)" type="email" />
            <input aria-label="Reply-to email" name="replyTo" placeholder="Reply-to email (optional)" type="email" />
            <select aria-label="Audience" defaultValue="" name="audienceId">
              <option value="">Choose an audience later</option>
              {workspace.audiences.map((audience) => (
                <option key={audience.id} value={audience.id}>{audience.name} ({audience.member_count} contacts)</option>
              ))}
            </select>
            <FusionSubmitButton pendingLabel="Creating...">Create and open builder</FusionSubmitButton>
          </form>
        </article>
      </section>
    </div>
  );
}
