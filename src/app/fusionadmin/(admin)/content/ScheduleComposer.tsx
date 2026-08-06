"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Clapperboard, Facebook, ImageOff, Instagram, MessageCircle, PlusCircle, GalleryHorizontal } from "lucide-react";
import { createFusionContentPost } from "@/app/fusionadmin/actions";
import { platformLabel, type ContentPlatform } from "@/lib/content";

const CONTENT_PLATFORM_ORDER: ContentPlatform[] = ["facebook_page", "instagram", "whatsapp_broadcast"];

const PLATFORM_ICONS: Record<ContentPlatform, typeof Facebook> = {
  facebook_page: Facebook,
  instagram: Instagram,
  whatsapp_broadcast: MessageCircle
};

// The DB's content_type column also supports "text" / "image" / "carousel",
// but those are all just different media counts of the same "Feed post"
// format — they're derived automatically from how many files are attached,
// not something the user picks directly. Story and Reel are real, distinct
// formats the backend (src/lib/content.ts) already knows how to publish to
// both Facebook and Instagram, but this composer never exposed a way to
// choose them, so every post fell back to a feed post. "Reel / Video" is one
// option because neither Meta surface has a separate plain-video feed post
// anymore — Instagram's Graph API only accepts IMAGE/CAROUSEL/REELS/STORIES,
// so video content is published as a Reel either way.
type PostType = "feed" | "story" | "reel";

const POST_TYPE_OPTIONS: { value: PostType; label: string; helper: string; icon: typeof Facebook }[] = [
  { value: "feed", label: "Feed post", helper: "Photo, carousel, or text update", icon: GalleryHorizontal },
  { value: "story", label: "Story", helper: "Disappears after 24 hours", icon: ImageOff },
  { value: "reel", label: "Reel / Video", helper: "Short vertical video", icon: Clapperboard }
];

// Stories and Reels aren't deliverable as a WhatsApp broadcast — the backend
// rejects that combination outright (see validatePostInput in content.ts).
const PLATFORMS_UNAVAILABLE_FOR: Record<PostType, ContentPlatform[]> = {
  feed: [],
  story: ["whatsapp_broadcast"],
  reel: ["whatsapp_broadcast"]
};

type PreviewImage = { url: string; name: string; isVideo: boolean };

function isVideoFile(name: string): boolean {
  return /\.(mp4|mov|m4v|webm)$/i.test(name);
}

export function ScheduleComposer({ channelStatus }: { channelStatus: Record<ContentPlatform, boolean> }) {
  const [caption, setCaption] = useState("");
  const [postType, setPostType] = useState<PostType>("feed");
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<ContentPlatform[]>([]);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function handleMediaChange(event: React.ChangeEvent<HTMLInputElement>) {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];

    const files = Array.from(event.target.files || []);
    const next = files.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      return { url, name: file.name, isVideo: isVideoFile(file.name) };
    });
    setImages(next);
  }

  function handlePostTypeChange(next: PostType) {
    setPostType(next);
    // Reels only ever take one video, Stories only take one file — drop any
    // extra media that was staged for a feed carousel so the form doesn't
    // silently submit files the picker no longer shows.
    if (next !== "feed" && images.length > 1) {
      setImages((prev) => prev.slice(0, 1));
    }
    const unavailable = PLATFORMS_UNAVAILABLE_FOR[next];
    if (unavailable.length) {
      setSelectedPlatforms((prev) => prev.filter((platform) => !unavailable.includes(platform)));
    }
  }

  function togglePlatform(platform: ContentPlatform, checked: boolean) {
    setSelectedPlatforms((prev) => {
      if (checked) return prev.includes(platform) ? prev : [...prev, platform];
      return prev.filter((item) => item !== platform);
    });
  }

  const orderedSelected = useMemo(
    () => CONTENT_PLATFORM_ORDER.filter((platform) => selectedPlatforms.includes(platform)),
    [selectedPlatforms]
  );

  const mediaAccept = postType === "reel" ? "video/*" : postType === "story" ? "image/*,video/*" : "image/*";
  const mediaAllowsMultiple = postType === "feed";
  const mediaLabel =
    postType === "reel"
      ? "Video (required)"
      : postType === "story"
        ? "Image or video (required)"
        : "Images (optional — leave empty for a text post)";

  return (
    <div className="composer-live-grid">
      <div className="composer-form-col">
        <h2><PlusCircle size={20} /> Schedule a post</h2>
        <form className="quick-form content-composer-form" action={createFusionContentPost} data-track-unsaved="true">
          <input name="title" placeholder="Internal label (optional)" />

          <div className="content-type-picker">
            {POST_TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <label className={postType === option.value ? "content-type-option content-type-option--active" : "content-type-option"} key={option.value}>
                  <input
                    checked={postType === option.value}
                    name="postTypeChoice"
                    onChange={() => handlePostTypeChange(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  <Icon size={16} />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.helper}</small>
                  </span>
                </label>
              );
            })}
          </div>
          <input name="postType" type="hidden" value={postType} />

          <textarea
            name="caption"
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Write your caption..."
            required={postType === "feed" && images.length === 0}
            rows={4}
            value={caption}
          />
          <label>
            <span>{mediaLabel}</span>
            <input accept={mediaAccept} key={postType} multiple={mediaAllowsMultiple} name="media" onChange={handleMediaChange} type="file" />
          </label>
          <div className="content-platform-picker">
            {CONTENT_PLATFORM_ORDER.map((platform) => {
              const connected = channelStatus[platform];
              const unavailableForType = PLATFORMS_UNAVAILABLE_FOR[postType].includes(platform);
              const disabled = !connected || unavailableForType;
              return (
                <label className={disabled ? "content-platform-option content-platform-option--disabled" : "content-platform-option"} key={platform}>
                  <input
                    checked={selectedPlatforms.includes(platform)}
                    disabled={disabled}
                    name="platforms"
                    onChange={(event) => togglePlatform(platform, event.target.checked)}
                    type="checkbox"
                    value={platform}
                  />
                  <span>{platformLabel(platform)}</span>
                  {!connected ? <small>Not connected</small> : unavailableForType ? <small>Not available for this post type</small> : null}
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
      </div>

      <div className="composer-preview-col">
        <h3 className="composer-preview-heading">Live preview</h3>
        {!orderedSelected.length ? (
          <p className="admin-empty composer-preview-empty">Choose a platform above to see how this post will look.</p>
        ) : (
          <div className="composer-preview-stack">
            {orderedSelected.map((platform) => (
              <PlatformPreviewCard caption={caption} images={images} key={platform} platform={platform} postType={postType} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlatformPreviewCard({
  platform,
  caption,
  images,
  postType
}: {
  platform: ContentPlatform;
  caption: string;
  images: PreviewImage[];
  postType: PostType;
}) {
  const Icon = PLATFORM_ICONS[platform];
  const typeOption = POST_TYPE_OPTIONS.find((option) => option.value === postType)!;

  function renderMedia(image: PreviewImage) {
    return image.isVideo ? (
      <video controls muted src={image.url} />
    ) : (
      <img alt="" src={image.url} />
    );
  }

  return (
    <div className={"preview-platform-card preview-platform-card--" + platform}>
      <div className="preview-platform-card__head">
        <span className="preview-platform-card__badge">
          <Icon size={14} /> {platformLabel(platform)}
        </span>
        {postType !== "feed" ? <span className="preview-platform-card__type-badge">{typeOption.label}</span> : null}
      </div>

      {platform === "whatsapp_broadcast" ? (
        <div className="preview-whatsapp-bubble">
          {images.length ? (
            <div className="preview-media-grid preview-media-grid--single">{renderMedia(images[0])}</div>
          ) : null}
          <p>{caption || "Your caption will appear here."}</p>
        </div>
      ) : (
        <div className={postType === "story" || postType === "reel" ? "preview-post-body preview-post-body--vertical" : "preview-post-body"}>
          <div className="preview-post-author">
            <span className="preview-post-author__avatar" />
            <div>
              <strong>Fusion Digital Dynamics</strong>
              <small>Just now</small>
            </div>
          </div>
          {platform === "facebook_page" && postType === "feed" ? <p className="preview-post-caption">{caption || "Your caption will appear here."}</p> : null}
          {images.length ? (
            postType === "feed" ? (
              // Feed media is always image/* (see mediaAccept) — kept as bare
              // <img> elements, matching the original markup, because the
              // existing .preview-media-grid--3 img:first-child grid layout
              // rule depends on <img> being a direct child, not wrapped.
              <div className={"preview-media-grid preview-media-grid--" + Math.min(images.length, 4)}>
                {images.slice(0, 4).map((image) => (
                  <img alt="" key={image.url} src={image.url} />
                ))}
              </div>
            ) : (
              <div className="preview-media-grid preview-media-grid--single">{renderMedia(images[0])}</div>
            )
          ) : (
            <div className="preview-media-placeholder">
              <ImageOff size={22} />
              <span>
                {postType === "reel"
                  ? "Reels need a video file"
                  : postType === "story"
                    ? "Stories need an image or video file"
                    : platform === "instagram"
                      ? "Instagram needs at least one image"
                      : "No image attached"}
              </span>
            </div>
          )}
          {platform === "instagram" && postType === "feed" ? <p className="preview-post-caption">{caption || "Your caption will appear here."}</p> : null}
          {postType !== "feed" ? <p className="preview-post-caption">{caption || "Your caption will appear here."}</p> : null}
        </div>
      )}
    </div>
  );
}
