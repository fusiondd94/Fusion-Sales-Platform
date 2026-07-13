import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getFusionAdminUser } from "@/lib/auth";

export type ClientProject = {
  id: string;
  project_name: string;
  project_status: string;
  live_url: string | null;
  preview_url: string | null;
  current_phase: string;
  payment_status: string;
  client_instructions: string | null;
  updated_at: string;
};

export type ClientProjectComment = {
  id: string;
  author_user_id: string | null;
  author_name: string;
  author_role: string;
  body: string;
  page_url: string | null;
  marker_x: number | null;
  marker_y: number | null;
  status: string;
  created_at: string;
};

export type ClientProjectFile = {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size: number;
  description: string | null;
  created_at: string;
  signedUrl?: string | null;
};

export type ClientTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_at: string | null;
  created_at: string;
  completed_at: string | null;
};

export type ClientPortalWorkspace = {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  client: {
    id: string;
    customer_name: string;
    customer_email: string;
    company: string;
    status: string;
    onboarding_status: string | null;
  };
  project: ClientProject;
  comments: ClientProjectComment[];
  files: ClientProjectFile[];
  tasks: ClientTask[];
  isAdminPreview?: boolean;
  availableClients?: Array<{
    id: string;
    customer_name: string;
    company: string;
  }>;
};

export type AdminClientPortalRecord = {
  id: string;
  customer_name: string;
  customer_email: string;
  company: string;
  status: string;
  portal_status: string | null;
  onboarding_status: string | null;
  portal_user_id: string | null;
  project?: ClientProject | null;
  commentCount?: number;
  fileCount?: number;
  recentComments?: ClientProjectComment[];
};

function displayNameFromEmail(email: string) {
  return email.split("@")[0] || email;
}

function cleanUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 140) || "upload";
}

async function getDefaultOrganizationId() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("crm_organizations")
    .select("id")
    .eq("slug", "fusion-digital-dynamics")
    .single<{ id: string }>();

  if (error || !data) return null;
  return data.id;
}

async function ensureClientProject(clientId: string, actorId?: string | null) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const { data: existing } = await supabase
    .from("crm_client_projects")
    .select("id, project_name, project_status, live_url, preview_url, current_phase, client_instructions, payment_status, updated_at")
    .eq("client_id", clientId)
    .single<ClientProject>();

  if (existing) return existing;

  const organizationId = await getDefaultOrganizationId();
  const { data, error } = await supabase
    .from("crm_client_projects")
    .insert({
      organization_id: organizationId,
      client_id: clientId,
      created_by: actorId || null,
      updated_by: actorId || null
    })
    .select("id, project_name, project_status, live_url, preview_url, current_phase, client_instructions, payment_status, updated_at")
    .single<ClientProject>();

  if (error || !data) return null;
  return data;
}

async function getSignedFileUrl(storagePath: string) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const { data } = await supabase.storage
    .from("client-project-files")
    .createSignedUrl(storagePath, 60 * 15);

  return data?.signedUrl || null;
}

async function getAvailablePortalClients() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("crm_clients")
    .select("id, customer_name, company")
    .order("created_at", { ascending: false })
    .limit(100);

  return data || [];
}

function adminPreviewProject(): ClientProject {
  return {
    id: "admin-preview-project",
    project_name: "Admin Client Portal Preview",
    project_status: "preview",
    live_url: null,
    preview_url: null,
    current_phase: "Portal QA",
    client_instructions: "Create or select a client record to test comments, file uploads, and live website review tools.",
    updated_at: new Date().toISOString()
  };
}

async function buildPortalWorkspace(input: {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  client: ClientPortalWorkspace["client"];
  actorId?: string | null;
  isAdminPreview?: boolean;
  availableClients?: ClientPortalWorkspace["availableClients"];
}) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const project = await ensureClientProject(input.client.id, input.actorId || input.user.id);
  if (!project) return null;

  const [{ data: comments }, { data: files }, { data: tasks }] = await Promise.all([
    supabase
      .from("crm_project_comments")
      .select("id, author_user_id, author_name, author_role, body, page_url, marker_x, marker_y, status, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("crm_project_files")
      .select("id, file_name, file_type, file_size, description, storage_path, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("crm_tasks")
      .select("id, title, description, status, due_at, created_at, completed_at")
      .eq("client_id", input.client.id)
      .eq("client_visible", true)
      .order("created_at", { ascending: false })
      .limit(50)
  ]);

  const signedFiles = await Promise.all((files || []).map(async (file) => ({
    id: file.id,
    file_name: file.file_name,
    file_type: file.file_type,
    file_size: Number(file.file_size || 0),
    description: file.description,
    created_at: file.created_at,
    signedUrl: await getSignedFileUrl(file.storage_path)
  })));

  return {
    user: input.user,
    client: input.client,
    project,
    comments: (comments || []) as ClientProjectComment[],
    files: signedFiles,
    tasks: (tasks || []) as ClientTask[],
    isAdminPreview: input.isAdminPreview,
    availableClients: input.availableClients
  };
}

export async function getClientPortalWorkspace(clientId?: string): Promise<ClientPortalWorkspace | null> {
  const authClient = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authClient.auth.getUser();
  const user = authData.user;

  if (authError || !user?.email) return null;

  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const email = user.email.toLowerCase();
  const metadata = user.user_metadata as { full_name?: string; name?: string } | null;
  const admin = await getFusionAdminUser();
  const isAdmin = Boolean(admin?.isAllowed && admin.id === user.id);

  if (isAdmin) {
    const availableClients = await getAvailablePortalClients();
    const requestedClientId = clientId?.trim();
    const fallbackClientId = availableClients[0]?.id;
    const activeClientId = requestedClientId || fallbackClientId;

    if (!activeClientId) {
      return {
        user: {
          id: user.id,
          email,
          displayName: admin?.displayName || metadata?.full_name || metadata?.name || displayNameFromEmail(email)
        },
        client: {
          id: "admin-preview-client",
          customer_name: admin?.displayName || "Fusion Admin",
          customer_email: email,
          company: "Fusion Digital Dynamics LLC",
          status: "internal_preview",
          onboarding_status: "qa"
        },
        project: adminPreviewProject(),
        comments: [],
        files: [],
        isAdminPreview: true,
        availableClients
      };
    }

    const { data: adminClient } = await supabase
      .from("crm_clients")
      .select("id, customer_name, customer_email, company, status, onboarding_status")
      .eq("id", activeClientId)
      .single<ClientPortalWorkspace["client"]>();

    if (adminClient) {
      return buildPortalWorkspace({
        user: {
          id: user.id,
          email,
          displayName: admin?.displayName || metadata?.full_name || metadata?.name || displayNameFromEmail(email)
        },
        client: adminClient,
        actorId: user.id,
        isAdminPreview: true,
        availableClients
      });
    }
  }

  const { data: client, error: clientError } = await supabase
    .from("crm_clients")
    .select("id, customer_name, customer_email, company, status, onboarding_status, portal_user_id")
    .or(`portal_user_id.eq.${user.id},customer_email.eq.${email}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single<ClientPortalWorkspace["client"] & { portal_user_id?: string | null }>();

  if (clientError || !client) return null;

  if (!client.portal_user_id) {
    await supabase
      .from("crm_clients")
      .update({
        portal_user_id: user.id,
        portal_status: "active",
        updated_at: new Date().toISOString()
      })
      .eq("id", client.id)
      .is("portal_user_id", null);
  }

  return buildPortalWorkspace({
    user: {
      id: user.id,
      email,
      displayName: metadata?.full_name || metadata?.name || client.customer_name || displayNameFromEmail(email)
    },
    client: {
      id: client.id,
      customer_name: client.customer_name,
      customer_email: client.customer_email,
      company: client.company,
      status: client.status,
      onboarding_status: client.onboarding_status || null
    }
  });
}

export async function getAdminPortalClients(): Promise<AdminClientPortalRecord[]> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  const { data: clients } = await supabase
    .from("crm_clients")
    .select("id, customer_name, customer_email, company, status, portal_status, onboarding_status, portal_user_id")
    .order("created_at", { ascending: false })
    .limit(50);

  const safeClients = (clients || []) as AdminClientPortalRecord[];
  const projects = await Promise.all(safeClients.map((client) => ensureClientProject(client.id)));
  const projectByClientId = new Map(safeClients.map((client, index) => [client.id, projects[index] || null]));
  const projectIds = projects.map((project) => project?.id).filter(Boolean) as string[];
  const [{ data: comments }, { data: files }] = projectIds.length
    ? await Promise.all([
        supabase
          .from("crm_project_comments")
          .select("id, project_id, author_user_id, author_name, author_role, body, page_url, marker_x, marker_y, status, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("crm_project_files")
          .select("id, project_id")
          .in("project_id", projectIds)
      ])
    : [{ data: [] }, { data: [] }];
  const commentsByProjectId = new Map<string, ClientProjectComment[]>();
  const fileCountByProjectId = new Map<string, number>();

  for (const comment of comments || []) {
    const projectComments = commentsByProjectId.get(comment.project_id) || [];
    projectComments.push(comment as ClientProjectComment);
    commentsByProjectId.set(comment.project_id, projectComments);
  }

  for (const file of files || []) {
    fileCountByProjectId.set(file.project_id, (fileCountByProjectId.get(file.project_id) || 0) + 1);
  }

  return safeClients.map((client) => ({
    ...client,
    project: projectByClientId.get(client.id) || null,
    commentCount: projectByClientId.get(client.id)?.id ? commentsByProjectId.get(projectByClientId.get(client.id)!.id)?.length || 0 : 0,
    fileCount: projectByClientId.get(client.id)?.id ? fileCountByProjectId.get(projectByClientId.get(client.id)!.id) || 0 : 0,
    recentComments: projectByClientId.get(client.id)?.id ? (commentsByProjectId.get(projectByClientId.get(client.id)!.id) || []).slice(0, 3) : []
  }));
}

export async function updateClientProject(input: {
  actorId: string;
  clientId: string;
  projectName: string;
  projectStatus: string;
  liveUrl?: string;
  previewUrl?: string;
  currentPhase?: string;
  clientInstructions?: string;
  paymentStatus?: string;
}) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const project = await ensureClientProject(input.clientId, input.actorId);
  if (!project) return { ok: false, error: "Project could not be created." };

  const allowedStatuses = new Set(["not_started", "in_progress", "review", "done", "on_hold"]);
  const projectStatus = allowedStatuses.has(input.projectStatus) ? input.projectStatus : "in_progress";

  const { error } = await supabase
    .from("crm_client_projects")
    .update({
      project_name: input.projectName.trim() || "Website Project",
      project_status: projectStatus,
      live_url: cleanUrl(input.liveUrl || ""),
      preview_url: cleanUrl(input.previewUrl || input.liveUrl || ""),
      current_phase: input.currentPhase?.trim() || "Design Review",
      client_instructions: input.clientInstructions?.trim() || null,
      updated_by: input.actorId,
      updated_at: new Date().toISOString(),
      ...(input.paymentStatus ? { payment_status: input.paymentStatus } : {})
    })
    .eq("id", project.id);

  if (error) return { ok: false, error: "Unable to update project." };
  return { ok: true };
}

export async function createClientProjectComment(input: {
  body: string;
  pageUrl?: string;
  markerX?: number | null;
  markerY?: number | null;
  clientId?: string;
}) {
  const workspace = await getClientPortalWorkspace(input.clientId);
  if (!workspace) return { ok: false, error: "Sign in to comment on your project." };
  if (workspace.project.id === "admin-preview-project") return { ok: false, error: "Select a client before adding comments." };
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const safeBody = input.body.trim().replace(/<[^>]*>/g, "");
  if (!safeBody) return { ok: false, error: "Add a comment before sending." };

  const { error } = await supabase.from("crm_project_comments").insert({
    project_id: workspace.project.id,
    client_id: workspace.client.id,
    author_user_id: workspace.user.id,
    author_name: workspace.user.displayName,
    author_role: workspace.isAdminPreview ? "admin" : "client",
    body: safeBody,
    page_url: cleanUrl(input.pageUrl || workspace.project.preview_url || workspace.project.live_url || ""),
    marker_x: typeof input.markerX === "number" ? input.markerX : null,
    marker_y: typeof input.markerY === "number" ? input.markerY : null
  });

  if (error) return { ok: false, error: "Unable to save comment." };
  return { ok: true };
}

export async function uploadClientProjectFile(input: {
  file: File;
  description?: string;
  clientId?: string;
}) {
  const workspace = await getClientPortalWorkspace(input.clientId);
  if (!workspace) return { ok: false, error: "Sign in to upload files." };
  if (workspace.project.id === "admin-preview-project") return { ok: false, error: "Select a client before uploading files." };
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!input.file || input.file.size <= 0) return { ok: false, error: "Choose a file to upload." };
  if (input.file.size > 50 * 1024 * 1024) return { ok: false, error: "Files must be 50MB or smaller." };

  const storagePath = `${workspace.client.id}/${workspace.project.id}/${Date.now()}-${safeFileName(input.file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("client-project-files")
    .upload(storagePath, input.file, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false
    });

  if (uploadError) return { ok: false, error: "Unable to upload file." };

  const { error } = await supabase.from("crm_project_files").insert({
    project_id: workspace.project.id,
    client_id: workspace.client.id,
    uploaded_by: workspace.user.id,
    file_name: input.file.name,
    file_type: input.file.type || null,
    file_size: input.file.size,
    storage_path: storagePath,
    description: input.description?.trim() || null
  });

  if (error) return { ok: false, error: "File uploaded, but the portal record could not be saved." };
  return { ok: true };
}

export async function deleteProjectComment(input: {
  actorId: string;
  commentId: string;
  requireOwnership?: boolean;
}) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!input.commentId) return { ok: false, error: "Comment id is required." };

  if (input.requireOwnership) {
    const { data: existing } = await supabase
      .from("crm_project_comments")
      .select("id, author_user_id")
      .eq("id", input.commentId)
      .single<{ id: string; author_user_id: string | null }>();

    if (!existing || existing.author_user_id !== input.actorId) {
      return { ok: false, error: "You can only delete your own comments." };
    }
  }

  const { error } = await supabase
    .from("crm_project_comments")
    .delete()
    .eq("id", input.commentId);

  if (error) return { ok: false, error: "Unable to delete comment." };
  return { ok: true };
}

export async function resolveProjectComment(input: { commentId: string }) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!input.commentId) return { ok: false, error: "Comment id is required." };

  const { error } = await supabase
    .from("crm_project_comments")
    .update({ status: "resolved" })
    .eq("id", input.commentId);

  if (error) return { ok: false, error: "Unable to resolve comment." };
  return { ok: true };
}


export async function createClientTask(input: {
  clientId: string;
  title: string;
  description?: string;
  dueAt?: string;
}) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!input.title.trim()) return { ok: false, error: "Task title is required." };

  const organizationId = await getDefaultOrganizationId();

  const { error } = await supabase.from("crm_tasks").insert({
    organization_id: organizationId,
    client_id: input.clientId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    due_at: input.dueAt || null,
    status: "open",
    owner: "Fusion Design Team",
    task_type: "Client Task",
    client_visible: true
  });

  if (error) return { ok: false, error: "Unable to create task." };
  return { ok: true };
}

export async function updateClientTaskStatus(input: { taskId: string; status: string }) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!input.taskId) return { ok: false, error: "Task id is required." };

  const { error } = await supabase
    .from("crm_tasks")
    .update({
      status: input.status,
      completed_at: input.status === "completed" ? new Date().toISOString() : null
    })
    .eq("id", input.taskId);

  if (error) return { ok: false, error: "Unable to update task." };
  return { ok: true };
}
