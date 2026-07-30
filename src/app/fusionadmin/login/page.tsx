import { redirect } from "next/navigation";
import { getFusionAdminUser } from "@/lib/auth";
import { getFusionAdminSettings } from "@/lib/crm";
import { FusionAdminLoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function FusionAdminLoginPage() {
  const user = await getFusionAdminUser();

  if (user?.isAllowed) {
    redirect("/fusionadmin");
  }

  const admin = await getFusionAdminSettings();
  const logoUrl = admin.settings?.logo_url;

  return (
    <main className="login-shell">
      <a className="brand login-brand" href="/">
        {logoUrl ? <img alt="Brand logo" className="brand-mark brand-mark--logo" src={logoUrl} /> : <span className="brand-mark">FDD</span>}
        <span>Fusion Digital Dynamics</span>
      </a>
      <section className="login-layout">
        <aside className="login-story" aria-label="Fusion admin overview">
          <p className="eyebrow">Private command center</p>
          <h1>Run sales, clients, and delivery from one polished backend.</h1>
          <p>
            Fusion Admin keeps the sales funnel connected to CRM records, paid onboarding,
            and production tasks so every new client has a clear next step.
          </p>
          <div className="login-proof-grid">
            <div>
              <strong>CRM</strong>
              <span>Lead capture and deal status</span>
            </div>
            <div>
              <strong>Tasks</strong>
              <span>Sales and production handoff</span>
            </div>
          </div>
        </aside>
        <FusionAdminLoginForm />
      </section>
    </main>
  );
}
