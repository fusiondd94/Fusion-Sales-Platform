import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DEFAULT_CAMPAIGN_BLOCKS, renderBlocksToHtml, safeParseBlocks, type EmailBlock } from "@/lib/email-blocks";

export type { EmailBlock, EmailBlockType } from "@/lib/email-blocks";
export { DEFAULT_CAMPAIGN_BLOCKS, renderBlocksToHtml } from "@/lib/email-blocks";

type JsonObject = Record<string, string | number | boolean | null>;

export type EmailAudience = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count?: number;
};

export type EmailAudienceMember = {
  id: string;
  audience_id: string;
  contact_id: string;
  category: string | null;
  added_at: string;
  contact?: { id: string; display_name: string; email: string | null } | null;
};

export type EmailCampaign = {
  id: string;
  audience_id: string | null;
  campaign_name: string;
  subject: string;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  status: string;
  content_blocks: EmailBlock[];
  html_body: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
  created_at: string;
  updated_at: string;
  audience?: { id: string; name: string } | null;
};

export type EmailSend = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  email: string;
  status: string;
  error: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
};

export type EmailContactOption = { id: string; display_name: string; email: string | null };

let cachedClient: SupabaseClient<any> | null = null;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cachedClient) {
    cachedClient = createClient<any>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return cachedClient;
}

async function getDefaultOrganizationId(supabase: SupabaseClient<any>) {
  const { data, error } = await supabase
    .from("crm_organizations")
    .select("id")
    .eq("slug", "fusion-digital-dynamics")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("Unable to load Fusion CRM organization for email marketing.", error);
    return null;
  }
  return data.id;
}

async function logActivity(
  supabase: SupabaseClient<any>,
  organizationId: string,
  actorId: string | null,
  actionType: string,
  entityType: string,
  entityId: string | null,
  summary: string,
  metadata: JsonObject = {}
) {
  await supabase.from("crm_activities").insert({
    organization_id: organizationId,
    actor_id: actorId,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId,
    summary,
    metadata
  });
}

const audienceSchema = z.object({
  actorId: z.string().uuid(),
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(400).optional()
});

const updateAudienceSchema = audienceSchema.extend({ audienceId: z.string().uuid() });

const memberSchema = z.object({
  actorId: z.string().uuid(),
  audienceId: z.string().uuid(),
  contactId: z.string().uuid(),
  category: z.string().trim().max(80).optional()
});

const campaignSchema = z.object({
  actorId: z.string().uuid(),
  campaignName: z.string().trim().min(2).max(160),
  subject: z.string().trim().min(2).max(200),
  fromName: z.string().trim().max(120).optional(),
  fromEmail: z.string().trim().max(180).optional(),
  replyTo: z.string().trim().max(180).optional(),
  audienceId: z.string().uuid().optional().or(z.literal(""))
});

const updateCampaignSchema = z.object({
  actorId: z.string().uuid(),
  campaignId: z.string().uuid(),
  campaignName: z.string().trim().min(2).max(160),
  subject: z.string().trim().min(2).max(200),
  fromName: z.string().trim().max(120).optional(),
  fromEmail: z.string().trim().max(180).optional(),
  replyTo: z.string().trim().max(180).optional(),
  audienceId: z.string().uuid().optional().or(z.literal("")),
  contentBlocksJson: z.string()
});

export async function getEmailMarketingWorkspace() {
  const empty = {
    audiences: [] as EmailAudience[],
    campaigns: [] as EmailCampaign[],
    contacts: [] as EmailContactOption[],
    totals: { audiences: 0, campaigns: 0, sent: 0, opened: 0, clicked: 0 }
  };

  const supabase = getServiceClient();
  if (!supabase) return empty;
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return empty;

  const [audiencesResult, membersResult, campaignsResult, contactsResult] = await Promise.all([
    supabase.from("crm_email_audiences").select("id, name, description, created_at").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("crm_email_audience_members").select("audience_id"),
    supabase.from("crm_email_campaigns").select("id, audience_id, campaign_name, subject, from_name, from_email, reply_to, status, content_blocks, html_body, scheduled_at, sent_at, recipient_count, opened_count, clicked_count, replied_count, created_at, updated_at, audience:crm_email_audiences(id, name)").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("crm_contacts").select("id, display_name, email").eq("organization_id", organizationId).is("deleted_at", null).order("display_name", { ascending: true }).limit(500)
  ]);

  const counts = new Map<string, number>();
  for (const row of membersResult.data || []) {
    counts.set(row.audience_id, (counts.get(row.audience_id) || 0) + 1);
  }

  const audiences = (audiencesResult.data || []).map((audience: EmailAudience) => ({
    ...audience,
    member_count: counts.get(audience.id) || 0
  }));

  const campaigns = ((campaignsResult.data || []) as any[]).map((row) => ({
    ...row,
    audience: Array.isArray(row.audience) ? row.audience[0] || null : row.audience || null
  })) as EmailCampaign[];

  const totals = {
    audiences: audiences.length,
    campaigns: campaigns.length,
    sent: campaigns.filter((campaign) => campaign.status === "sent").length,
    opened: campaigns.reduce((sum, campaign) => sum + (campaign.opened_count || 0), 0),
    clicked: campaigns.reduce((sum, campaign) => sum + (campaign.clicked_count || 0), 0)
  };

  return {
    audiences,
    campaigns,
    contacts: (contactsResult.data || []) as EmailContactOption[],
    totals
  };
}

export async function getAudienceDetail(audienceId: string) {
  const supabase = getServiceClient();
  if (!supabase) return { audience: null, members: [] as EmailAudienceMember[], availableContacts: [] as EmailContactOption[] };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { audience: null, members: [] as EmailAudienceMember[], availableContacts: [] as EmailContactOption[] };

  const [audienceResult, membersResult, contactsResult] = await Promise.all([
    supabase.from("crm_email_audiences").select("id, name, description, created_at").eq("organization_id", organizationId).eq("id", audienceId).is("deleted_at", null).single<EmailAudience>(),
    supabase.from("crm_email_audience_members").select("id, audience_id, contact_id, category, added_at, contact:crm_contacts(id, display_name, email)").eq("audience_id", audienceId).order("added_at", { ascending: false }),
    supabase.from("crm_contacts").select("id, display_name, email").eq("organization_id", organizationId).is("deleted_at", null).order("display_name", { ascending: true }).limit(500)
  ]);

  const members = ((membersResult.data || []) as any[]).map((row) => ({
    ...row,
    contact: Array.isArray(row.contact) ? row.contact[0] || null : row.contact || null
  })) as EmailAudienceMember[];

  const memberContactIds = new Set(members.map((member) => member.contact_id));
  const availableContacts = ((contactsResult.data || []) as EmailContactOption[]).filter((contact) => !memberContactIds.has(contact.id));

  return {
    audience: (audienceResult.data as EmailAudience) || null,
    members,
    availableContacts
  };
}

export async function getCampaignForEdit(campaignId: string) {
  const supabase = getServiceClient();
  if (!supabase) return { campaign: null, audiences: [] as EmailAudience[], sends: [] as EmailSend[] };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { campaign: null, audiences: [] as EmailAudience[], sends: [] as EmailSend[] };

  const [campaignResult, audiencesResult, sendsResult] = await Promise.all([
    supabase.from("crm_email_campaigns").select("id, audience_id, campaign_name, subject, from_name, from_email, reply_to, status, content_blocks, html_body, scheduled_at, sent_at, recipient_count, opened_count, clicked_count, replied_count, created_at, updated_at").eq("organization_id", organizationId).eq("id", campaignId).is("deleted_at", null).single<EmailCampaign>(),
    supabase.from("crm_email_audiences").select("id, name, description, created_at").eq("organization_id", organizationId).is("deleted_at", null).order("name", { ascending: true }),
    supabase.from("crm_email_sends").select("id, campaign_id, contact_id, email, status, error, sent_at, opened_at, clicked_at, replied_at").eq("campaign_id", campaignId).order("sent_at", { ascending: false }).limit(200)
  ]);

  return {
    campaign: (campaignResult.data as EmailCampaign) || null,
    audiences: (audiencesResult.data || []) as EmailAudience[],
    sends: (sendsResult.data || []) as EmailSend[]
  };
}

export async function createEmailAudience(input: z.input<typeof audienceSchema>) {
  const parsed = audienceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Audience information is not valid." };
  const value = parsed.data;
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data, error } = await supabase
    .from("crm_email_audiences")
    .insert({
      organization_id: organizationId,
      name: value.name,
      description: value.description || null,
      created_by: value.actorId,
      updated_by: value.actorId
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to create audience." };
  await logActivity(supabase, organizationId, value.actorId, "email_audience.created", "email_audience", data.id, `Audience created: ${value.name}`);
  return { ok: true, id: data.id };
}

export async function updateEmailAudience(input: z.input<typeof updateAudienceSchema>) {
  const parsed = updateAudienceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Audience information is not valid." };
  const value = parsed.data;
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data, error } = await supabase
    .from("crm_email_audiences")
    .update({ name: value.name, description: value.description || null, updated_by: value.actorId, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", value.audienceId)
    .is("deleted_at", null)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to update audience." };
  return { ok: true };
}

export async function deleteEmailAudience(input: { actorId: string; audienceId: string }) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { error } = await supabase
    .from("crm_email_audiences")
    .update({ deleted_at: new Date().toISOString(), updated_by: input.actorId })
    .eq("organization_id", organizationId)
    .eq("id", input.audienceId);

  if (error) return { ok: false, error: "Unable to delete audience." };
  return { ok: true };
}

export async function addAudienceMember(input: z.input<typeof memberSchema>) {
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Member information is not valid." };
  const value = parsed.data;
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data: audience } = await supabase.from("crm_email_audiences").select("id").eq("organization_id", organizationId).eq("id", value.audienceId).is("deleted_at", null).single<{ id: string }>();
  if (!audience) return { ok: false, error: "Audience not found." };

  const { error } = await supabase
    .from("crm_email_audience_members")
    .upsert(
      { audience_id: value.audienceId, contact_id: value.contactId, category: value.category || null },
      { onConflict: "audience_id,contact_id" }
    );

  if (error) return { ok: false, error: "Unable to add contact to audience." };
  return { ok: true };
}

export async function updateAudienceMemberCategory(input: { actorId: string; memberId: string; category: string }) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };

  const { error } = await supabase
    .from("crm_email_audience_members")
    .update({ category: input.category.trim() || null })
    .eq("id", input.memberId);

  if (error) return { ok: false, error: "Unable to update category." };
  return { ok: true };
}

export async function removeAudienceMember(input: { actorId: string; memberId: string }) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };

  const { error } = await supabase.from("crm_email_audience_members").delete().eq("id", input.memberId);
  if (error) return { ok: false, error: "Unable to remove contact from audience." };
  return { ok: true };
}

export async function createEmailCampaign(input: z.input<typeof campaignSchema>) {
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Campaign information is not valid." };
  const value = parsed.data;
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data, error } = await supabase
    .from("crm_email_campaigns")
    .insert({
      organization_id: organizationId,
      audience_id: value.audienceId || null,
      campaign_name: value.campaignName,
      subject: value.subject,
      from_name: value.fromName || "Fusion Digital Dynamics",
      from_email: value.fromEmail || null,
      reply_to: value.replyTo || null,
      status: "draft",
      content_blocks: DEFAULT_CAMPAIGN_BLOCKS,
      html_body: renderBlocksToHtml(DEFAULT_CAMPAIGN_BLOCKS),
      created_by: value.actorId,
      updated_by: value.actorId
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to create campaign." };
  await logActivity(supabase, organizationId, value.actorId, "email_campaign.created", "email_campaign", data.id, `Campaign created: ${value.campaignName}`);
  return { ok: true, id: data.id };
}

export async function updateEmailCampaign(input: z.input<typeof updateCampaignSchema>) {
  const parsed = updateCampaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Campaign information is not valid." };
  const value = parsed.data;
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const blocks = safeParseBlocks(value.contentBlocksJson);

  const { data, error } = await supabase
    .from("crm_email_campaigns")
    .update({
      audience_id: value.audienceId || null,
      campaign_name: value.campaignName,
      subject: value.subject,
      from_name: value.fromName || "Fusion Digital Dynamics",
      from_email: value.fromEmail || null,
      reply_to: value.replyTo || null,
      content_blocks: blocks,
      html_body: renderBlocksToHtml(blocks),
      updated_by: value.actorId,
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("id", value.campaignId)
    .is("deleted_at", null)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to save campaign." };
  return { ok: true };
}

export async function deleteEmailCampaign(input: { actorId: string; campaignId: string }) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { error } = await supabase
    .from("crm_email_campaigns")
    .update({ deleted_at: new Date().toISOString(), updated_by: input.actorId })
    .eq("organization_id", organizationId)
    .eq("id", input.campaignId);

  if (error) return { ok: false, error: "Unable to delete campaign." };
  return { ok: true };
}

export async function sendEmailCampaign(input: { actorId: string; campaignId: string }) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data: campaign } = await supabase
    .from("crm_email_campaigns")
    .select("id, audience_id, campaign_name, subject, from_name, from_email, reply_to, status, content_blocks")
    .eq("organization_id", organizationId)
    .eq("id", input.campaignId)
    .is("deleted_at", null)
    .single<EmailCampaign>();

  if (!campaign) return { ok: false, error: "Campaign not found." };
  if (campaign.status === "sending" || campaign.status === "sent") return { ok: false, error: "This campaign has already been sent." };
  if (!campaign.audience_id) return { ok: false, error: "Select an audience before sending this campaign." };

  const { data: memberRows } = await supabase
    .from("crm_email_audience_members")
    .select("contact_id, contact:crm_contacts(id, display_name, email)")
    .eq("audience_id", campaign.audience_id);

  const recipients = ((memberRows || []) as any[])
    .map((row) => (Array.isArray(row.contact) ? row.contact[0] : row.contact))
    .filter((contact) => contact && contact.email) as EmailContactOption[];

  if (!recipients.length) return { ok: false, error: "This audience has no contacts with an email address." };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "Resend is not connected yet. Add a RESEND_API_KEY environment variable in your hosting settings, then try sending again."
    };
  }

  const fromEmail = campaign.from_email || "no-reply@fddynamics.com";
  const fromHeader = `${campaign.from_name || "Fusion Digital Dynamics"} <${fromEmail}>`;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fusion-digital-dynamics-sales-platf.vercel.app";
  const blocks = (campaign.content_blocks || []) as EmailBlock[];

  await supabase
    .from("crm_email_campaigns")
    .update({ status: "sending", recipient_count: recipients.length, updated_by: input.actorId, updated_at: new Date().toISOString() })
    .eq("id", campaign.id);

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    const { data: sendRow } = await supabase
      .from("crm_email_sends")
      .insert({ campaign_id: campaign.id, contact_id: recipient.id, email: recipient.email, status: "queued" })
      .select("id")
      .single<{ id: string }>();

    if (!sendRow) {
      failedCount += 1;
      continue;
    }

    const html = renderBlocksToHtml(blocks, { trackingBaseUrl: siteUrl, sendId: sendRow.id });

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromHeader,
          to: recipient.email,
          subject: campaign.subject,
          html,
          reply_to: campaign.reply_to || undefined
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload?.id) {
        sentCount += 1;
        await supabase.from("crm_email_sends").update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: payload.id }).eq("id", sendRow.id);
      } else {
        failedCount += 1;
        await supabase.from("crm_email_sends").update({ status: "failed", error: payload?.message || `Resend returned status ${response.status}` }).eq("id", sendRow.id);
      }
    } catch (error) {
      failedCount += 1;
      await supabase.from("crm_email_sends").update({ status: "failed", error: error instanceof Error ? error.message : "Send failed." }).eq("id", sendRow.id);
    }
  }

  await supabase
    .from("crm_email_campaigns")
    .update({
      status: sentCount > 0 ? "sent" : "failed",
      sent_at: sentCount > 0 ? new Date().toISOString() : null,
      updated_by: input.actorId,
      updated_at: new Date().toISOString()
    })
    .eq("id", campaign.id);

  await logActivity(supabase, organizationId, input.actorId, "email_campaign.sent", "email_campaign", campaign.id, `Campaign sent: ${campaign.campaign_name}`, { sent: sentCount, failed: failedCount });

  if (sentCount === 0) return { ok: false, error: `All ${failedCount} sends failed. Check your Resend domain verification and API key.` };
  return { ok: true, sent: sentCount, failed: failedCount };
}

export async function markEmailSendOpened(sendId: string) {
  const supabase = getServiceClient();
  if (!supabase) return;
  const { data: send } = await supabase.from("crm_email_sends").select("id, campaign_id, opened_at").eq("id", sendId).single<{ id: string; campaign_id: string; opened_at: string | null }>();
  if (!send || send.opened_at) return;

  await supabase.from("crm_email_sends").update({ opened_at: new Date().toISOString(), status: "opened" }).eq("id", sendId);

  const { data: campaign } = await supabase.from("crm_email_campaigns").select("opened_count").eq("id", send.campaign_id).single<{ opened_count: number }>();
  if (campaign) {
    await supabase.from("crm_email_campaigns").update({ opened_count: (campaign.opened_count || 0) + 1 }).eq("id", send.campaign_id);
  }
}

export async function markEmailSendClicked(sendId: string) {
  const supabase = getServiceClient();
  if (!supabase) return;
  const { data: send } = await supabase.from("crm_email_sends").select("id, campaign_id, clicked_at").eq("id", sendId).single<{ id: string; campaign_id: string; clicked_at: string | null }>();
  if (!send) return;

  if (!send.clicked_at) {
    await supabase.from("crm_email_sends").update({ clicked_at: new Date().toISOString(), status: "clicked" }).eq("id", sendId);
    const { data: campaign } = await supabase.from("crm_email_campaigns").select("clicked_count").eq("id", send.campaign_id).single<{ clicked_count: number }>();
    if (campaign) {
      await supabase.from("crm_email_campaigns").update({ clicked_count: (campaign.clicked_count || 0) + 1 }).eq("id", send.campaign_id);
    }
  }
}
