import { CalendarRange, Sparkles } from "lucide-react";
import Link from "next/link";
import { getContentCalendarWorkspace, platformLabel, type ContentPlatform } from "@/lib/content";
import { PageHeader } from "@/app/fusionadmin/(admin)/crm-ui";
import { BulkScheduleForm } from "./BulkScheduleForm";
import "./bulk-append.css";

const BULK_PLATFORMS: ContentPlatform[] = ["facebook_page", "instagram"];

// A real batch (20-30 files) calls Claude's vision API for each image once
// scheduling starts — give this route's Server Actions real headroom instead
// of the platform default, which a batch that size would otherwise blow
// right past. (File uploads themselves now go straight from the browser to
// Supabase Storage and don't count against this at all — see BulkScheduleForm.)
export const maxDuration = 300;

export default async function BulkContentSchedulePage({
  searchParams
}: {
  searchParams: Promise<{
    date?: string;
  }>;
}) {
  const { channelStatus } = await getContentCalendarWorkspace();
  const params = await searchParams;

  const platformOptions = BULK_PLATFORMS.map((platform) => ({
    value: platform,
    label: platformLabel(platform),
    connected: channelStatus[platform]
  }));

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

        <BulkScheduleForm defaultDate={params.date} platformOptions={platformOptions} />
      </div>
    </div>
  );
}
