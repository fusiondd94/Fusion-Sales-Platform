export type EmailBlockType = "heading" | "text" | "image" | "button" | "divider" | "spacer";

export type EmailBlock = {
  id: string;
  type: EmailBlockType;
  text?: string;
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  src?: string;
  alt?: string;
  width?: number;
  link?: string;
  label?: string;
  url?: string;
  bgColor?: string;
  textColor?: string;
  borderRadius?: number;
  height?: number;
};

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function renderBlockHtml(block: EmailBlock, trackClickUrl?: (url: string) => string): string {
  switch (block.type) {
    case "heading": {
      const size = block.fontSize || 26;
      const color = block.color || "#004443";
      const align = block.align || "left";
      const weight = block.bold === false ? 400 : 700;
      return `<h2 style="margin:0 0 16px;font-family:Inter,Arial,sans-serif;font-size:${size}px;color:${color};text-align:${align};font-weight:${weight};">${escapeHtml(block.text || "")}</h2>`;
    }
    case "text": {
      const size = block.fontSize || 15;
      const color = block.color || "#36454f";
      const align = block.align || "left";
      const weight = block.bold ? 700 : 400;
      const content = escapeHtml(block.text || "").replace(/\n/g, "<br />");
      return `<p style="margin:0 0 16px;font-family:Inter,Arial,sans-serif;font-size:${size}px;line-height:1.6;color:${color};text-align:${align};font-weight:${weight};">${content}</p>`;
    }
    case "image": {
      const align = block.align || "center";
      const width = block.width || 560;
      const img = `<img src="${escapeHtml(block.src || "")}" alt="${escapeHtml(block.alt || "")}" width="${width}" style="max-width:100%;display:block;border:0;margin:${align === "center" ? "0 auto" : "0"};" />`;
      const wrapped = block.link ? `<a href="${escapeHtml(trackClickUrl ? trackClickUrl(block.link) : block.link)}" target="_blank" rel="noopener">${img}</a>` : img;
      return `<div style="margin:0 0 16px;text-align:${align};">${wrapped}</div>`;
    }
    case "button": {
      const align = block.align || "left";
      const href = trackClickUrl ? trackClickUrl(block.url || "#") : (block.url || "#");
      const bg = block.bgColor || "#0f766e";
      const color = block.textColor || "#ffffff";
      const radius = block.borderRadius ?? 8;
      return `<div style="margin:0 0 20px;text-align:${align};"><a href="${escapeHtml(href)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 28px;background:${bg};color:${color};text-decoration:none;font-family:Inter,Arial,sans-serif;font-weight:600;border-radius:${radius}px;">${escapeHtml(block.label || "Click here")}</a></div>`;
    }
    case "divider":
      return `<hr style="border:none;border-top:1px solid ${block.color || "#dfe5ea"};margin:20px 0;" />`;
    case "spacer":
      return `<div style="height:${block.height || 24}px;line-height:${block.height || 24}px;">&nbsp;</div>`;
    default:
      return "";
  }
}

export function renderBlocksToHtml(blocks: EmailBlock[], opts?: { trackingBaseUrl?: string; sendId?: string }): string {
  const trackClickUrl = opts?.trackingBaseUrl && opts?.sendId
    ? (url: string) => `${opts.trackingBaseUrl}/api/email/track/click/${opts.sendId}?u=${encodeURIComponent(url)}`
    : undefined;
  const body = blocks.map((block) => renderBlockHtml(block, trackClickUrl)).join("\n                ");
  const pixel = opts?.trackingBaseUrl && opts?.sendId
    ? `<img src="${opts.trackingBaseUrl}/api/email/track/open/${opts.sendId}" width="1" height="1" alt="" style="display:block;border:0;" />`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;background:#f7f8fa;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dfe5ea;border-radius:8px;padding:32px;">
            <tr>
              <td>
                ${body}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ${pixel}
  </body>
</html>`;
}

export const DEFAULT_CAMPAIGN_BLOCKS: EmailBlock[] = [
  { id: "block-1", type: "heading", text: "Your headline here", fontSize: 26, color: "#004443", align: "left", bold: true },
  { id: "block-2", type: "text", text: "Write your message to your audience here. Add images, buttons, dividers, and spacers from the panel on the left.", fontSize: 15, color: "#36454f", align: "left" },
  { id: "block-3", type: "button", label: "Get started", url: "https://fusiondigitaldynamics.com", bgColor: "#0f766e", textColor: "#ffffff", align: "left", borderRadius: 8 }
];

export function safeParseBlocks(raw: string): EmailBlock[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry === "object" && typeof entry.id === "string" && typeof entry.type === "string")
      .slice(0, 60);
  } catch {
    return [];
  }
}

export function newBlockId() {
  return `block-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultBlock(type: EmailBlockType): EmailBlock {
  const id = newBlockId();
  switch (type) {
    case "heading":
      return { id, type, text: "New headline", fontSize: 26, color: "#004443", align: "left", bold: true };
    case "text":
      return { id, type, text: "Write your paragraph here.", fontSize: 15, color: "#36454f", align: "left" };
    case "image":
      return { id, type, src: "https://placehold.co/560x240", alt: "", width: 560, align: "center", link: "" };
    case "button":
      return { id, type, label: "Click here", url: "https://", bgColor: "#0f766e", textColor: "#ffffff", align: "left", borderRadius: 8 };
    case "divider":
      return { id, type, color: "#dfe5ea" };
    case "spacer":
      return { id, type, height: 24 };
    default:
      return { id, type: "text", text: "" };
  }
}
