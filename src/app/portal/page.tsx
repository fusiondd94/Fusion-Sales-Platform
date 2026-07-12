import { redirect } from "next/navigation";
import { getClientPortalWorkspace } from "@/lib/portal";
import { PortalWorkspace } from "./PortalWorkspace";

type PageProps = {
  searchParams?: Promise<{ clientId?: string; highlightComment?: string }>;
};

export default async function PortalPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const workspace = await getClientPortalWorkspace(params.clientId);

  if (!workspace) {
    redirect("/portal/login");
  }

  return <PortalWorkspace highlightCommentId={params.highlightComment} workspace={workspace} />;
}
