import { loadResultByShareToken, recordResultView } from "@/lib/sales-result";
import { ResultView } from "@/app/results/[token]/ResultView";
import { getFusionAdminSettings } from "@/lib/crm";
import "@/app/results/[token]/results.css";

export const metadata = {
    title: "Your Website Plan | Fusion Digital Dynamics",
    description: "View your personalized Fusion Digital Dynamics website plan and let us know how you'd like to move forward."
};

export default async function SharedResultPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const [loaded, admin] = await Promise.all([loadResultByShareToken(token), getFusionAdminSettings()]);
    const logoUrl = admin.settings?.logo_url;

  if (!loaded.ok) {
        return (
                <main className="shell shell-light questionnaire-page">
                        <nav className="nav">
                                  <a className="brand" href="/">
                                              {logoUrl ? <img alt="Brand logo" className="brand-mark brand-mark--logo" src={logoUrl} /> : <span className="brand-mark">FDD</span>}
                                  <span>Fusion Digital Dynamics</span>
                                  </a>
                        </nav>
                        <div className="section questionnaire-container">
                                  <section className="flow-panel">
                                              <p className="eyebrow">Fusion Digital Dynamics</p>
                                              <h2>We couldn&apos;t find this plan.</h2>
                                              <p className="muted">{loaded.reason} Double-check the link, or reach out and we&apos;ll resend it.</p>
                                  </section>
                        </div>
                </main>
              );
  }

    // Recording the view is a fire-and-forget side effect of loading the
    // page - it never blocks or affects what's rendered, and never trusts
    // anything the client sends (the token was already validated above).
    await recordResultView(token);

    return (
          <main className="shell shell-light questionnaire-page">
                <nav className="nav">
                        <a className="brand" href="/">
                                  {logoUrl ? <img alt="Brand logo" className="brand-mark brand-mark--logo" src={logoUrl} /> : <span className="brand-mark">FDD</span>}
                                  <span>Fusion Digital Dynamics</span>
                        </a>
                </nav>
                <div className="section questionnaire-container">
                        <ResultView result={loaded.result} token={token} />
                </div>
          </main>
        );
}
