"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Sparkles } from "lucide-react";
import { FormError } from "@/components/ui";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { getBulkUploadTargets, bulkScheduleFusionContent } from "./bulk-actions";
import type { ContentPlatform } from "@/lib/content";

type PlatformOption = { value: ContentPlatform; label: string; connected: boolean };

// How many files to upload to Supabase Storage concurrently from the
// browser. Real batches (20-30 photos) uploading one at a time would be slow
// and uploading all at once would flood the connection; a small worker pool
// keeps things fast without overwhelming the browser or Supabase.
const UPLOAD_CONCURRENCY = 3;

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0;

  async function next(): Promise<void> {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) return;
    await worker(items[index], index);
    return next();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
}

export function BulkScheduleForm({
  defaultDate,
  platformOptions
}: {
  defaultDate?: string;
  platformOptions: PlatformOption[];
}) {
  const router = useRouter();

  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [postType, setPostType] = useState("image");
  const [cadence, setCadence] = useState("daily");
  const [intervalDays, setIntervalDays] = useState(3);
  const [startDate, setStartDate] = useState(defaultDate || "");
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [platforms, setPlatforms] = useState<string[]>(
    platformOptions.filter((option) => option.connected).map((option) => option.value)
  );
  const [batchNote, setBatchNote] = useState("");

  const [error, setError] = useState<string | undefined>(undefined);
  const [progress, setProgress] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const anyConnected = platformOptions.some((option) => option.connected);
  // Regular-file input first, folder input second — mirrors the exact DOM
  // order the old single <form> used (both inputs shared name="images"), so
  // file ordering behaves the same as before.
  const allFiles = [...pickedFiles, ...folderFiles];

  function togglePlatform(value: string) {
    setPlatforms((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (!allFiles.length) {
      setError("Choose at least one file to schedule.");
      return;
    }
    if (!startDate) {
      setError("Choose a start date.");
      return;
    }
    if (!platforms.length) {
      setError("Choose at least one platform.");
      return;
    }

    setSubmitting(true);

    try {
      setProgress(`Preparing ${allFiles.length} upload${allFiles.length === 1 ? "" : "s"}...`);
      const targetsResult = await getBulkUploadTargets(allFiles.map((file) => ({ name: file.name, type: file.type })));
      if (!targetsResult.ok || !targetsResult.targets) {
        setError(targetsResult.error || "Could not prepare uploads.");
        setSubmitting(false);
        setProgress(undefined);
        return;
      }

      const targets = targetsResult.targets;

      // Each file's bytes go straight from this browser to Supabase Storage
      // using its one-time signed token — the Vercel function behind
      // getBulkUploadTargets never sees the raw bytes, which is what avoids
      // hitting Vercel's 4.5MB serverless request body limit on real photo
      // batches.
      const supabase = createBrowserSupabaseClient();
      const uploadOutcomes: boolean[] = new Array(targets.length).fill(false);
      const uploadErrors: string[] = [];

      await runWithConcurrency(targets, UPLOAD_CONCURRENCY, async (target, index) => {
        const file = allFiles[index];
        const { error: uploadError } = await supabase.storage
          .from("content-media")
          .uploadToSignedUrl(target.path, target.token, file, { contentType: file.type || "application/octet-stream" });

        if (uploadError) {
          uploadErrors.push(`${target.name}: ${uploadError.message}`);
        } else {
          uploadOutcomes[index] = true;
        }

        const uploadedSoFar = uploadOutcomes.filter(Boolean).length;
        setProgress(`Uploaded ${uploadedSoFar} of ${targets.length}...`);
      });

      const uploadedTargets = targets.filter((_, index) => uploadOutcomes[index]);

      if (!uploadedTargets.length) {
        setError(uploadErrors[0] || "None of the files could be uploaded.");
        setSubmitting(false);
        setProgress(undefined);
        return;
      }

      setProgress("Writing captions and scheduling...");

      const result = await bulkScheduleFusionContent({
        files: uploadedTargets.map((target) => ({ name: target.name, type: target.type, url: target.publicUrl })),
        cadence,
        intervalDays,
        startDate,
        timeOfDay,
        platforms,
        postType,
        batchNote
      });

      if (!result.ok || !result.redirectUrl) {
        setError(result.error || "Nothing could be scheduled.");
        setSubmitting(false);
        setProgress(undefined);
        return;
      }

      router.push(result.redirectUrl);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong. Try again.");
      setSubmitting(false);
      setProgress(undefined);
    }
  }

  return (
    <form className="quick-form bulk-schedule-form" onSubmit={handleSubmit}>
      <FormError message={error} />

      <div className="bulk-field-group">
        <span className="bulk-field-label">Post type</span>
        <select disabled={submitting} onChange={(event) => setPostType(event.target.value)} value={postType}>
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
          <input
            accept="image/*,video/*"
            disabled={submitting}
            multiple
            onChange={(event) => setPickedFiles(Array.from(event.target.files || []))}
            type="file"
          />
        </label>
        <label className="bulk-file-input">
          <span>Or choose an entire folder</span>
          <input
            accept="image/*,video/*"
            disabled={submitting}
            multiple
            onChange={(event) => setFolderFiles(Array.from(event.target.files || []))}
            type="file"
            {...{ webkitdirectory: "", directory: "" }}
          />
        </label>
        <p className="muted bulk-field-hint">
          {allFiles.length
            ? `${allFiles.length} file${allFiles.length === 1 ? "" : "s"} selected — each gets its own post, in the order they're selected.`
            : "Every file you add gets its own post, in the order they're selected."}
        </p>
      </div>

      <div className="bulk-field-row">
        <label>
          <span>Post frequency</span>
          <select disabled={submitting} onChange={(event) => setCadence(event.target.value)} value={cadence}>
            <option value="daily">Daily</option>
            <option value="every_two_days">Every 2 days</option>
            <option value="every_n_days">Custom interval (days)</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly (same date each month)</option>
          </select>
        </label>
        <label>
          <span>Interval, in days (custom only)</span>
          <input
            disabled={submitting}
            min={1}
            onChange={(event) => setIntervalDays(Number(event.target.value) || 1)}
            type="number"
            value={intervalDays}
          />
        </label>
      </div>

      <div className="bulk-field-row">
        <label>
          <span>Start date</span>
          <input disabled={submitting} onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} />
        </label>
        <label>
          <span>Time of day to post</span>
          <input disabled={submitting} onChange={(event) => setTimeOfDay(event.target.value)} required type="time" value={timeOfDay} />
        </label>
      </div>

      <div className="bulk-field-group">
        <span className="bulk-field-label">Platforms</span>
        <div className="content-platform-picker">
          {platformOptions.map((option) => (
            <label
              className={option.connected ? "content-platform-option" : "content-platform-option content-platform-option--disabled"}
              key={option.value}
            >
              <input
                checked={platforms.includes(option.value)}
                disabled={!option.connected || submitting}
                onChange={() => togglePlatform(option.value)}
                type="checkbox"
              />
              <span>{option.label}</span>
              {!option.connected ? <small>Not connected</small> : null}
            </label>
          ))}
        </div>
        {!anyConnected ? (
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
        <textarea
          disabled={submitting}
          onChange={(event) => setBatchNote(event.target.value)}
          placeholder="e.g. these are all from our summer sale, or launch week for the new product line"
          rows={2}
          value={batchNote}
        />
      </label>

      <button className="primary-button" disabled={submitting} type="submit">
        <Sparkles size={16} /> {submitting ? progress || "Working..." : "Generate captions & schedule"}
      </button>
    </form>
  );
}
