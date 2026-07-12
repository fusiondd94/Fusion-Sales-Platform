"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireFusionAdmin } from "@/lib/auth";
import {
  createCrmClient,
  createCrmContact,
  createCrmDeal,
  createCrmNote,
  createCrmTask,
  inviteCrmTeamMember,
  updateCrmBrandSettings,
  updateCrmCompany,
  updateCrmContact,
  updateCrmDeal,
  updateCrmLead,
  updateCrmServicePackage,
  updateCrmTask,
  updateCrmTeamMember
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
  updateSalesProposalStatus,
  updateSalesService
} from "@/lib/sales-ops";
import {
  AutomationAction,
  AutomationCondition,
  AutomationTriggerType,
  createAutomation,
  deleteAutomation,
  toggleAutomation,
  updateAutomation
} from "@/lib/automations";
import { updateClientProject } from "@/lib/portal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function enumValue<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T) {
  const text = String(value || "");
  return allowed.includes(text as T) ? text as T : fallback;
}

function optionalEnumValue<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[]) {
  const text = String(value || "");
  return allowed.includes(text as T) ? text as T : "";
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
    clientInstructions: String(formData.get("clientInstructions") || "")
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

  await updateCrmBrandSettings({
    actorId: user.id,
    logoUrl: String(formData.get("logoUrl") || ""),
    primaryColor: String(formData.get("primaryColor") || ""),
    accentColor: String(formData.get("accentColor") || "")
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
    expirationDate: String(formData.get("expirationDate") || "")
  });

  revalidatePath("/fusionadmin");
  revalidatePath("/fusionadmin/proposals");
  revalidatePath("/fusionadmin/reports");
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

export async function createFusionAutomation(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const conditions = parseAutomationConditions(formData);
  const actions = parseAutomationActions(formData);

  await createAutomation({
    actorId: user.id,
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || ""),
    triggerType: String(formData.get("triggerType") || "lead.captured") as AutomationTriggerType,
    conditions,
    actions,
    isActive: formData.get("isActive") === "on"
  });

  revalidatePath("/fusionadmin/automations");
}

export async function updateFusionAutomation(formData: FormData) {
  const user = await requireFusionAdmin();
  if (!user.isAllowed) return;

  const conditions = parseAutomationConditions(formData);
  const actions = parseAutomationActions(formData);

  await updateAutomation({
    actorId: user.id,
    automationId: String(formData.get("automationId") || ""),
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || ""),
    triggerType: String(formData.get("triggerType") || "lead.captured") as AutomationTriggerType,
    conditions,
    actions,
    isActive: formData.get("isActive") === "on"
  });

  revalidatePath("/fusionadmin/automations");
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

  const conditions: AutomationCondition[] = [];
  fields.forEach((field, index) => {
    if (!field.trim()) return;
    conditions.push({
      field: field.trim(),
      operator: (operators[index] || "is_set") as AutomationCondition["operator"],
      value: values[index] || undefined
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
