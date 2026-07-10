import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "./utils";

type Tone = "neutral" | "teal" | "gold" | "success" | "warning" | "danger" | "info";

export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button className={cn("fusion-button", `fusion-button--${variant}`, `fusion-button--${size}`, className)} type={type} {...props}>
      {children}
    </button>
  );
}

export function IconButton({
  label,
  variant = "secondary",
  size = "md",
  type = "button",
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      aria-label={label}
      className={cn("fusion-icon-button", `fusion-button--${variant}`, `fusion-icon-button--${size}`, className)}
      title={label}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  className,
  elevated = false,
  children,
  ...props
}: ComponentPropsWithoutRef<"article"> & { elevated?: boolean }) {
  return (
    <article className={cn("fusion-card", elevated && "fusion-card--elevated", className)} {...props}>
      {children}
    </article>
  );
}

export function PageContainer({ className, children, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("fusion-page-container", className)} {...props}>
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("fusion-page-header", className)}>
      <div>
        {eyebrow ? <p className="fusion-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="fusion-page-header__action">{action}</div> : null}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("fusion-section-header", className)}>
      <div>
        {eyebrow ? <p className="fusion-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="fusion-section-header__action">{action}</div> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("fusion-field", error && "fusion-field--error", className)}>
      <span>
        {label}
        {required ? <strong aria-hidden="true">*</strong> : null}
      </span>
      {children}
      {hint ? <small>{hint}</small> : null}
      {error ? <small className="fusion-field__error">{error}</small> : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cn("fusion-control", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cn("fusion-control fusion-control--textarea", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentPropsWithoutRef<"select">) {
  return (
    <select className={cn("fusion-control", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: ComponentPropsWithoutRef<"input"> & { label: string; description?: string }) {
  return (
    <label className={cn("fusion-choice", className)}>
      <input type="checkbox" {...props} />
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  );
}

export function Radio({
  label,
  description,
  className,
  ...props
}: ComponentPropsWithoutRef<"input"> & { label: string; description?: string }) {
  return (
    <label className={cn("fusion-choice", className)}>
      <input type="radio" {...props} />
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  );
}

export function Switch({
  label,
  description,
  className,
  ...props
}: ComponentPropsWithoutRef<"input"> & { label: string; description?: string }) {
  return (
    <label className={cn("fusion-switch", className)}>
      <input role="switch" type="checkbox" {...props} />
      <span className="fusion-switch__track" aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  );
}

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"span"> & { tone?: Tone }) {
  return (
    <span className={cn("fusion-badge", `fusion-badge--${tone}`, className)} {...props}>
      {children}
    </span>
  );
}

export function Avatar({
  name,
  src,
  className
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "F";

  return (
    <span className={cn("fusion-avatar", className)} title={name}>
      {src ? <img alt="" src={src} /> : initials}
    </span>
  );
}

export function Tooltip({
  label,
  children,
  className
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("fusion-tooltip", className)}>
      {children}
      <span className="fusion-tooltip__content" role="tooltip">
        {label}
      </span>
    </span>
  );
}

export function Divider({ className, ...props }: ComponentPropsWithoutRef<"hr">) {
  return <hr className={cn("fusion-divider", className)} {...props} />;
}

export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("fusion-skeleton", className)} aria-hidden="true" {...props} />;
}

export function Spinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("fusion-spinner", className)} role="status">
      <Loader2 size={16} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function EmptyState({
  title = "No records yet",
  description,
  action,
  className,
  children
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("fusion-state fusion-state--empty", className)}>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : children ? <p>{children}</p> : null}
      {action ? <div className="fusion-state__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something needs attention",
  description,
  action,
  className
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("fusion-state fusion-state--error", className)} role="alert">
      <AlertCircle size={20} aria-hidden="true" />
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action ? <div className="fusion-state__action">{action}</div> : null}
    </div>
  );
}

export function LoadingState({
  title = "Loading",
  description,
  className
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("fusion-state fusion-state--loading", className)} role="status">
      <Spinner label={title} />
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function FormSection({
  title,
  description,
  className,
  children
}: {
  title?: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={cn("fusion-form-section", className)}>
      {title ? (
        <legend>
          <span>{title}</span>
          {description ? <small>{description}</small> : null}
        </legend>
      ) : null}
      <div className="fusion-form-section__grid">{children}</div>
    </fieldset>
  );
}

export function FormActions({
  align = "end",
  sticky = false,
  className,
  children
}: {
  align?: "start" | "end" | "between";
  sticky?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "fusion-form-actions",
        `fusion-form-actions--${align}`,
        sticky && "fusion-form-actions--sticky",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FormError({
  message,
  className
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;

  return (
    <p className={cn("fusion-form-error", className)} role="alert">
      <AlertCircle aria-hidden="true" size={16} />
      <span>{message}</span>
    </p>
  );
}
