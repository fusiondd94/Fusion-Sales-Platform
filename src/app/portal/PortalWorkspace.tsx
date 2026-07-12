"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Eye, FileUp, LogOut, MessageSquarePlus, MousePointer2, Send, X } from "lucide-react";
import { addProjectComment, signOutClientPortal, uploadProjectFile } from "@/app/portal/actions";
import type { ClientPortalWorkspace } from "@/lib/portal";

const DEFAULT_FRAME_HEIGHT = 1400;

function clampPercent(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function PortalWorkspace({ workspace }: { workspace: ClientPortalWorkspace }) {
  const [commentMode, setCommentMode] = useState(false);
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);
  const [frameHeight, setFrameHeight] = useState(DEFAULT_FRAME_HEIGHT);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewUrl = workspace.project.preview_url || workspace.project.live_url || "";
  const openComments = useMemo(() => workspace.comments.filter((comment) => comment.status !== "resolved"), [workspace.comments]);
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

  return (
    <main className="shell">
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

        <section className="portal-workspace-grid">
          <article className="admin-panel portal-preview-panel">
            <div className="panel-heading">
              <h2><MousePointer2 size={20} /> Website review</h2>
              <button
                className={commentMode ? "primary-button compact-button" : "secondary-button compact-button"}
                onClick={() => {
                  setCommentMode((value) => !value);
                  setMarker(null);
                }}
                type="button"
              >
                <MessageSquarePlus size={16} /> Comment tool
              </button>
            </div>
            {workspace.project.client_instructions ? <p className="muted">{workspace.project.client_instructions}</p> : null}
            {commentMode ? <p className="muted comment-mode-hint">Click anywhere on the preview to drop a comment pin at that exact spot.</p> : null}
            {previewUrl ? (
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
              >
                <iframe
                  onLoad={handleFrameLoad}
                  ref={iframeRef}
                  src={previewUrl}
                  style={{ height: frameHeight }}
                  title={`${workspace.project.project_name} preview`}
                />
                <div className="comment-layer" aria-hidden={!commentMode}>
                  {workspace.comments.filter((comment) => comment.marker_x !== null && comment.marker_y !== null).map((comment) => (
                    <span
                      className={comment.status === "resolved" ? "comment-pin resolved" : "comment-pin"}
                      key={comment.id}
                      style={{ left: `${comment.marker_x}%`, top: `${comment.marker_y}%` }}
                      title={comment.body}
                    />
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
                        <input name="pageUrl" type="hidden" value={previewUrl} />
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
            ) : (
              <div className="portal-empty-preview">
                <p className="eyebrow">Preview pending</p>
                <h2>Fusion will add your project preview here.</h2>
                <p className="muted">Once the admin pastes the preview link, your live website review will appear in this workspace.</p>
              </div>
            )}

            <form className="quick-form portal-comment-form" action={addProjectComment}>
              <input name="clientId" type="hidden" value={selectedClientId} />
              <input name="pageUrl" type="hidden" value={previewUrl} />
              <input name="markerX" type="hidden" value="" />
              <input name="markerY" type="hidden" value="" />
              <textarea aria-label="Project comment" disabled={!canSubmitPortalWork} name="body" placeholder="Leave a general project comment about the site overall." required />
              <button className="primary-button" disabled={!canSubmitPortalWork} type="submit"><Send size={16} /> Send comment</button>
            </form>
          </article>

          <aside className="portal-side-stack">
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

            <article className="admin-panel">
              <div className="panel-heading">
                <h2>Comments</h2>
                <span className="status-pill">{workspace.comments.length}</span>
              </div>
              <div className="timeline-list">
                {workspace.comments.map((comment) => (
                  <p key={comment.id}>
                    <strong>{comment.author_name}</strong>
                    <br />
                    <span className="muted">{comment.body}</span>
                    <br />
                    <span className="status-pill">{comment.status}</span>
                  </p>
                ))}
                {!workspace.comments.length ? <p className="admin-empty">No comments yet.</p> : null}
              </div>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
