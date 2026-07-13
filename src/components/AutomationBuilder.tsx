"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { GripVertical, PlusCircle, Trash2, Zap } from "lucide-react";
import { FormError, SubmitButton } from "@/components/ui";

export type BuilderTrigger = { value: string; label: string; description: string };
export type BuilderActionType = { value: string; label: string; description: string };
export type BuilderCondition = { field: string; operator: string; value: string; group?: number };
export type BuilderAction = { type: string; config: Record<string, string | number | boolean> };
export type BuilderEmailTemplate = { id: string; template_name: string };

type ConditionNode = BuilderCondition & { id: string; x: number; y: number };
type ActionNode = BuilderAction & { id: string; x: number; y: number };

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

const NODE_WIDTH = 280;
const TRIGGER_HEIGHT = 100;
const CONDITION_HEIGHT = 132;
const ACTION_HEIGHT = 176;
const V_GAP = 40;
const START_X = 32;
const START_Y = 24;

function makeId(prefix: string) {
  return prefix + "-" + Math.random().toString(36).slice(2, 9) + "-" + Date.now().toString(36);
}

function actionConfigFields(
  actionType: string,
  config: Record<string, string | number | boolean>,
  emailTemplates: BuilderEmailTemplate[],
  onChange: (key: string, value: string) => void
): ReactNode {
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
  formAction: (prevState: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string }> | { error?: string };
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
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [state, dispatchFormAction] = useActionState(formAction, undefined as { error?: string } | undefined);

  const [triggerType, setTriggerType] = useState(initial?.triggerType || triggers[0]?.value || "lead.captured");
  const [triggerPos, setTriggerPos] = useState({ x: START_X, y: START_Y });

  const [conditions, setConditions] = useState<ConditionNode[]>(() => {
    let y = START_Y + TRIGGER_HEIGHT + V_GAP;
    return (initial?.conditions || []).map((condition, index) => {
      const node = { ...condition, group: condition.group ?? 0, id: "cond-initial-" + index, x: START_X, y };
      y += CONDITION_HEIGHT + V_GAP;
      return node;
    });
  });

  const [actions, setActions] = useState<ActionNode[]>(() => {
    let y = START_Y + TRIGGER_HEIGHT + V_GAP + (initial?.conditions?.length || 0) * (CONDITION_HEIGHT + V_GAP);
    return (initial?.actions || []).map((action, index) => {
      const node = { ...action, id: "action-initial-" + index, x: START_X, y };
      y += ACTION_HEIGHT + V_GAP;
      return node;
    });
  });

    useEffect(() => {
      if (!state || state.error) return;
      setTriggerType(initial?.triggerType || triggers[0]?.value || "lead.captured");
      setTriggerPos({ x: START_X, y: START_Y });
      let condY = START_Y + TRIGGER_HEIGHT + V_GAP;
      setConditions(
        (initial?.conditions || []).map((condition) => {
          const node = { ...condition, group: condition.group ?? 0, id: makeId("cond"), x: START_X, y: condY };
          condY += CONDITION_HEIGHT + V_GAP;
          return node;
        })
      );
      let actionY = START_Y + TRIGGER_HEIGHT + V_GAP + (initial?.conditions?.length || 0) * (CONDITION_HEIGHT + V_GAP);
      setActions(
        (initial?.actions || []).map((action) => {
          const node = { ...action, id: makeId("action"), x: START_X, y: actionY };
          actionY += ACTION_HEIGHT + V_GAP;
          return node;
        })
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);
  
  function appendY() {
    const ys = [
      triggerPos.y + TRIGGER_HEIGHT,
      ...conditions.map((c) => c.y + CONDITION_HEIGHT),
      ...actions.map((a) => a.y + ACTION_HEIGHT)
    ];
    return Math.max(...ys) + V_GAP;
  }

  function addConditionAt(x: number, y: number) {
    setConditions((current) => [...current, { field: "", operator: "is_set", value: "", group: 0, id: makeId("cond"), x, y }]);
  }

  function addActionAt(x: number, y: number) {
    setActions((current) => [
      ...current,
      { type: actionTypes[0]?.value || "create_contact", config: {}, id: makeId("action"), x, y }
    ]);
  }

  function updateCondition(id: string, patch: Partial<BuilderCondition>) {
    setConditions((current) => current.map((condition) => (condition.id === id ? { ...condition, ...patch } : condition)));
  }

  function removeCondition(id: string) {
    setConditions((current) => current.filter((condition) => condition.id !== id));
  }

  function updateActionType(id: string, type: string) {
    setActions((current) => current.map((action) => (action.id === id ? { ...action, type, config: {} } : action)));
  }

  function updateActionConfig(id: string, key: string, value: string) {
    setActions((current) =>
      current.map((action) => (action.id === id ? { ...action, config: { ...action.config, [key]: value } } : action))
    );
  }

  function removeAction(id: string) {
    setActions((current) => current.filter((action) => action.id !== id));
  }

  function startDrag(pointerDownEvent: ReactPointerEvent<HTMLDivElement>, id: string, kind: "trigger" | "condition" | "action") {
    if ((pointerDownEvent.target as HTMLElement).closest("button")) return;
    pointerDownEvent.preventDefault();
    const startX = pointerDownEvent.clientX;
    const startY = pointerDownEvent.clientY;
    const origin =
      kind === "trigger"
        ? triggerPos
        : kind === "condition"
        ? conditions.find((condition) => condition.id === id)
        : actions.find((action) => action.id === id);
    if (!origin) return;
    const originX = origin.x;
    const originY = origin.y;

    function onMove(moveEvent: PointerEvent) {
      const nextX = Math.max(0, originX + (moveEvent.clientX - startX));
      const nextY = Math.max(0, originY + (moveEvent.clientY - startY));
      if (kind === "trigger") {
        setTriggerPos({ x: nextX, y: nextY });
      } else if (kind === "condition") {
        setConditions((current) => current.map((condition) => (condition.id === id ? { ...condition, x: nextX, y: nextY } : condition)));
      } else {
        setActions((current) => current.map((action) => (action.id === id ? { ...action, x: nextX, y: nextY } : action)));
      }
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleCanvasDrop(dropEvent: ReactDragEvent<HTMLDivElement>) {
    dropEvent.preventDefault();
    const kind = dropEvent.dataTransfer.getData("text/automation-node");
    if (kind !== "condition" && kind !== "action") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, dropEvent.clientX - rect.left + (canvasRef.current?.scrollLeft || 0) - NODE_WIDTH / 2);
    const y = Math.max(0, dropEvent.clientY - rect.top + (canvasRef.current?.scrollTop || 0) - 20);
    if (kind === "condition") addConditionAt(x, y);
    else addActionAt(x, y);
  }

  const existingGroups = Array.from(new Set(conditions.map((condition) => condition.group ?? 0))).sort((a, b) => a - b);
  const groupOptions = existingGroups.length ? existingGroups : [0];
  const nextGroupNumber = Math.max(0, ...groupOptions) + 1;
  const sortedConditions = [...conditions].sort((a, b) => (a.group ?? 0) - (b.group ?? 0) || a.y - b.y);
  const sortedActions = [...actions].sort((a, b) => a.y - b.y);

  const chainForEdges = [
    { x: triggerPos.x, y: triggerPos.y, height: TRIGGER_HEIGHT },
    ...sortedConditions.map((condition) => ({ x: condition.x, y: condition.y, height: CONDITION_HEIGHT })),
    ...sortedActions.map((action) => ({ x: action.x, y: action.y, height: ACTION_HEIGHT }))
  ];

  const edgePaths: string[] = [];
  for (let i = 0; i < chainForEdges.length - 1; i += 1) {
    const from = chainForEdges[i];
    const to = chainForEdges[i + 1];
    const fromPoint = { x: from.x + NODE_WIDTH / 2, y: from.y + from.height };
    const toPoint = { x: to.x + NODE_WIDTH / 2, y: to.y };
    const midY = (fromPoint.y + toPoint.y) / 2;
    edgePaths.push(
      "M " + fromPoint.x + " " + fromPoint.y + " C " + fromPoint.x + " " + midY + " " + toPoint.x + " " + midY + " " + toPoint.x + " " + toPoint.y
    );
  }

  const canvasWidth =
    Math.max(triggerPos.x, ...conditions.map((condition) => condition.x), ...actions.map((action) => action.x), 0) + NODE_WIDTH + 80;

  const canvasHeight =
    Math.max(
      triggerPos.y + TRIGGER_HEIGHT,
      ...conditions.map((condition) => condition.y + CONDITION_HEIGHT),
      ...actions.map((action) => action.y + ACTION_HEIGHT),
      200
    ) + 80;

  return (
    <form action={dispatchFormAction} className="automation-form" data-track-unsaved="true">
      {initial?.automationId ? <input name="automationId" type="hidden" value={initial.automationId} /> : null}

      <label>
        Automation name
        <input defaultValue={initial?.name || ""} name="name" placeholder="New lead -> Contact + Business" required />
      </label>

      <label>
        Description
        <textarea defaultValue={initial?.description || ""} name="description" placeholder="What does this automation do?" />
      </label>

      <div className="automation-canvas-toolbar">
        <p className="muted automation-canvas-hint">
          Drag <strong>Condition</strong> or <strong>Action</strong> onto the canvas, or use the buttons below. Drag a node up
          or down to change the order actions run in.
        </p>
        <div className="automation-canvas-toolbar-actions">
          <div className="automation-palette">
            <span
              className="automation-palette-chip"
              draggable
              onDragStart={(event) => event.dataTransfer.setData("text/automation-node", "condition")}
            >
              <GripVertical size={14} /> Condition
            </span>
            <span
              className="automation-palette-chip"
              draggable
              onDragStart={(event) => event.dataTransfer.setData("text/automation-node", "action")}
            >
              <GripVertical size={14} /> Action
            </span>
          </div>
          <button className="secondary-button compact-button" onClick={() => addConditionAt(START_X, appendY())} type="button">
            <PlusCircle size={16} /> Add condition
          </button>
          <button className="secondary-button compact-button" onClick={() => addActionAt(START_X, appendY())} type="button">
            <PlusCircle size={16} /> Add action
          </button>
        </div>
      </div>

      <div className="automation-canvas" onDragOver={(event) => event.preventDefault()} onDrop={handleCanvasDrop} ref={canvasRef}>
        <div className="automation-canvas-inner" style={{ width: canvasWidth, height: canvasHeight }}>
          <svg className="automation-edges" height={canvasHeight} width={canvasWidth}>
            {edgePaths.map((d, index) => (
              <path className="automation-edge-path" d={d} key={index} />
            ))}
          </svg>

          <div className="automation-node automation-node-trigger" style={{ left: triggerPos.x, top: triggerPos.y, width: NODE_WIDTH }}>
            <div className="automation-node-handle" onPointerDown={(event) => startDrag(event, "trigger", "trigger")}>
              <Zap size={14} />
              <span>Trigger</span>
            </div>
            <div className="automation-node-body">
              <select name="triggerType" onChange={(event) => setTriggerType(event.target.value)} value={triggerType}>
                {triggers.map((trigger) => (
                  <option key={trigger.value} value={trigger.value}>{trigger.label}</option>
                ))}
              </select>
              <p className="muted automation-trigger-hint">{triggers.find((trigger) => trigger.value === triggerType)?.description}</p>
            </div>
          </div>

          {sortedConditions.map((condition) => (
            <div
              className="automation-node automation-node-condition"
              key={condition.id}
              style={{ left: condition.x, top: condition.y, width: NODE_WIDTH }}
            >
              <div className="automation-node-handle" onPointerDown={(event) => startDrag(event, condition.id, "condition")}>
                <GripVertical size={14} />
                <span>Condition</span>
                <button
                  aria-label="Remove condition"
                  className="icon-remove-button"
                  onClick={() => removeCondition(condition.id)}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="automation-node-body">
                <input
                  list="automation-field-hints"
                  name="conditionField"
                  onChange={(event) => updateCondition(condition.id, { field: event.target.value })}
                  placeholder="field, e.g. contact.email"
                  value={condition.field}
                />
                <select
                  name="conditionOperator"
                  onChange={(event) => updateCondition(condition.id, { operator: event.target.value })}
                  value={condition.operator}
                >
                  {OPERATORS.map((operator) => (
                    <option key={operator.value} value={operator.value}>{operator.label}</option>
                  ))}
                </select>
                <input
                  name="conditionValue"
                  onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
                  placeholder="value (if needed)"
                  value={condition.value}
                />
                <label className="automation-condition-group">
                  OR group
                  <select
                    name="conditionGroup"
                    onChange={(event) => {
                      const raw = event.target.value;
                      const nextValue = raw === "new" ? nextGroupNumber : Number(raw);
                      updateCondition(condition.id, { group: nextValue });
                    }}
                    value={String(condition.group ?? 0)}
                  >
                    {groupOptions.map((groupNumber) => (
                      <option key={groupNumber} value={groupNumber}>Group {groupNumber + 1}</option>
                    ))}
                    <option value="new">+ New OR group</option>
                  </select>
                </label>
              </div>
            </div>
          ))}

          {sortedActions.map((action) => (
            <div
              className="automation-node automation-node-action"
              key={action.id}
              style={{ left: action.x, top: action.y, width: NODE_WIDTH }}
            >
              <div className="automation-node-handle" onPointerDown={(event) => startDrag(event, action.id, "action")}>
                <GripVertical size={14} />
                <span>Action</span>
                <button aria-label="Remove action" className="icon-remove-button" onClick={() => removeAction(action.id)} type="button">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="automation-node-body">
                <select name="actionType" onChange={(event) => updateActionType(action.id, event.target.value)} value={action.type}>
                  {actionTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <p className="muted automation-trigger-hint">{actionTypes.find((type) => type.value === action.type)?.description}</p>
                <div className="automation-action-config">
                  {actionConfigFields(action.type, action.config, emailTemplates, (key, value) => updateActionConfig(action.id, key, value))}
                </div>
                <input name="actionConfig" type="hidden" value={JSON.stringify(action.config)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <datalist id="automation-field-hints">
        {FIELD_HINTS.map((hint) => (
          <option key={hint} value={hint} />
        ))}
      </datalist>

      <label className="automation-toggle-row">
        <input defaultChecked={initial?.isActive ?? true} name="isActive" type="checkbox" />
        Active
      </label>

      {actions.length === 0 ? (
        <p className="muted automation-canvas-hint">This automation has no actions yet. Add at least one before saving.</p>
      ) : null}

      <FormError message={state?.error} />

      <SubmitButton pendingLabel="Saving...">{initial?.automationId ? "Save automation" : "Create automation"}</SubmitButton>
    </form>
  );
}
