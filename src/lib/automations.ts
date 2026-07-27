import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { sendCrmEmail } from "@/lib/email";

export type AutomationTriggerType =
  | "lead.captured"
  | "deal.stage_changed"
  | "task.completed"
  | "task.overdue"
  | "payment.received"
  | "proposal.sent"
  | "proposal.signed"
  | "message.received";

export const AUTOMATION_TRIGGERS: Array<{ value: AutomationTriggerType; label: string; description: string }> = [
  { value: "lead.captured", label: "New lead captured", description: "A potential client submits the sales questionnaire." },
  { value: "deal.stage_changed", label: "Deal stage changed", description: "A deal moves to a different pipeline stage." },
  { value: "task.completed", label: "Task completed", description: "A task is marked done." },
  { value: "task.overdue", label: "Task overdue", description: "A task passes its due date without being completed." },
  { value: "payment.received", label: "Payment received", description: "A Stripe checkout completes and a client is created." },
  { value: "proposal.sent", label: "Proposal sent", description: "A proposal is marked as sent to a client." },
  { value: "proposal.signed", label: "Proposal signed", description: "A proposal is marked as accepted/signed." },
  { value: "message.received", label: "Message received", description: "A new WhatsApp, Messenger, or Instagram message arrives." }
];

export type AutomationActionType =
  | "create_contact"
  | "link_company"
  | "create_deal"
  | "create_task"
  | "update_lead_status"
  | "add_note"
  | "notify_team"
  | "send_email";

export const AUTOMATION_ACTIONS: Array<{ value: AutomationActionType; label: string; description: string }> = [
  { value: "create_contact", label: "Create contact", description: "Create a Contact (and link/create their Business) from the trigger's name, email, phone, and company." },
  { value: "link_company", label: "Link / create business", description: "Upsert a Business (company) record from the trigger's company name." },
  { value: "create_deal", label: "Create deal", description: "Create a pipeline deal linked to the business." },
  { value: "create_task", label: "Create task", description: "Create a follow-up task, optionally due N hours later." },
  { value: "update_lead_status", label: "Update lead status", description: "Change the status field on the source lead." },
  { value: "add_note", label: "Add internal note", description: "Log a note visible in the CRM activity feed." },
  { value: "notify_team", label: "Notify team", description: "Create an in-app notification for your team." },
  { value: "send_email", label: "Send email", description: "Send one of your saved email templates to the contact." }
];

export type AutomationCondition = {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_set" | "is_not_set";
  value?: string;
  group?: number;
};

export type AutomationAction = {
  type: AutomationActionType;
  config: Record<string, string | number | boolean | null | undefined>;
};

export type AutomationRecord = {
  id: string;
  name: string;
  description: string | null;
  trigger_type: AutomationTriggerType;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
};

export type AutomationRunRecord = {
  id: string;
  automation_id: string | null;
  trigger_type: string;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  actions_run: Array<{ type: string; ok: boolean; detail?: string }>;
  error_message: string | null;
  created_at: string;
};

export type AutomationContext = {
  trigger: AutomationTriggerType;
  entityType: string;
  entityId: string | null;
  organizationId: string;
  actorId?: string | null;
  contact?: { name?: string | null; email?: string | null; phone?: string | null };
  company?: { name?: string | null; website?: string | null };
  deal?: { title?: string | null; value?: number | null; stageId?: string | null; stageName?: string | null; previousStageName?: string | null };
  task?: { title?: string | null; dueAt?: string | null; owner?: string | null };
  proposal?: { title?: string | null; number?: string | null; total?: number | null };
  message?: { body?: string | null; channel?: string | null };
  raw?: Record<string, unknown>;
};

let cachedClient: SupabaseClient<any> | null = null;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  if (!cachedClient) {
    cachedClient = createClient<any>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  return cachedClient;
}

async function getDefaultOrganizationId(supabase: SupabaseClient<any>) {
  const { data } = await supabase
    .from("crm_organizations")
    .select("id")
    .eq("slug", "fusion-digital-dynamics")
    .single<{ id: string }>();
  return data?.id || null;
}

function getPath(context: AutomationContext, path: string): string | number | null | undefined {
  const parts = path.split(".");
  let value: unknown = context;
  for (const part of parts) {
    if (value == null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  if (value === undefined || value === null) return value as null | undefined;
  if (typeof value === "string" || typeof value === "number") return value;
  return String(value);
}

function evaluateCondition(context: AutomationContext, condition: AutomationCondition): boolean {
  const actual = getPath(context, condition.field);

  switch (condition.operator) {
    case "is_set":
      return actual !== undefined && actual !== null && actual !== "";
    case "is_not_set":
      return actual === undefined || actual === null || actual === "";
    case "equals":
      return String(actual ?? "").toLowerCase() === String(condition.value ?? "").toLowerCase();
    case "not_equals":
      return String(actual ?? "").toLowerCase() !== String(condition.value ?? "").toLowerCase();
    case "contains":
      return String(actual ?? "").toLowerCase().includes(String(condition.value ?? "").toLowerCase());
    case "greater_than":
      return Number(actual ?? 0) > Number(condition.value ?? 0);
    case "less_than":
      return Number(actual ?? 0) < Number(condition.value ?? 0);
    default:
      return true;
  }
}

function evaluateConditionGroups(context: AutomationContext, conditions: AutomationCondition[]): boolean {
  if (!conditions.length) return true;
  const groups = new Map<number, AutomationCondition[]>();
  for (const condition of conditions) {
    const groupKey = condition.group ?? 0;
    const list = groups.get(groupKey) || [];
    list.push(condition);
    groups.set(groupKey, list);
  }
  return Array.from(groups.values()).some((group) => group.every((condition) => evaluateCondition(context, condition)));
}

function fillTemplate(template: string, context: AutomationContext): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const value = getPath(context, path);
    return value === undefined || value === null ? "" : String(value);
  });
}

async function logActivity(
  supabase: SupabaseClient<any>,
  organizationId: string,
  actorId: string | null,
  actionType: string,
  entityType: string,
  entityId: string | null,
  summary: string,
  metadata: Record<string, unknown> = {}
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

async function runAction(
  supabase: SupabaseClient<any>,
  organizationId: string,
  context: AutomationContext,
  action: AutomationAction
): Promise<{ ok: boolean; detail?: string }> {
  try {
    switch (action.type) {
      case "create_contact": {
        const name = (context.contact?.name || "").trim();
        if (!name) return { ok: false, detail: "No contact name in trigger context." };
        const parts = name.split(/\s+/).filter(Boolean);
        const firstName = parts.shift() || name;
        const lastName = parts.length ? parts.join(" ") : null;

        let companyId: string | null = null;
        const companyName = context.company?.name?.trim();
        if (companyName) {
          const { data: company } = await supabase
            .from("crm_companies")
            .upsert(
              { organization_id: organizationId, company_name: companyName, website: context.company?.website || null },
              { onConflict: "organization_id,company_name", ignoreDuplicates: false }
            )
            .select("id")
            .single<{ id: string }>();
          companyId = company?.id || null;
        }

        const email = context.contact?.email?.trim() || null;
        if (email) {
          const { data: existing } = await supabase
            .from("crm_contacts")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("normalized_email", email.toLowerCase())
            .is("deleted_at", null)
            .maybeSingle<{ id: string }>();
          if (existing) return { ok: true, detail: `Contact already exists (${email}).` };
        }

        const { error } = await supabase.from("crm_contacts").insert({
          organization_id: organizationId,
          company_id: companyId,
          first_name: firstName,
          last_name: lastName,
          display_name: name,
          email,
          normalized_email: email ? email.toLowerCase() : null,
          phone: context.contact?.phone || null,
          lead_source: String(action.config.leadSource || "Automation"),
          created_by: context.actorId || null,
          updated_by: context.actorId || null
        });
        if (error) return { ok: false, detail: error.message };
        return { ok: true, detail: `Contact created: ${name}` };
      }

      case "link_company": {
        const companyName = context.company?.name?.trim();
        if (!companyName) return { ok: false, detail: "No company name in trigger context." };
        const { error } = await supabase
          .from("crm_companies")
          .upsert(
            { organization_id: organizationId, company_name: companyName, website: context.company?.website || null },
            { onConflict: "organization_id,company_name", ignoreDuplicates: false }
          );
        if (error) return { ok: false, detail: error.message };
        return { ok: true, detail: `Business linked: ${companyName}` };
      }

      case "create_deal": {
        const companyName = context.company?.name?.trim();
        let companyId: string | null = null;
        if (companyName) {
          const { data: company } = await supabase
            .from("crm_companies")
            .upsert(
              { organization_id: organizationId, company_name: companyName },
              { onConflict: "organization_id,company_name", ignoreDuplicates: false }
            )
            .select("id")
            .single<{ id: string }>();
          companyId = company?.id || null;
        }

        const titleTemplate = String(action.config.dealTitleTemplate || "{{company.name}} - New Deal");
        const dealTitle = fillTemplate(titleTemplate, context) || "New Deal";

        const { data: stage } = await supabase
          .from("crm_pipeline_stages")
          .select("id, probability")
          .eq("organization_id", organizationId)
          .order("stage_order", { ascending: true })
          .limit(1)
          .single<{ id: string; probability: number }>();

        const { error } = await supabase.from("crm_deals").insert({
          organization_id: organizationId,
          company_id: companyId,
          stage_id: stage?.id || null,
          deal_title: dealTitle,
          value: Number(action.config.value || context.deal?.value || 0),
          probability: stage?.probability || 25,
          created_by: context.actorId || null,
          updated_by: context.actorId || null
        });
        if (error) return { ok: false, detail: error.message };
        return { ok: true, detail: `Deal created: ${dealTitle}` };
      }

      case "create_task": {
        const titleTemplate = String(action.config.titleTemplate || "Follow up: {{contact.name}}");
        const title = fillTemplate(titleTemplate, context) || "Automated follow-up";
        const dueInHours = Number(action.config.dueInHours ?? 24);
        const dueAt = new Date(Date.now() + dueInHours * 60 * 60 * 1000).toISOString();

        const { error } = await supabase.from("crm_tasks").insert({
          organization_id: organizationId,
          title,
          task_type: String(action.config.taskType || "Follow-Up"),
          priority: String(action.config.priority || "normal"),
          status: "open",
          owner: "Fusion Automation",
          due_at: dueAt
        });
        if (error) return { ok: false, detail: error.message };
        return { ok: true, detail: `Task created: ${title}` };
      }

      case "update_lead_status": {
        if (context.entityType !== "lead" || !context.entityId) {
          return { ok: false, detail: "Trigger did not originate from a lead." };
        }
        const status = String(action.config.status || "").trim();
        if (!status) return { ok: false, detail: "No status configured." };
        const { error } = await supabase
          .from("crm_leads")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("organization_id", organizationId)
          .eq("id", context.entityId);
        if (error) return { ok: false, detail: error.message };
        return { ok: true, detail: `Lead status set to ${status}.` };
      }

      case "add_note": {
        const bodyTemplate = String(action.config.bodyTemplate || "");
        const body = fillTemplate(bodyTemplate, context).trim();
        if (!body) return { ok: false, detail: "Note body is empty." };
        const { error } = await supabase.from("crm_notes").insert({
          organization_id: organizationId,
          entity_type: context.entityType,
          body,
          author_id: context.actorId || null
        });
        if (error) return { ok: false, detail: error.message };
        return { ok: true, detail: "Note added." };
      }

      case "notify_team": {
        const titleTemplate = String(action.config.titleTemplate || "Automation triggered: {{trigger}}");
        const title = fillTemplate(titleTemplate, context) || "Automation notification";
        const { error } = await supabase.from("crm_notifications").insert({
          organization_id: organizationId,
          title
        });
        if (error) return { ok: false, detail: error.message };
        return { ok: true, detail: `Notification created: ${title}` };
      }

      case "send_email": {
        const templateId = String(action.config.templateId || "");
        if (!templateId) return { ok: false, detail: "No email template selected." };
        const to = context.contact?.email;
        if (!to) return { ok: false, detail: "No contact email in trigger context." };

        const { data: template } = await supabase
          .from("crm_email_templates")
          .select("subject, body")
          .eq("organization_id", organizationId)
          .eq("id", templateId)
          .is("deleted_at", null)
          .single<{ subject: string; body: string }>();
        if (!template) return { ok: false, detail: "Email template not found." };

        const variables: Record<string, string> = {
          contact_first_name: context.contact?.name?.split(" ")[0] || "",
          contact_full_name: context.contact?.name || "",
          company_name: context.company?.name || "",
          deal_title: context.deal?.title || "",
          proposal_title: context.proposal?.title || "",
          proposal_number: context.proposal?.number || ""
        };
        const subject = template.subject.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key: string) => variables[key] || "");
        const html = template.body.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key: string) => variables[key] || "");

        const result = await sendCrmEmail({ to, subject, html });
        if (!result.ok) return { ok: false, detail: result.error };
        return { ok: true, detail: `Email sent to ${to}.` };
      }

      default:
        return { ok: false, detail: `Unknown action type: ${action.type}` };
    }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Unexpected automation error." };
  }
}

/**
 * Fires every active automation rule matching `triggerType`. Never throws:
 * automation failures are logged to crm_automation_runs and crm_activities
 * but must not interrupt the primary CRM action that triggered them.
 */
export type AutomationPreviewCondition = {
  field: string;
  operator: string;
  value?: string;
  actual: string;
  passed: boolean;
};

export type AutomationPreviewGroup = {
  group: number;
  passed: boolean;
  conditions: AutomationPreviewCondition[];
};

export type AutomationPreviewAction = {
  type: string;
  summary: string;
};

export type AutomationPreviewResult = {
  passes: boolean;
  groups: AutomationPreviewGroup[];
  actions: AutomationPreviewAction[];
};

export type AutomationSampleData = {
  contact?: { name?: string; email?: string; phone?: string };
  company?: { name?: string };
  deal?: { value?: number; stageName?: string };
  task?: { title?: string };
  proposal?: { total?: number };
};

const TRIGGER_ENTITY_TYPE: Record<string, string> = {
  "lead.captured": "lead",
  "deal.stage_changed": "deal",
  "task.completed": "task",
  "task.overdue": "task",
  "payment.received": "payment",
  "proposal.sent": "proposal",
  "proposal.signed": "proposal",
  "message.received": "message"
};

export function previewAutomation(
  triggerType: AutomationTriggerType,
  conditions: AutomationCondition[],
  actions: AutomationAction[],
  sample: AutomationSampleData
): AutomationPreviewResult {
  const context: AutomationContext = {
    trigger: triggerType,
    entityType: TRIGGER_ENTITY_TYPE[triggerType] || "unknown",
    entityId: "preview",
    organizationId: "preview",
    contact: sample.contact,
    company: sample.company,
    deal: sample.deal,
    task: sample.task,
    proposal: sample.proposal
  };

  const groupsMap = new Map<number, AutomationCondition[]>();
  for (const condition of conditions) {
    const key = condition.group ?? 0;
    const list = groupsMap.get(key) || [];
    list.push(condition);
    groupsMap.set(key, list);
  }

  const groups: AutomationPreviewGroup[] = Array.from(groupsMap.entries()).map(([group, groupConditions]) => {
    const evaluated = groupConditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: condition.value,
      actual: String(getPath(context, condition.field) ?? ""),
      passed: evaluateCondition(context, condition)
    }));
    return { group, passed: evaluated.every((item) => item.passed), conditions: evaluated };
  });

  const passes = !groups.length || groups.some((group) => group.passed);

  const previewActions: AutomationPreviewAction[] = actions.map((action) => ({
    type: action.type,
    summary: describeActionPreview(action, context)
  }));

  return { passes, groups, actions: previewActions };
}

function describeActionPreview(action: AutomationAction, context: AutomationContext): string {
  switch (action.type) {
    case "create_contact": {
      const name = context.contact?.name;
      return name ? "Would create/link contact \"" + name + "\"." : "Would create/link a contact (no sample contact name provided).";
    }
    case "link_company": {
      const name = context.company?.name;
      return name ? "Would link company \"" + name + "\"." : "Would link a company (no sample company name provided).";
    }
    case "create_deal": {
      const titleTemplate = String(action.config.dealTitleTemplate || "{{company.name}} - New Deal");
      const title = fillTemplate(titleTemplate, context) || "New Deal";
      return "Would create deal \"" + title + "\".";
    }
    case "create_task": {
      const titleTemplate = String(action.config.titleTemplate || "Follow up");
      const title = fillTemplate(titleTemplate, context) || "Follow up";
      const dueInHours = Number(action.config.dueInHours ?? 24);
      return "Would create task \"" + title + "\" due in " + dueInHours + " hour(s).";
    }
    case "update_lead_status": {
      const status = String(action.config.status || "").trim();
      if (!status) return "Would update lead status (no status configured).";
      if (context.entityType !== "lead") return "Would update lead status to \"" + status + "\" (skipped in this sample: trigger is not a lead event).";
      return "Would update lead status to \"" + status + "\".";
    }
    case "add_note": {
      const bodyTemplate = String(action.config.bodyTemplate || "");
      const body = fillTemplate(bodyTemplate, context);
      return body ? "Would add note: \"" + body + "\"." : "Would add a note (no template configured).";
    }
    case "notify_team": {
      const titleTemplate = String(action.config.titleTemplate || "Automation triggered: {{trigger}}");
      const title = fillTemplate(titleTemplate, context) || "Automation notification";
      return "Would notify team: \"" + title + "\".";
    }
    case "send_email": {
      const templateId = String(action.config.templateId || "");
      if (!templateId) return "Would send email (no template selected).";
      if (!context.contact?.email) return "Would send email using the configured template (no sample contact email provided).";
      return "Would send email to " + context.contact.email + " using the configured template.";
    }
    default:
      return "Would run action: " + action.type + ".";
  }
}

export async function runAutomations(context: AutomationContext) {
  const supabase = getServiceClient();
  if (!supabase) return;

  try {
    const { data: automations } = await supabase
      .from("crm_automations")
      .select("id, name, conditions, actions, run_count")
      .eq("organization_id", context.organizationId)
      .eq("trigger_type", context.trigger)
      .eq("is_active", true)
      .is("deleted_at", null);

    for (const automation of automations || []) {
      const conditions = (automation.conditions || []) as AutomationCondition[];
      const passes = evaluateConditionGroups(context, conditions);
      if (!passes) {
        await supabase.from("crm_automation_runs").insert({
          organization_id: context.organizationId,
          automation_id: automation.id,
          trigger_type: context.trigger,
          entity_type: context.entityType,
          entity_id: context.entityId,
          status: "skipped",
          actions_run: []
        });
        continue;
      }

      const actions = (automation.actions || []) as AutomationAction[];
      const results: Array<{ type: string; ok: boolean; detail?: string }> = [];
      for (const action of actions) {
        const result = await runAction(supabase, context.organizationId, context, action);
        results.push({ type: action.type, ...result });
      }

      const hasFailure = results.some((result) => !result.ok);
      await supabase.from("crm_automation_runs").insert({
        organization_id: context.organizationId,
        automation_id: automation.id,
        trigger_type: context.trigger,
        entity_type: context.entityType,
        entity_id: context.entityId,
        status: hasFailure ? "error" : "success",
        actions_run: results,
        error_message: hasFailure ? results.filter((result) => !result.ok).map((result) => result.detail).join("; ") : null
      });

      await supabase
        .from("crm_automations")
        .update({
          run_count: Number((automation as { run_count?: number }).run_count || 0) + 1,
          last_run_at: new Date().toISOString()
        })
        .eq("id", automation.id);

      await logActivity(
        supabase,
        context.organizationId,
        context.actorId || null,
        "automation.ran",
        "automation",
        automation.id,
        `Automation "${automation.name}" ran on ${context.trigger}`,
        { results }
      );
    }
  } catch (error) {
    console.error("Automation engine error", error);
  }
}

export async function getAutomationsWorkspace() {
  const supabase = getServiceClient();
  if (!supabase) return { automations: [] as AutomationRecord[], runs: [] as AutomationRunRecord[], emailTemplates: [] as Array<{ id: string; template_name: string }> };

  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { automations: [] as AutomationRecord[], runs: [] as AutomationRunRecord[], emailTemplates: [] as Array<{ id: string; template_name: string }> };

  const [automationsResult, runsResult, templatesResult] = await Promise.all([
    supabase
      .from("crm_automations")
      .select("id, name, description, trigger_type, conditions, actions, is_active, run_count, last_run_at, created_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_automation_runs")
      .select("id, automation_id, trigger_type, entity_type, entity_id, status, actions_run, error_message, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("crm_email_templates")
      .select("id, template_name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .is("deleted_at", null)
  ]);

  return {
    automations: (automationsResult.data || []) as AutomationRecord[],
    runs: (runsResult.data || []) as AutomationRunRecord[],
    emailTemplates: (templatesResult.data || []) as Array<{ id: string; template_name: string }>
  };
}

export async function getAutomationEditWorkspace(automationId: string) {
  const supabase = getServiceClient();
  if (!supabase) {
    return { automation: null as AutomationRecord | null, emailTemplates: [] as Array<{ id: string; template_name: string }> };
  }

  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) {
    return { automation: null as AutomationRecord | null, emailTemplates: [] as Array<{ id: string; template_name: string }> };
  }

  const [automationResult, templatesResult] = await Promise.all([
    supabase
      .from("crm_automations")
      .select("id, name, description, trigger_type, conditions, actions, is_active, run_count, last_run_at, created_at")
      .eq("organization_id", organizationId)
      .eq("id", automationId)
      .is("deleted_at", null)
      .maybeSingle<AutomationRecord>(),
    supabase
      .from("crm_email_templates")
      .select("id, template_name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .is("deleted_at", null)
  ]);

  return {
    automation: automationResult.data || null,
    emailTemplates: (templatesResult.data || []) as Array<{ id: string; template_name: string }>
  };
}

export async function createAutomation(input: {
  actorId: string;
  name: string;
  description?: string;
  triggerType: AutomationTriggerType;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isActive: boolean;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Automation name is required." };
  if (!input.actions.length) return { ok: false, error: "Add at least one action." };

  const { data, error } = await supabase
    .from("crm_automations")
    .insert({
      organization_id: organizationId,
      name,
      description: input.description?.trim() || null,
      trigger_type: input.triggerType,
      conditions: input.conditions,
      actions: input.actions,
      is_active: input.isActive,
      created_by: input.actorId,
      updated_by: input.actorId
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to create automation." };
  await logActivity(supabase, organizationId, input.actorId, "automation.created", "automation", data.id, `Automation created: ${name}`);
  return { ok: true };
}

export async function duplicateAutomation(input: { automationId: string; actorId: string }): Promise<{ ok: boolean; error?: string; newId?: string }> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { data: source, error: fetchError } = await supabase
    .from("crm_automations")
    .select("*")
    .eq("id", input.automationId)
    .eq("organization_id", organizationId)
    .single();

  if (fetchError || !source) return { ok: false, error: "Automation not found." };

  const { data, error } = await supabase
    .from("crm_automations")
    .insert({
      organization_id: organizationId,
      name: source.name + " (Copy)",
      description: source.description,
      trigger_type: source.trigger_type,
      conditions: source.conditions,
      actions: source.actions,
      is_active: false,
      created_by: input.actorId,
      updated_by: input.actorId
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: "Unable to duplicate automation." };
  await logActivity(supabase, organizationId, input.actorId, "automation.duplicated", "automation", data.id, "Automation duplicated: " + source.name);
  return { ok: true, newId: data.id };
}

export async function updateAutomation(input: {
  actorId: string;
  automationId: string;
  name: string;
  description?: string;
  triggerType: AutomationTriggerType;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isActive: boolean;
}) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Automation name is required." };

  const { error } = await supabase
    .from("crm_automations")
    .update({
      name,
      description: input.description?.trim() || null,
      trigger_type: input.triggerType,
      conditions: input.conditions,
      actions: input.actions,
      is_active: input.isActive,
      updated_by: input.actorId,
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("id", input.automationId);

  if (error) return { ok: false, error: "Unable to update automation." };
  await logActivity(supabase, organizationId, input.actorId, "automation.updated", "automation", input.automationId, `Automation updated: ${name}`);
  return { ok: true };
}

export async function toggleAutomation(input: { actorId: string; automationId: string; isActive: boolean }) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { error } = await supabase
    .from("crm_automations")
    .update({ is_active: input.isActive, updated_by: input.actorId, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", input.automationId);

  if (error) return { ok: false, error: "Unable to update automation." };
  return { ok: true };
}

export async function deleteAutomation(input: { actorId: string; automationId: string }) {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, error: "Supabase CRM is not configured." };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "CRM organization is not configured." };

  const { error } = await supabase
    .from("crm_automations")
    .update({ deleted_at: new Date().toISOString(), updated_by: input.actorId })
    .eq("organization_id", organizationId)
    .eq("id", input.automationId);

  if (error) return { ok: false, error: "Unable to delete automation." };
  return { ok: true };
}

/**
 * Scans for tasks whose due date has passed and haven't already fired the
 * task.overdue trigger. Called from the /api/cron/automations route.
 */
export async function checkOverdueTasks() {
  const supabase = getServiceClient();
  if (!supabase) return { checked: 0, fired: 0 };
  const organizationId = await getDefaultOrganizationId(supabase);
  if (!organizationId) return { checked: 0, fired: 0 };

  const { data: overdueTasks } = await supabase
    .from("crm_tasks")
    .select("id, title, owner, due_at")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .neq("status", "done")
    .lt("due_at", new Date().toISOString())
    .limit(200);

  const tasks = overdueTasks || [];
  if (!tasks.length) return { checked: 0, fired: 0 };

  const { data: alreadyFlagged } = await supabase
    .from("crm_automation_overdue_flags")
    .select("task_id")
    .in("task_id", tasks.map((task) => task.id));
  const flaggedIds = new Set((alreadyFlagged || []).map((row: { task_id: string }) => row.task_id));

  let fired = 0;
  for (const task of tasks) {
    if (flaggedIds.has(task.id)) continue;
    await supabase.from("crm_automation_overdue_flags").upsert({ task_id: task.id });
    await runAutomations({
      trigger: "task.overdue",
      entityType: "task",
      entityId: task.id,
      organizationId,
      task: { title: task.title, dueAt: task.due_at, owner: task.owner }
    });
    fired += 1;
  }

  return { checked: tasks.length, fired };
}
