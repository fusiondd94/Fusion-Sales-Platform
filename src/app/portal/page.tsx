import { redirect } from "next/navigation";
import { getClientPortalWorkspace } from "@/lib/portal";
import { getFusionAdminSettings } from "@/lib/crm";
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

  return <PortalWorkspace highlightCommentId={params.highlightComment} logoUrl={admin.settings?.logo_url ?? null} workspace={workspace} />;
}
