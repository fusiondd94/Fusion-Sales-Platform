"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Facebook, ImageOff, Instagram, MessageCircle, PlusCircle } from "lucide-react";
import { createFusionContentPost } from "@/app/fusionadmin/actions";
import { platformLabel, type ContentPlatform } from "@/lib/content";

const CONTENT_PLATFORM_ORDER: ContentPlatform[] = ["facebook_page", "instagram", "whatsapp_broadcast"];

const PLATFORM_ICONS: Record<ContentPlatform, typeof Facebook> = {
  facebook_page: Facebook,
  instagram: Instagram,
  whatsapp_broadcast: MessageCircle
};

type PreviewImage = { url: string; name: string };

export function ScheduleComposer({ channelStatus }: { channelStatus: Record<ContentPlatform, boolean> }) {
  const [caption, setCaption] = useState("");
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
      return { url, name: file.name };
    });
    setImages(next);
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

  return (
    <div className="composer-live-grid">
      <div className="composer-form-col">
        <h2><PlusCircle size={20} /> Schedule a post</h2>
        <form className="quick-form content-composer-form" action={createFusionContentPost} data-track-unsaved="true">
          <input name="title" placeholder="Internal label (optional)" />
          <textarea
            name="caption"
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Write your caption..."
            required
            rows={4}
            value={caption}
          />
          <label>
            <span>Images (optional — leave empty for a text post)</span>
            <input accept="image/*" multiple name="media" onChange={handleMediaChange} type="file" />
          </label>
          <div className="content-platform-picker">
            {CONTENT_PLATFORM_ORDER.map((platform) => {
              const connected = channelStatus[platform];
              return (
                <label className={connected ? "content-platform-option" : "content-platform-option content-platform-option--disabled"} key={platform}>
                  <input
                    disabled={!connected}
                    name="platforms"
                    onChange={(event) => togglePlatform(platform, event.target.checked)}
                    type="checkbox"
                    value={platform}
                  />
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
      </div>

      <div className="composer-preview-col">
        <h3 className="composer-preview-heading">Live preview</h3>
        {!orderedSelected.length ? (
          <p className="admin-empty composer-preview-empty">Choose a platform above to see how this post will look.</p>
        ) : (
          <div className="composer-preview-stack">
            {orderedSelected.map((platform) => (
              <PlatformPreviewCard caption={caption} images={images} key={platform} platform={platform} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlatformPreviewCard({ platform, caption, images }: { platform: ContentPlatform; caption: string; images: PreviewImage[] }) {
  const Icon = PLATFORM_ICONS[platform];

  return (
    <div className={"preview-platform-card preview-platform-card--" + platform}>
      <div className="preview-platform-card__head">
        <span className="preview-platform-card__badge">
          <Icon size={14} /> {platformLabel(platform)}
        </span>
      </div>

      {platform === "whatsapp_broadcast" ? (
        <div className="preview-whatsapp-bubble">
          {images.length ? (
            <div className="preview-media-grid preview-media-grid--single">
              <img alt="" src={images[0].url} />
            </div>
          ) : null}
          <p>{caption || "Your caption will appear here."}</p>
        </div>
      ) : (
        <div className="preview-post-body">
          <div className="preview-post-author">
            <span className="preview-post-author__avatar" />
            <div>
              <strong>Fusion Digital Dynamics</strong>
              <small>Just now</small>
            </div>
          </div>
          {platform === "facebook_page" ? <p className="preview-post-caption">{caption || "Your caption will appear here."}</p> : null}
          {images.length ? (
            <div className={"preview-media-grid preview-media-grid--" + Math.min(images.length, 4)}>
              {images.slice(0, 4).map((image) => (
                <img alt="" key={image.url} src={image.url} />
              ))}
            </div>
          ) : (
            <div className="preview-media-placeholder">
              <ImageOff size={22} />
              <span>{platform === "instagram" ? "Instagram needs at least one image" : "No image attached"}</span>
            </div>
          )}
          {platform === "instagram" ? <p className="preview-post-caption">{caption || "Your caption will appear here."}</p> : null}
        </div>
      )}
    </div>
  );
}
