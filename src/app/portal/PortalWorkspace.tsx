"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCircle2, Circle, Clock, Download, Eye, FileUp, GripVertical, LayoutDashboard, ListChecks, LogOut, MessageSquarePlus, Monitor, MousePointer2, Send, Smartphone, Tablet, Trash2, X } from "lucide-react";
import { addProjectComment, deleteOwnProjectComment, markAllOwnNotificationsRead, markOwnNotificationRead, reorderOwnBoardTasks, signOutClientPortal, updateOwnClientTaskStatus, uploadProjectFile } from "@/app/portal/actions";
import type { ClientPortalWorkspace } from "@/lib/portal";

const DEFAULT_FRAME_HEIGHT = 1400;
const DESKTOP_FIT_WIDTH = 1280;

function clampPercent(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeUrl(url: string | null | undefined) {
  if (!url) return "";
  return url.split("#")[0].replace(/\/$/, "");
}

const PORTAL_PHASES = ["Discovery", "Design", "Development", "Client Review", "Launch"];

function getPhaseIndex(currentPhase: string | null | undefined) {
  return PORTAL_PHASES.findIndex((phase) => phase.toLowerCase() === (currentPhase || "").toLowerCase());
}

function getPhaseProgress(currentPhase: string | null | undefined, projectStatus: string | null | undefined) {
  if (projectStatus === "done" || projectStatus === "complete" || projectStatus === "completed") return 100;
  const idx = getPhaseIndex(currentPhase);
  if (idx === -1) return 15;
  return Math.round(((idx + 1) / PORTAL_PHASES.length) * 100);
}

export function PortalWorkspace({ workspace, highlightCommentId }: { workspace: ClientPortalWorkspace; highlightCommentId?: string }) {
  const [commentMode, setCommentMode] = useState(false);
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);
  const [frameHeight, setFrameHeight] = useState(DEFAULT_FRAME_HEIGHT);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [commentsTab, setCommentsTab] = useState<"active" | "resolved">("active");
  const [activeTool, setActiveTool] = useState<"review" | "uploads" | "dashboard" | "tasks">("review");
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadNotifCount = workspace.notifications.filter((notification) => !notification.read_at).length;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const [previewViewportWidth, setPreviewViewportWidth] = useState(0);
  const previewUrl = workspace.project.preview_url || workspace.project.live_url || "";
  const [currentPageUrl, setCurrentPageUrl] = useState(previewUrl);
  const openComments = useMemo(() => workspace.comments.filter((comment) => comment.status !== "resolved"), [workspace.comments]);
  const resolvedComments = useMemo(() => workspace.comments.filter((comment) => comment.status === "resolved"), [workspace.comments]);
  const pinNumberById = useMemo(() => {
    const map = new Map();
    [...openComments]
      .filter((comment) => comment.marker_x !== null && comment.marker_y !== null)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach((comment, index) => map.set(comment.id, index + 1));
    return map;
  }, [openComments]);
  const visibleComments = commentsTab === "active" ? openComments : resolvedComments;
  const selectedClientId = workspace.client.id.startsWith("admin-preview-") ? "" : workspace.client.id;
  const canSubmitPortalWork = workspace.project.id !== "admin-preview-project";

  function handleFrameLoad() {
    try {
      const doc = iframeRef.current?.contentDocument;
      const height = doc ? Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight || 0) : 0;
      if (height && height > 300) {
        setFrameHeight(height + 24);
      }
    } catch {
      // Cross-origin preview: can't read its content height, keep the generous default
      // so the page (not the iframe) does the scrolling and pins stay put.
    }
  }

  useEffect(() => {
    if (!previewUrl) return;
    const interval = setInterval(() => {
      const frame = iframeRef.current;
      if (!frame) return;
      let liveUrl = null;
      try {
        liveUrl = frame.contentWindow ? frame.contentWindow.location.href : null;
      } catch {
        // cross-origin preview: can't track in-frame navigation
        return;
      }
      if (!liveUrl || liveUrl === "about:blank") return;
      setCurrentPageUrl((prev) => {
        if (normalizeUrl(prev) === normalizeUrl(liveUrl)) return prev;
        // Only remeasure height on an actual page change so on-page scroll
        // animations (which grow scrollHeight) don't shift pins mid-scroll.
        try {
          const doc = frame.contentDocument;
          const height = doc ? Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight || 0) : 0;
          if (height && height > 300) setFrameHeight(height + 24);
        } catch {
          // cross-origin preview: can't read content height
        }
        return liveUrl;
      });
    }, 700);
    return () => clearInterval(interval);
  }, [previewUrl]);

  useEffect(() => {
    if (!highlightCommentId || !previewFrameRef.current) return;
    const target = workspace.comments.find((comment) => comment.id === highlightCommentId);
    if (!target || target.marker_y === null) return;
    if (target.page_url && normalizeUrl(target.page_url) !== normalizeUrl(currentPageUrl) && iframeRef.current) {
      iframeRef.current.src = target.page_url;
      setCurrentPageUrl(target.page_url);
    }
    const frameTop = previewFrameRef.current.getBoundingClientRect().top + window.scrollY;
    const targetY = frameTop + (target.marker_y / 100) * frameHeight;
    window.scrollTo({ top: Math.max(targetY - 160, 0), behavior: "smooth" });
  }, [highlightCommentId, frameHeight, workspace.comments, currentPageUrl]);

  useEffect(() => {
    if (activeTool !== "review") return;
    const el = previewWrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPreviewViewportWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeTool]);

  // Desktop previews are rendered at a true desktop width (DESKTOP_FIT_WIDTH)
  // so the site lays out the same way it would on a real desktop, then the
  // whole rendered page is scaled down to fit the visible panel width. This
  // avoids horizontal scrolling while keeping comment-pin placement accurate,
  // since pins are positioned by percentage against the same (scaled) box.
  const desktopFitScale =
    viewport === "desktop" && previewViewportWidth > 0
      ? Math.min(1, previewViewportWidth / DESKTOP_FIT_WIDTH)
      : 1;

  return (
    <main className="shell client-portal-shell">
      <div className="admin-shell crm-shell">
        <nav className="nav admin-nav">
          <a className="brand" href="/">
            <span className="brand-mark">FDD</span>
            <span>Client Portal</span>
          </a>
          <form action={signOutClientPortal}>
            <button className="ghost-button" type="submit"><LogOut size={16} /> Sign out</button>
          </form>
          <div className="portal-notif-bell">
            <button className="ghost-button" onClick={() => setNotifOpen((value) => !value)} type="button">
              <Bell size={16} />
              {unreadNotifCount > 0 ? <span className="portal-notif-badge">{unreadNotifCount}</span> : null}
            </button>
            {notifOpen ? (
              <div className="portal-notif-dropdown">
                <div className="portal-notif-dropdown__heading">
                  <strong>Notifications</strong>
                  {unreadNotifCount > 0 ? (
                    <form action={markAllOwnNotificationsRead}>
                      <input name="clientId" type="hidden" value={selectedClientId} />
                      <button className="text-link" type="submit">Mark all read</button>
                    </form>
                  ) : null}
                </div>
                <div className="portal-notif-list">
                  {workspace.notifications.length ? (
                    workspace.notifications.map((notification) => (
                      <form action={markOwnNotificationRead} key={notification.id}>
                        <input name="notificationId" type="hidden" value={notification.id} />
                        <button className={notification.read_at ? "portal-notif-item" : "portal-notif-item portal-notif-item--unread"} type="submit">
                          <strong>{notification.title}</strong>
                          {notification.body ? <p>{notification.body}</p> : null}
                          <span className="muted">{new Date(notification.created_at).toLocaleString()}</span>
                        </button>
                      </form>
                    ))
                  ) : (
                    <p className="admin-empty">No notifications yet.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </nav>

        {workspace.isAdminPreview ? (
          <section className="portal-admin-preview">
            <div>
              <p className="eyebrow">Admin portal preview</p>
              <h2><Eye size={19} /> Roam the client portal</h2>
              <p className="muted">You are viewing the portal as an admin. Switch clients to test comments, uploads, preview links, and project status.</p>
            </div>
            <form className="portal-client-switcher" action="/portal">
              <label>
                Client
                <select name="clientId" defaultValue={selectedClientId}>
                  {workspace.availableClients?.map((client) => (
                    <option key={client.id} value={client.id}>{client.company || client.customer_name}</option>
                  ))}
                </select>
              </label>
              <button className="secondary-button compact-button" type="submit">View client</button>
            </form>
          </section>
        ) : null}

        {activeTool !== "review" ? (
          <section className="portal-hero">
            <div>
              <p className="eyebrow">Project workspace</p>
              <h1>{workspace.project.project_name}</h1>
              <p className="hero-copy">{workspace.client.company} · {workspace.project.current_phase}</p>
            </div>
            <div className="portal-status-strip">
              <span>{workspace.project.project_status.replace("_", " ")}</span>
              <strong>{openComments.length}</strong>
              <span>open comments</span>
            </div>
          </section>
        ) : null}

        <div className="portal-toolbar-bar">
          <div className="portal-tool-tabs">
            <button className={activeTool === "review" ? "portal-tool-tab portal-tool-tab--active" : "portal-tool-tab"} onClick={() => setActiveTool("review")} type="button">
              <MousePointer2 size={16} /> <span>Website Review</span>
            </button>
            <button className={activeTool === "uploads" ? "portal-tool-tab portal-tool-tab--active" : "portal-tool-tab"} onClick={() => setActiveTool("uploads")} type="button">
              <FileUp size={16} /> <span>Uploads</span>
            </button>
            <button className={activeTool === "dashboard" ? "portal-tool-tab portal-tool-tab--active" : "portal-tool-tab"} onClick={() => setActiveTool("dashboard")} type="button">
              <LayoutDashboard size={16} /> <span>Dashboard</span>
            </button>
            <button className={activeTool === "tasks" ? "portal-tool-tab portal-tool-tab--active" : "portal-tool-tab"} onClick={() => setActiveTool("tasks")} type="button">
              <ListChecks size={16} /> <span>Tasks</span>
            </button>
          </div>

          {activeTool === "review" && previewUrl ? (
            <div className="portal-toolbar-bar__center">
              <div className="viewport-switch">
                <button aria-label="Desktop view" className={viewport === "desktop" ? "viewport-switch__btn viewport-switch__btn--active" : "viewport-switch__btn"} onClick={() => setViewport("desktop")} type="button">
                  <Monitor size={15} />
                </button>
                <button aria-label="Tablet view" className={viewport === "tablet" ? "viewport-switch__btn viewport-switch__btn--active" : "viewport-switch__btn"} onClick={() => setViewport("tablet")} type="button">
                  <Tablet size={15} />
                </button>
                <button aria-label="Mobile view" className={viewport === "mobile" ? "viewport-switch__btn viewport-switch__btn--active" : "viewport-switch__btn"} onClick={() => setViewport("mobile")} type="button">
                  <Smartphone size={15} />
                </button>
              </div>
              <div className="comment-mode-toggle">
                <button
                  className={commentMode ? "comment-mode-toggle__btn comment-mode-toggle__btn--active" : "comment-mode-toggle__btn"}
                  onClick={() => setCommentMode(true)}
                  type="button"
                >
                  <MessageSquarePlus size={14} /> Comment
                </button>
                <button
                  className={!commentMode ? "comment-mode-toggle__btn comment-mode-toggle__btn--active" : "comment-mode-toggle__btn"}
                  onClick={() => { setCommentMode(false); setMarker(null); }}
                  type="button"
                >
                  <MousePointer2 size={14} /> Browse
                </button>
              </div>
            </div>
          ) : (
            <div className="portal-toolbar-bar__center" />
          )}

          <div className="portal-toolbar-bar__meta">
            <span className={`status-pill status-pill--${workspace.project.project_status}`}>
              {(workspace.project.project_status || "").replace("_", " ")}
            </span>
          </div>
        </div>

        <div className="portal-main portal-main--full">
          {activeTool === "review" ? (
            <section className="portal-workspace-grid">
              <aside className="portal-side-stack portal-comments-rail">
                <article className="admin-panel portal-comments-panel">
                  <div className="panel-heading">
                    <h2>Comments</h2>
                    <div className="comment-tabs">
                      <button className={commentsTab === "active" ? "comment-tab comment-tab--active" : "comment-tab"} onClick={() => setCommentsTab("active")} type="button">
                        {openComments.length} Active
                      </button>
                      <button className={commentsTab === "resolved" ? "comment-tab comment-tab--active" : "comment-tab"} onClick={() => setCommentsTab("resolved")} type="button">
                        {resolvedComments.length} Resolved
                      </button>
                    </div>
                  </div>
                  <div className="timeline-list">
                    {visibleComments.map((comment) => (
                      <div className={comment.id === highlightCommentId ? "timeline-item timeline-item--target" : "timeline-item"} key={comment.id}>
                        {pinNumberById.get(comment.id) ? <span className="timeline-item__number">{pinNumberById.get(comment.id)}</span> : null}
                        <p>
                          <strong>{comment.author_name}</strong>
                          <br />
                          <span className="muted">{comment.body}</span>
                          <br />
                          <span className={`status-pill status-pill--${comment.status}`}>{comment.status}</span>
                        </p>
                        {comment.author_user_id === workspace.user.id ? (
                          <form action={deleteOwnProjectComment}>
                            <input name="clientId" type="hidden" value={selectedClientId} />
                            <input name="commentId" type="hidden" value={comment.id} />
                            <button aria-label="Delete comment" className="timeline-item__delete" type="submit"><Trash2 size={14} /></button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                    {!visibleComments.length ? (
                      <div className="portal-comments-empty">
                        <MessageSquarePlus size={22} />
                        <p>{commentsTab === "active" ? "Click anywhere on the preview to leave a comment." : "No resolved comments yet."}</p>
                      </div>
                    ) : null}
                  </div>
                  <form className="quick-form portal-comment-form" action={addProjectComment}>
                    <input name="clientId" type="hidden" value={selectedClientId} />
                    <input name="pageUrl" type="hidden" value={currentPageUrl} />
                    <input name="markerX" type="hidden" value="" />
                    <input name="markerY" type="hidden" value="" />
                    <textarea aria-label="Project comment" disabled={!canSubmitPortalWork} name="body" placeholder="Leave a general comment about the site overall." required />
                    <button className="primary-button compact-button" disabled={!canSubmitPortalWork} type="submit"><Send size={14} /> Send comment</button>
                  </form>
                </article>
              </aside>

              <article className="admin-panel portal-preview-panel">
                {workspace.project.client_instructions ? <p className="muted portal-preview-note">{workspace.project.client_instructions}</p> : null}
                {commentMode ? <p className="muted comment-mode-hint">Click anywhere on the preview to drop a comment pin at that exact spot.</p> : null}
                {previewUrl ? (
                  <div className={"preview-frame-wrap preview-frame-wrap--" + viewport} ref={previewWrapRef}>
                    <div
                      className={commentMode ? "preview-frame comment-mode" : "preview-frame"}
                      onClick={(event) => {
                        if (!commentMode) return;
                        const box = event.currentTarget.getBoundingClientRect();
                        setMarker({
                          x: Number((((event.clientX - box.left) / box.width) * 100).toFixed(3)),
                          y: Number((((event.clientY - box.top) / box.height) * 100).toFixed(3))
                        });
                      }}
                      ref={previewFrameRef}
                      style={viewport === "desktop" ? { height: frameHeight * desktopFitScale } : undefined}
                    >
                      <div
                        className="preview-frame-scaler"
                        style={
                          viewport === "desktop"
                            ? { width: DESKTOP_FIT_WIDTH, height: frameHeight, transform: `scale(${desktopFitScale})`, transformOrigin: "top left" }
                            : undefined
                        }
                      >
                        <iframe
                          onLoad={handleFrameLoad}
                          ref={iframeRef}
                          src={previewUrl}
                          style={{ height: frameHeight, width: viewport === "desktop" ? DESKTOP_FIT_WIDTH : undefined }}
                          title={`${workspace.project.project_name} preview`}
                        />
                      </div>
                      <div className="comment-layer" aria-hidden={!commentMode}>
                        {workspace.comments.filter((comment) => comment.marker_x !== null && comment.marker_y !== null && normalizeUrl(comment.page_url) === normalizeUrl(currentPageUrl)).map((comment) => (
                          <span
                            className={
                              (comment.status === "resolved" ? "comment-pin resolved" : "comment-pin") +
                              (comment.id === highlightCommentId ? " comment-pin--target" : "")
                            }
                            key={comment.id}
                            style={{ left: `${comment.marker_x}%`, top: `${comment.marker_y}%` }}
                            title={comment.body}
                          >
                            {pinNumberById.get(comment.id) || ""}
                          </span>
                        ))}
                        {marker ? <span className="comment-pin draft" style={{ left: `${marker.x}%`, top: `${marker.y}%` }} /> : null}
                        {marker ? (
                          <div
                            className="comment-popup"
                            onClick={(event) => event.stopPropagation()}
                            style={{ left: `${clampPercent(marker.x, 4, 78)}%`, top: `${clampPercent(marker.y, 4, 82)}%` }}
                          >
                            <div className="comment-popup__head">
                              <span>New comment</span>
                              <button
                                aria-label="Cancel comment"
                                className="comment-popup__close"
                                onClick={() => setMarker(null)}
                                type="button"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <form action={addProjectComment} className="quick-form" onSubmit={() => setMarker(null)}>
                              <input name="clientId" type="hidden" value={selectedClientId} />
                              <input name="pageUrl" type="hidden" value={currentPageUrl} />
                              <input name="markerX" type="hidden" value={marker.x} />
                              <input name="markerY" type="hidden" value={marker.y} />
                              <textarea
                                aria-label="Project comment"
                                autoFocus
                                disabled={!canSubmitPortalWork}
                                name="body"
                                placeholder="Describe the change for this spot."
                                required
                              />
                              <button className="primary-button compact-button" disabled={!canSubmitPortalWork} type="submit"><Send size={14} /> Send</button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="portal-empty-preview">
                    <p className="eyebrow">Preview pending</p>
                    <h2>Fusion will add your project preview here.</h2>
                    <p className="muted">Once the admin pastes the preview link, your live website review will appear in this workspace.</p>
                  </div>
                )}
              </article>
            </section>
          ) : activeTool === "uploads" ? (
            <div className="portal-side-stack portal-uploads-view">
              <article className="admin-panel">
                <h2><FileUp size={20} /> Upload project files</h2>
                <form className="quick-form" action={uploadProjectFile}>
                  <input name="clientId" type="hidden" value={selectedClientId} />
                  <label>
                    Project file
                    <input disabled={!canSubmitPortalWork} name="file" type="file" required />
                  </label>
                  <textarea aria-label="File description" disabled={!canSubmitPortalWork} name="description" placeholder="What is this file for? Logo, copy, inspiration, photos..." />
                  <button className="secondary-button" disabled={!canSubmitPortalWork} type="submit"><FileUp size={16} /> Upload file</button>
                </form>
              </article>
              <article className="admin-panel">
                <div className="panel-heading">
                  <h2>Uploaded files</h2>
                  <span className="status-pill">{workspace.files.length}</span>
                </div>
                <div className="stack-list">
                  {workspace.files.map((file) => (
                    <p key={file.id}>
                      <strong>{file.file_name}</strong>
                      <br />
                      <span className="muted">{formatFileSize(file.file_size)} · {file.description || "No note"}</span>
                      {file.signedUrl ? (
                        <>
                          <br />
                          <a className="text-link" href={file.signedUrl}><Download size={14} /> Download</a>
                        </>
                      ) : null}
                    </p>
                  ))}
                  {!workspace.files.length ? <p className="admin-empty">No files uploaded yet.</p> : null}
                </div>
              </article>
            </div>
          ) : activeTool === "dashboard" ? (
            <DashboardView workspace={workspace} />
          ) : (
            <TasksView workspace={workspace} />
          )}
        </div>
      </div>
    </main>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}


function DashboardView({ workspace }: { workspace: ClientPortalWorkspace }) {
  const progress = getPhaseProgress(workspace.project.current_phase, workspace.project.project_status);
  const currentIndex = getPhaseIndex(workspace.project.current_phase);
  const paymentStatus = workspace.project.payment_status || "unpaid";
  const paymentLabel = paymentStatus === "paid" ? "Paid" : paymentStatus === "partial" ? "Partially paid" : "Unpaid";

  return (
    <div className="portal-side-stack portal-dashboard-view">
      <article className="admin-panel">
        <div className="panel-heading">
          <h2>Project progress</h2>
          <span className={`status-pill status-pill--${paymentStatus}`}>{paymentLabel}</span>
        </div>
        <p className="muted">{workspace.project.project_name}</p>
        <div className="dashboard-progress-bar">
          <div className="dashboard-progress-bar__fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="muted dashboard-progress-label">{progress}% complete · Currently in {workspace.project.current_phase || "Discovery"}</p>
        <ul className="dashboard-milestones">
          {PORTAL_PHASES.map((phase, index) => {
            const state = currentIndex === -1 ? (index === 0 ? "current" : "upcoming") : index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
            return (
              <li className={`dashboard-milestone dashboard-milestone--${state}`} key={phase}>
                {state === "done" ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                <span>{phase}</span>
              </li>
            );
          })}
        </ul>
      </article>
      <article className="admin-panel">
        <h2>Project details</h2>
        <div className="dashboard-detail-grid">
          <div>
            <span className="muted">Status</span>
            <p>{(workspace.project.project_status || "in_progress").replace("_", " ")}</p>
          </div>
          <div>
            <span className="muted">Payment</span>
            <p>{paymentStatus === "paid" ? "Paid in full" : paymentStatus === "partial" ? "Partially paid" : "Payment due"}</p>
          </div>
          {workspace.project.live_url ? (
            <div>
              <span className="muted">Live site</span>
              <p><a className="text-link" href={workspace.project.live_url} rel="noreferrer" target="_blank">{workspace.project.live_url}</a></p>
            </div>
          ) : null}
        </div>
        {workspace.project.client_instructions ? <p className="muted">{workspace.project.client_instructions}</p> : null}
      </article>
    </div>
  );
}

function priorityLabel(priority: string) {
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Medium";
}

function TasksView({ workspace }: { workspace: ClientPortalWorkspace }) {
  const [sections, setSections] = useState(workspace.sections);
  const [boardTasks, setBoardTasks] = useState(workspace.tasks);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  useEffect(() => {
    setSections(workspace.sections);
    setBoardTasks(workspace.tasks);
  }, [workspace]);

  const tasksForSection = (sectionId: string | null) =>
    boardTasks
      .filter((task) => task.section_id === sectionId)
      .sort((a, b) => a.position - b.position);

  const handleDropOnSection = async (targetSectionId: string | null) => {
    if (!dragTaskId) return;
    const draggedId = dragTaskId;
    setDragTaskId(null);
    const dragged = boardTasks.find((task) => task.id === draggedId);
    if (!dragged) return;

    const destination = boardTasks.filter(
      (task) => task.section_id === targetSectionId && task.id !== draggedId
    );
    destination.push({ ...dragged, section_id: targetSectionId });

    const updates = destination.map((task, index) => ({
      taskId: task.id,
      sectionId: targetSectionId,
      position: index,
    }));

    setBoardTasks((prev) =>
      prev.map((task) => {
        const match = updates.find((update) => update.taskId === task.id);
        return match ? { ...task, section_id: match.sectionId, position: match.position } : task;
      })
    );

    await reorderOwnBoardTasks(updates);
  };

  const sectionList = [...sections, { id: "__unsectioned", name: "No section", position: sections.length }];

  return (
    <div className="portal-side-stack portal-tasks-view">
      <article className="admin-panel">
        <div className="panel-heading">
          <h2>Your tasks</h2>
          <span className="status-pill">
            {boardTasks.filter((task) => task.status !== "completed").length} open
          </span>
        </div>
        <div className="task-board__columns">
          {sectionList.map((section) => {
            const sectionId = section.id === "__unsectioned" ? null : section.id;
            const sectionTasks = tasksForSection(sectionId);
            return (
              <div
                className="task-board__column"
                key={section.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDropOnSection(sectionId)}
              >
                <div className="task-board__column-heading">
                  <div className="task-board__column-heading-label">
                    <GripVertical size={14} />
                    <span>{section.name}</span>
                  </div>
                  <span className="status-pill">{sectionTasks.length}</span>
                </div>
                <div className="task-board__column-body">
                  {sectionTasks.map((task) => (
                    <div
                      className="task-board__card"
                      draggable
                      key={task.id}
                      onDragStart={() => setDragTaskId(task.id)}
                    >
                      <div className="task-board__card-top">
                        <span className="task-board__card-title">{task.title}</span>
                        <span className={`task-board__priority task-board__priority--${task.priority}`}>
                          {priorityLabel(task.priority)}
                        </span>
                      </div>
                      {task.description ? <p className="muted">{task.description}</p> : null}
                      <div className="task-board__card-meta">
                        <span>
                          {task.due_at
                            ? new Date(task.due_at).toLocaleString(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "No due date"}
                        </span>
                        {task.status !== "completed" ? (
                          <form action={updateOwnClientTaskStatus}>
                            <input name="taskId" type="hidden" value={task.id} />
                            <input name="status" type="hidden" value="completed" />
                            <button className="secondary-button compact-button" type="submit">
                              <CheckCircle2 size={14} /> Done
                            </button>
                          </form>
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                      </div>
                    </div>
                  ))}
                  {!sectionTasks.length ? <p className="admin-empty">No tasks here.</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}
