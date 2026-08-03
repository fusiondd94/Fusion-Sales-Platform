import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Facebook, Instagram, MessageCircle, PlusCircle, Send, Sparkles, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import {
  cancelFusionContentPost,
  createFusionContentPost,
  deleteFusionContentPost,
  publishFusionContentPostNow,
  updateFusionContentPost
} from "@/app/fusionadmin/actions";
import { getContentCalendarWorkspace, platformLabel, type ContentPlatform, type ContentPost } from "@/lib/content";
import { EmptyState, PageHeader } from "../crm-ui";
import { FormError } from "@/components/ui";
import { ContentCalendarGrid, type CalendarDay, type CalendarPostSummary } from "./calendar-grid";

const PLATFORM_ICONS: Record<ContentPlatform, typeof Facebook> = {
  facebook_page: Facebook,
  instagram: Instagram,
  whatsapp_broadcast: MessageCircle
};

function monthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function buildCalendarDays(referenceDate: Date): CalendarDay[] {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      dateIso: date.toISOString(),
      key: monthKey(date),
      isCurrentMonth: date.getMonth() === month,
      dayNumber: date.getDate()
    };
  });
}

// Matches ORG_TIME_ZONE in src/lib/content.ts — the business operates in a
// single timezone today, so times are displayed and edited in that zone
// rather than the server's (UTC) or the admin's own browser timezone.
const DISPLAY_TIME_ZONE = "America/New_York";

// Builds the "YYYY-MM-DDTHH:mm" value a <input type="datetime-local"> needs,
// representing the post's scheduled time in DISPLAY_TIME_ZONE (not UTC) —
// otherwise re-saving the edit form unchanged would silently shift the time.
function toDateTimeLocal(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function contentTypeLabel(contentType: string) {
  if (contentType === "reel") return "Reel";
  if (contentType === "story") return "Story";
  if (contentType === "carousel") return "Carousel";
  if (contentType === "text") return "Text";
  return "Feed post";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

// Buckets a post's UTC-stored scheduled_at into the calendar day it falls on
// in DISPLAY_TIME_ZONE, not the server's own timezone — otherwise a post near
// midnight could show up under the wrong day on the calendar.
function zonedDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseMonthParam(month: string | undefined): Date {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNum] = month.split("-").map(Number);
    if (monthNum >= 1 && monthNum <= 12) return new Date(year, monthNum - 1, 1);
  }
  return new Date();
}

function monthParamKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export default async function FusionContentCalendarPage({
  searchParams
}: {
  searchParams: Promise<{ contentError?: string; month?: string }>;
}) {
  const { posts, channelStatus } = await getContentCalendarWorkspace();
  const { contentError, month } = await searchParams;
  const referenceDate = parseMonthParam(month);
  const monthDays = buildCalendarDays(referenceDate);
  const monthTitle = referenceDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const prevMonthKey = monthParamKey(shiftMonth(referenceDate, -1));
  const nextMonthKey = monthParamKey(shiftMonth(referenceDate, 1));
  const currentMonthKey = monthParamKey(new Date());
  const isCurrentMonth = monthParamKey(referenceDate) === currentMonthKey;

  const postsByDate: Record<string, CalendarPostSummary[]> = {};
  for (const post of posts) {
    const key = zonedDateKey(new Date(post.scheduled_at), "America/New_York");
    const list = postsByDate[key] || [];
    list.push({
      id: post.id,
      status: post.status,
      title: post.title,
      caption: post.caption,
      scheduledAtIso: post.scheduled_at
    });
    postsByDate[key] = list;
  }

  const anyChannelConnected = channelStatus.facebook_page || channelStatus.instagram || channelStatus.whatsapp_broadcast;
  const upcomingPosts = posts.filter((post) => post.status === "scheduled" || post.status === "draft");
  const pastPosts = posts.filter((post) => !["scheduled", "draft"].includes(post.status));

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Marketing"
        title="Content calendar"
        description="Click any day to schedule a post, story, or reel — plan once and it publishes automatically to Facebook and Instagram at the time you set."
        action={
          <span style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="primary-button compact-button" href="/fusionadmin/content/bulk">
              <Sparkles size={16} /> Bulk schedule
            </Link>
            <Link className="secondary-button compact-button" href="/fusionadmin/settings/connections">
              <MessageCircle size={16} /> Manage channels
            </Link>
          </span>
        }
      />

      <FormError message={contentError} />

      {!anyChannelConnected ? (
        <p className="fusion-form-error" role="status">
          <AlertTriangle aria-hidden="true" size={16} />
          <span>
            No channels are connected yet. <Link href="/fusionadmin/settings/connections">Connect Facebook, Instagram, or WhatsApp</Link> before scheduling posts.
          </span>
        </p>
      ) : null}

      <div className="content-channel-strip">
        {CONTENT_PLATFORM_ORDER.map((platform) => {
          const Icon = PLATFORM_ICONS[platform];
          const connected = channelStatus[platform];
          return (
            <span className={connected ? "platform-chip platform-chip--connected" : "platform-chip platform-chip--disconnected"} key={platform}>
              <Icon size={14} /> {platformLabel(platform)} · {connected ? "Connected" : "Not connected"}
            </span>
          );
        })}
      </div>

      <section className="admin-two-column">
        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><CalendarClock size={20} /> {monthTitle}</h2>
            <span className="calendar-nav">
              <Link aria-label="Previous month" className="ghost-button compact-button" href={`/fusionadmin/content?month=${prevMonthKey}`}>
                <ChevronLeft size={16} />
              </Link>
              {!isCurrentMonth ? (
                <Link className="secondary-button compact-button" href="/fusionadmin/content">
                  Today
                </Link>
              ) : null}
              <Link aria-label="Next month" className="ghost-button compact-button" href={`/fusionadmin/content?month=${nextMonthKey}`}>
                <ChevronRight size={16} />
              </Link>
              <span className="status-pill">{posts.length} posts</span>
            </span>
          </div>
          <ContentCalendarGrid channelStatus={channelStatus} monthDays={monthDays} monthTitle={monthTitle} postsByDate={postsByDate} />
          {!posts.length ? <p className="admin-empty calendar-empty-note">No posts scheduled yet. Click a day above, or use the form to plan your first one.</p> : null}
        </article>

        <article className="admin-panel">
          <h2><PlusCircle size={20} /> Schedule a post</h2>
          <form className="quick-form content-composer-form" action={createFusionContentPost} data-track-unsaved="true">
            <input name="title" placeholder="Internal label (optional)" />
            <textarea name="caption" placeholder="Write your caption..." required rows={4} />
            <label>
              <span>Images (optional — leave empty for a text post)</span>
              <input accept="image/*" multiple name="media" type="file" />
            </label>
            <div className="content-platform-picker">
              {CONTENT_PLATFORM_ORDER.map((platform) => {
                const connected = channelStatus[platform];
                return (
                  <label className={connected ? "content-platform-option" : "content-platform-option content-platform-option--disabled"} key={platform}>
                    <input disabled={!connected} name="platforms" type="checkbox" value={platform} />
                    <span>{platformLabel(platform)}</span>
                    {!connected ? <small>Not connected</small> : null}
                  </label>
                );
              })}
            </div>
            <label>
              <span>Publish at</span>
              <input name="scheduledAt" required type="datetime-local" />
            </label>
            <button className="primary-button" type="submit">
              <CalendarClock size={16} /> Schedule post
            </button>
          </form>
        </article>

        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><Send size={20} /> Upcoming</h2>
            <span className="status-pill">{upcomingPosts.length}</span>
          </div>
          <div className="content-post-list">
            {upcomingPosts.map((post) => (
              <div className="content-post-card" id={`post-${post.id}`} key={post.id}>
                <div className="content-post-card__head">
                  <div>
                    <strong>{post.title || "Untitled post"}</strong>
                    <span className="muted">{new Date(post.scheduled_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: DISPLAY_TIME_ZONE })}</span>
                  </div>
                  <span style={{ display: "flex", gap: 6 }}>
                    <span className="status-pill">{contentTypeLabel(post.content_type)}</span>
                    <span className="status-pill">{statusLabel(post.status)}</span>
                  </span>
                </div>
                <p className="content-post-card__caption">{post.caption}</p>
                {post.media_urls.length ? (
                  <div className="content-post-card__media">
                    {post.media_urls.map((url) => <img alt="" key={url} src={url} />)}
                  </div>
                ) : null}
                <div className="content-post-card__targets">
                  {post.targets.map((target) => {
                    const Icon = PLATFORM_ICONS[target.platform];
                    return (
                      <span className={"content-target-badge content-target-badge--" + target.status} key={target.id} title={target.error || undefined}>
                        <Icon size={13} /> {platformLabel(target.platform)} · {statusLabel(target.status)}
                      </span>
                    );
                  })}
                </div>

                <details className="content-post-card__edit">
                  <summary>Edit</summary>
                  <form action={updateFusionContentPost} className="record-edit-grid" data-track-unsaved="true">
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
                      {CONTENT_PLATFORM_ORDER.map((platform) => {
                        const connected = channelStatus[platform];
                        const checked = post.targets.some((target) => target.platform === platform);
                        return (
                          <label className={connected ? "content-platform-option" : "content-platform-option content-platform-option--disabled"} key={platform}>
                            <input defaultChecked={checked} disabled={!connected} name="platforms" type="checkbox" value={platform} />
                            <span>{platformLabel(platform)}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="muted full-field">To change the image, delete this post and schedule a new one.</p>
                    <button className="secondary-button compact-button" type="submit">Save changes</button>
                  </form>
                </details>

                <div className="content-post-card__actions">
                  <form action={publishFusionContentPostNow}>
                    <input name="postId" type="hidden" value={post.id} />
                    <button className="secondary-button compact-button" type="submit"><Send size={14} /> Publish now</button>
                  </form>
                  <form action={cancelFusionContentPost}>
                    <input name="postId" type="hidden" value={post.id} />
                    <button className="ghost-button compact-button" type="submit"><XCircle size={14} /> Cancel</button>
                  </form>
                  <form action={deleteFusionContentPost}>
                    <input name="postId" type="hidden" value={post.id} />
                    <button className="ghost-button compact-button content-delete-button" type="submit"><Trash2 size={14} /> Delete</button>
                  </form>
                </div>
              </div>
            ))}
            {!upcomingPosts.length ? <EmptyState>No upcoming posts. Click a day on the calendar, or use the form above.</EmptyState> : null}
          </div>
        </article>

        {pastPosts.length ? (
          <article className="admin-panel panel-span-2">
            <div className="panel-heading">
              <h2>History</h2>
              <span className="status-pill">{pastPosts.length}</span>
            </div>
            <div className="content-post-list">
              {pastPosts.map((post) => (
                <div className="content-post-card content-post-card--compact" key={post.id}>
                  <div className="content-post-card__head">
                    <div>
                      <strong>{post.title || "Untitled post"}</strong>
                      <span className="muted">{new Date(post.scheduled_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: DISPLAY_TIME_ZONE })}</span>
                    </div>
                    <span className="status-pill">{statusLabel(post.status)}</span>
                  </div>
                  <div className="content-post-card__targets">
                    {post.targets.map((target) => {
                      const Icon = PLATFORM_ICONS[target.platform];
                      return (
                        <span className={"content-target-badge content-target-badge--" + target.status} key={target.id} title={target.error || undefined}>
                          <Icon size={13} /> {platformLabel(target.platform)} · {statusLabel(target.status)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ) : null}
      </section>
    </div>
  );
}

const CONTENT_PLATFORM_ORDER: ContentPlatform[] = ["facebook_page", "instagram", "whatsapp_broadcast"];
