"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileUp, LogOut, MessageSquarePlus, Monitor, MousePointer2, Send, Smartphone, Tablet, Trash2, X } from "lucide-react";
import { addProjectComment, deleteOwnProjectComment, signOutClientPortal, uploadProjectFile } from "@/app/portal/actions";
import type { ClientPortalWorkspace } from "@/lib/portal";

const DEFAULT_FRAME_HEIGHT = 1400;

function clampPercent(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeUrl(url: string | null | undefined) {
  if (!url) return "";
  return url.split("#")[0].replace(/\/$/, "");
}

export function PortalWorkspace({ workspace, highlightCommentId }: { workspace: ClientPortalWorkspace; highlightCommentId?: string }) {
  const [commentMode, setCommentMode] = useState(false);
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);
  const [frameHeight, setFrameHeight] = useState(DEFAULT_FRAME_HEIGHT);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [commentsTab, setCommentsTab] = useState<"active" | "resolved">("active");
  const [activeTool, setActiveTool] = useState<"review" | "uploads">("review");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
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

        <div className="portal-layout">
        <aside className="portal-sidebar">
          <button className={activeTool === "review" ? "portal-sidebar__link portal-sidebar__link--active" : "portal-sidebar__link"} onClick={() => setActiveTool("review")} type="button">
            <MousePointer2 size={16} /> Website Review
          </button>
          <button className={activeTool === "uploads" ? "portal-sidebar__link portal-sidebar__link--active" : "portal-sidebar__link"} onClick={() => setActiveTool("uploads")} type="button">
            <FileUp size={16} /> Uploads
          </button>
        </aside>
        <div className="portal-main">
          {activeTool === "review" ? (
            <section className="portal-workspace-grid">
              <article className="admin-panel portal-preview-panel">
            <div className="panel-heading">
                  <h2><MousePointer2 size={20} /> Website review</h2>
                  <div className="portal-toolbar">
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
                </div>
            {workspace.project.client_instructions ? <p className="muted">{workspace.project.client_instructions}</p> : null}
            {commentMode ? <p className="muted comment-mode-hint">Click anywhere on the preview to drop a comment pin at that exact spot.</p> : null}
            {previewUrl ? (
              <div className={"preview-frame-wrap preview-frame-wrap--" + viewport}>
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
              >
                <iframe
                  onLoad={handleFrameLoad}
                  ref={iframeRef}
                  src={previewUrl}
                  style={{ height: frameHeight }}
                  title={`${workspace.project.project_name} preview`}
                />
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

            <form className="quick-form portal-comment-form" action={addProjectComment}>
              <input name="clientId" type="hidden" value={selectedClientId} />
              <input name="pageUrl" type="hidden" value={currentPageUrl} />
              <input name="markerX" type="hidden" value="" />
              <input name="markerY" type="hidden" value="" />
              <textarea aria-label="Project comment" disabled={!canSubmitPortalWork} name="body" placeholder="Leave a general project comment about the site overall." required />
              <button className="primary-button" disabled={!canSubmitPortalWork} type="submit"><Send size={16} /> Send comment</button>
            </form>
          </article>
              <aside className="portal-side-stack">
                <article className="admin-panel">
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
                      <span className="status-pill">{comment.status}</span>
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
                {!visibleComments.length ? <p className="admin-empty">{commentsTab === "active" ? "No active comments." : "No resolved comments yet."}</p> : null}
              </div>
            </article>
              </aside>
            </section>
          ) : (
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
          )}
        </div>
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
