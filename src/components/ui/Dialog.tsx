"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "./utils";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    const focusable = node?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fusion-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-describedby={description ? descId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn("fusion-dialog", className)}
        ref={dialogRef}
        role="dialog"
      >
        <h2 id={titleId}>{title}</h2>
        {description ? <p id={descId}>{description}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary"
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
}) {
  return (
    <Dialog description={description} onClose={onClose} open={open} title={title}>
      <div className="fusion-dialog-actions">
        <button className="fusion-button fusion-button--ghost" onClick={onClose} type="button">
          {cancelLabel}
        </button>
        <button
          className={cn("fusion-button", tone === "danger" ? "fusion-button--danger" : "fusion-button--primary")}
          onClick={() => {
            onConfirm();
            onClose();
          }}
          type="button"
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
