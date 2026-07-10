"use client";

import { useFormStatus } from "react-dom";
import type { ComponentPropsWithoutRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./utils";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={cn("fusion-button", `fusion-button--${variant}`, `fusion-button--${size}`, className)}
      disabled={pending || props.disabled}
      type="submit"
      {...props}
    >
      {pending ? (
        <>
          <Loader2 aria-hidden="true" className="fusion-spin-icon" size={16} />
          {pendingLabel || "Saving..."}
        </>
      ) : (
        children
      )}
    </button>
  );
}
