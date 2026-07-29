import { Inbox, MessageCircle, Phone, Camera } from "lucide-react";
import { cn } from "@/components/ui/utils";

export type ChannelIconType = "all" | "whatsapp" | "messenger" | "instagram";

const CHANNEL_ICON_STYLES: Record<ChannelIconType, { className: string; label: string }> = {
  all: { className: "channel-icon--all", label: "All Inbox" },
  whatsapp: { className: "channel-icon--whatsapp", label: "WhatsApp" },
  messenger: { className: "channel-icon--messenger", label: "Messenger" },
  instagram: { className: "channel-icon--instagram", label: "Instagram" }
};

export function ChannelIcon({
  type,
  size = 18,
  className
}: {
  type: ChannelIconType;
  size?: number;
  className?: string;
}) {
  const style = CHANNEL_ICON_STYLES[type] || CHANNEL_ICON_STYLES.all;
  const iconSize = Math.round(size * 0.58);

  return (
    <span
      aria-label={style.label}
      className={cn("channel-icon", style.className, className)}
      style={{ width: size, height: size }}
      title={style.label}
    >
      {type === "whatsapp" ? <Phone size={iconSize} strokeWidth={2.25} /> : null}
      {type === "messenger" ? <MessageCircle size={iconSize} strokeWidth={2.25} /> : null}
      {type === "instagram" ? <Camera size={iconSize} strokeWidth={2.25} /> : null}
      {type === "all" ? <Inbox size={iconSize} strokeWidth={2.25} /> : null}
    </span>
  );
}
