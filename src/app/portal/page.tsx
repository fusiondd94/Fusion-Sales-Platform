import { redirect } from "next/navigation";
import { getClientPortalWorkspace } from "@/lib/portal";
import { getFusionAdminSettings } from "@/lib/crm";
import { getOrderBalancesForClient } from "@/lib/sales-orders";
import { PortalWorkspace } from "./PortalWorkspace";

type PageProps = {
  searchParams?: Promise<{ clientId?: string; highlightComment?: string }>;
};

export default async function PortalPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const [workspace, admin] = await Promise.all([getClientPortalWorkspace(params.clientId), getFusionAdminSettings()]);

  if (!workspace) {
    redirect("/portal/login");
  }

  const balances = workspace.client.id.startsWith("admin-preview-") ? [] : await getOrderBalancesForClient(workspace.client.id);

  return (
    <PortalWorkspace
      balances={balances}
      highlightCommentId={params.highlightComment}
      logoUrl={admin.settings?.logo_url ?? null}
      workspace={workspace}
    />
  );
}
