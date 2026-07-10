"use client";

import { useMemo, useState } from "react";
import { Download, FileUp, LogOut, MessageSquarePlus, MousePointer2, Send } from "lucide-react";
import { addProjectComment, signOutClientPortal, uploadProjectFile } from "@/app/portal/actions";
import type { ClientPortalWorkspace } from "@/lib/portal";

export function PortalWorkspace({ workspace }: { workspace: ClientPortalWorkspace }) {
  const [commentMode, setCommentMode] = useState(false);
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);
  const previewUrl = workspace.project.preview_url || workspace.project.live_url || "";
  const openComments = useMemo(() => workspace.comments.filter((comment) => comment.status !== "resolved"), [workspace.comments]);

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
                onClick={() => setCommentMode((value) => !value)}
                type="button"
              >
                <MessageSquarePlus size={16} /> Comment tool
              </button>
            </div>
            {workspace.project.client_instructions ? <p className="muted">{workspace.project.client_instructions}</p> : null}
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
                <iframe src={previewUrl} title={`${workspace.project.project_name} preview`} />
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
              <input name="pageUrl" type="hidden" value={previewUrl} />
              <input name="markerX" type="hidden" value={marker?.x || ""} />
              <input name="markerY" type="hidden" value={marker?.y || ""} />
              <textarea name="body" placeholder={marker ? "Describe the change for this selected spot." : "Leave a general project comment or select the comment tool and click the preview."} required />
              <button className="primary-button" type="submit"><Send size={16} /> Send comment</button>
            </form>
          </article>

          <aside className="portal-side-stack">
            <article className="admin-panel">
              <h2><FileUp size={20} /> Upload project files</h2>
              <form className="quick-form" action={uploadProjectFile}>
                <input name="file" type="file" required />
                <textarea name="description" placeholder="What is this file for? Logo, copy, inspiration, photos..." />
                <button className="secondary-button" type="submit"><FileUp size={16} /> Upload file</button>
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
