import { ClipboardList, FileText } from "lucide-react";
import { createFusionNote, createFusionTask, updateFusionTask } from "@/app/fusionadmin/actions";
import { getFusionCrmWorkspace } from "@/lib/crm";
import { EmptyState, formatDate, FusionDataTable, FusionSubmitButton, optionList, PageHeader } from "../crm-ui";

export default async function FusionTasksPage() {
  const crm = await getFusionCrmWorkspace();
  const taskTypes = optionList(crm.settings?.task_types);
  const statusOptions = ["open", "in_progress", "done", "blocked"];

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Tasks"
        title="Manage follow-up and internal work"
        description="Keep sales follow-up, onboarding, notes, and project handoff work from slipping."
      />

      <section className="admin-two-column">
        <article className="admin-panel">
          <h2><ClipboardList size={20} /> Add task</h2>
          <form className="quick-form" action={createFusionTask}>
            <input name="title" placeholder="Task title" required />
            <select name="taskType">
              {taskTypes.map((type) => <option key={type}>{type}</option>)}
              {!taskTypes.length ? <option>Follow-Up</option> : null}
            </select>
            <select name="priority" defaultValue="normal">
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
            <input name="dueAt" type="datetime-local" />
            <FusionSubmitButton pendingLabel="Adding...">Add task</FusionSubmitButton>
          </form>
        </article>

        <article className="admin-panel">
          <h2><FileText size={20} /> Add note</h2>
          <form className="quick-form" action={createFusionNote}>
            <select name="entityType" defaultValue="general">
              <option value="general">General</option>
              <option value="lead">Lead</option>
              <option value="deal">Deal</option>
              <option value="contact">Contact</option>
              <option value="company">Company</option>
            </select>
            <textarea name="body" placeholder="Internal CRM note" required />
            <FusionSubmitButton pendingLabel="Adding...">Add note</FusionSubmitButton>
          </form>
        </article>

        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><ClipboardList size={20} /> Task queue</h2>
            <span className="status-pill">{crm.tasks.length}</span>
          </div>
          <FusionDataTable
            aria-label="Task queue"
            columns={[
              { header: "Task", priority: "primary" },
              { header: "Type" },
              { header: "Status" },
              { header: "Priority" },
              { header: "Due" },
              { header: "Save", className: "table-action-column" }
            ]}
            empty={!crm.tasks.length ? <EmptyState>No open tasks yet.</EmptyState> : null}
          >
            {crm.tasks.map((task) => (
              <tr key={task.id}>
                <td data-label="Task">
                  <form id={`task-${task.id}`} action={updateFusionTask}>
                    <input name="taskId" type="hidden" value={task.id} />
                    <label className="sr-only" htmlFor={`title-${task.id}`}>Task title</label>
                    <input id={`title-${task.id}`} name="title" defaultValue={task.title} required />
                    <span className="muted">{task.owner} · {task.company || "No company"}</span>
                  </form>
                </td>
                <td data-label="Type">
                  <select form={`task-${task.id}`} name="taskType" defaultValue={task.task_type || "Follow-Up"}>
                    {taskTypes.map((type) => <option key={type}>{type}</option>)}
                    {!taskTypes.length ? <option>Follow-Up</option> : null}
                  </select>
                </td>
                <td data-label="Status">
                  <select form={`task-${task.id}`} name="status" defaultValue={task.status || "open"}>
                    {statusOptions.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
                  </select>
                  {task.completed_at ? <span className="muted">Completed {formatDate(task.completed_at)}</span> : null}
                </td>
                <td data-label="Priority">
                  <select form={`task-${task.id}`} name="priority" defaultValue={task.priority || "normal"}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </td>
                <td data-label="Due">
                  <input form={`task-${task.id}`} name="dueAt" type="datetime-local" defaultValue={toDateTimeLocal(task.due_at)} aria-label={`Due date for ${task.title}`} />
                </td>
                <td data-label="Save">
                  <button form={`task-${task.id}`} className="secondary-button compact-button" type="submit">Save</button>
                </td>
              </tr>
            ))}
          </FusionDataTable>
        </article>

        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><FileText size={20} /> Notes</h2>
            <span className="status-pill">{crm.notes.length}</span>
          </div>
          <div className="stack-list">
            {crm.notes.map((note) => (
              <p key={note.id}><strong>{note.entity_type}</strong><br /><span className="muted">{note.body}</span></p>
            ))}
            {!crm.notes.length ? <EmptyState>No notes yet.</EmptyState> : null}
          </div>
        </article>
      </section>
    </div>
  );
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}
