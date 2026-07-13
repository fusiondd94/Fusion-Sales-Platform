import type { ReactNode } from "react";
import { LogOut, ShieldAlert } from "lucide-react";
import { signOutFusionAdmin } from "@/app/fusionadmin/actions";
import { requireFusionAdmin } from "@/lib/auth";
import { getAdminNotifications } from "@/lib/portal";
import { AdminShell } from "./AdminShell";

export const dynamic = "force-dynamic";

export default async function FusionAdminLayout({ children }: { children: ReactNode }) {
  const user = await requireFusionAdmin();

  if (!user.isAllowed) {
    return (
      <main className="shell">
        <section className="login-shell">
          <article className="login-card">
            <div className="login-icon">
              <ShieldAlert size={24} />
            </div>
            <p className="eyebrow">Access denied</p>
            <h1>This account is not allowed into Fusion Admin.</h1>
            <p className="muted">Ask an owner to add {user.email} as a Fusion CRM team member or to FUSION_ADMIN_EMAILS.</p>
            <form action={signOutFusionAdmin}>
              <button className="primary-button" type="submit">
                Sign out <LogOut size={17} />
              </button>
            </form>
          </article>
        </section>
      </main>
    );
  }

  const notifications = await getAdminNotifications();
  return (
    <AdminShell notifications={notifications} user={user}>
      {children}
    </AdminShell>
  );
}
