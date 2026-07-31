import { cookies } from "next/headers";
import { QUESTIONNAIRE_COOKIE_NAME } from "@/lib/questionnaire-cookie";
import { loadQuestionnaireState } from "@/lib/sales-questionnaire";
import { QuestionnaireFlow } from "@/components/QuestionnaireFlow";

export const metadata = {
  title: "Plan Your Website | Fusion Digital Dynamics",
  description: "Answer a few questions and get a clear, honest plan for your website project - no jargon, no pressure."
};

export default async function GetStartedPage() {
  const store = await cookies();
  const token = store.get(QUESTIONNAIRE_COOKIE_NAME)?.value || null;
  const initialState = token ? await loadQuestionnaireState(token) : null;

  return (
    <main className="shell shell-light questionnaire-page">
      <nav className="nav">
        <a className="brand" href="/">
          <span className="brand-mark">FDD</span>
          <span>Fusion Digital Dynamics</span>
        </a>
      </nav>
      <div className="section questionnaire-container">
        <QuestionnaireFlow initialState={initialState} />
      </div>
    </main>
  );
}
