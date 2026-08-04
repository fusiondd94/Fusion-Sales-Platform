import { AlertTriangle, CalendarRange, CheckCircle2, Send, Trash2, X } from "lucide-react";
import Link from "next/link";
import { getDraftBatch } from "@/lib/content";
import { PageHeader, EmptyState } from "@/app/fusionadmin/(admin)/crm-ui";
import { FormError } from "@/components/ui";
import { discardBulkDraftBatch, publishBulkDraftBatch, removeDraftPostFromBatch } from "./review-actions";
import "./review-append.css";

const VIDEO_EXTENSION_RE = /\.(mp4|mov|m4v|webm)(\?|$)/i;

function contentTypeLabel(contentType: string) {
  if (contentType === "reel") return "Reel";
  if (contentType === "story") return "Story";
  return "Feed post";
}

export default async function BulkReviewPage({
  searchParams
}: {
  searchParams: Promise<{
    batch?: string;
    draftFailed?: string;
    draftAi?: string;
    draftTemplate?: string;
    draftErrors?: string;
    publishError?: string;
  }>;
}) {
  const params = await searchParams;
  const batchId = params.batch || "";
  const posts = batchId ? await getDraftBatch(batchId) : [];
  const postIds = posts.map((post) => post.id).join(",");

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Marketing"
        title="Review before publishing"
        description="Nothing has been scheduled yet. Check each caption, remove anything that doesn't look right, then publish the batch."
        action={
          <Link className="secondary-button compact-button" href="/fusionadmin/content/bulk">
            <CalendarRange size={16} /> Back to bulk schedule
          </Link>
        }
      />

      <FormError message={params.publishError} />

      {!batchId || !posts.length ? (
        <EmptyState>
          {batchId
            ? "Nothing left to review in this batch — it may have already been published or discarded."
            : "No batch to review. Start a new one from the bulk scheduler."}
          <br />
          <Link className="secondary-button compact-button" href="/fusionadmin/content/bulk" style={{ marginTop: 12, display: "inline-flex" }}>
            Go to bulk scheduler
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="review-summary-banner">
            <CheckCircle2 aria-hidden="true" size={18} />
            <div>
              <strong>{posts.length} post{posts.length === 1 ? "" : "s"} ready to review</strong>
              <p className="muted">
                {params.draftAi && Number(params.draftAi) > 0 ? `${params.draftAi} caption${params.draftAi === "1" ? "" : "s"} written by Claude` : null}
                {params.draftAi && Number(params.draftAi) > 0 && params.draftTemplate && Number(params.draftTemplate) > 0 ? " · " : null}
                {params.draftTemplate && Number(params.draftTemplate) > 0
                  ? `${params.draftTemplate} caption${params.draftTemplate === "1" ? "" : "s"} used the template fallback`
                  : null}
                {params.draftFailed && Number(params.draftFailed) > 0 ? ` · ${params.draftFailed} file${params.draftFailed === "1" ? "" : "s"} could not be prepared` : null}
              </p>
              {params.draftErrors ? <p className="muted review-summary-errors">{params.draftErrors}</p> : null}
            </div>
          </div>

          <div className="review-post-grid">
            {posts.map((post) => {
              const mediaUrl = post.media_urls[0];
              const isVideo = mediaUrl ? VIDEO_EXTENSION_RE.test(mediaUrl) : false;
              return (
                <article className="admin-panel review-post-card" key={post.id}>
                  <div className="review-post-card__media">
                    {mediaUrl ? (
                      isVideo ? (
                        <video controls muted src={mediaUrl} />
                      ) : (
                        <img alt="" src={mediaUrl} />
                      )
                    ) : (
                      <div className="review-post-card__media-empty">No media</div>
                    )}
                  </div>
                  <div className="review-post-card__body">
                    <div className="review-post-card__head">
                      <span className="status-pill">{contentTypeLabel(post.content_type)}</span>
                      <form action={removeDraftPostFromBatch}>
                        <input name="postId" type="hidden" value={post.id} />
                        <input name="batchId" type="hidden" value={batchId} />
                        <button aria-label="Remove this post from the batch" className="ghost-button compact-button" title="Remove from batch" type="submit">
                          <X size={14} />
                        </button>
                      </form>
                    </div>
                    <textarea
                      defaultValue={post.caption}
                      form="publish-batch-form"
                      name={`caption__${post.id}`}
                      rows={5}
                    />
                    <p className="muted review-post-card__time">
                      {new Date(post.scheduled_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" })}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="review-actions-bar">
            <form action={discardBulkDraftBatch}>
              <input name="batchId" type="hidden" value={batchId} />
              <button className="ghost-button" type="submit">
                <Trash2 size={16} /> Discard entire batch
              </button>
            </form>
            <form action={publishBulkDraftBatch} id="publish-batch-form">
              <input name="batchId" type="hidden" value={batchId} />
              <input name="postIds" type="hidden" value={postIds} />
              <button className="primary-button" type="submit">
                <Send size={16} /> Publish everything ({posts.length})
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
