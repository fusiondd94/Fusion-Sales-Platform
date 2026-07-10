import { redirect } from "next/navigation";
import { getClientPortalWorkspace } from "@/lib/portal";
import { PortalWorkspace } from "./PortalWorkspace";

export default async function PortalPage() {
  const workspace = await getClientPortalWorkspace();

  if (!workspace) {
    redirect("/portal/login");
  }

  return <PortalWorkspace workspace={workspace} />;
}
