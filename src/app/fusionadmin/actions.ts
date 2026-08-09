"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireFusionAdmin } from "@/lib/auth";
import {
createCrmClient,
createCrmContact,
createCrmDeal,
createCrmNote,
createCrmTask,
deleteCrmServicePackage,
inviteCrmTeamMember,
mergeCrmContacts,
updateCrmBrandSettings,
updateCrmCompany,
updateCrmContact,
updateCrmDeal,
updateCrmLead,
updateCrmServicePackage,
updateCrmTask,
updateCrmTeamMember,
uploadCrmBrandLogo
} from "@/lib/crm";
import {
createSalesAppointment,
createSalesCrmForm,
createSalesEmailTemplate,
createSalesProposal,
createSalesService,
updateSalesAppointment,
updateSalesCrmForm,
updateSalesEmailTemplate,
updateSalesProposal,
updateSalesProposalStatus,
updateSalesService
} from "@/lib/sales-ops";
import {
AutomationAction,
AutomationCondition,
AutomationPreviewResult,
AutomationTriggerType,
createAutomation,
deleteAutomation,
duplicateAutomation,
getAutomationEditWorkspace,
previewAutomation,
toggleAutomation,
updateAutomation
} from "@/lib/automations";
import {
createClientTask,
createTaskSection,
deleteBoardTask,
deleteProjectComment,
deleteTaskSection,
markAdminNotificationRead,
markAllAdminNotificationsRead,
reorderBoardTasks,
reorderTaskSections,
resolveProjectComment,
updateClientProject
} from "@/lib/portal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cancelClientOrder, createManualClientCharge, markOrderPaidManually } from "@/lib/sales-orders";
import {
backfillContactNames,
disconnectMessageChannel,
MessageChannelType,
MESSAGE_CHANNEL_TYPES,
MessageThreadStatus,
moveThreadFolder,
permanentlyDeleteThread,
saveMessageChannel,
sendMessage,
syncChannelHistory,
  triggerSmbAppDataSync,
} from "@/lib/messages";
import {
cancelContentPost,
ContentPlatform,
ContentType,
createContentPost,
deleteContentPost,
getOrganizationIdForContent,
publishPostNow,
updateContentPost,
uploadContentMedia
} from "@/lib/content";
import { addHashtagsToPool, applyRandomHashtagsToPost } from "@/lib/hashtags";
import {
addAudienceMember,
createEmailAudience,
createEmailCampaign,
deleteEmailAudience,
deleteEmailCampaign,
removeAudienceMember,
sendEmailCampaign,
updateAudienceMemberCategory,
updateEmailAudience,
updateEmailCampaign
} from "@/lib/email-marketing";

function enumValue<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T) {
const text = String(value || "");
return allowed.includes(text as T) ? text as T : fallback;
}

function optionalEnumValue<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[]) {
const text = String(value || "");
return allowed.includes(text as T) ? text as T : "";
}

function normalizeHexColor(raw: string, fallback: string) {
const trimmed = raw.trim();
if (!trimmed) return fallback;
const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
return /^#[0-9A-Fa-f]{6}$/.test(withHash) ? withHash : fallback;
}

export async function signInFusionAdmin(_: unknown, formData: FormData) {
const email = String(formData.get("email") || "").trim();
const password = String(formData.get("password") || "");

if (!email || !password) {
return { error: "Enter your email and password." };
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
return { error: "Supabase Auth is not configured yet." };
}

const supabase = await createSupabaseServerClient();
const { error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
return { error: "The email or password is not correct." };
}

redirect("/fusionadmin");
}

export async function signOutFusionAdmin() {
const supabase = await createSupabaseServerClient();
await supabase.auth.signOut();
redirect("/fusionadmin/login");
}

export async function createFusionContact(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createCrmContact({
actorId: user.id,
firstName: String(formData.get("firstName") || ""),
lastName: String(formData.get("lastName") || ""),
email: String(formData.get("email") || ""),
phone: String(formData.get("phone") || ""),
companyName: String(formData.get("companyName") || ""),
leadSource: String(formData.get("leadSource") || "Manual"),
nextFollowUpAt: String(formData.get("nextFollowUpAt") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
}

export async function createFusionClient(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createCrmClient({
actorId: user.id,
customerName: String(formData.get("customerName") || ""),
customerEmail: String(formData.get("customerEmail") || ""),
company: String(formData.get("company") || ""),
password: String(formData.get("password") || ""),
projectName: String(formData.get("projectName") || ""),
previewUrl: String(formData.get("previewUrl") || ""),
liveUrl: String(formData.get("liveUrl") || ""),
clientInstructions: String(formData.get("clientInstructions") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
revalidatePath("/portal");
}

export async function createFusionDeal(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createCrmDeal({
actorId: user.id,
dealTitle: String(formData.get("dealTitle") || ""),
companyName: String(formData.get("companyName") || ""),
service: String(formData.get("service") || ""),
value: Number(formData.get("value") || 0),
stageId: String(formData.get("stageId") || ""),
status: String(formData.get("status") || "open"),
expectedCloseDate: String(formData.get("expectedCloseDate") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/deals");
}

export async function createFusionTask(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createCrmTask({
actorId: user.id,
title: String(formData.get("title") || ""),
taskType: String(formData.get("taskType") || "Follow-Up"),
priority: String(formData.get("priority") || "normal"),
dueAt: String(formData.get("dueAt") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/tasks");
}

export async function updateFusionContact(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateCrmContact({
actorId: user.id,
contactId: String(formData.get("contactId") || ""),
displayName: String(formData.get("displayName") || ""),
email: String(formData.get("email") || ""),
phone: String(formData.get("phone") || ""),
jobTitle: String(formData.get("jobTitle") || ""),
companyName: String(formData.get("companyName") || ""),
lifecycleStatus: String(formData.get("lifecycleStatus") || "new"),
leadSource: String(formData.get("leadSource") || "Manual"),
nextFollowUpAt: String(formData.get("nextFollowUpAt") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
}

export async function mergeFusionContacts(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const primaryContactId = String(formData.get("primaryContactId") || "");
const duplicateContactId = String(formData.get("duplicateContactId") || "");

const result = await mergeCrmContacts({
actorId: user.id,
primaryContactId,
duplicateContactId
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");

if (!result.ok) {
redirect(
"/fusionadmin/clients?contactId=" +
encodeURIComponent(primaryContactId) +
"&mergeError=" +
encodeURIComponent(result.error || "Unable to merge contacts.") +
"#contact-editor"
);
}

redirect("/fusionadmin/clients?contactId=" + encodeURIComponent(primaryContactId) + "&merged=1#contact-editor");
}

export async function updateFusionLead(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateCrmLead({
actorId: user.id,
leadId: String(formData.get("leadId") || ""),
customerName: String(formData.get("customerName") || ""),
customerEmail: String(formData.get("customerEmail") || ""),
customerPhone: String(formData.get("customerPhone") || ""),
company: String(formData.get("company") || ""),
website: String(formData.get("website") || ""),
industry: String(formData.get("industry") || ""),
goal: String(formData.get("goal") || ""),
timeline: String(formData.get("timeline") || ""),
budget: String(formData.get("budget") || ""),
objection: String(formData.get("objection") || ""),
projectNotes: String(formData.get("projectNotes") || ""),
packageName: String(formData.get("packageName") || ""),
totalToday: Number(formData.get("totalToday") || 0),
monthlyDue: Number(formData.get("monthlyDue") || 0),
discountPercent: Number(formData.get("discountPercent") || 0),
status: String(formData.get("status") || "captured")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
}

export async function updateFusionTask(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateCrmTask({
actorId: user.id,
taskId: String(formData.get("taskId") || ""),
title: String(formData.get("title") || ""),
taskType: String(formData.get("taskType") || "Follow-Up"),
priority: String(formData.get("priority") || "normal"),
status: String(formData.get("status") || "open"),
dueAt: String(formData.get("dueAt") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/tasks");
}

export async function updateFusionClientProject(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateClientProject({
actorId: user.id,
clientId: String(formData.get("clientId") || ""),
projectName: String(formData.get("projectName") || "Website Project"),
projectStatus: String(formData.get("projectStatus") || "in_progress"),
liveUrl: String(formData.get("liveUrl") || ""),
previewUrl: String(formData.get("previewUrl") || ""),
currentPhase: String(formData.get("currentPhase") || "Design Review"),
paymentStatus: String(formData.get("paymentStatus") || "unpaid"),
clientInstructions: String(formData.get("clientInstructions") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
revalidatePath("/portal");
}


export async function createFusionClientCharge(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await createManualClientCharge({
    clientId: String(formData.get("clientId") || ""),
    description: String(formData.get("description") || ""),
    amountDollars: Number(formData.get("amountDollars") || 0)
  });

  revalidatePath("/fusionadmin");
  revalidatePath("/fusionadmin/clients");
  revalidatePath("/portal");
}

export async function markFusionOrderPaid(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await markOrderPaidManually({ orderId: String(formData.get("orderId") || "") });

  revalidatePath("/fusionadmin");
  revalidatePath("/fusionadmin/clients");
  revalidatePath("/portal");
}

export async function cancelFusionOrder(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await cancelClientOrder({ orderId: String(formData.get("orderId") || "") });

  revalidatePath("/fusionadmin");
  revalidatePath("/fusionadmin/clients");
  revalidatePath("/portal");
}

export async function deleteFusionProjectComment(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await deleteProjectComment({
actorId: user.id,
commentId: String(formData.get("commentId") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
revalidatePath("/portal");
}

export async function resolveFusionProjectComment(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await resolveProjectComment({
commentId: String(formData.get("commentId") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
revalidatePath("/portal");
}

export async function createFusionNote(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createCrmNote({
actorId: user.id,
body: String(formData.get("body") || ""),
entityType: String(formData.get("entityType") || "general")
});

revalidatePath("/fusionadmin");
}

export async function updateFusionBrandSettings(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

let logoUrl = String(formData.get("logoUrl") || "");
const logoFile = formData.get("logoFile");
if (logoFile instanceof File && logoFile.size > 0) {
const organizationId = await getOrganizationIdForContent();
if (organizationId) {
const buffer = await logoFile.arrayBuffer();
const uploadResult = await uploadCrmBrandLogo({
organizationId,
fileName: logoFile.name,
contentType: logoFile.type,
data: buffer
});
if (uploadResult.ok && uploadResult.url) logoUrl = uploadResult.url;
}
}

const primaryColor = normalizeHexColor(
String(formData.get("primaryColorHex") || ""),
String(formData.get("primaryColor") || "#31d7ff")
);
const accentColor = normalizeHexColor(
String(formData.get("accentColorHex") || ""),
String(formData.get("accentColor") || "#f5b84b")
);

await updateCrmBrandSettings({
actorId: user.id,
logoUrl,
primaryColor,
accentColor
});

revalidatePath("/fusionadmin/settings");
}

export async function updateFusionServicePackage(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateCrmServicePackage({
actorId: user.id,
packageId: String(formData.get("packageId") || ""),
packageName: String(formData.get("packageName") || ""),
description: String(formData.get("description") || ""),
setupPrice: Number(formData.get("setupPrice") || 0),
monthlyPrice: Number(formData.get("monthlyPrice") || 0),
isActive: formData.get("isActive") === "on"
});

revalidatePath("/fusionadmin/settings");
}

export async function deleteFusionServicePackage(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await deleteCrmServicePackage({
actorId: user.id,
packageId: String(formData.get("packageId") || "")
});

revalidatePath("/fusionadmin/settings");
}

export async function inviteFusionTeamMember(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await inviteCrmTeamMember({
actorId: user.id,
email: String(formData.get("email") || ""),
displayName: String(formData.get("displayName") || ""),
title: String(formData.get("title") || ""),
roleId: String(formData.get("roleId") || "")
});

revalidatePath("/fusionadmin/team");
revalidatePath("/fusionadmin/settings");
}

export async function createFusionService(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createSalesService({
actorId: user.id,
serviceName: String(formData.get("serviceName") || ""),
sku: String(formData.get("sku") || ""),
categoryId: String(formData.get("categoryId") || ""),
shortDescription: String(formData.get("shortDescription") || ""),
billingType: enumValue(formData.get("billingType"), ["one_time", "recurring", "usage_based", "custom_quote"] as const, "one_time"),
pricingModel: enumValue(formData.get("pricingModel"), ["fixed_price", "starting_at", "price_range", "per_unit", "hourly", "custom_quote"] as const, "fixed_price"),
basePrice: Number(formData.get("basePrice") || 0),
minimumPrice: Number(formData.get("minimumPrice") || 0),
maximumPrice: Number(formData.get("maximumPrice") || 0),
internalEstimatedCost: Number(formData.get("internalEstimatedCost") || 0),
recurringInterval: optionalEnumValue(formData.get("recurringInterval"), ["monthly", "quarterly", "semiannual", "annual", "custom"] as const),
isFeatured: formData.get("isFeatured") === "on",
publicVisibility: formData.get("publicVisibility") === "on"
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/services");
revalidatePath("/fusionadmin/reports");
}

export async function createFusionProposal(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createSalesProposal({
actorId: user.id,
proposalTitle: String(formData.get("proposalTitle") || ""),
serviceId: String(formData.get("serviceId") || ""),
quantity: Number(formData.get("quantity") || 1),
discountType: enumValue(formData.get("discountType"), ["none", "fixed", "percent"] as const, "none"),
discountValue: Number(formData.get("discountValue") || 0),
expirationDate: String(formData.get("expirationDate") || ""),
contactId: String(formData.get("contactId") || ""),
companyId: String(formData.get("companyId") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/proposals");
revalidatePath("/fusionadmin/reports");
}

export async function updateFusionProposal(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const proposalId = String(formData.get("proposalId") || "");

await updateSalesProposal({
actorId: user.id,
proposalId,
proposalTitle: String(formData.get("proposalTitle") || ""),
contactId: String(formData.get("contactId") || ""),
companyId: String(formData.get("companyId") || ""),
quantity: Number(formData.get("quantity") || 1),
discountType: enumValue(formData.get("discountType"), ["none", "fixed", "percent"] as const, "none"),
discountValue: Number(formData.get("discountValue") || 0),
expirationDate: String(formData.get("expirationDate") || ""),
status: enumValue(formData.get("status"), ["draft", "sent", "accepted", "declined", "expired"] as const, "draft")
});

revalidatePath("/fusionadmin/proposals");
revalidatePath("/fusionadmin/reports");
redirect("/fusionadmin/proposals");
}

export async function createFusionAppointment(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createSalesAppointment({
actorId: user.id,
title: String(formData.get("title") || ""),
appointmentTypeId: String(formData.get("appointmentTypeId") || ""),
startsAt: String(formData.get("startsAt") || ""),
endsAt: String(formData.get("endsAt") || ""),
location: String(formData.get("location") || ""),
meetingUrl: String(formData.get("meetingUrl") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/calendar");
revalidatePath("/fusionadmin/reports");
}

export async function updateFusionAppointment(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateSalesAppointment({
actorId: user.id,
appointmentId: String(formData.get("appointmentId") || ""),
title: String(formData.get("title") || ""),
appointmentTypeId: String(formData.get("appointmentTypeId") || ""),
startsAt: String(formData.get("startsAt") || ""),
endsAt: String(formData.get("endsAt") || ""),
status: enumValue(formData.get("status"), ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const, "scheduled"),
location: String(formData.get("location") || ""),
meetingUrl: String(formData.get("meetingUrl") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/calendar");
revalidatePath("/fusionadmin/reports");
}

export async function createFusionEmailTemplate(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createSalesEmailTemplate({
actorId: user.id,
templateName: String(formData.get("templateName") || ""),
subject: String(formData.get("subject") || ""),
body: String(formData.get("body") || ""),
category: String(formData.get("category") || "General Sales"),
visibility: enumValue(formData.get("visibility"), ["private", "shared"] as const, "shared")
});

revalidatePath("/fusionadmin/email-templates");
}

export async function createFusionCrmForm(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createSalesCrmForm({
actorId: user.id,
formName: String(formData.get("formName") || ""),
formType: String(formData.get("formType") || "Lead Inquiry"),
description: String(formData.get("description") || ""),
isPublished: formData.get("isPublished") === "on"
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/forms");
revalidatePath("/fusionadmin/reports");
}

export async function updateFusionCompany(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateCrmCompany({
actorId: user.id,
companyId: String(formData.get("companyId") || ""),
companyName: String(formData.get("companyName") || ""),
industry: String(formData.get("industry") || ""),
website: String(formData.get("website") || ""),
mainPhone: String(formData.get("mainPhone") || ""),
generalEmail: String(formData.get("generalEmail") || ""),
lifecycleStatus: String(formData.get("lifecycleStatus") || "new"),
leadSource: String(formData.get("leadSource") || "Manual")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
}

export async function updateFusionDeal(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateCrmDeal({
actorId: user.id,
dealId: String(formData.get("dealId") || ""),
dealTitle: String(formData.get("dealTitle") || ""),
companyName: String(formData.get("companyName") || ""),
service: String(formData.get("service") || ""),
value: Number(formData.get("value") || 0),
stageId: String(formData.get("stageId") || ""),
expectedCloseDate: String(formData.get("expectedCloseDate") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/deals");
}

export async function updateFusionTeamMember(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateCrmTeamMember({
actorId: user.id,
memberId: String(formData.get("memberId") || ""),
title: String(formData.get("title") || ""),
status: String(formData.get("status") || "active"),
roleId: String(formData.get("roleId") || "")
});

revalidatePath("/fusionadmin/team");
revalidatePath("/fusionadmin/settings");
}

export async function updateFusionService(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateSalesService({
actorId: user.id,
serviceId: String(formData.get("serviceId") || ""),
serviceName: String(formData.get("serviceName") || ""),
sku: String(formData.get("sku") || ""),
categoryId: String(formData.get("categoryId") || ""),
shortDescription: String(formData.get("shortDescription") || ""),
billingType: enumValue(formData.get("billingType"), ["one_time", "recurring", "usage_based", "custom_quote"] as const, "one_time"),
pricingModel: enumValue(formData.get("pricingModel"), ["fixed_price", "starting_at", "price_range", "per_unit", "hourly", "custom_quote"] as const, "fixed_price"),
basePrice: Number(formData.get("basePrice") || 0),
internalEstimatedCost: Number(formData.get("internalEstimatedCost") || 0),
recurringInterval: optionalEnumValue(formData.get("recurringInterval"), ["monthly", "quarterly", "semiannual", "annual", "custom"] as const),
isFeatured: formData.get("isFeatured") === "on",
publicVisibility: formData.get("publicVisibility") === "on",
isActive: formData.get("isActive") === "on"
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/services");
revalidatePath("/fusionadmin/reports");
}

export async function updateFusionEmailTemplate(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateSalesEmailTemplate({
actorId: user.id,
templateId: String(formData.get("templateId") || ""),
templateName: String(formData.get("templateName") || ""),
subject: String(formData.get("subject") || ""),
body: String(formData.get("body") || ""),
category: String(formData.get("category") || "General Sales"),
visibility: enumValue(formData.get("visibility"), ["private", "shared"] as const, "shared"),
isActive: formData.get("isActive") === "on"
});

revalidatePath("/fusionadmin/email-templates");
}

export async function updateFusionCrmForm(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateSalesCrmForm({
actorId: user.id,
formId: String(formData.get("formId") || ""),
formName: String(formData.get("formName") || ""),
formType: String(formData.get("formType") || "Lead Inquiry"),
description: String(formData.get("description") || ""),
isPublished: formData.get("isPublished") === "on",
isActive: formData.get("isActive") === "on"
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/forms");
revalidatePath("/fusionadmin/reports");
}

export async function createFusionAutomation(_prevState: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { error: "You are not authorized to do that." };

const conditions = parseAutomationConditions(formData);
const actions = parseAutomationActions(formData);

const result = await createAutomation({
actorId: user.id,
name: String(formData.get("name") || ""),
description: String(formData.get("description") || ""),
triggerType: String(formData.get("triggerType") || "lead.captured") as AutomationTriggerType,
conditions,
actions,
isActive: formData.get("isActive") === "on"
});

if (!result.ok) return { error: result.error };

revalidatePath("/fusionadmin/automations");
redirect("/fusionadmin/automations");
}
export async function updateFusionAutomation(_prevState: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { error: "You are not authorized to do that." };

const conditions = parseAutomationConditions(formData);
const actions = parseAutomationActions(formData);

const result = await updateAutomation({
actorId: user.id,
automationId: String(formData.get("automationId") || ""),
name: String(formData.get("name") || ""),
description: String(formData.get("description") || ""),
triggerType: String(formData.get("triggerType") || "lead.captured") as AutomationTriggerType,
conditions,
actions,
isActive: formData.get("isActive") === "on"
});

if (!result.ok) return { error: result.error };

revalidatePath("/fusionadmin/automations");
redirect("/fusionadmin/automations");
}
export async function toggleFusionAutomation(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await toggleAutomation({
actorId: user.id,
automationId: String(formData.get("automationId") || ""),
isActive: formData.get("isActive") === "on"
});

revalidatePath("/fusionadmin/automations");
}

export async function deleteFusionAutomation(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await deleteAutomation({
actorId: user.id,
automationId: String(formData.get("automationId") || "")
});

revalidatePath("/fusionadmin/automations");
redirect("/fusionadmin/automations");
}

export async function previewFusionAutomation(
_prevState: { result?: AutomationPreviewResult; error?: string } | undefined,
formData: FormData
): Promise<{ result?: AutomationPreviewResult; error?: string }> {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { error: "You are not authorized to do that." };

const automationId = String(formData.get("automationId") || "");
if (!automationId) return { error: "Missing automation id." };

const { automation } = await getAutomationEditWorkspace(automationId);
if (!automation) return { error: "Automation not found." };

const dealValueRaw = String(formData.get("sampleDealValue") || "").trim();
const proposalTotalRaw = String(formData.get("sampleProposalTotal") || "").trim();

const sample = {
contact: {
name: String(formData.get("sampleContactName") || ""),
email: String(formData.get("sampleContactEmail") || ""),
phone: String(formData.get("sampleContactPhone") || "")
},
company: {
name: String(formData.get("sampleCompanyName") || "")
},
deal: {
value: dealValueRaw ? Number(dealValueRaw) : undefined,
stageName: String(formData.get("sampleDealStage") || "")
},
task: {
title: String(formData.get("sampleTaskTitle") || "")
},
proposal: {
total: proposalTotalRaw ? Number(proposalTotalRaw) : undefined
}
};

const result = previewAutomation(automation.trigger_type, automation.conditions, automation.actions, sample);
return { result };
}

export async function duplicateFusionAutomation(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const result = await duplicateAutomation({
actorId: user.id,
automationId: String(formData.get("automationId") || "")
});

revalidatePath("/fusionadmin/automations");
if (result.ok && result.newId) {
redirect("/fusionadmin/automations/" + result.newId + "/edit");
}
redirect("/fusionadmin/automations");
}

export async function updateFusionProposalStatus(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateSalesProposalStatus({
actorId: user.id,
proposalId: String(formData.get("proposalId") || ""),
status: enumValue(formData.get("status"), ["draft", "sent", "accepted", "declined", "expired"] as const, "draft")
});

revalidatePath("/fusionadmin/proposals");
revalidatePath("/fusionadmin/automations");
}

function parseAutomationConditions(formData: FormData): AutomationCondition[] {
const fields = formData.getAll("conditionField").map(String);
const operators = formData.getAll("conditionOperator").map(String);
const values = formData.getAll("conditionValue").map(String);
const groups = formData.getAll("conditionGroup").map(String);

const conditions: AutomationCondition[] = [];
fields.forEach((field, index) => {
if (!field.trim()) return;
conditions.push({
field: field.trim(),
operator: (operators[index] || "is_set") as AutomationCondition["operator"],
value: values[index] || undefined,
group: Number(groups[index] || 0) || 0
});
});
return conditions;
}

function parseAutomationActions(formData: FormData): AutomationAction[] {
const types = formData.getAll("actionType").map(String);
const configsRaw = formData.getAll("actionConfig").map(String);

const actions: AutomationAction[] = [];
types.forEach((type, index) => {
if (!type.trim()) return;
let config: Record<string, string | number | boolean | null | undefined> = {};
try {
config = configsRaw[index] ? JSON.parse(configsRaw[index]) : {};
} catch {
config = {};
}
actions.push({ type: type.trim() as AutomationAction["type"], config });
});
return actions;
}

export async function assignFusionClientTask(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createClientTask({
clientId: String(formData.get("clientId") || ""),
projectId: String(formData.get("projectId") || "") || undefined,
sectionId: String(formData.get("sectionId") || "") || undefined,
title: String(formData.get("title") || ""),
description: String(formData.get("description") || ""),
dueAt: String(formData.get("dueAt") || "") || undefined,
priority: String(formData.get("priority") || "medium")
});

revalidatePath("/fusionadmin/clients");
revalidatePath("/fusionadmin/task-board");
revalidatePath("/portal");
}

export async function createFusionTaskSection(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createTaskSection({
projectId: String(formData.get("projectId") || ""),
name: String(formData.get("name") || "")
});

revalidatePath("/fusionadmin/task-board");
revalidatePath("/portal");
}

export async function deleteFusionTaskSection(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await deleteTaskSection({ sectionId: String(formData.get("sectionId") || "") });

revalidatePath("/fusionadmin/task-board");
revalidatePath("/portal");
}

export async function deleteFusionBoardTask(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await deleteBoardTask({ taskId: String(formData.get("taskId") || "") });

revalidatePath("/fusionadmin/task-board");
revalidatePath("/portal");
}

export async function reorderFusionTaskSections(orderedSectionIds: string[]) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { ok: false };

const result = await reorderTaskSections({ orderedSectionIds });
revalidatePath("/fusionadmin/task-board");
return result;
}

export async function reorderFusionBoardTasks(updates: Array<{ taskId: string; sectionId: string | null; position: number }>) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { ok: false };

const result = await reorderBoardTasks({ updates });
revalidatePath("/fusionadmin/task-board");
revalidatePath("/portal");
return result;
}

export async function markFusionNotificationRead(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const notificationId = String(formData.get("notificationId") || "");
if (!notificationId) return;

await markAdminNotificationRead({ notificationId });
revalidatePath("/fusionadmin", "layout");
}

export async function markAllFusionNotificationsRead(_formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await markAllAdminNotificationsRead();
revalidatePath("/fusionadmin", "layout");
}

export async function saveFusionMessageChannel(
_prevState: { error?: string } | undefined,
formData: FormData
): Promise<{ error?: string }> {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { error: "You are not authorized to do that." };

const channelType = String(formData.get("channelType") || "") as MessageChannelType;
if (!MESSAGE_CHANNEL_TYPES.includes(channelType)) return { error: "Unknown channel." };

const credentials: Record<string, string> = {};
let externalAccountId = "";
let displayName = String(formData.get("displayName") || "").trim();

if (channelType === "whatsapp") {
externalAccountId = String(formData.get("phoneNumberId") || "").trim();
credentials.phoneNumberId = externalAccountId;
credentials.accessToken = String(formData.get("accessToken") || "").trim();
credentials.wabaId = String(formData.get("wabaId") || "").trim();
displayName = displayName || "WhatsApp";
} else if (channelType === "messenger") {
externalAccountId = String(formData.get("pageId") || "").trim();
credentials.pageId = externalAccountId;
credentials.accessToken = String(formData.get("accessToken") || "").trim();
displayName = displayName || "Messenger";
} else if (channelType === "instagram") {
externalAccountId = String(formData.get("igAccountId") || "").trim();
credentials.igAccountId = externalAccountId;
credentials.accessToken = String(formData.get("accessToken") || "").trim();
displayName = displayName || "Instagram";
}

const result = await saveMessageChannel({
actorId: user.id,
channelType,
displayName,
externalAccountId,
credentials
});

if (result.error) return { error: result.error };

revalidatePath("/fusionadmin/settings/connections");
redirect("/fusionadmin/settings/connections");
}

export async function disconnectFusionMessageChannel(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const channelType = String(formData.get("channelType") || "") as MessageChannelType;
await disconnectMessageChannel({ actorId: user.id, channelType });

revalidatePath("/fusionadmin/settings/connections");
redirect("/fusionadmin/settings/connections");
}

export async function sendFusionMessage(
_prevState: { error?: string } | undefined,
formData: FormData
): Promise<{ error?: string }> {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { error: "You are not authorized to do that." };

const threadId = String(formData.get("threadId") || "");
const body = String(formData.get("body") || "");

const result = await sendMessage({ actorId: user.id, threadId, body });
if (!result.ok) return { error: result.error || "Unable to send message." };

revalidatePath("/fusionadmin/messages");
redirect("/fusionadmin/messages?thread=" + threadId);
}

export async function connectMetaPage(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const pageId = String(formData.get("pageId") || "").trim();
const pageName = String(formData.get("pageName") || "").trim();
const pageToken = String(formData.get("pageToken") || "").trim();
const igId = String(formData.get("igId") || "").trim();
const igUsername = String(formData.get("igUsername") || "").trim();

if (pageId && pageToken) {
await saveMessageChannel({
actorId: user.id,
channelType: "messenger",
displayName: pageName || "Messenger",
externalAccountId: pageId,
credentials: { accessToken: pageToken }
});

try {
await fetch(
`https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${encodeURIComponent(pageToken)}`,
{ method: "POST" }
);
} catch {
// Non-fatal: the channel is still saved even if the webhook subscription call fails.
}

if (igId) {
await saveMessageChannel({
actorId: user.id,
channelType: "instagram",
displayName: igUsername ? "@" + igUsername : "Instagram",
externalAccountId: igId,
credentials: { accessToken: pageToken }
});
}
}

const cookieStore = await cookies();
cookieStore.set("meta_oauth_pages", "", { maxAge: 0, path: "/" });

revalidatePath("/fusionadmin/settings/connections");
redirect("/fusionadmin/settings/connections");
}

export async function cancelMetaConnect() {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const cookieStore = await cookies();
cookieStore.set("meta_oauth_pages", "", { maxAge: 0, path: "/" });

redirect("/fusionadmin/settings/connections");
}

export async function syncFusionMessageChannelHistory(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const channelType = String(formData.get("channelType") || "") as MessageChannelType;
const result = await syncChannelHistory(channelType);

revalidatePath("/fusionadmin/settings/connections");
revalidatePath("/fusionadmin/messages");

if (!result.ok) {
redirect(
"/fusionadmin/settings/connections?syncError=" + encodeURIComponent(result.error || "Unable to sync message history.")
);
}

redirect("/fusionadmin/settings/connections?synced=" + encodeURIComponent(String(result.imported ?? 0)));
}

export async function refreshFusionChannelContactNames(_formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const result = await backfillContactNames();

revalidatePath("/fusionadmin/settings/connections");
revalidatePath("/fusionadmin/messages");
revalidatePath("/fusionadmin/clients");

if (!result.ok) {
redirect("/fusionadmin/settings/connections?nameRefreshError=" + encodeURIComponent(result.error || "Unable to refresh contact names."));
}

redirect("/fusionadmin/settings/connections?namesRefreshed=" + encodeURIComponent(String(result.updated)));
}

export async function moveFusionThreadFolder(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const threadId = String(formData.get("threadId") || "");
const newFolderRaw = String(formData.get("newFolder") || "");
const returnFolder = String(formData.get("returnFolder") || "inbox");
const returnChannel = String(formData.get("returnChannel") || "");

if (threadId && (newFolderRaw === "inbox" || newFolderRaw === "spam" || newFolderRaw === "trash")) {
await moveThreadFolder({ actorId: user.id, threadId, folder: newFolderRaw as MessageThreadStatus });
}

revalidatePath("/fusionadmin/messages");

const params = new URLSearchParams();
params.set("folder", returnFolder);
if (returnChannel) params.set("channel", returnChannel);
redirect("/fusionadmin/messages?" + params.toString());
}

export async function deleteFusionThreadForever(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const threadId = String(formData.get("threadId") || "");
const returnChannel = String(formData.get("returnChannel") || "");

if (threadId) {
await permanentlyDeleteThread({ actorId: user.id, threadId });
}

revalidatePath("/fusionadmin/messages");

const params = new URLSearchParams();
params.set("folder", "trash");
if (returnChannel) params.set("channel", returnChannel);
redirect("/fusionadmin/messages?" + params.toString());
}

export async function connectWhatsAppEmbeddedSignup(input: {
code: string;
phoneNumberId?: string;
wabaId?: string;
  isCoexistence?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { ok: false, error: "You are not authorized to do that." };

if (!input.phoneNumberId || !input.wabaId) {
return {
ok: false,
error:
"Meta didn't return a WhatsApp phone number or business account. Please try connecting again and complete every step in the popup, including verifying a phone number."
};
}

const appId = process.env.NEXT_PUBLIC_META_APP_ID;
const appSecret = process.env.META_APP_SECRET;
if (!appId || !appSecret) {
return { ok: false, error: "Meta App ID or App Secret is not configured on the server." };
}

try {
const tokenRes = await fetch(
`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(
appSecret
)}&code=${encodeURIComponent(input.code)}`
);
const tokenPayload = await tokenRes.json();
if (!tokenRes.ok || !tokenPayload?.access_token) {
throw new Error(tokenPayload?.error?.message || "Unable to exchange the WhatsApp signup code for an access token.");
}
const accessToken = tokenPayload.access_token as string;

try {
await fetch(
`https://graph.facebook.com/v21.0/${input.wabaId}/subscribed_apps?access_token=${encodeURIComponent(accessToken)}`,
{ method: "POST" }
);
} catch {
// Non-fatal: the channel is still saved even if the webhook subscription call fails.
}

const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

const result = await saveMessageChannel({
actorId: user.id,
channelType: "whatsapp",
displayName: "WhatsApp",
externalAccountId: input.phoneNumberId,
credentials: {
phoneNumberId: input.phoneNumberId,
wabaId: input.wabaId,
accessToken,
  tokenExpiresAt: expiresAt,
connectionMethod: input.isCoexistence ? "embedded_signup_coexistence" : "embedded_signup",
  coexistence: input.isCoexistence ? "true" : "false"
}
});

if (result.error) return { ok: false, error: result.error };

revalidatePath("/fusionadmin/settings/connections");
revalidatePath("/fusionadmin/messages");
  if (input.isCoexistence) {
    await triggerSmbAppDataSync(input.phoneNumberId, accessToken);
  }
return { ok: true };
} catch (error) {
return { ok: false, error: error instanceof Error ? error.message : "Something went wrong connecting WhatsApp." };
}
}

export async function createFusionContentPost(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const organizationId = await getOrganizationIdForContent();
const platforms = formData.getAll("platforms").map(String) as ContentPlatform[];
const caption = String(formData.get("caption") || "");
const title = String(formData.get("title") || "");
const scheduledAt = String(formData.get("scheduledAt") || "");

const files = formData.getAll("media").filter((entry): entry is File => entry instanceof File && entry.size > 0);
const mediaUrls: string[] = [];

if (organizationId) {
for (const file of files) {
const buffer = await file.arrayBuffer();
const uploadResult = await uploadContentMedia({
organizationId,
fileName: file.name,
contentType: file.type,
data: buffer
});
if (uploadResult.ok && uploadResult.url) mediaUrls.push(uploadResult.url);
}
}

const postType = String(formData.get("postType") || "feed");
const contentType: ContentType =
  postType === "reel"
    ? "reel"
    : postType === "story"
      ? "story"
      : mediaUrls.length === 0
        ? "text"
        : mediaUrls.length === 1
          ? "image"
          : "carousel";

const result = await createContentPost({
actorId: user.id,
title,
caption,
contentType,
mediaUrls,
platforms,
scheduledAt
});

revalidatePath("/fusionadmin/content");

if (!result.ok) {
redirect("/fusionadmin/content?contentError=" + encodeURIComponent(result.error || "Unable to schedule post."));
}
}

export async function updateFusionContentPost(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const platforms = formData.getAll("platforms").map(String) as ContentPlatform[];

const result = await updateContentPost({
actorId: user.id,
postId: String(formData.get("postId") || ""),
title: String(formData.get("title") || ""),
caption: String(formData.get("caption") || ""),
platforms,
scheduledAt: String(formData.get("scheduledAt") || "")
});

revalidatePath("/fusionadmin/content");

if (!result.ok) {
redirect("/fusionadmin/content?contentError=" + encodeURIComponent(result.error || "Unable to save changes."));
}
}

export async function deleteFusionContentPost(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await deleteContentPost({ postId: String(formData.get("postId") || "") });
revalidatePath("/fusionadmin/content");
}

export async function cancelFusionContentPost(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await cancelContentPost({ actorId: user.id, postId: String(formData.get("postId") || "") });
revalidatePath("/fusionadmin/content");
}

export async function randomizeFusionContentHashtags(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await applyRandomHashtagsToPost(String(formData.get("postId") || ""));
  revalidatePath("/fusionadmin/content");
}

export async function addFusionHashtagsToPool(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await addHashtagsToPool(String(formData.get("hashtags") || ""));
  revalidatePath("/fusionadmin/content/hashtags");
}

export async function publishFusionContentPostNow(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const result = await publishPostNow(String(formData.get("postId") || ""));
revalidatePath("/fusionadmin/content");

if (!result.ok) {
redirect("/fusionadmin/content?contentError=" + encodeURIComponent(result.error || "Unable to publish this post."));
}
}

export async function createFusionEmailAudience(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await createEmailAudience({
    actorId: user.id,
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || "")
  });

  revalidatePath("/fusionadmin/email/audiences");
}

export async function updateFusionEmailAudience(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const audienceId = String(formData.get("audienceId") || "");

  await updateEmailAudience({
    actorId: user.id,
    audienceId,
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || "")
  });

  revalidatePath("/fusionadmin/email/audiences");
  redirect("/fusionadmin/email/audiences?audienceId=" + encodeURIComponent(audienceId));
}

export async function deleteFusionEmailAudience(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await deleteEmailAudience({
    actorId: user.id,
    audienceId: String(formData.get("audienceId") || "")
  });

  revalidatePath("/fusionadmin/email/audiences");
  redirect("/fusionadmin/email/audiences");
}

export async function addFusionAudienceMember(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const audienceId = String(formData.get("audienceId") || "");

  await addAudienceMember({
    actorId: user.id,
    audienceId,
    contactId: String(formData.get("contactId") || ""),
    category: String(formData.get("category") || "")
  });

  revalidatePath("/fusionadmin/email/audiences");
  redirect("/fusionadmin/email/audiences?audienceId=" + encodeURIComponent(audienceId));
}

export async function updateFusionAudienceMemberCategory(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const audienceId = String(formData.get("audienceId") || "");

  await updateAudienceMemberCategory({
    actorId: user.id,
    memberId: String(formData.get("memberId") || ""),
    category: String(formData.get("category") || "")
  });

  revalidatePath("/fusionadmin/email/audiences");
  redirect("/fusionadmin/email/audiences?audienceId=" + encodeURIComponent(audienceId));
}

export async function removeFusionAudienceMember(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const audienceId = String(formData.get("audienceId") || "");

  await removeAudienceMember({
    actorId: user.id,
    memberId: String(formData.get("memberId") || "")
  });

  revalidatePath("/fusionadmin/email/audiences");
  redirect("/fusionadmin/email/audiences?audienceId=" + encodeURIComponent(audienceId));
}

export async function createFusionEmailCampaign(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const result = await createEmailCampaign({
    actorId: user.id,
    campaignName: String(formData.get("campaignName") || ""),
    subject: String(formData.get("subject") || ""),
    fromName: String(formData.get("fromName") || ""),
    fromEmail: String(formData.get("fromEmail") || ""),
    replyTo: String(formData.get("replyTo") || ""),
    audienceId: String(formData.get("audienceId") || "")
  });

  revalidatePath("/fusionadmin/email");

  if (result.ok && result.id) {
    redirect("/fusionadmin/email/campaigns/" + result.id + "/edit");
  }

  redirect("/fusionadmin/email?campaignError=" + encodeURIComponent(result.error || "Unable to create campaign."));
}

export async function updateFusionEmailCampaign(
  _prevState: { error?: string; saved?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; saved?: boolean }> {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return { error: "You are not authorized to do that." };

  const result = await updateEmailCampaign({
    actorId: user.id,
    campaignId: String(formData.get("campaignId") || ""),
    campaignName: String(formData.get("campaignName") || ""),
    subject: String(formData.get("subject") || ""),
    fromName: String(formData.get("fromName") || ""),
    fromEmail: String(formData.get("fromEmail") || ""),
    replyTo: String(formData.get("replyTo") || ""),
    audienceId: String(formData.get("audienceId") || ""),
    contentBlocksJson: String(formData.get("contentBlocksJson") || "[]")
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/fusionadmin/email");
  revalidatePath("/fusionadmin/email/campaigns/" + String(formData.get("campaignId") || "") + "/edit");
  return { saved: true };
}

export async function deleteFusionEmailCampaign(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await deleteEmailCampaign({
    actorId: user.id,
    campaignId: String(formData.get("campaignId") || "")
  });

  revalidatePath("/fusionadmin/email");
  redirect("/fusionadmin/email");
}

export async function sendFusionEmailCampaign(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const campaignId = String(formData.get("campaignId") || "");
  const result = await sendEmailCampaign({ actorId: user.id, campaignId });

  revalidatePath("/fusionadmin/email");
  revalidatePath("/fusionadmin/email/campaigns/" + campaignId + "/edit");

  if (!result.ok) {
    redirect("/fusionadmin/email/campaigns/" + campaignId + "/edit?sendError=" + encodeURIComponent(result.error || "Unable to send campaign."));
  }

  redirect("/fusionadmin/email/campaigns/" + campaignId + "/edit?sent=" + encodeURIComponent(String(result.sent ?? 0)));
}
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireFusionAdmin } from "@/lib/auth";
import {
createCrmClient,
createCrmContact,
createCrmDeal,
createCrmNote,
createCrmTask,
deleteCrmServicePackage,
inviteCrmTeamMember,
mergeCrmContacts,
updateCrmBrandSettings,
updateCrmCompany,
updateCrmContact,
updateCrmDeal,
updateCrmLead,
updateCrmServicePackage,
updateCrmTask,
updateCrmTeamMember,
uploadCrmBrandLogo
} from "@/lib/crm";
import {
createSalesAppointment,
createSalesCrmForm,
createSalesEmailTemplate,
createSalesProposal,
createSalesService,
updateSalesAppointment,
updateSalesCrmForm,
updateSalesEmailTemplate,
updateSalesProposal,
updateSalesProposalStatus,
updateSalesService
} from "@/lib/sales-ops";
import {
AutomationAction,
AutomationCondition,
AutomationPreviewResult,
AutomationTriggerType,
createAutomation,
deleteAutomation,
duplicateAutomation,
getAutomationEditWorkspace,
previewAutomation,
toggleAutomation,
updateAutomation
} from "@/lib/automations";
import {
createClientTask,
createTaskSection,
deleteBoardTask,
deleteProjectComment,
deleteTaskSection,
markAdminNotificationRead,
markAllAdminNotificationsRead,
reorderBoardTasks,
reorderTaskSections,
resolveProjectComment,
updateClientProject
} from "@/lib/portal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cancelClientOrder, createManualClientCharge, markOrderPaidManually } from "@/lib/sales-orders";
import {
backfillContactNames,
disconnectMessageChannel,
MessageChannelType,
MESSAGE_CHANNEL_TYPES,
MessageThreadStatus,
moveThreadFolder,
permanentlyDeleteThread,
saveMessageChannel,
sendMessage,
syncChannelHistory,
  triggerSmbAppDataSync,
} from "@/lib/messages";
import {
cancelContentPost,
ContentPlatform,
ContentType,
createContentPost,
deleteContentPost,
getOrganizationIdForContent,
publishPostNow,
updateContentPost,
uploadContentMedia
} from "@/lib/content";
import {
addAudienceMember,
createEmailAudience,
createEmailCampaign,
deleteEmailAudience,
deleteEmailCampaign,
removeAudienceMember,
sendEmailCampaign,
updateAudienceMemberCategory,
updateEmailAudience,
updateEmailCampaign
} from "@/lib/email-marketing";

function enumValue<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T) {
const text = String(value || "");
return allowed.includes(text as T) ? text as T : fallback;
}

function optionalEnumValue<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[]) {
const text = String(value || "");
return allowed.includes(text as T) ? text as T : "";
}

function normalizeHexColor(raw: string, fallback: string) {
const trimmed = raw.trim();
if (!trimmed) return fallback;
const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
return /^#[0-9A-Fa-f]{6}$/.test(withHash) ? withHash : fallback;
}

export async function signInFusionAdmin(_: unknown, formData: FormData) {
const email = String(formData.get("email") || "").trim();
const password = String(formData.get("password") || "");

if (!email || !password) {
return { error: "Enter your email and password." };
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
return { error: "Supabase Auth is not configured yet." };
}

const supabase = await createSupabaseServerClient();
const { error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
return { error: "The email or password is not correct." };
}

redirect("/fusionadmin");
}

export async function signOutFusionAdmin() {
const supabase = await createSupabaseServerClient();
await supabase.auth.signOut();
redirect("/fusionadmin/login");
}

export async function createFusionContact(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createCrmContact({
actorId: user.id,
firstName: String(formData.get("firstName") || ""),
lastName: String(formData.get("lastName") || ""),
email: String(formData.get("email") || ""),
phone: String(formData.get("phone") || ""),
companyName: String(formData.get("companyName") || ""),
leadSource: String(formData.get("leadSource") || "Manual"),
nextFollowUpAt: String(formData.get("nextFollowUpAt") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
}

export async function createFusionClient(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createCrmClient({
actorId: user.id,
customerName: String(formData.get("customerName") || ""),
customerEmail: String(formData.get("customerEmail") || ""),
company: String(formData.get("company") || ""),
password: String(formData.get("password") || ""),
projectName: String(formData.get("projectName") || ""),
previewUrl: String(formData.get("previewUrl") || ""),
liveUrl: String(formData.get("liveUrl") || ""),
clientInstructions: String(formData.get("clientInstructions") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
revalidatePath("/portal");
}

export async function createFusionDeal(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createCrmDeal({
actorId: user.id,
dealTitle: String(formData.get("dealTitle") || ""),
companyName: String(formData.get("companyName") || ""),
service: String(formData.get("service") || ""),
value: Number(formData.get("value") || 0),
stageId: String(formData.get("stageId") || ""),
status: String(formData.get("status") || "open"),
expectedCloseDate: String(formData.get("expectedCloseDate") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/deals");
}

export async function createFusionTask(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createCrmTask({
actorId: user.id,
title: String(formData.get("title") || ""),
taskType: String(formData.get("taskType") || "Follow-Up"),
priority: String(formData.get("priority") || "normal"),
dueAt: String(formData.get("dueAt") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/tasks");
}

export async function updateFusionContact(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateCrmContact({
actorId: user.id,
contactId: String(formData.get("contactId") || ""),
displayName: String(formData.get("displayName") || ""),
email: String(formData.get("email") || ""),
phone: String(formData.get("phone") || ""),
jobTitle: String(formData.get("jobTitle") || ""),
companyName: String(formData.get("companyName") || ""),
lifecycleStatus: String(formData.get("lifecycleStatus") || "new"),
leadSource: String(formData.get("leadSource") || "Manual"),
nextFollowUpAt: String(formData.get("nextFollowUpAt") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
}

export async function mergeFusionContacts(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const primaryContactId = String(formData.get("primaryContactId") || "");
const duplicateContactId = String(formData.get("duplicateContactId") || "");

const result = await mergeCrmContacts({
actorId: user.id,
primaryContactId,
duplicateContactId
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");

if (!result.ok) {
redirect(
"/fusionadmin/clients?contactId=" +
encodeURIComponent(primaryContactId) +
"&mergeError=" +
encodeURIComponent(result.error || "Unable to merge contacts.") +
"#contact-editor"
);
}

redirect("/fusionadmin/clients?contactId=" + encodeURIComponent(primaryContactId) + "&merged=1#contact-editor");
}

export async function updateFusionLead(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateCrmLead({
actorId: user.id,
leadId: String(formData.get("leadId") || ""),
customerName: String(formData.get("customerName") || ""),
customerEmail: String(formData.get("customerEmail") || ""),
customerPhone: String(formData.get("customerPhone") || ""),
company: String(formData.get("company") || ""),
website: String(formData.get("website") || ""),
industry: String(formData.get("industry") || ""),
goal: String(formData.get("goal") || ""),
timeline: String(formData.get("timeline") || ""),
budget: String(formData.get("budget") || ""),
objection: String(formData.get("objection") || ""),
projectNotes: String(formData.get("projectNotes") || ""),
packageName: String(formData.get("packageName") || ""),
totalToday: Number(formData.get("totalToday") || 0),
monthlyDue: Number(formData.get("monthlyDue") || 0),
discountPercent: Number(formData.get("discountPercent") || 0),
status: String(formData.get("status") || "captured")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
}

export async function updateFusionTask(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateCrmTask({
actorId: user.id,
taskId: String(formData.get("taskId") || ""),
title: String(formData.get("title") || ""),
taskType: String(formData.get("taskType") || "Follow-Up"),
priority: String(formData.get("priority") || "normal"),
status: String(formData.get("status") || "open"),
dueAt: String(formData.get("dueAt") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/tasks");
}

export async function updateFusionClientProject(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateClientProject({
actorId: user.id,
clientId: String(formData.get("clientId") || ""),
projectName: String(formData.get("projectName") || "Website Project"),
projectStatus: String(formData.get("projectStatus") || "in_progress"),
liveUrl: String(formData.get("liveUrl") || ""),
previewUrl: String(formData.get("previewUrl") || ""),
currentPhase: String(formData.get("currentPhase") || "Design Review"),
paymentStatus: String(formData.get("paymentStatus") || "unpaid"),
clientInstructions: String(formData.get("clientInstructions") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
revalidatePath("/portal");
}


export async function createFusionClientCharge(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await createManualClientCharge({
    clientId: String(formData.get("clientId") || ""),
    description: String(formData.get("description") || ""),
    amountDollars: Number(formData.get("amountDollars") || 0)
  });

  revalidatePath("/fusionadmin");
  revalidatePath("/fusionadmin/clients");
  revalidatePath("/portal");
}

export async function markFusionOrderPaid(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await markOrderPaidManually({ orderId: String(formData.get("orderId") || "") });

  revalidatePath("/fusionadmin");
  revalidatePath("/fusionadmin/clients");
  revalidatePath("/portal");
}

export async function cancelFusionOrder(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await cancelClientOrder({ orderId: String(formData.get("orderId") || "") });

  revalidatePath("/fusionadmin");
  revalidatePath("/fusionadmin/clients");
  revalidatePath("/portal");
}

export async function deleteFusionProjectComment(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await deleteProjectComment({
actorId: user.id,
commentId: String(formData.get("commentId") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
revalidatePath("/portal");
}

export async function resolveFusionProjectComment(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await resolveProjectComment({
commentId: String(formData.get("commentId") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
revalidatePath("/portal");
}

export async function createFusionNote(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createCrmNote({
actorId: user.id,
body: String(formData.get("body") || ""),
entityType: String(formData.get("entityType") || "general")
});

revalidatePath("/fusionadmin");
}

export async function updateFusionBrandSettings(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

let logoUrl = String(formData.get("logoUrl") || "");
const logoFile = formData.get("logoFile");
if (logoFile instanceof File && logoFile.size > 0) {
const organizationId = await getOrganizationIdForContent();
if (organizationId) {
const buffer = await logoFile.arrayBuffer();
const uploadResult = await uploadCrmBrandLogo({
organizationId,
fileName: logoFile.name,
contentType: logoFile.type,
data: buffer
});
if (uploadResult.ok && uploadResult.url) logoUrl = uploadResult.url;
}
}

const primaryColor = normalizeHexColor(
String(formData.get("primaryColorHex") || ""),
String(formData.get("primaryColor") || "#31d7ff")
);
const accentColor = normalizeHexColor(
String(formData.get("accentColorHex") || ""),
String(formData.get("accentColor") || "#f5b84b")
);

await updateCrmBrandSettings({
actorId: user.id,
logoUrl,
primaryColor,
accentColor
});

revalidatePath("/fusionadmin/settings");
}

export async function updateFusionServicePackage(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateCrmServicePackage({
actorId: user.id,
packageId: String(formData.get("packageId") || ""),
packageName: String(formData.get("packageName") || ""),
description: String(formData.get("description") || ""),
setupPrice: Number(formData.get("setupPrice") || 0),
monthlyPrice: Number(formData.get("monthlyPrice") || 0),
isActive: formData.get("isActive") === "on"
});

revalidatePath("/fusionadmin/settings");
}

export async function deleteFusionServicePackage(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await deleteCrmServicePackage({
actorId: user.id,
packageId: String(formData.get("packageId") || "")
});

revalidatePath("/fusionadmin/settings");
}

export async function inviteFusionTeamMember(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await inviteCrmTeamMember({
actorId: user.id,
email: String(formData.get("email") || ""),
displayName: String(formData.get("displayName") || ""),
title: String(formData.get("title") || ""),
roleId: String(formData.get("roleId") || "")
});

revalidatePath("/fusionadmin/team");
revalidatePath("/fusionadmin/settings");
}

export async function createFusionService(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createSalesService({
actorId: user.id,
serviceName: String(formData.get("serviceName") || ""),
sku: String(formData.get("sku") || ""),
categoryId: String(formData.get("categoryId") || ""),
shortDescription: String(formData.get("shortDescription") || ""),
billingType: enumValue(formData.get("billingType"), ["one_time", "recurring", "usage_based", "custom_quote"] as const, "one_time"),
pricingModel: enumValue(formData.get("pricingModel"), ["fixed_price", "starting_at", "price_range", "per_unit", "hourly", "custom_quote"] as const, "fixed_price"),
basePrice: Number(formData.get("basePrice") || 0),
minimumPrice: Number(formData.get("minimumPrice") || 0),
maximumPrice: Number(formData.get("maximumPrice") || 0),
internalEstimatedCost: Number(formData.get("internalEstimatedCost") || 0),
recurringInterval: optionalEnumValue(formData.get("recurringInterval"), ["monthly", "quarterly", "semiannual", "annual", "custom"] as const),
isFeatured: formData.get("isFeatured") === "on",
publicVisibility: formData.get("publicVisibility") === "on"
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/services");
revalidatePath("/fusionadmin/reports");
}

export async function createFusionProposal(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createSalesProposal({
actorId: user.id,
proposalTitle: String(formData.get("proposalTitle") || ""),
serviceId: String(formData.get("serviceId") || ""),
quantity: Number(formData.get("quantity") || 1),
discountType: enumValue(formData.get("discountType"), ["none", "fixed", "percent"] as const, "none"),
discountValue: Number(formData.get("discountValue") || 0),
expirationDate: String(formData.get("expirationDate") || ""),
contactId: String(formData.get("contactId") || ""),
companyId: String(formData.get("companyId") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/proposals");
revalidatePath("/fusionadmin/reports");
}

export async function updateFusionProposal(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const proposalId = String(formData.get("proposalId") || "");

await updateSalesProposal({
actorId: user.id,
proposalId,
proposalTitle: String(formData.get("proposalTitle") || ""),
contactId: String(formData.get("contactId") || ""),
companyId: String(formData.get("companyId") || ""),
quantity: Number(formData.get("quantity") || 1),
discountType: enumValue(formData.get("discountType"), ["none", "fixed", "percent"] as const, "none"),
discountValue: Number(formData.get("discountValue") || 0),
expirationDate: String(formData.get("expirationDate") || ""),
status: enumValue(formData.get("status"), ["draft", "sent", "accepted", "declined", "expired"] as const, "draft")
});

revalidatePath("/fusionadmin/proposals");
revalidatePath("/fusionadmin/reports");
redirect("/fusionadmin/proposals");
}

export async function createFusionAppointment(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createSalesAppointment({
actorId: user.id,
title: String(formData.get("title") || ""),
appointmentTypeId: String(formData.get("appointmentTypeId") || ""),
startsAt: String(formData.get("startsAt") || ""),
endsAt: String(formData.get("endsAt") || ""),
location: String(formData.get("location") || ""),
meetingUrl: String(formData.get("meetingUrl") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/calendar");
revalidatePath("/fusionadmin/reports");
}

export async function updateFusionAppointment(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateSalesAppointment({
actorId: user.id,
appointmentId: String(formData.get("appointmentId") || ""),
title: String(formData.get("title") || ""),
appointmentTypeId: String(formData.get("appointmentTypeId") || ""),
startsAt: String(formData.get("startsAt") || ""),
endsAt: String(formData.get("endsAt") || ""),
status: enumValue(formData.get("status"), ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const, "scheduled"),
location: String(formData.get("location") || ""),
meetingUrl: String(formData.get("meetingUrl") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/calendar");
revalidatePath("/fusionadmin/reports");
}

export async function createFusionEmailTemplate(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createSalesEmailTemplate({
actorId: user.id,
templateName: String(formData.get("templateName") || ""),
subject: String(formData.get("subject") || ""),
body: String(formData.get("body") || ""),
category: String(formData.get("category") || "General Sales"),
visibility: enumValue(formData.get("visibility"), ["private", "shared"] as const, "shared")
});

revalidatePath("/fusionadmin/email-templates");
}

export async function createFusionCrmForm(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createSalesCrmForm({
actorId: user.id,
formName: String(formData.get("formName") || ""),
formType: String(formData.get("formType") || "Lead Inquiry"),
description: String(formData.get("description") || ""),
isPublished: formData.get("isPublished") === "on"
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/forms");
revalidatePath("/fusionadmin/reports");
}

export async function updateFusionCompany(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateCrmCompany({
actorId: user.id,
companyId: String(formData.get("companyId") || ""),
companyName: String(formData.get("companyName") || ""),
industry: String(formData.get("industry") || ""),
website: String(formData.get("website") || ""),
mainPhone: String(formData.get("mainPhone") || ""),
generalEmail: String(formData.get("generalEmail") || ""),
lifecycleStatus: String(formData.get("lifecycleStatus") || "new"),
leadSource: String(formData.get("leadSource") || "Manual")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/clients");
}

export async function updateFusionDeal(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateCrmDeal({
actorId: user.id,
dealId: String(formData.get("dealId") || ""),
dealTitle: String(formData.get("dealTitle") || ""),
companyName: String(formData.get("companyName") || ""),
service: String(formData.get("service") || ""),
value: Number(formData.get("value") || 0),
stageId: String(formData.get("stageId") || ""),
expectedCloseDate: String(formData.get("expectedCloseDate") || "")
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/deals");
}

export async function updateFusionTeamMember(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateCrmTeamMember({
actorId: user.id,
memberId: String(formData.get("memberId") || ""),
title: String(formData.get("title") || ""),
status: String(formData.get("status") || "active"),
roleId: String(formData.get("roleId") || "")
});

revalidatePath("/fusionadmin/team");
revalidatePath("/fusionadmin/settings");
}

export async function updateFusionService(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateSalesService({
actorId: user.id,
serviceId: String(formData.get("serviceId") || ""),
serviceName: String(formData.get("serviceName") || ""),
sku: String(formData.get("sku") || ""),
categoryId: String(formData.get("categoryId") || ""),
shortDescription: String(formData.get("shortDescription") || ""),
billingType: enumValue(formData.get("billingType"), ["one_time", "recurring", "usage_based", "custom_quote"] as const, "one_time"),
pricingModel: enumValue(formData.get("pricingModel"), ["fixed_price", "starting_at", "price_range", "per_unit", "hourly", "custom_quote"] as const, "fixed_price"),
basePrice: Number(formData.get("basePrice") || 0),
internalEstimatedCost: Number(formData.get("internalEstimatedCost") || 0),
recurringInterval: optionalEnumValue(formData.get("recurringInterval"), ["monthly", "quarterly", "semiannual", "annual", "custom"] as const),
isFeatured: formData.get("isFeatured") === "on",
publicVisibility: formData.get("publicVisibility") === "on",
isActive: formData.get("isActive") === "on"
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/services");
revalidatePath("/fusionadmin/reports");
}

export async function updateFusionEmailTemplate(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateSalesEmailTemplate({
actorId: user.id,
templateId: String(formData.get("templateId") || ""),
templateName: String(formData.get("templateName") || ""),
subject: String(formData.get("subject") || ""),
body: String(formData.get("body") || ""),
category: String(formData.get("category") || "General Sales"),
visibility: enumValue(formData.get("visibility"), ["private", "shared"] as const, "shared"),
isActive: formData.get("isActive") === "on"
});

revalidatePath("/fusionadmin/email-templates");
}

export async function updateFusionCrmForm(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateSalesCrmForm({
actorId: user.id,
formId: String(formData.get("formId") || ""),
formName: String(formData.get("formName") || ""),
formType: String(formData.get("formType") || "Lead Inquiry"),
description: String(formData.get("description") || ""),
isPublished: formData.get("isPublished") === "on",
isActive: formData.get("isActive") === "on"
});

revalidatePath("/fusionadmin");
revalidatePath("/fusionadmin/forms");
revalidatePath("/fusionadmin/reports");
}

export async function createFusionAutomation(_prevState: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { error: "You are not authorized to do that." };

const conditions = parseAutomationConditions(formData);
const actions = parseAutomationActions(formData);

const result = await createAutomation({
actorId: user.id,
name: String(formData.get("name") || ""),
description: String(formData.get("description") || ""),
triggerType: String(formData.get("triggerType") || "lead.captured") as AutomationTriggerType,
conditions,
actions,
isActive: formData.get("isActive") === "on"
});

if (!result.ok) return { error: result.error };

revalidatePath("/fusionadmin/automations");
redirect("/fusionadmin/automations");
}
export async function updateFusionAutomation(_prevState: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { error: "You are not authorized to do that." };

const conditions = parseAutomationConditions(formData);
const actions = parseAutomationActions(formData);

const result = await updateAutomation({
actorId: user.id,
automationId: String(formData.get("automationId") || ""),
name: String(formData.get("name") || ""),
description: String(formData.get("description") || ""),
triggerType: String(formData.get("triggerType") || "lead.captured") as AutomationTriggerType,
conditions,
actions,
isActive: formData.get("isActive") === "on"
});

if (!result.ok) return { error: result.error };

revalidatePath("/fusionadmin/automations");
redirect("/fusionadmin/automations");
}
export async function toggleFusionAutomation(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await toggleAutomation({
actorId: user.id,
automationId: String(formData.get("automationId") || ""),
isActive: formData.get("isActive") === "on"
});

revalidatePath("/fusionadmin/automations");
}

export async function deleteFusionAutomation(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await deleteAutomation({
actorId: user.id,
automationId: String(formData.get("automationId") || "")
});

revalidatePath("/fusionadmin/automations");
redirect("/fusionadmin/automations");
}

export async function previewFusionAutomation(
_prevState: { result?: AutomationPreviewResult; error?: string } | undefined,
formData: FormData
): Promise<{ result?: AutomationPreviewResult; error?: string }> {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { error: "You are not authorized to do that." };

const automationId = String(formData.get("automationId") || "");
if (!automationId) return { error: "Missing automation id." };

const { automation } = await getAutomationEditWorkspace(automationId);
if (!automation) return { error: "Automation not found." };

const dealValueRaw = String(formData.get("sampleDealValue") || "").trim();
const proposalTotalRaw = String(formData.get("sampleProposalTotal") || "").trim();

const sample = {
contact: {
name: String(formData.get("sampleContactName") || ""),
email: String(formData.get("sampleContactEmail") || ""),
phone: String(formData.get("sampleContactPhone") || "")
},
company: {
name: String(formData.get("sampleCompanyName") || "")
},
deal: {
value: dealValueRaw ? Number(dealValueRaw) : undefined,
stageName: String(formData.get("sampleDealStage") || "")
},
task: {
title: String(formData.get("sampleTaskTitle") || "")
},
proposal: {
total: proposalTotalRaw ? Number(proposalTotalRaw) : undefined
}
};

const result = previewAutomation(automation.trigger_type, automation.conditions, automation.actions, sample);
return { result };
}

export async function duplicateFusionAutomation(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const result = await duplicateAutomation({
actorId: user.id,
automationId: String(formData.get("automationId") || "")
});

revalidatePath("/fusionadmin/automations");
if (result.ok && result.newId) {
redirect("/fusionadmin/automations/" + result.newId + "/edit");
}
redirect("/fusionadmin/automations");
}

export async function updateFusionProposalStatus(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await updateSalesProposalStatus({
actorId: user.id,
proposalId: String(formData.get("proposalId") || ""),
status: enumValue(formData.get("status"), ["draft", "sent", "accepted", "declined", "expired"] as const, "draft")
});

revalidatePath("/fusionadmin/proposals");
revalidatePath("/fusionadmin/automations");
}

function parseAutomationConditions(formData: FormData): AutomationCondition[] {
const fields = formData.getAll("conditionField").map(String);
const operators = formData.getAll("conditionOperator").map(String);
const values = formData.getAll("conditionValue").map(String);
const groups = formData.getAll("conditionGroup").map(String);

const conditions: AutomationCondition[] = [];
fields.forEach((field, index) => {
if (!field.trim()) return;
conditions.push({
field: field.trim(),
operator: (operators[index] || "is_set") as AutomationCondition["operator"],
value: values[index] || undefined,
group: Number(groups[index] || 0) || 0
});
});
return conditions;
}

function parseAutomationActions(formData: FormData): AutomationAction[] {
const types = formData.getAll("actionType").map(String);
const configsRaw = formData.getAll("actionConfig").map(String);

const actions: AutomationAction[] = [];
types.forEach((type, index) => {
if (!type.trim()) return;
let config: Record<string, string | number | boolean | null | undefined> = {};
try {
config = configsRaw[index] ? JSON.parse(configsRaw[index]) : {};
} catch {
config = {};
}
actions.push({ type: type.trim() as AutomationAction["type"], config });
});
return actions;
}

export async function assignFusionClientTask(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createClientTask({
clientId: String(formData.get("clientId") || ""),
projectId: String(formData.get("projectId") || "") || undefined,
sectionId: String(formData.get("sectionId") || "") || undefined,
title: String(formData.get("title") || ""),
description: String(formData.get("description") || ""),
dueAt: String(formData.get("dueAt") || "") || undefined,
priority: String(formData.get("priority") || "medium")
});

revalidatePath("/fusionadmin/clients");
revalidatePath("/fusionadmin/task-board");
revalidatePath("/portal");
}

export async function createFusionTaskSection(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await createTaskSection({
projectId: String(formData.get("projectId") || ""),
name: String(formData.get("name") || "")
});

revalidatePath("/fusionadmin/task-board");
revalidatePath("/portal");
}

export async function deleteFusionTaskSection(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await deleteTaskSection({ sectionId: String(formData.get("sectionId") || "") });

revalidatePath("/fusionadmin/task-board");
revalidatePath("/portal");
}

export async function deleteFusionBoardTask(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await deleteBoardTask({ taskId: String(formData.get("taskId") || "") });

revalidatePath("/fusionadmin/task-board");
revalidatePath("/portal");
}

export async function reorderFusionTaskSections(orderedSectionIds: string[]) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { ok: false };

const result = await reorderTaskSections({ orderedSectionIds });
revalidatePath("/fusionadmin/task-board");
return result;
}

export async function reorderFusionBoardTasks(updates: Array<{ taskId: string; sectionId: string | null; position: number }>) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { ok: false };

const result = await reorderBoardTasks({ updates });
revalidatePath("/fusionadmin/task-board");
revalidatePath("/portal");
return result;
}

export async function markFusionNotificationRead(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const notificationId = String(formData.get("notificationId") || "");
if (!notificationId) return;

await markAdminNotificationRead({ notificationId });
revalidatePath("/fusionadmin", "layout");
}

export async function markAllFusionNotificationsRead(_formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await markAllAdminNotificationsRead();
revalidatePath("/fusionadmin", "layout");
}

export async function saveFusionMessageChannel(
_prevState: { error?: string } | undefined,
formData: FormData
): Promise<{ error?: string }> {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { error: "You are not authorized to do that." };

const channelType = String(formData.get("channelType") || "") as MessageChannelType;
if (!MESSAGE_CHANNEL_TYPES.includes(channelType)) return { error: "Unknown channel." };

const credentials: Record<string, string> = {};
let externalAccountId = "";
let displayName = String(formData.get("displayName") || "").trim();

if (channelType === "whatsapp") {
externalAccountId = String(formData.get("phoneNumberId") || "").trim();
credentials.phoneNumberId = externalAccountId;
credentials.accessToken = String(formData.get("accessToken") || "").trim();
credentials.wabaId = String(formData.get("wabaId") || "").trim();
displayName = displayName || "WhatsApp";
} else if (channelType === "messenger") {
externalAccountId = String(formData.get("pageId") || "").trim();
credentials.pageId = externalAccountId;
credentials.accessToken = String(formData.get("accessToken") || "").trim();
displayName = displayName || "Messenger";
} else if (channelType === "instagram") {
externalAccountId = String(formData.get("igAccountId") || "").trim();
credentials.igAccountId = externalAccountId;
credentials.accessToken = String(formData.get("accessToken") || "").trim();
displayName = displayName || "Instagram";
}

const result = await saveMessageChannel({
actorId: user.id,
channelType,
displayName,
externalAccountId,
credentials
});

if (result.error) return { error: result.error };

revalidatePath("/fusionadmin/settings/connections");
redirect("/fusionadmin/settings/connections");
}

export async function disconnectFusionMessageChannel(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const channelType = String(formData.get("channelType") || "") as MessageChannelType;
await disconnectMessageChannel({ actorId: user.id, channelType });

revalidatePath("/fusionadmin/settings/connections");
redirect("/fusionadmin/settings/connections");
}

export async function sendFusionMessage(
_prevState: { error?: string } | undefined,
formData: FormData
): Promise<{ error?: string }> {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { error: "You are not authorized to do that." };

const threadId = String(formData.get("threadId") || "");
const body = String(formData.get("body") || "");

const result = await sendMessage({ actorId: user.id, threadId, body });
if (!result.ok) return { error: result.error || "Unable to send message." };

revalidatePath("/fusionadmin/messages");
redirect("/fusionadmin/messages?thread=" + threadId);
}

export async function connectMetaPage(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const pageId = String(formData.get("pageId") || "").trim();
const pageName = String(formData.get("pageName") || "").trim();
const pageToken = String(formData.get("pageToken") || "").trim();
const igId = String(formData.get("igId") || "").trim();
const igUsername = String(formData.get("igUsername") || "").trim();

if (pageId && pageToken) {
await saveMessageChannel({
actorId: user.id,
channelType: "messenger",
displayName: pageName || "Messenger",
externalAccountId: pageId,
credentials: { accessToken: pageToken }
});

try {
await fetch(
`https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${encodeURIComponent(pageToken)}`,
{ method: "POST" }
);
} catch {
// Non-fatal: the channel is still saved even if the webhook subscription call fails.
}

if (igId) {
await saveMessageChannel({
actorId: user.id,
channelType: "instagram",
displayName: igUsername ? "@" + igUsername : "Instagram",
externalAccountId: igId,
credentials: { accessToken: pageToken }
});
}
}

const cookieStore = await cookies();
cookieStore.set("meta_oauth_pages", "", { maxAge: 0, path: "/" });

revalidatePath("/fusionadmin/settings/connections");
redirect("/fusionadmin/settings/connections");
}

export async function cancelMetaConnect() {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const cookieStore = await cookies();
cookieStore.set("meta_oauth_pages", "", { maxAge: 0, path: "/" });

redirect("/fusionadmin/settings/connections");
}

export async function syncFusionMessageChannelHistory(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const channelType = String(formData.get("channelType") || "") as MessageChannelType;
const result = await syncChannelHistory(channelType);

revalidatePath("/fusionadmin/settings/connections");
revalidatePath("/fusionadmin/messages");

if (!result.ok) {
redirect(
"/fusionadmin/settings/connections?syncError=" + encodeURIComponent(result.error || "Unable to sync message history.")
);
}

redirect("/fusionadmin/settings/connections?synced=" + encodeURIComponent(String(result.imported ?? 0)));
}

export async function refreshFusionChannelContactNames(_formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const result = await backfillContactNames();

revalidatePath("/fusionadmin/settings/connections");
revalidatePath("/fusionadmin/messages");
revalidatePath("/fusionadmin/clients");

if (!result.ok) {
redirect("/fusionadmin/settings/connections?nameRefreshError=" + encodeURIComponent(result.error || "Unable to refresh contact names."));
}

redirect("/fusionadmin/settings/connections?namesRefreshed=" + encodeURIComponent(String(result.updated)));
}

export async function moveFusionThreadFolder(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const threadId = String(formData.get("threadId") || "");
const newFolderRaw = String(formData.get("newFolder") || "");
const returnFolder = String(formData.get("returnFolder") || "inbox");
const returnChannel = String(formData.get("returnChannel") || "");

if (threadId && (newFolderRaw === "inbox" || newFolderRaw === "spam" || newFolderRaw === "trash")) {
await moveThreadFolder({ actorId: user.id, threadId, folder: newFolderRaw as MessageThreadStatus });
}

revalidatePath("/fusionadmin/messages");

const params = new URLSearchParams();
params.set("folder", returnFolder);
if (returnChannel) params.set("channel", returnChannel);
redirect("/fusionadmin/messages?" + params.toString());
}

export async function deleteFusionThreadForever(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const threadId = String(formData.get("threadId") || "");
const returnChannel = String(formData.get("returnChannel") || "");

if (threadId) {
await permanentlyDeleteThread({ actorId: user.id, threadId });
}

revalidatePath("/fusionadmin/messages");

const params = new URLSearchParams();
params.set("folder", "trash");
if (returnChannel) params.set("channel", returnChannel);
redirect("/fusionadmin/messages?" + params.toString());
}

export async function connectWhatsAppEmbeddedSignup(input: {
code: string;
phoneNumberId?: string;
wabaId?: string;
  isCoexistence?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
const user = await requireFusionAdmin();
if (!user.isAllowed) return { ok: false, error: "You are not authorized to do that." };

if (!input.phoneNumberId || !input.wabaId) {
return {
ok: false,
error:
"Meta didn't return a WhatsApp phone number or business account. Please try connecting again and complete every step in the popup, including verifying a phone number."
};
}

const appId = process.env.NEXT_PUBLIC_META_APP_ID;
const appSecret = process.env.META_APP_SECRET;
if (!appId || !appSecret) {
return { ok: false, error: "Meta App ID or App Secret is not configured on the server." };
}

try {
const tokenRes = await fetch(
`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(
appSecret
)}&code=${encodeURIComponent(input.code)}`
);
const tokenPayload = await tokenRes.json();
if (!tokenRes.ok || !tokenPayload?.access_token) {
throw new Error(tokenPayload?.error?.message || "Unable to exchange the WhatsApp signup code for an access token.");
}
const accessToken = tokenPayload.access_token as string;

try {
await fetch(
`https://graph.facebook.com/v21.0/${input.wabaId}/subscribed_apps?access_token=${encodeURIComponent(accessToken)}`,
{ method: "POST" }
);
} catch {
// Non-fatal: the channel is still saved even if the webhook subscription call fails.
}

const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

const result = await saveMessageChannel({
actorId: user.id,
channelType: "whatsapp",
displayName: "WhatsApp",
externalAccountId: input.phoneNumberId,
credentials: {
phoneNumberId: input.phoneNumberId,
wabaId: input.wabaId,
accessToken,
  tokenExpiresAt: expiresAt,
connectionMethod: input.isCoexistence ? "embedded_signup_coexistence" : "embedded_signup",
  coexistence: input.isCoexistence ? "true" : "false"
}
});

if (result.error) return { ok: false, error: result.error };

revalidatePath("/fusionadmin/settings/connections");
revalidatePath("/fusionadmin/messages");
  if (input.isCoexistence) {
    await triggerSmbAppDataSync(input.phoneNumberId, accessToken);
  }
return { ok: true };
} catch (error) {
return { ok: false, error: error instanceof Error ? error.message : "Something went wrong connecting WhatsApp." };
}
}

export async function createFusionContentPost(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const organizationId = await getOrganizationIdForContent();
const platforms = formData.getAll("platforms").map(String) as ContentPlatform[];
const caption = String(formData.get("caption") || "");
const title = String(formData.get("title") || "");
const scheduledAt = String(formData.get("scheduledAt") || "");

const files = formData.getAll("media").filter((entry): entry is File => entry instanceof File && entry.size > 0);
const mediaUrls: string[] = [];

if (organizationId) {
for (const file of files) {
const buffer = await file.arrayBuffer();
const uploadResult = await uploadContentMedia({
organizationId,
fileName: file.name,
contentType: file.type,
data: buffer
});
if (uploadResult.ok && uploadResult.url) mediaUrls.push(uploadResult.url);
}
}

const postType = String(formData.get("postType") || "feed");
const contentType: ContentType =
  postType === "reel"
    ? "reel"
    : postType === "story"
      ? "story"
      : mediaUrls.length === 0
        ? "text"
        : mediaUrls.length === 1
          ? "image"
          : "carousel";

const result = await createContentPost({
actorId: user.id,
title,
caption,
contentType,
mediaUrls,
platforms,
scheduledAt
});

revalidatePath("/fusionadmin/content");

if (!result.ok) {
redirect("/fusionadmin/content?contentError=" + encodeURIComponent(result.error || "Unable to schedule post."));
}
}

export async function updateFusionContentPost(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const platforms = formData.getAll("platforms").map(String) as ContentPlatform[];

const result = await updateContentPost({
actorId: user.id,
postId: String(formData.get("postId") || ""),
title: String(formData.get("title") || ""),
caption: String(formData.get("caption") || ""),
platforms,
scheduledAt: String(formData.get("scheduledAt") || "")
});

revalidatePath("/fusionadmin/content");

if (!result.ok) {
redirect("/fusionadmin/content?contentError=" + encodeURIComponent(result.error || "Unable to save changes."));
}
}

export async function deleteFusionContentPost(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await deleteContentPost({ postId: String(formData.get("postId") || "") });
revalidatePath("/fusionadmin/content");
}

export async function cancelFusionContentPost(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

await cancelContentPost({ actorId: user.id, postId: String(formData.get("postId") || "") });
revalidatePath("/fusionadmin/content");
}

export async function publishFusionContentPostNow(formData: FormData) {
const user = await requireFusionAdmin();
if (!user.isAllowed) return;

const result = await publishPostNow(String(formData.get("postId") || ""));
revalidatePath("/fusionadmin/content");

if (!result.ok) {
redirect("/fusionadmin/content?contentError=" + encodeURIComponent(result.error || "Unable to publish this post."));
}
}

export async function createFusionEmailAudience(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await createEmailAudience({
    actorId: user.id,
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || "")
  });

  revalidatePath("/fusionadmin/email/audiences");
}

export async function updateFusionEmailAudience(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const audienceId = String(formData.get("audienceId") || "");

  await updateEmailAudience({
    actorId: user.id,
    audienceId,
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || "")
  });

  revalidatePath("/fusionadmin/email/audiences");
  redirect("/fusionadmin/email/audiences?audienceId=" + encodeURIComponent(audienceId));
}

export async function deleteFusionEmailAudience(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await deleteEmailAudience({
    actorId: user.id,
    audienceId: String(formData.get("audienceId") || "")
  });

  revalidatePath("/fusionadmin/email/audiences");
  redirect("/fusionadmin/email/audiences");
}

export async function addFusionAudienceMember(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const audienceId = String(formData.get("audienceId") || "");

  await addAudienceMember({
    actorId: user.id,
    audienceId,
    contactId: String(formData.get("contactId") || ""),
    category: String(formData.get("category") || "")
  });

  revalidatePath("/fusionadmin/email/audiences");
  redirect("/fusionadmin/email/audiences?audienceId=" + encodeURIComponent(audienceId));
}

export async function updateFusionAudienceMemberCategory(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const audienceId = String(formData.get("audienceId") || "");

  await updateAudienceMemberCategory({
    actorId: user.id,
    memberId: String(formData.get("memberId") || ""),
    category: String(formData.get("category") || "")
  });

  revalidatePath("/fusionadmin/email/audiences");
  redirect("/fusionadmin/email/audiences?audienceId=" + encodeURIComponent(audienceId));
}

export async function removeFusionAudienceMember(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const audienceId = String(formData.get("audienceId") || "");

  await removeAudienceMember({
    actorId: user.id,
    memberId: String(formData.get("memberId") || "")
  });

  revalidatePath("/fusionadmin/email/audiences");
  redirect("/fusionadmin/email/audiences?audienceId=" + encodeURIComponent(audienceId));
}

export async function createFusionEmailCampaign(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const result = await createEmailCampaign({
    actorId: user.id,
    campaignName: String(formData.get("campaignName") || ""),
    subject: String(formData.get("subject") || ""),
    fromName: String(formData.get("fromName") || ""),
    fromEmail: String(formData.get("fromEmail") || ""),
    replyTo: String(formData.get("replyTo") || ""),
    audienceId: String(formData.get("audienceId") || "")
  });

  revalidatePath("/fusionadmin/email");

  if (result.ok && result.id) {
    redirect("/fusionadmin/email/campaigns/" + result.id + "/edit");
  }

  redirect("/fusionadmin/email?campaignError=" + encodeURIComponent(result.error || "Unable to create campaign."));
}

export async function updateFusionEmailCampaign(
  _prevState: { error?: string; saved?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; saved?: boolean }> {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return { error: "You are not authorized to do that." };

  const result = await updateEmailCampaign({
    actorId: user.id,
    campaignId: String(formData.get("campaignId") || ""),
    campaignName: String(formData.get("campaignName") || ""),
    subject: String(formData.get("subject") || ""),
    fromName: String(formData.get("fromName") || ""),
    fromEmail: String(formData.get("fromEmail") || ""),
    replyTo: String(formData.get("replyTo") || ""),
    audienceId: String(formData.get("audienceId") || ""),
    contentBlocksJson: String(formData.get("contentBlocksJson") || "[]")
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/fusionadmin/email");
  revalidatePath("/fusionadmin/email/campaigns/" + String(formData.get("campaignId") || "") + "/edit");
  return { saved: true };
}

export async function deleteFusionEmailCampaign(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  await deleteEmailCampaign({
    actorId: user.id,
    campaignId: String(formData.get("campaignId") || "")
  });

  revalidatePath("/fusionadmin/email");
  redirect("/fusionadmin/email");
}

export async function sendFusionEmailCampaign(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const campaignId = String(formData.get("campaignId") || "");
  const result = await sendEmailCampaign({ actorId: user.id, campaignId });

  revalidatePath("/fusionadmin/email");
  revalidatePath("/fusionadmin/email/campaigns/" + campaignId + "/edit");

  if (!result.ok) {
    redirect("/fusionadmin/email/campaigns/" + campaignId + "/edit?sendError=" + encodeURIComponent(result.error || "Unable to send campaign."));
  }

  redirect("/fusionadmin/email/campaigns/" + campaignId + "/edit?sent=" + encodeURIComponent(String(result.sent ?? 0)));
}
