import { AlertTriangle, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Facebook, Instagram, MessageCircle, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import {
  cancelFusionContentPost,
  deleteFusionContentPost,
  publishFusionContentPostNow,
  updateFusionContentPost
} from "@/app/fusionadmin/actions";
import { editAndRescheduleContentPost, repostFusionContentPost, retryFusionContentPostTargets } from "./content-post-actions";
import { getContentCalendarWorkspace, platformLabel, type ContentPlatform } from "@/lib/content";
import { PageHeader } from "../crm-ui";
import { FormError } from "@/components/ui";
import { ContentCalendarGrid, type CalendarDay, type CalendarPostSummary } from "./calendar-grid";
import { ContentPostList } from "./ContentPostList";
import { ScheduleComposer } from "./ScheduleComposer";

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
  searchParams: Promise<{ contentError?: string; month?: string; published?: string; reposted?: string; retried?: string }>;
}) {
  const { posts, channelStatus } = await getContentCalendarWorkspace();
  const { contentError, month, published, reposted, retried } = await searchParams;
  const referenceDate = parseMonthParam(month);
  const monthDays = buildCalendarDays(referenceDate);
  const monthTitle = referenceDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const prevMonthKey = monthParamKey(shiftMonth(referenceDate, -1));
  const nextMonthKey = monthParamKey(shiftMonth(referenceDate, 1));
  const currentMonthKey = monthParamKey(new Date());
  const isCurrentMonth = monthParamKey(referenceDate) === currentMonthKey;
  const viewedMonthKey = monthParamKey(referenceDate);

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

  // The header badge next to the month title should reflect posts scheduled
  // *in the month currently being viewed*, not the total across all time —
  // otherwise it stays stuck on the all-time count while you page through
  // months with zero posts, which reads as a bug.
  const postsInViewedMonth = posts.filter(
    (post) => zonedDateKey(new Date(post.scheduled_at), DISPLAY_TIME_ZONE).slice(0, 7) === viewedMonthKey
  ).length;

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

      {published && Number(published) > 0 ? (
        <p className="content-success-banner" role="status">
          <CheckCircle2 aria-hidden="true" size={16} />
          <span>
            Published {published} post{published === "1" ? "" : "s"} — {published === "1" ? "it's" : "they're"} now on the calendar.
          </span>
        </p>
      ) : null}

      {reposted ? (
        <p className="content-success-banner" role="status">
          <CheckCircle2 aria-hidden="true" size={16} />
          <span>Saved. Scroll down to see it in Upcoming or History.</span>
        </p>
      ) : null}

      {retried ? (
        <p className="content-success-banner" role="status">
          <CheckCircle2 aria-hidden="true" size={16} />
          <span>Retried the failed platforms for that post.</span>
        </p>
      ) : null}

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
              <span className="status-pill">{postsInViewedMonth} posts</span>
            </span>
          </div>
          <ContentCalendarGrid channelStatus={channelStatus} monthDays={monthDays} monthTitle={monthTitle} postsByDate={postsByDate} />
          {!posts.length ? <p className="admin-empty calendar-empty-note">No posts scheduled yet. Click a day above, or use the form to plan your first one.</p> : null}
        </article>

        <article className="admin-panel panel-span-2">
          <ScheduleComposer channelStatus={channelStatus} />
        </article>

        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><Send size={20} /> Upcoming</h2>
            <span className="status-pill">{upcomingPosts.length}</span>
          </div>
          <ContentPostList
            cancelAction={cancelFusionContentPost}
            channelStatus={channelStatus}
            deleteAction={deleteFusionContentPost}
            posts={upcomingPosts}
            publishNowAction={publishFusionContentPostNow}
            scope="upcoming"
            updateAction={updateFusionContentPost}
          />
        </article>

        {pastPosts.length ? (
          <article className="admin-panel panel-span-2">
            <div className="panel-heading">
              <h2>History</h2>
              <span className="status-pill">{pastPosts.length}</span>
            </div>
            <ContentPostList
              channelStatus={channelStatus}
              editRescheduleAction={editAndRescheduleContentPost}
              posts={pastPosts}
              repostAction={repostFusionContentPost}
              retryAction={retryFusionContentPostTargets}
              scope="history"
            />
          </article>
        ) : null}
      </section>
    </div>
  );
}

const CONTENT_PLATFORM_ORDER: ContentPlatform[] = ["facebook_page", "instagram", "whatsapp_broadcast"];
