"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import {
  assignFusionClientTask,
  createFusionTaskSection,
  deleteFusionBoardTask,
  deleteFusionTaskSection,
  reorderFusionBoardTasks,
  reorderFusionTaskSections
} from "@/app/fusionadmin/actions";
import { FusionField, FusionInput, FusionSelect, FusionSubmitButton, FusionTextarea } from "../crm-ui";

type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  section_id: string | null;
  position: number;
  due_at: string | null;
  created_at: string;
  completed_at: string | null;
  client_visible?: boolean;
  client_id?: string | null;
  client_name?: string | null;
  project_id?: string | null;
  project_name?: string | null;
};

type Section = { id: string; name: string; position: number };

type ClientOption = { id: string; customer_name: string; project_id: string | null; project_name: string | null };

function priorityLabel(priority: string) {
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Medium";
}

export function TaskBoard({
  clients,
  tasks,
  selectedClientId,
  search,
  projectBoard,
  selectedClient
}: {
  clients: ClientOption[];
  tasks: BoardTask[];
  selectedClientId: string;
  search: string;
  projectBoard: { sections: Section[]; tasks: BoardTask[] } | null;
  selectedClient: ClientOption | null;
}) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>(projectBoard?.sections || []);
  const [boardTasks, setBoardTasks] = useState<BoardTask[]>(projectBoard?.tasks || []);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragSectionId, setDragSectionId] = useState<string | null>(null);

  function goTo(nextClientId: string, nextSearch: string) {
    const params = new URLSearchParams();
    if (nextClientId) params.set("clientId", nextClientId);
    if (nextSearch) params.set("search", nextSearch);
    router.push(`/fusionadmin/task-board${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function tasksForSection(sectionId: string | null) {
    return boardTasks
      .filter((task) => task.section_id === sectionId)
      .sort((a, b) => a.position - b.position);
  }

  async function handleDropOnSection(targetSectionId: string | null) {
    if (!dragTaskId) return;
    const dragged = boardTasks.find((task) => task.id === dragTaskId);
    if (!dragged) return;

    const destinationTasks = tasksForSection(targetSectionId).filter((task) => task.id !== dragTaskId);
    destinationTasks.push({ ...dragged, section_id: targetSectionId });

    const updates = destinationTasks.map((task, index) => ({ taskId: task.id, sectionId: targetSectionId, position: index }));

    setBoardTasks((prev) =>
      prev.map((task) => {
        const match = updates.find((update) => update.taskId === task.id);
        return match ? { ...task, section_id: match.sectionId, position: match.position } : task;
      })
    );
    const draggedId = dragTaskId;
    setDragTaskId(null);
    if (draggedId) await reorderFusionBoardTasks(updates);
  }

  async function handleDropOnColumn(targetColumnSectionId: string) {
    if (!dragSectionId || dragSectionId === targetColumnSectionId) return;
    const ordered = [...sections];
    const fromIndex = ordered.findIndex((section) => section.id === dragSectionId);
    const toIndex = ordered.findIndex((section) => section.id === targetColumnSectionId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, moved);
    const reindexed = ordered.map((section, index) => ({ ...section, position: index }));
    setSections(reindexed);
    setDragSectionId(null);
    await reorderFusionTaskSections(reindexed.map((section) => section.id));
  }

  return (
    <div className="task-board">
      <div className="task-board__filters">
        <FusionField label="Client">
          <FusionSelect defaultValue={selectedClientId} onChange={(event) => goTo(event.target.value, search)}>
            <option value="">All clients (monitoring view)</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.customer_name}
              </option>
            ))}
          </FusionSelect>
        </FusionField>
        <FusionField label="Search tasks">
          <FusionInput
            defaultValue={search}
            onKeyDown={(event) => {
              if (event.key === "Enter") goTo(selectedClientId, (event.target as HTMLInputElement).value);
            }}
            placeholder="Search by title and press Enter..."
          />
        </FusionField>
      </div>

      {selectedClient ? (
        <div className="task-board__kanban">
          <div className="task-board__columns">
            {sections.map((section) => (
              <div
                className="task-board__column"
                draggable
                key={section.id}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={() => setDragSectionId(section.id)}
                onDrop={() => handleDropOnColumn(section.id)}
              >
                <div className="task-board__column-heading">
                  <GripVertical size={14} />
                  <h3>{section.name}</h3>
                  <span className="status-pill">{tasksForSection(section.id).length}</span>
                  <form action={deleteFusionTaskSection}>
                    <input name="sectionId" type="hidden" value={section.id} />
                    <button className="text-link text-link--danger" type="submit">
                      <Trash2 size={13} />
                    </button>
                  </form>
                </div>
                <div
                  className="task-board__column-body"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDropOnSection(section.id)}
                >
                  {tasksForSection(section.id).map((task) => (
                    <div className="task-board__card" draggable key={task.id} onDragStart={() => setDragTaskId(task.id)}>
                      <div className={`task-board__priority task-board__priority--${task.priority}`}>{priorityLabel(task.priority)}</div>
                      <p className="task-board__card-title">{task.title}</p>
                      {task.due_at ? <p className="muted">{new Date(task.due_at).toLocaleString()}</p> : null}
                      <form action={deleteFusionBoardTask}>
                        <input name="taskId" type="hidden" value={task.id} />
                        <button className="text-link text-link--danger" type="submit">
                          <Trash2 size={12} />
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
                <details className="task-board__add-task">
                  <summary>
                    <Plus size={13} /> Add task
                  </summary>
                  <form action={assignFusionClientTask}>
                    <input name="clientId" type="hidden" value={selectedClient.id} />
                    <input name="projectId" type="hidden" value={selectedClient.project_id || ""} />
                    <input name="sectionId" type="hidden" value={section.id} />
                    <FusionInput name="title" placeholder="Task title" required />
                    <FusionTextarea name="description" placeholder="Details (optional)" />
                    <FusionSelect defaultValue="medium" name="priority">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </FusionSelect>
                    <FusionInput name="dueAt" type="datetime-local" />
                    <FusionSubmitButton className="compact-button" pendingLabel="Adding...">
                      Add task
                    </FusionSubmitButton>
                  </form>
                </details>
              </div>
            ))}

            <div
              className="task-board__column task-board__column--empty"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDropOnSection(null)}
            >
              <div className="task-board__column-heading">
                <h3>No section</h3>
                <span className="status-pill">{tasksForSection(null).length}</span>
              </div>
              <div className="task-board__column-body">
                {tasksForSection(null).map((task) => (
                  <div className="task-board__card" draggable key={task.id} onDragStart={() => setDragTaskId(task.id)}>
                    <div className={`task-board__priority task-board__priority--${task.priority}`}>{priorityLabel(task.priority)}</div>
                    <p className="task-board__card-title">{task.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <form action={createFusionTaskSection} className="task-board__new-section">
            <input name="projectId" type="hidden" value={selectedClient.project_id || ""} />
            <FusionInput name="name" placeholder="New section name (e.g. In Progress)" required />
            <FusionSubmitButton className="compact-button" pendingLabel="Creating...">
              + Add section
            </FusionSubmitButton>
          </form>
        </div>
      ) : (
        <div className="admin-panel">
          <table className="fusion-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Client</th>
                <th>Project</th>
                <th>Priority</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>{task.client_name || "—"}</td>
                  <td>{task.project_name || "—"}</td>
                  <td>
                    <span className={`task-board__priority task-board__priority--${task.priority}`}>{priorityLabel(task.priority)}</span>
                  </td>
                  <td>{task.due_at ? new Date(task.due_at).toLocaleString() : "—"}</td>
                  <td>{task.status}</td>
                </tr>
              ))}
              {!tasks.length ? (
                <tr>
                  <td className="admin-empty" colSpan={6}>
                    No tasks match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
