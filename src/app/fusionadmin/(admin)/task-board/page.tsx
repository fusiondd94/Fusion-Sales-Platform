import { getAdminTaskBoard, getProjectTaskBoard } from "@/lib/portal";
import { PageHeader } from "../crm-ui";
import { TaskBoard } from "./TaskBoard";

type PageProps = {
  searchParams?: Promise<{ clientId?: string; search?: string }>;
};

export default async function FusionTaskBoardPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const clientId = params.clientId?.trim() || "";
  const search = params.search?.trim() || "";

  const board = await getAdminTaskBoard({ clientId: clientId || undefined, search: search || undefined });
  const selectedClient = clientId ? board.clients.find((client) => client.id === clientId) || null : null;

  const projectBoard = selectedClient?.project_id
    ? await getProjectTaskBoard({ clientId: selectedClient.id, projectId: selectedClient.project_id })
    : null;

  return (
    <div className="admin-content">
      <PageHeader
        description="Create sections per project, drag tasks between them, and monitor every client task in one place."
        eyebrow="Task Board"
        title="Client task board"
      />

      <TaskBoard
        clients={board.clients}
        projectBoard={projectBoard}
        search={search}
        selectedClient={selectedClient}
        selectedClientId={clientId}
        tasks={board.tasks}
      />
    </div>
  );
}
