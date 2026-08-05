"use client";

import { useMemo, useState } from "react";
import { Facebook, Instagram, LayoutGrid, List, MessageCircle, RefreshCcw, Repeat, Send, Trash2, XCircle } from "lucide-react";
import type { ContentPlatform, ContentPost } from "@/lib/content";
import "./content-list-append.css";

const PLATFORM_ICONS: Record<ContentPlatform, typeof Facebook> = {
  facebook_page: Facebook,
  instagram: Instagram,
  whatsapp_broadcast: MessageCircle
};

const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  facebook_page: "Facebook Page",
  instagram: "Instagram",
  whatsapp_broadcast: "WhatsApp"
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  image: "Feed post",
  carousel: "Carousel",
  story: "Story",
  reel: "Reel"
};

const DISPLAY_TIME_ZONE = "America/New_York";
const ALL_PLATFORMS: ContentPlatform[] = ["facebook_page", "instagram", "whatsapp_broadcast"];
const ALL_CONTENT_TYPES = ["image", "story", "reel", "carousel", "text"];

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: DISPLAY_TIME_ZONE });
}

// Batches (from the bulk scheduler) are the closest thing this app has to a
// "campaign" — every post created in one bulk run shares a batch_id. Posts
// scheduled one at a time have no batch_id and are grouped under
// "Individual posts" here.
function batchLabel(post: ContentPost): string {
  if (!post.batch_id) return "Individual posts";
  return `Batch — ${new Date(post.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: DISPLAY_TIME_ZONE })}`;
}

function toDateInputValue(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function toDateTimeLocal(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

type ActionProps = {
  updateAction?: (formData: FormData) => void;
  publishNowAction?: (formData: FormData) => void;
  cancelAction?: (formData: FormData) => void;
  deleteAction?: (formData: FormData) => void;
  repostAction?: (formData: FormData) => void;
  editRescheduleAction?: (formData: FormData) => void;
  retryAction?: (formData: FormData) => void;
};

export function ContentPostList({
  posts,
  channelStatus,
  scope,
  ...actions
}: ActionProps & {
  posts: ContentPost[];
  channelStatus: Record<ContentPlatform, boolean>;
  scope: "upcoming" | "history";
}) {
  const [view, setView] = useState<"grid" | "line">("grid");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [platformFilter, setPlatformFilter] = useState<ContentPlatform[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [batchFilter, setBatchFilter] = useState("all");

  const batchOptions = useMemo(() => {
    const seen = new Map<string, string>();
    posts.forEach((post) => {
      const key = post.batch_id || "none";
      if (!seen.has(key)) seen.set(key, batchLabel(post));
    });
    return Array.from(seen.entries());
  }, [posts]);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const dateKey = toDateInputValue(post.scheduled_at);
      if (dateFrom && dateKey < dateFrom) return false;
      if (dateTo && dateKey > dateTo) return false;
      if (platformFilter.length && !post.targets.some((target) => platformFilter.includes(target.platform))) return false;
      if (typeFilter.length && !typeFilter.includes(post.content_type)) return false;
      if (batchFilter !== "all") {
        const key = post.batch_id || "none";
        if (key !== batchFilter) return false;
      }
      return true;
    });
  }, [posts, dateFrom, dateTo, platformFilter, typeFilter, batchFilter]);

  function togglePlatform(platform: ContentPlatform) {
    setPlatformFilter((current) => (current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]));
  }

  function toggleType(type: string) {
    setTypeFilter((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setPlatformFilter([]);
    setTypeFilter([]);
    setBatchFilter("all");
  }

  const anyFilterActive = Boolean(dateFrom || dateTo || platformFilter.length || typeFilter.length || batchFilter !== "all");

  return (
    <div className="content-list-wrap">
      <div className="content-list-toolbar">
        <div className="content-list-filters">
          <label className="content-list-filter-field">
            <span>From</span>
            <input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
          </label>
          <label className="content-list-filter-field">
            <span>To</span>
            <input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
          </label>

          <div className="content-list-filter-field">
            <span>Platform</span>
            <div className="content-list-chip-row">
              {ALL_PLATFORMS.map((platform) => {
                const Icon = PLATFORM_ICONS[platform];
                const active = platformFilter.includes(platform);
                return (
                  <button
                    className={active ? "content-list-chip content-list-chip--active" : "content-list-chip"}
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    type="button"
                  >
                    <Icon size={12} /> {PLATFORM_LABELS[platform]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="content-list-filter-field">
            <span>Type</span>
            <div className="content-list-chip-row">
              {ALL_CONTENT_TYPES.map((type) => {
                const active = typeFilter.includes(type);
                return (
                  <button
                    className={active ? "content-list-chip content-list-chip--active" : "content-list-chip"}
                    key={type}
                    onClick={() => toggleType(type)}
                    type="button"
                  >
                    {CONTENT_TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="content-list-filter-field">
            <span>Batch / campaign</span>
            <select onChange={(event) => setBatchFilter(event.target.value)} value={batchFilter}>
              <option value="all">All</option>
              {batchOptions.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>

          {anyFilterActive ? (
            <button className="ghost-button compact-button" onClick={clearFilters} type="button">
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="content-list-view-toggle" role="group" aria-label="Layout">
          <button
            aria-pressed={view === "grid"}
            className={view === "grid" ? "content-list-view-button content-list-view-button--active" : "content-list-view-button"}
            onClick={() => setView("grid")}
            type="button"
          >
            <LayoutGrid size={15} /> Grid
          </button>
          <button
            aria-pressed={view === "line"}
            className={view === "line" ? "content-list-view-button content-list-view-button--active" : "content-list-view-button"}
            onClick={() => setView("line")}
            type="button"
          >
            <List size={15} /> Line
          </button>
        </div>
      </div>

      <p className="muted content-list-count">
        Showing {filteredPosts.length} of {posts.length} {scope === "upcoming" ? "upcoming" : "past"} post{posts.length === 1 ? "" : "s"}
      </p>

      {view === "grid" ? (
        <div className="content-post-list">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} channelStatus={channelStatus} scope={scope} {...actions} />
          ))}
          {!filteredPosts.length ? <p className="admin-empty">No posts match these filters.</p> : null}
        </div>
      ) : (
        <div className="content-list-table">
          <div className="content-list-table__head">
            <span>When</span>
            <span>Title</span>
            <span>Type</span>
            <span>Platforms</span>
            <span>Status</span>
            <span></span>
          </div>
          {filteredPosts.map((post) => (
            <PostRow key={post.id} post={post} channelStatus={channelStatus} scope={scope} {...actions} />
          ))}
          {!filteredPosts.length ? <p className="admin-empty">No posts match these filters.</p> : null}
        </div>
      )}
    </div>
  );
}

function TargetBadges({ post }: { post: ContentPost }) {
  return (
    <div className="content-post-card__targets">
      {post.targets.map((target) => {
        const Icon = PLATFORM_ICONS[target.platform];
        return (
          <span className={"content-target-badge content-target-badge--" + target.status} key={target.id} title={target.error || undefined}>
            <Icon size={13} /> {PLATFORM_LABELS[target.platform]} · {statusLabel(target.status)}
          </span>
        );
      })}
    </div>
  );
}

function PostActions({ post, channelStatus, scope, ...actions }: { post: ContentPost; channelStatus: Record<ContentPlatform, boolean> } & ActionProps & { scope: "upcoming" | "history" }) {
  const wentOut = post.status === "published" || post.status === "partially_published" || post.status === "failed";
  const canRetry = post.status === "partially_published" || post.status === "failed";

  if (scope === "upcoming") {
    return (
      <>
        {actions.updateAction ? (
          <details className="content-post-card__edit">
            <summary>Edit</summary>
            <form action={actions.updateAction} className="record-edit-grid" data-track-unsaved="true">
              <input name="postId" type="hidden" value={post.id} />
              <label className="full-field">
                Title
                <input defaultValue={post.title} name="title" />
              </label>
              <label className="full-field">
                Caption
                <textarea defaultValue={post.caption} name="caption" required rows={3} />
              </label>
              <label>
                Publish at
                <input defaultValue={toDateTimeLocal(post.scheduled_at)} name="scheduledAt" required type="datetime-local" />
              </label>
              <div className="content-platform-picker full-field">
                {ALL_PLATFORMS.map((platform) => {
                  const connected = channelStatus[platform];
                  const checked = post.targets.some((target) => target.platform === platform);
                  return (
                    <label className={connected ? "content-platform-option" : "content-platform-option content-platform-option--disabled"} key={platform}>
                      <input defaultChecked={checked} disabled={!connected} name="platforms" type="checkbox" value={platform} />
                      <span>{PLATFORM_LABELS[platform]}</span>
                    </label>
                  );
                })}
              </div>
              <p className="muted full-field">To change the image, delete this post and schedule a new one.</p>
              <button className="secondary-button compact-button" type="submit">Save changes</button>
            </form>
          </details>
        ) : null}

        <div className="content-post-card__actions">
          {actions.publishNowAction ? (
            <form action={actions.publishNowAction}>
              <input name="postId" type="hidden" value={post.id} />
              <button className="secondary-button compact-button" type="submit"><Send size={14} /> Publish now</button>
            </form>
          ) : null}
          {actions.cancelAction ? (
            <form action={actions.cancelAction}>
              <input name="postId" type="hidden" value={post.id} />
              <button className="ghost-button compact-button" type="submit"><XCircle size={14} /> Cancel</button>
            </form>
          ) : null}
          {actions.deleteAction ? (
            <form action={actions.deleteAction}>
              <input name="postId" type="hidden" value={post.id} />
              <button className="ghost-button compact-button content-delete-button" type="submit"><Trash2 size={14} /> Delete</button>
            </form>
          ) : null}
        </div>
      </>
    );
  }

  // History scope: no in-place caption/media rewrite of what actually
  // happened — offer "Edit & reschedule" (reuses this exact post row) and
  // "Repost" (creates a fresh copy), plus a one-click Retry for targets
  // that failed.
  return (
    <>
      {canRetry && actions.retryAction ? (
        <form action={actions.retryAction}>
          <input name="postId" type="hidden" value={post.id} />
          <button className="secondary-button compact-button" type="submit"><RefreshCcw size={14} /> Retry failed platforms</button>
        </form>
      ) : null}

      {wentOut && actions.editRescheduleAction ? (
        <details className="content-post-card__edit">
          <summary>Edit &amp; reschedule</summary>
          <form action={actions.editRescheduleAction} className="record-edit-grid" data-track-unsaved="true">
            <input name="postId" type="hidden" value={post.id} />
            <label className="full-field">
              Title
              <input defaultValue={post.title} name="title" />
            </label>
            <label className="full-field">
              Caption
              <textarea defaultValue={post.caption} name="caption" required rows={3} />
            </label>
            <label>
              New publish time
              <input defaultValue={toDateTimeLocal(new Date().toISOString())} name="scheduledAt" required type="datetime-local" />
            </label>
            <div className="content-platform-picker full-field">
              {ALL_PLATFORMS.map((platform) => {
                const connected = channelStatus[platform];
                const checked = post.targets.some((target) => target.platform === platform);
                return (
                  <label className={connected ? "content-platform-option" : "content-platform-option content-platform-option--disabled"} key={platform}>
                    <input defaultChecked={checked} disabled={!connected} name="platforms" type="checkbox" value={platform} />
                    <span>{PLATFORM_LABELS[platform]}</span>
                  </label>
                );
              })}
            </div>
            <p className="muted full-field">This resets every selected platform to publish again at the new time.</p>
            <button className="secondary-button compact-button" type="submit">Save &amp; reschedule</button>
          </form>
        </details>
      ) : null}

      {wentOut && actions.repostAction ? (
        <details className="content-post-card__edit">
          <summary><Repeat size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />Repost as new</summary>
          <form action={actions.repostAction} className="record-edit-grid" data-track-unsaved="true">
            <input name="postId" type="hidden" value={post.id} />
            <input name="contentType" type="hidden" value={post.content_type} />
            {post.media_urls.map((url) => <input key={url} name="mediaUrls" type="hidden" value={url} />)}
            <label className="full-field">
              Title
              <input defaultValue={post.title} name="title" />
            </label>
            <label className="full-field">
              Caption
              <textarea defaultValue={post.caption} name="caption" required rows={3} />
            </label>
            <label>
              New publish time
              <input defaultValue={toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000).toISOString())} name="scheduledAt" required type="datetime-local" />
            </label>
            <div className="content-platform-picker full-field">
              {ALL_PLATFORMS.map((platform) => {
                const connected = channelStatus[platform];
                const checked = post.targets.some((target) => target.platform === platform);
                return (
                  <label className={connected ? "content-platform-option" : "content-platform-option content-platform-option--disabled"} key={platform}>
                    <input defaultChecked={checked} disabled={!connected} name="platforms" type="checkbox" value={platform} />
                    <span>{PLATFORM_LABELS[platform]}</span>
                  </label>
                );
              })}
            </div>
            <p className="muted full-field">Creates a brand-new post with this caption and media — the original stays in your history untouched.</p>
            <button className="primary-button compact-button" type="submit"><Repeat size={14} /> Repost</button>
          </form>
        </details>
      ) : null}
    </>
  );
}

function PostCard({ post, channelStatus, scope, ...actions }: { post: ContentPost; channelStatus: Record<ContentPlatform, boolean> } & ActionProps & { scope: "upcoming" | "history" }) {
  return (
    <div className={scope === "history" ? "content-post-card content-post-card--compact" : "content-post-card"} id={`post-${post.id}`}>
      <div className="content-post-card__head">
        <div>
          <strong>{post.title || "Untitled post"}</strong>
          <span className="muted">{formatDateTime(post.scheduled_at)}</span>
        </div>
        <span style={{ display: "flex", gap: 6 }}>
          <span className="status-pill">{CONTENT_TYPE_LABELS[post.content_type] || post.content_type}</span>
          <span className="status-pill">{statusLabel(post.status)}</span>
        </span>
      </div>
      {scope === "upcoming" ? <p className="content-post-card__caption">{post.caption}</p> : null}
      {scope === "upcoming" && post.media_urls.length ? (
        <div className="content-post-card__media">
          {post.media_urls.map((url) => <img alt="" key={url} src={url} />)}
        </div>
      ) : null}
      <TargetBadges post={post} />
      <PostActions post={post} channelStatus={channelStatus} scope={scope} {...actions} />
    </div>
  );
}

function PostRow({ post, channelStatus, scope, ...actions }: { post: ContentPost; channelStatus: Record<ContentPlatform, boolean> } & ActionProps & { scope: "upcoming" | "history" }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="content-list-row-wrap" id={`post-${post.id}`}>
      <button className="content-list-row" onClick={() => setExpanded((value) => !value)} type="button">
        <span>{formatDateTime(post.scheduled_at)}</span>
        <span className="content-list-row__title">{post.title || post.caption.slice(0, 40) || "Untitled post"}</span>
        <span>{CONTENT_TYPE_LABELS[post.content_type] || post.content_type}</span>
        <span className="content-list-row__platforms">
          {post.targets.map((target) => {
            const Icon = PLATFORM_ICONS[target.platform];
            return <Icon aria-label={PLATFORM_LABELS[target.platform]} key={target.id} size={14} />;
          })}
        </span>
        <span className="status-pill">{statusLabel(post.status)}</span>
        <span className="content-list-row__chevron">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded ? (
        <div className="content-list-row__detail">
          <p className="content-post-card__caption">{post.caption}</p>
          {post.media_urls.length ? (
            <div className="content-post-card__media">
              {post.media_urls.map((url) => <img alt="" key={url} src={url} />)}
            </div>
          ) : null}
          <TargetBadges post={post} />
          <PostActions post={post} channelStatus={channelStatus} scope={scope} {...actions} />
        </div>
      ) : null}
    </div>
  );
}
