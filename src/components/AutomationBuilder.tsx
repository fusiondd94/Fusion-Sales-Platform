"use client";

import { useState, type ReactNode } from "react";
import { PlusCircle, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/ui";

export type BuilderTrigger = { value: string; label: string; description: string };
export type BuilderActionType = { value: string; label: string; description: string };
export type BuilderCondition = { field: string; operator: string; value: string };
export type BuilderAction = { type: string; config: Record<string, string | number | boolean> };
export type BuilderEmailTemplate = { id: string; template_name: string };

const OPERATORS = [
  { value: "is_set", label: "is set" },
  { value: "is_not_set", label: "is not set" },
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "greater_than", label: "is greater than" },
  { value: "less_than", label: "is less than" }
];

const FIELD_HINTS = [
  "contact.name",
  "contact.email",
  "contact.phone",
  "company.name",
  "deal.value",
  "deal.stageName",
  "task.title",
  "proposal.total"
];

function actionConfigFields(actionType: string, config: Record<string, string | number | boolean>, emailTemplates: BuilderEmailTemplate[], onChange: (key: string, value: string) => void): ReactNode {
  switch (actionType) {
    case "create_contact":
      return (
        <label>
          Lead source label
          <input
            onChange={(event) => onChange("leadSource", event.target.value)}
            placeholder="Website questionnaire"
            value={String(config.leadSource || "")}
          />
        </label>
      );
    case "create_deal":
      return (
        <>
          <label>
            Deal title template
            <input
              onChange={(event) => onChange("dealTitleTemplate", event.target.value)}
              placeholder="{{company.name}} - New Deal"
              value={String(config.dealTitleTemplate || "")}
            />
          </label>
          <label>
            Deal value ($)
            <input
              min="0"
              onChange={(event) => onChange("value", event.target.value)}
              type="number"
              value={String(config.value || "")}
            />
          </label>
        </>
      );
    case "create_task":
      return (
        <>
          <label>
            Task title template
            <input
              onChange={(event) => onChange("titleTemplate", event.target.value)}
              placeholder="Follow up with {{contact.name}}"
              value={String(config.titleTemplate || "")}
            />
          </label>
          <label>
            Due in (hours)
            <input
              min="1"
              onChange={(event) => onChange("dueInHours", event.target.value)}
              type="number"
              value={String(config.dueInHours || "24")}
            />
          </label>
          <label>
            Priority
            <select onChange={(event) => onChange("priority", event.target.value)} value={String(config.priority || "normal")}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
        </>
      );
    case "update_lead_status":
      return (
        <label>
          New status
          <input
            onChange={(event) => onChange("status", event.target.value)}
            placeholder="qualified"
            value={String(config.status || "")}
          />
        </label>
      );
    case "add_note":
      return (
        <label>
          Note text (supports {"{{"}fields{"}}"})
          <textarea
            onChange={(event) => onChange("bodyTemplate", event.target.value)}
            placeholder="Auto-note: {{contact.name}} triggered this automation."
            value={String(config.bodyTemplate || "")}
          />
        </label>
      );
    case "notify_team":
      return (
        <label>
          Notification title
          <input
            onChange={(event) => onChange("titleTemplate", event.target.value)}
            placeholder="New activity: {{contact.name}}"
            value={String(config.titleTemplate || "")}
          />
        </label>
      );
    case "send_email":
      return (
        <label>
          Email template
          <select onChange={(event) => onChange("templateId", event.target.value)} value={String(config.templateId || "")}>
            <option value="">Select a template</option>
            {emailTemplates.map((template) => (
              <option key={template.id} value={template.id}>{template.template_name}</option>
            ))}
          </select>
        </label>
      );
    default:
      return null;
  }
}

export function AutomationBuilder({
  formAction,
  triggers,
  actionTypes,
  emailTemplates,
  initial
}: {
  formAction: (formData: FormData) => void;
  triggers: BuilderTrigger[];
  actionTypes: BuilderActionType[];
  emailTemplates: BuilderEmailTemplate[];
  initial?: {
    automationId?: string;
    name?: string;
    description?: string;
    triggerType?: string;
    isActive?: boolean;
    conditions?: BuilderCondition[];
    actions?: BuilderAction[];
  };
}) {
  const [triggerType, setTriggerType] = useState(initial?.triggerType || triggers[0]?.value || "lead.captured");
  const [conditions, setConditions] = useState<BuilderCondition[]>(initial?.conditions || []);
  const [actions, setActions] = useState<BuilderAction[]>(initial?.actions || []);

  function addCondition() {
    setConditions((current) => [...current, { field: "", operator: "is_set", value: "" }]);
  }

  function updateCondition(index: number, patch: Partial<BuilderCondition>) {
    setConditions((current) => current.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)));
  }

  function removeCondition(index: number) {
    setConditions((current) => current.filter((_, i) => i !== index));
  }

  function addAction() {
    setActions((current) => [...current, { type: actionTypes[0]?.value || "create_contact", config: {} }]);
  }

  function updateActionType(index: number, type: string) {
    setActions((current) => current.map((action, i) => (i === index ? { type, config: {} } : action)));
  }

  function updateActionConfig(index: number, key: string, value: string) {
    setActions((current) => current.map((action, i) => (i === index ? { ...action, config: { ...action.config, [key]: value } } : action)));
  }

  function removeAction(index: number) {
    setActions((current) => current.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="automation-form" data-track-unsaved="true">
      {initial?.automationId ? <input name="automationId" type="hidden" value={initial.automationId} /> : null}

      <label>
        Automation name
        <input defaultValue={initial?.name || ""} name="name" placeholder="New lead -> Contact + Business" required />
      </label>

      <label>
        Description
        <textarea defaultValue={initial?.description || ""} name="description" placeholder="What does this automation do?" />
      </label>

      <label>
        When this happens (trigger)
        <select name="triggerType" onChange={(event) => setTriggerType(event.target.value)} value={triggerType}>
          {triggers.map((trigger) => (
            <option key={trigger.value} value={trigger.value}>{trigger.label}</option>
          ))}
        </select>
      </label>
      <p className="muted automation-trigger-hint">{triggers.find((trigger) => trigger.value === triggerType)?.description}</p>

      <fieldset className="automation-fieldset">
        <legend>Only run if... (optional)</legend>
        {conditions.map((condition, index) => (
          <div className="automation-row" key={index}>
            <input
              list="automation-field-hints"
              name="conditionField"
              onChange={(event) => updateCondition(index, { field: event.target.value })}
              placeholder="field, e.g. contact.email"
              value={condition.field}
            />
            <select
              name="conditionOperator"
              onChange={(event) => updateCondition(index, { operator: event.target.value })}
              value={condition.operator}
            >
              {OPERATORS.map((operator) => (
                <option key={operator.value} value={operator.value}>{operator.label}</option>
              ))}
            </select>
            <input
              name="conditionValue"
              onChange={(event) => updateCondition(index, { value: event.target.value })}
              placeholder="value (if needed)"
              value={condition.value}
            />
            <button aria-label="Remove condition" onClick={() => removeCondition(index)} className="icon-remove-button" type="button">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <datalist id="automation-field-hints">
          {FIELD_HINTS.map((hint) => (
            <option key={hint} value={hint} />
          ))}
        </datalist>
        <button className="secondary-button compact-button" onClick={addCondition} type="button">
          <PlusCircle size={16} /> Add condition
        </button>
      </fieldset>

      <fieldset className="automation-fieldset">
        <legend>Then do this... (actions run in order)</legend>
        {actions.map((action, index) => (
          <div className="automation-action-block" key={index}>
            <div className="automation-row">
              <select
                name="actionType"
                onChange={(event) => updateActionType(index, event.target.value)}
                value={action.type}
              >
                {actionTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <button aria-label="Remove action" onClick={() => removeAction(index)} className="icon-remove-button" type="button">
                <Trash2 size={16} />
              </button>
            </div>
            <p className="muted automation-trigger-hint">{actionTypes.find((type) => type.value === action.type)?.description}</p>
            <div className="automation-action-config">
              {actionConfigFields(action.type, action.config, emailTemplates, (key, value) => updateActionConfig(index, key, value))}
            </div>
            <input name="actionConfig" type="hidden" value={JSON.stringify(action.config)} />
          </div>
        ))}
        <button className="secondary-button compact-button" onClick={addAction} type="button">
          <PlusCircle size={16} /> Add action
        </button>
      </fieldset>

      <label className="automation-toggle-row">
        <input defaultChecked={initial?.isActive ?? true} name="isActive" type="checkbox" />
        Active
      </label>

      <SubmitButton pendingLabel="Saving...">{initial?.automationId ? "Save automation" : "Create automation"}</SubmitButton>
    </form>
  );
}
