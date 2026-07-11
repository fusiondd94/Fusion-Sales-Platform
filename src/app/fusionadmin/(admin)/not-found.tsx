import Link from "next/link";
import { FusionEmptyState } from "./crm-ui";

export default function FusionAdminNotFound() {
  return (
    <div className="admin-content">
      <FusionEmptyState
        title="Admin page not found"
        description="The CRM section you opened is not available from this workspace."
        action={<Link className="fusion-button fusion-button--primary" href="/fusionadmin">Return to dashboard</Link>}
      />
    </div>
  );
}
