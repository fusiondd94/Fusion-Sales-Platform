import type { ReactNode } from "react";
import {
  Avatar as FusionAvatar,
  Badge as FusionBadge,
  Button as FusionButton,
  Card as FusionCard,
  Checkbox as FusionCheckbox,
  DataTable as FusionDataTable,
  Divider as FusionDivider,
  EmptyState as FusionEmptyState,
  ErrorState as FusionErrorState,
  Field as FusionField,
  FormActions as FusionFormActions,
  FormError as FusionFormError,
  FormSection as FusionFormSection,
  IconButton as FusionIconButton,
  Input as FusionInput,
  LoadingState as FusionLoadingState,
  PageContainer as FusionPageContainer,
  PageHeader as FusionPageHeader,
  Radio as FusionRadio,
  SectionHeader as FusionSectionHeader,
  Select as FusionSelect,
  Skeleton as FusionSkeleton,
  Spinner as FusionSpinner,
  SubmitButton as FusionSubmitButton,
  Switch as FusionSwitch,
  Textarea as FusionTextarea,
  Tooltip as FusionTooltip
} from "@/components/ui";

export {
  FusionAvatar,
  FusionBadge,
  FusionButton,
  FusionCard,
  FusionCheckbox,
  FusionDataTable,
  FusionDivider,
  FusionEmptyState,
  FusionErrorState,
  FusionField,
  FusionFormActions,
  FusionFormError,
  FusionFormSection,
  FusionIconButton,
  FusionInput,
  FusionLoadingState,
  FusionPageContainer,
  FusionPageHeader,
  FusionRadio,
  FusionSectionHeader,
  FusionSelect,
  FusionSkeleton,
  FusionSpinner,
  FusionSubmitButton,
  FusionSwitch,
  FusionTextarea,
  FusionTooltip
};

export function formatDate(value: string | null | undefined) {
  if (!value) return "Open";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function optionList(values?: string[] | null) {
  return values?.length ? values : [];
}

const STATUS_TONE_MAP: Record<string, "success" | "warning" | "danger" | "info" | "teal" | "neutral"> = {
  won: "success",
  paid: "success",
  accepted: "success",
  active: "success",
  client: "success",
  done: "success",
  resolved: "success",
  published: "success",
  qualified: "teal",
  proposal_sent: "teal",
  in_progress: "teal",
  sent: "info",
  new: "info",
  prospect: "info",
  captured: "info",
  checkout_started: "info",
  not_started: "neutral",
  draft: "neutral",
  review: "warning",
  partial: "warning",
  on_hold: "warning",
  pending: "warning",
  lost: "danger",
  declined: "danger",
  expired: "danger",
  unqualified: "danger",
  inactive: "danger",
  unpaid: "danger"
};

export function statusTone(status: string | null | undefined): "success" | "warning" | "danger" | "info" | "teal" | "neutral" {
  if (!status) return "neutral";
  return STATUS_TONE_MAP[status.toLowerCase()] || "neutral";
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="admin-empty">{children}</p>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="admin-page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
      {action ? <div className="admin-page-action">{action}</div> : null}
    </section>
  );
}
