import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { sendFusionEmailCampaign, updateFusionEmailCampaign } from "@/app/fusionadmin/actions";
import { getCampaignForEdit } from "@/lib/email-marketing";
import { DEFAULT_CAMPAIGN_BLOCKS } from "@/lib/email-blocks";
import { EmailCampaignBuilder } from "@/components/EmailCampaignBuilder";
import { formatDate, FusionBadge, FusionDataTable, EmptyState, PageHeader, statusTone } from "@/app/fusionadmin/(admin)/crm-ui";

export default async function FusionEmailCampaignEditPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ sendError?: string; sent?: string }>;
}) {
  const { id } = await params;
  const filters = (await searchParams) || {};
  const { campaign, audiences, sends } = await getCampaignForEdit(id);

  if (!campaign) notFound();

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Email marketing"
        title={campaign.campaign_name}
        description={`${campaign.subject}`}
        action={
          <div className="admin-page-action-group">
            <FusionBadge tone={statusTone(campaign.status)}>{campaign.status}</FusionBadge>
            <Link className="secondary-button compact-button" href="/fusionadmin/email">
              <ArrowLeft size={16} /> Back to email
            </Link>
          </div>
        }
      />

      <EmailCampaignBuilder
        audiences={audiences}
        campaignId={campaign.id}
        initialAudienceId={campaign.audience_id || ""}
        initialBlocks={campaign.content_blocks?.length ? campaign.content_blocks : DEFAULT_CAMPAIGN_BLOCKS}
        initialCampaignName={campaign.campaign_name}
        initialFromEmail={campaign.from_email || ""}
        initialFromName={campaign.from_name || ""}
        initialReplyTo={campaign.reply_to || ""}
        initialSubject={campaign.subject}
        saveAction={updateFusionEmailCampaign}
        sendAction={sendFusionEmailCampaign}
        sendError={filters.sendError}
        sentCount={filters.sent}
        status={campaign.status}
      />

      {sends.length ? (
        <article className="admin-panel" style={{ marginTop: "1.5rem" }}>
          <div className="panel-heading">
            <h2>Recipient activity</h2>
            <span className="status-pill">{sends.length} sends</span>
          </div>
          <FusionDataTable
            aria-label="Recipient activity"
            columns={[{ header: "Email", priority: "primary" }, { header: "Status" }, { header: "Sent" }, { header: "Opened" }, { header: "Clicked" }]}
            empty={<EmptyState>No sends yet.</EmptyState>}
          >
            {sends.map((send) => (
              <tr key={send.id}>
                <td data-label="Email">{send.email}</td>
                <td data-label="Status"><FusionBadge tone={statusTone(send.status)}>{send.status}</FusionBadge></td>
                <td data-label="Sent">{send.sent_at ? formatDate(send.sent_at) : "-"}</td>
                <td data-label="Opened">{send.opened_at ? formatDate(send.opened_at) : "-"}</td>
                <td data-label="Clicked">{send.clicked_at ? formatDate(send.clicked_at) : "-"}</td>
              </tr>
            ))}
          </FusionDataTable>
        </article>
      ) : null}
    </div>
  );
}
