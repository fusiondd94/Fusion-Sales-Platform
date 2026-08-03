"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarRange, PlusCircle, Sparkles, X } from "lucide-react";
import { scheduleSingleContentPost } from "./content-schedule-actions";
import type { ContentPlatform } from "@/lib/content";
import "./calendar-append.css";

export type CalendarDay = {
  dateIso: string;
  key: string;
  isCurrentMonth: boolean;
  dayNumber: number;
};

export type CalendarPostSummary = {
  id: string;
  status: string;
  title: string;
  caption: string;
  scheduledAtIso: string;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PLATFORMS: ContentPlatform[] = ["facebook_page", "instagram", "whatsapp_broadcast"];
const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  facebook_page: "Facebook Page",
  instagram: "Instagram",
  whatsapp_broadcast: "WhatsApp broadcast"
};

// Matches ORG_TIME_ZONE in src/lib/content.ts.
const DISPLAY_TIME_ZONE = "America/New_York";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: DISPLAY_TIME_ZONE });
}

export function ContentCalendarGrid({
  monthDays,
  postsByDate,
  monthTitle,
  channelStatus
}: {
  monthDays: CalendarDay[];
  postsByDate: Record<string, CalendarPostSummary[]>;
  monthTitle: string;
  channelStatus: Record<ContentPlatform, boolean>;
}) {
  const [openDayKey, setOpenDayKey] = useState<string | null>(null);

  return (
    <>
      <div className="calendar-board" aria-label={`${monthTitle} content calendar`}>
        <div className="calendar-weekdays">
          {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="calendar-grid">
          {monthDays.map((day) => (
            <div
              className={day.isCurrentMonth ? "calendar-day calendar-day--clickable" : "calendar-day outside-month calendar-day--clickable"}
              key={day.key}
              onClick={() => setOpenDayKey(day.key)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setOpenDayKey(day.key);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Schedule content for ${day.key}`}
            >
              <span className="calendar-day-number">{day.dayNumber}</span>
              {(postsByDate[day.key] || []).map((post) => (
                <a
                  className={"calendar-event content-calendar-event content-calendar-event--" + post.status}
                  href={`#post-${post.id}`}
                  key={post.id}
                  onClick={(event) => event.stopPropagation()}
                >
                  <strong>{formatTime(post.scheduledAtIso)}</strong>
                  <span>{post.title || post.caption.slice(0, 40) || "Untitled post"}</span>
                </a>
              ))}
              <span className="calendar-day-add" aria-hidden="true">+ Schedule</span>
            </div>
          ))}
        </div>
      </div>

      {openDayKey ? (
        <div className="calendar-modal-backdrop" onClick={() => setOpenDayKey(null)}>
          <div className="calendar-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="calendar-modal__head">
              <h3>Schedule for {openDayKey}</h3>
              <button aria-label="Close" className="ghost-button compact-button" onClick={() => setOpenDayKey(null)} type="button">
                <X size={16} />
              </button>
            </div>

            <Link
              className="secondary-button compact-button calendar-modal__bulk-link"
              href={`/fusionadmin/content/bulk?date=${openDayKey}`}
            >
              <Sparkles size={16} /> Bulk schedule a batch starting this day
            </Link>

            <div className="calendar-modal__divider">
              <span>or schedule one post, story, or reel</span>
            </div>

            <form action={scheduleSingleContentPost} className="quick-form calendar-modal__form" key={openDayKey}>
              <textarea name="caption" placeholder="Write your caption..." required rows={3} />
              <label>
                <span>Media (image or video)</span>
                <input accept="image/*,video/*" name="media" type="file" />
              </label>
              <div className="bulk-field-row">
                <label>
                  <span>Post type</span>
                  <select defaultValue="image" name="postType">
                    <option value="image">Feed post</option>
                    <option value="story">Story</option>
                    <option value="reel">Reel (video)</option>
                  </select>
                </label>
                <ScheduledAtField dayKey={openDayKey} />
              </div>
              <div className="content-platform-picker">
                {PLATFORMS.map((platform) => {
                  const connected = channelStatus[platform];
                  return (
                    <label className={connected ? "content-platform-option" : "content-platform-option content-platform-option--disabled"} key={platform}>
                      <input disabled={!connected} name="platforms" type="checkbox" value={platform} />
                      <span>{PLATFORM_LABELS[platform]}</span>
                      {!connected ? <small>Not connected</small> : null}
                    </label>
                  );
                })}
              </div>
              <button className="primary-button" type="submit">
                <PlusCircle size={16} /> Schedule
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

// The server action expects a single "scheduledAt" datetime-local value.
// The date comes from whichever calendar day was clicked; this renders the
// visible time picker and keeps a hidden "scheduledAt" field combining both
// in sync as the user changes the time.
function ScheduledAtField({ dayKey }: { dayKey: string }) {
  const [time, setTime] = useState("09:00");

  return (
    <label>
      <span>Time of day</span>
      <input
        onChange={(event) => setTime(event.target.value || "09:00")}
        required
        type="time"
        value={time}
      />
      <input name="scheduledAt" type="hidden" value={`${dayKey}T${time}`} />
    </label>
  );
}
