import { ClipboardList, FileText } from "lucide-react";
import { createFusionNote, createFusionTask } from "@/app/fusionadmin/actions";
import { getFusionCrmWorkspace } from "@/lib/crm";
import { EmptyState, formatDate, optionList, PageHeader } from "../crm-ui";

export default async function FusionTasksPage() {
  const crm = await getFusionCrmWorkspace();
  const taskTypes = optionList(crm.settings?.task_types);

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
            <button className="primary-button" type="submit">Add task</button>
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
            <button className="primary-button" type="submit">Add note</button>
          </form>
        </article>

        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><ClipboardList size={20} /> Task queue</h2>
            <span className="status-pill">{crm.tasks.length}</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Owner</th>
                  <th>Company</th>
                  <th>Priority</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {crm.tasks.map((task) => (
                  <tr key={task.id}>
                    <td>{task.title}<br /><span className="muted">{task.status}</span></td>
                    <td>{task.owner}</td>
                    <td>{task.company || "No company"}</td>
                    <td><span className="status-pill">{task.priority}</span></td>
                    <td>{formatDate(task.due_at)}</td>
                  </tr>
                ))}
                {!crm.tasks.length ? (
                  <tr><td colSpan={5}><EmptyState>No open tasks yet.</EmptyState></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
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
