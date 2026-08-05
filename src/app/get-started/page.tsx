import { cookies } from "next/headers";
import { QUESTIONNAIRE_COOKIE_NAME } from "@/lib/questionnaire-cookie";
import { loadQuestionnaireState } from "@/lib/sales-questionnaire";
import { QuestionnaireFlow } from "@/components/QuestionnaireFlow";
import { getFusionAdminSettings } from "@/lib/crm";

export const metadata = {
  title: "Plan Your Website | Fusion Digital Dynamics",
  description: "Answer a few questions and get a clear, honest plan for your website project - no jargon, no pressure."
};

export default async function GetStartedPage() {
  const store = await cookies();
  const token = store.get(QUESTIONNAIRE_COOKIE_NAME)?.value || null;
  const [initialState, admin] = await Promise.all([
    token ? loadQuestionnaireState(token) : Promise.resolve(null),
    getFusionAdminSettings()
  ]);
  const logoUrl = admin.settings?.logo_url;

  return (
    <main className="shell shell-light questionnaire-page">
      <nav className="nav">
        <a className="brand" href="/">
          {logoUrl ? <img alt="Brand logo" className="brand-mark brand-mark--logo" src={logoUrl} /> : <span className="brand-mark">FDD</span>}
          <span>Fusion Digital Dynamics</span>
        </a>
      </nav>
      <div className="section questionnaire-container">
        <QuestionnaireFlow initialState={initialState} />
      </div>
    </main>
  );
}
