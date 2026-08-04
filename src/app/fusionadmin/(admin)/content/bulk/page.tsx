import { AlertTriangle, CalendarRange, Sparkles } from "lucide-react";
import Link from "next/link";
import { bulkScheduleFusionContent } from "./bulk-actions";
import { getContentCalendarWorkspace, platformLabel, type ContentPlatform } from "@/lib/content";
import { PageHeader } from "@/app/fusionadmin/(admin)/crm-ui";
import { FormError } from "@/components/ui";
import "./bulk-append.css";

const BULK_PLATFORMS: ContentPlatform[] = ["facebook_page", "instagram"];

// A real batch (20-30 files) uploads media and calls Claude's vision API for
// each one — give this route's function real headroom instead of the
// platform default, which a batch that size would otherwise blow right past.
export const maxDuration = 300;

export default async function BulkContentSchedulePage({
  searchParams
}: {
  searchParams: Promise<{
    bulkError?: string;
    date?: string;
  }>;
}) {
  const { channelStatus } = await getContentCalendarWorkspace();
  const params = await searchParams;

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Marketing"
        title="Bulk schedule content"
        description="Upload a folder of images, set a cadence, and let Claude write on-brand captions. You'll review every caption before anything actually gets scheduled."
        action={
          <Link className="secondary-button compact-button" href="/fusionadmin/content">
            <CalendarRange size={16} /> Back to calendar
          </Link>
        }
      />

      <FormError message={params.bulkError} />

      <div className="admin-panel bulk-schedule-panel">
        <div className="panel-heading">
          <h2>
            <Sparkles size={20} /> New batch
          </h2>
        </div>

        <p className="muted bulk-schedule-intro">
          Captions are written by Claude based on what&apos;s in each photo, plus your active services and current
          campaigns pulled live from the CRM. If Claude can&apos;t be reached, a caption is still generated from your
          business info so nothing is left blank. Nothing is scheduled yet after this step — you&apos;ll land on a
          review page to check every caption first.
        </p>

        <form action={bulkScheduleFusionContent} className="quick-form bulk-schedule-form" encType="multipart/form-data">
          <div className="bulk-field-group">
            <span className="bulk-field-label">Post type</span>
            <select defaultValue="image" name="postType">
              <option value="image">Feed post (image)</option>
              <option value="story">Story (image or video)</option>
              <option value="reel">Reel (video only)</option>
            </select>
            <p className="muted bulk-field-hint">
              Every file in this batch is scheduled as the same post type. Reels require video files (mp4, mov, or webm).
            </p>
          </div>

          <div className="bulk-field-group">
            <span className="bulk-field-label">Files</span>
            <label className="bulk-file-input">
              <span>Choose files</span>
              <input accept="image/*,video/*" multiple name="images" type="file" />
            </label>
            <label className="bulk-file-input">
              <span>Or choose an entire folder</span>
              <input accept="image/*,video/*" multiple name="images" type="file" {...{ webkitdirectory: "", directory: "" }} />
            </label>
            <p className="muted bulk-field-hint">Every file you add gets its own post, in the order they&apos;re selected.</p>
          </div>

          <div className="bulk-field-row">
            <label>
              <span>Post frequency</span>
              <select defaultValue="daily" name="cadence">
                <option value="daily">Daily</option>
                <option value="every_two_days">Every 2 days</option>
                <option value="every_n_days">Custom interval (days)</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly (same date each month)</option>
              </select>
            </label>
            <label>
              <span>Interval, in days (custom only)</span>
              <input defaultValue={3} min={1} name="intervalDays" type="number" />
            </label>
          </div>

          <div className="bulk-field-row">
            <label>
              <span>Start date</span>
              <input defaultValue={params.date || undefined} name="startDate" required type="date" />
            </label>
            <label>
              <span>Time of day to post</span>
              <input defaultValue="09:00" name="timeOfDay" required type="time" />
            </label>
          </div>

          <div className="bulk-field-group">
            <span className="bulk-field-label">Platforms</span>
            <div className="content-platform-picker">
              {BULK_PLATFORMS.map((platform) => {
                const connected = channelStatus[platform];
                return (
                  <label className={connected ? "content-platform-option" : "content-platform-option content-platform-option--disabled"} key={platform}>
                    <input defaultChecked={connected} disabled={!connected} name="platforms" type="checkbox" value={platform} />
                    <span>{platformLabel(platform)}</span>
                    {!connected ? <small>Not connected</small> : null}
                  </label>
                );
              })}
            </div>
            {!channelStatus.facebook_page && !channelStatus.instagram ? (
              <p className="fusion-form-error" role="status">
                <AlertTriangle aria-hidden="true" size={16} />
                <span>
                  Connect <Link href="/fusionadmin/settings/connections">Facebook or Instagram</Link> before scheduling a batch.
                </span>
              </p>
            ) : null}
          </div>

          <label className="bulk-field-group">
            <span className="bulk-field-label">Anything Claude should know about this batch? (optional)</span>
            <textarea name="batchNote" placeholder="e.g. these are all from our summer sale, or launch week for the new product line" rows={2} />
          </label>

          <button className="primary-button" type="submit">
            <Sparkles size={16} /> Generate captions &amp; schedule
          </button>
        </form>
      </div>
    </div>
  );
}
