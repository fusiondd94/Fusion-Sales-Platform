"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  GripVertical,
  Heading,
  ImageIcon,
  Minus,
  MousePointerClick,
  Send,
  Space,
  Trash2,
  Type
} from "lucide-react";
import { createDefaultBlock, renderBlocksToHtml, type EmailBlock, type EmailBlockType } from "@/lib/email-blocks";

type AudienceOption = { id: string; name: string; member_count?: number };

type SaveState = { error?: string; saved?: boolean };

const BLOCK_LIBRARY: { type: EmailBlockType; label: string; icon: typeof Type }[] = [
  { type: "heading", label: "Heading", icon: Heading },
  { type: "text", label: "Text", icon: Type },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "button", label: "Button", icon: MousePointerClick },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "spacer", label: "Spacer", icon: Space }
];

function blockPreviewLabel(block: EmailBlock) {
  if (block.type === "heading" || block.type === "text") return block.text || "(empty)";
  if (block.type === "button") return block.label || "(button)";
  if (block.type === "image") return block.src ? "Image" : "(no image set)";
  if (block.type === "divider") return "Divider";
  return "Spacer";
}

export function EmailCampaignBuilder({
  campaignId,
  initialCampaignName,
  initialSubject,
  initialFromName,
  initialFromEmail,
  initialReplyTo,
  initialAudienceId,
  initialBlocks,
  status,
  audiences,
  saveAction,
  sendAction,
  sendError,
  sentCount
}: {
  campaignId: string;
  initialCampaignName: string;
  initialSubject: string;
  initialFromName: string;
  initialFromEmail: string;
  initialReplyTo: string;
  initialAudienceId: string;
  initialBlocks: EmailBlock[];
  status: string;
  audiences: AudienceOption[];
  saveAction: (prevState: SaveState | undefined, formData: FormData) => Promise<SaveState>;
  sendAction: (formData: FormData) => void | Promise<void>;
  sendError?: string;
  sentCount?: string;
}) {
  const [blocks, setBlocks] = useState<EmailBlock[]>(initialBlocks.length ? initialBlocks : []);
  const [selectedId, setSelectedId] = useState<string | null>(blocks[0]?.id || null);
  const [campaignName, setCampaignName] = useState(initialCampaignName);
  const [subject, setSubject] = useState(initialSubject);
  const [fromName, setFromName] = useState(initialFromName);
  const [fromEmail, setFromEmail] = useState(initialFromEmail);
  const [replyTo, setReplyTo] = useState(initialReplyTo);
  const [audienceId, setAudienceId] = useState(initialAudienceId);
  const dragIndex = useRef<number | null>(null);
  const [state, formAction, pending] = useActionState(saveAction, undefined);

  const isDraft = status === "draft" || status === "failed";
  const selectedBlock = blocks.find((block) => block.id === selectedId) || null;
  const previewHtml = useMemo(() => renderBlocksToHtml(blocks), [blocks]);
  const blocksJson = useMemo(() => JSON.stringify(blocks), [blocks]);

  function addBlock(type: EmailBlockType) {
    const block = createDefaultBlock(type);
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
  }

  function updateSelectedBlock(patch: Partial<EmailBlock>) {
    if (!selectedId) return;
    setBlocks((prev) => prev.map((block) => (block.id === selectedId ? { ...block, ...patch } : block)));
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((block) => block.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function handleDrop(targetIndex: number) {
    const sourceIndex = dragIndex.current;
    dragIndex.current = null;
    if (sourceIndex === null || sourceIndex === targetIndex) return;
    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  return (
    <div className="email-builder">
      <form action={formAction} className="email-builder__meta admin-panel" data-track-unsaved="true">
        <input name="campaignId" type="hidden" value={campaignId} />
        <input name="contentBlocksJson" type="hidden" value={blocksJson} />
        <div className="email-builder__meta-grid">
          <label>
            <span>Campaign name</span>
            <input name="campaignName" onChange={(event) => setCampaignName(event.target.value)} required value={campaignName} />
          </label>
          <label>
            <span>Subject line</span>
            <input name="subject" onChange={(event) => setSubject(event.target.value)} required value={subject} />
          </label>
          <label>
            <span>From name</span>
            <input name="fromName" onChange={(event) => setFromName(event.target.value)} value={fromName} />
          </label>
          <label>
            <span>From email</span>
            <input name="fromEmail" onChange={(event) => setFromEmail(event.target.value)} type="email" value={fromEmail} />
          </label>
          <label>
            <span>Reply-to</span>
            <input name="replyTo" onChange={(event) => setReplyTo(event.target.value)} type="email" value={replyTo} />
          </label>
          <label>
            <span>Audience</span>
            <select name="audienceId" onChange={(event) => setAudienceId(event.target.value)} value={audienceId}>
              <option value="">No audience selected</option>
              {audiences.map((audience) => (
                <option key={audience.id} value={audience.id}>{audience.name} ({audience.member_count ?? 0} contacts)</option>
              ))}
            </select>
          </label>
        </div>
        <div className="email-builder__meta-actions">
          {state?.error ? <p className="form-error">{state.error}</p> : null}
          {state?.saved ? <p className="form-success">Campaign saved.</p> : null}
          <button className="primary-button compact-button" disabled={pending} type="submit">
            {pending ? "Saving..." : "Save campaign"}
          </button>
        </div>
      </form>

      {sendError ? <p className="form-error">{sendError}</p> : null}
      {sentCount ? <p className="form-success">Campaign sent to {sentCount} recipients.</p> : null}

      <div className="email-builder__workspace">
        <aside className="email-builder__library admin-panel">
          <h3>Add block</h3>
          <div className="email-builder__library-grid">
            {BLOCK_LIBRARY.map((entry) => {
              const Icon = entry.icon;
              return (
                <button key={entry.type} className="email-builder__library-item" onClick={() => addBlock(entry.type)} type="button">
                  <Icon size={18} />
                  <span>{entry.label}</span>
                </button>
              );
            })}
          </div>

          {selectedBlock ? (
            <div className="email-builder__inspector">
              <h3>Block settings</h3>
              <BlockInspector block={selectedBlock} onChange={updateSelectedBlock} />
              <button className="ghost-button compact-button content-delete-button" onClick={() => removeBlock(selectedBlock.id)} type="button">
                <Trash2 size={14} /> Remove block
              </button>
            </div>
          ) : (
            <p className="muted email-builder__inspector-empty">Select a block to edit its style.</p>
          )}
        </aside>

        <div className="email-builder__canvas admin-panel">
          <h3>Layout</h3>
          {blocks.length ? (
            <div className="email-builder__block-list">
              {blocks.map((block, index) => (
                <div
                  className={`email-builder__block${block.id === selectedId ? " email-builder__block--selected" : ""}`}
                  draggable
                  key={block.id}
                  onClick={() => setSelectedId(block.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDragStart={() => { dragIndex.current = index; }}
                  onDrop={() => handleDrop(index)}
                >
                  <GripVertical className="email-builder__drag-handle" size={16} />
                  <div className="email-builder__block-body">
                    <span className="email-builder__block-type">{block.type}</span>
                    <span className="email-builder__block-preview">{blockPreviewLabel(block)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Add a block from the left to start building your email.</p>
          )}
        </div>

        <div className="email-builder__preview admin-panel">
          <h3>Preview</h3>
          <iframe className="email-builder__preview-frame" sandbox="" srcDoc={previewHtml} title="Email preview" />
        </div>
      </div>

      {isDraft ? (
        <form action={sendAction} className="email-builder__send">
          <input name="campaignId" type="hidden" value={campaignId} />
          <button className="primary-button" type="submit">
            <Send size={16} /> Send campaign now
          </button>
          <span className="muted">Requires a saved audience and a connected Resend API key.</span>
        </form>
      ) : null}
    </div>
  );
}

function BlockInspector({ block, onChange }: { block: EmailBlock; onChange: (patch: Partial<EmailBlock>) => void }) {
  const alignRow = (
    <div className="email-builder__align-row">
      <button className={block.align === "left" || !block.align ? "active" : ""} onClick={() => onChange({ align: "left" })} type="button"><AlignLeft size={14} /></button>
      <button className={block.align === "center" ? "active" : ""} onClick={() => onChange({ align: "center" })} type="button"><AlignCenter size={14} /></button>
      <button className={block.align === "right" ? "active" : ""} onClick={() => onChange({ align: "right" })} type="button"><AlignRight size={14} /></button>
    </div>
  );

  if (block.type === "heading" || block.type === "text") {
    return (
      <div className="email-builder__field-group">
        <label>
          <span>Content</span>
          <textarea onChange={(event) => onChange({ text: event.target.value })} rows={4} value={block.text || ""} />
        </label>
        <label>
          <span>Font size ({block.fontSize || (block.type === "heading" ? 26 : 15)}px)</span>
          <input max={48} min={10} onChange={(event) => onChange({ fontSize: Number(event.target.value) })} type="range" value={block.fontSize || (block.type === "heading" ? 26 : 15)} />
        </label>
        <label>
          <span>Color</span>
          <input onChange={(event) => onChange({ color: event.target.value })} type="color" value={block.color || "#26333b"} />
        </label>
        <label className="email-builder__checkbox">
          <input checked={block.bold !== false} onChange={(event) => onChange({ bold: event.target.checked })} type="checkbox" />
          <span>Bold</span>
        </label>
        <span>Align</span>
        {alignRow}
      </div>
    );
  }

  if (block.type === "image") {
    return (
      <div className="email-builder__field-group">
        <label>
          <span>Image URL</span>
          <input onChange={(event) => onChange({ src: event.target.value })} placeholder="https://" value={block.src || ""} />
        </label>
        <label>
          <span>Alt text</span>
          <input onChange={(event) => onChange({ alt: event.target.value })} value={block.alt || ""} />
        </label>
        <label>
          <span>Link (optional)</span>
          <input onChange={(event) => onChange({ link: event.target.value })} placeholder="https://" value={block.link || ""} />
        </label>
        <label>
          <span>Width ({block.width || 560}px)</span>
          <input max={600} min={80} onChange={(event) => onChange({ width: Number(event.target.value) })} type="range" value={block.width || 560} />
        </label>
        <span>Align</span>
        {alignRow}
      </div>
    );
  }

  if (block.type === "button") {
    return (
      <div className="email-builder__field-group">
        <label>
          <span>Label</span>
          <input onChange={(event) => onChange({ label: event.target.value })} value={block.label || ""} />
        </label>
        <label>
          <span>Link URL</span>
          <input onChange={(event) => onChange({ url: event.target.value })} placeholder="https://" value={block.url || ""} />
        </label>
        <label>
          <span>Background</span>
          <input onChange={(event) => onChange({ bgColor: event.target.value })} type="color" value={block.bgColor || "#0f766e"} />
        </label>
        <label>
          <span>Text color</span>
          <input onChange={(event) => onChange({ textColor: event.target.value })} type="color" value={block.textColor || "#ffffff"} />
        </label>
        <label>
          <span>Corner radius ({block.borderRadius ?? 8}px)</span>
          <input max={24} min={0} onChange={(event) => onChange({ borderRadius: Number(event.target.value) })} type="range" value={block.borderRadius ?? 8} />
        </label>
        <span>Align</span>
        {alignRow}
      </div>
    );
  }

  if (block.type === "divider") {
    return (
      <div className="email-builder__field-group">
        <label>
          <span>Color</span>
          <input onChange={(event) => onChange({ color: event.target.value })} type="color" value={block.color || "#dfe5ea"} />
        </label>
      </div>
    );
  }

  return (
    <div className="email-builder__field-group">
      <label>
        <span>Height ({block.height || 24}px)</span>
        <input max={120} min={8} onChange={(event) => onChange({ height: Number(event.target.value) })} type="range" value={block.height || 24} />
      </label>
    </div>
  );
}
