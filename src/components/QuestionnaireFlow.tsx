"use client";

import { ArrowRight, Check, ChevronLeft, CreditCard, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AnswerMap, AnswerValue, QuestionDefinition, QuestionnaireStep } from "@/lib/questionnaire-schema";
import { QUESTIONNAIRE_STEPS, getVisibleStepQuestions } from "@/lib/questionnaire-schema";
import type { ConsultationReason, QuestionnaireState } from "@/lib/sales-questionnaire";
import type { BudgetAssessmentResult, NextStep, NextStepAction } from "@/lib/sales-rules";
import type { FeasibilityStatus, RecommendationPath } from "@/lib/recommendation-engine";
import type { StoredRecommendation } from "@/lib/sales-recommendation";
import {
    generateRecommendationAction,
    requestConsultationAction,
    saveForLaterAction,
    startQuestionnaireAction,
    submitAnswerAction,
    submitBudgetAction
} from "@/app/get-started/actions";
import { createRecommendationCheckoutAction } from "@/app/get-started/actions";

const FEASIBILITY_LABELS: Record<FeasibilityStatus, string> = {
    READY_TO_PROCEED: "Ready to proceed",
    READY_WITH_REDUCED_SCOPE: "Ready with a smaller starting scope",
    PAYMENT_PLAN_RECOMMENDED: "A payment plan can bridge the gap",
    PHASED_BUILD_RECOMMENDED: "A phased build is recommended",
    CONSULTATION_REQUIRED: "Let's talk it through together",
    BUDGET_INSUFFICIENT: "Below our starting budget - here's what's still possible",
    INFORMATION_INCOMPLETE: "A few more details will sharpen this plan"
};

const PATH_LABELS: Record<RecommendationPath["kind"], string> = {
    recommended: "Recommended",
    growth: "Growth option",
    starter_phased: "Starter / phased option"
};

type BudgetNotice = {
    assessment: BudgetAssessmentResult;
    requiredPortalCostEstimate: number | null;
};

type SpecialAck = "not_sure" | "payment_plan" | "talk_to_someone";

const SPECIAL_BUDGET_BUTTONS: Array<{ token: SpecialAck; label: string }> = [
  { token: "not_sure", label: "I am not sure" },
  { token: "payment_plan", label: "I need a payment plan" },
  { token: "talk_to_someone", label: "I want to speak with someone" }
  ];

const NEXT_STEP_TO_CONSULTATION_REASON: Record<NextStepAction, ConsultationReason | null> = {
    schedule_consultation: "below_minimum_budget",
    offer_payment_plan: "wants_payment_plan",
    offer_phased_build: "wants_phased_build",
    save_for_later: null,
    increase_budget: null,
    check_promotions: "other"
};

const BUDGET_STEP_KEY = "budget";

const DEPOSIT_PRESETS = [20, 30, 40, 50];

export function QuestionnaireFlow({ initialState }: { initialState: QuestionnaireState | null }) {
    const [state, setState] = useState<QuestionnaireState | null>(initialState);
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [budgetNotice, setBudgetNotice] = useState<BudgetNotice | null>(null);
    const [specialAck, setSpecialAck] = useState<SpecialAck | null>(null);
    const [forceShowBudget, setForceShowBudget] = useState(false);
    const [buildingPlan, setBuildingPlan] = useState(false);
    const [reviewStepKey, setReviewStepKey] = useState<string | null>(null);
    const [actionStatus, setActionStatus] = useState<Record<string, "sending" | "sent" | "error">>({});
    const [savedForLater, setSavedForLater] = useState(false);
    const [recommendation, setRecommendation] = useState<StoredRecommendation | null>(null);
    const [recommendationStatus, setRecommendationStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const visitedRef = useRef<string[]>([]);
    const prevStepKeyRef = useRef<string | null>(null);

  useEffect(() => {
        if (state) return;
        startTransition(async () => {
                const started = await startQuestionnaireAction({
                          entryUrl: window.location.href,
                          referrerUrl: document.referrer || undefined
                });
                setState(started);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
        const currentKey = state?.nextStep?.key ?? null;
        if (prevStepKeyRef.current && prevStepKeyRef.current !== currentKey && !reviewStepKey) {
                visitedRef.current.push(prevStepKeyRef.current);
        }
        prevStepKeyRef.current = currentKey;
        setError(null);
  }, [state?.nextStep?.key, reviewStepKey]);

  useEffect(() => {
        if (!state || state.session.status !== "completed") return;
        if (recommendationStatus !== "idle") return;
        setRecommendationStatus("loading");
        generateRecommendationAction().then((result) => {
                if (result.ok) {
                          setRecommendation(result.recommendation);
                          setRecommendationStatus("ready");
                } else {
                          setRecommendationStatus("error");
                }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.session.status, recommendationStatus]);

  if (!state) {
        return (
                <section className="flow-panel questionnaire-loading">
                        <p className="eyebrow">Fusion Digital Dynamics</p>
                        <h2>Preparing your website plan…</h2>
                        <p className="muted">Just a moment while we set things up.</p>
                </section>
              );
  }
  
    if (state.session.status === "completed" && !budgetNotice && !specialAck) {
          return (
                  <RecommendationSummaryView
                            status={recommendationStatus}
                            recommendation={recommendation}
                          />
                );
    }
  
    async function handleBudgetSubmit(rawInput: string) {
          setError(null);
          startTransition(async () => {
                  const result = await submitBudgetAction(rawInput);
                  if (!result.ok) {
                            setError(result.reason);
                            return;
                  }
                  setState(result.state);
                  setForceShowBudget(false);
                  if (reviewStepKey) setReviewStepKey(null);
            
                  if (result.parseResult.kind === "amount") {
                            if (result.assessment?.belowMinimum) {
                                        setBudgetNotice({ assessment: result.assessment, requiredPortalCostEstimate: result.requiredPortalCostEstimate });
                            } else {
                                        setBuildingPlan(true);
                                        window.setTimeout(() => setBuildingPlan(false), 900);
                            }
                  } else {
                            setSpecialAck(result.parseResult.kind);
                  }
          });
    }
  
    function dismissBudgetNotice() {
          setBudgetNotice(null);
          setBuildingPlan(true);
          window.setTimeout(() => setBuildingPlan(false), 500);
    }
  
    function dismissSpecialAck() {
          setSpecialAck(null);
    }
  
    async function handleNextStepAction(step: NextStep) {
          const reason = NEXT_STEP_TO_CONSULTATION_REASON[step.action];
      
          if (step.action === "increase_budget") {
                  setBudgetNotice(null);
                  setForceShowBudget(true);
                  return;
          }
      
          if (step.action === "save_for_later") {
                  setActionStatus((prev) => ({ ...prev, [step.action]: "sending" }));
                  const result = await saveForLaterAction();
                  setActionStatus((prev) => ({ ...prev, [step.action]: result.ok ? "sent" : "error" }));
                  setSavedForLater(result.ok);
                  return;
          }
      
          if (!reason) return;
      
          setActionStatus((prev) => ({ ...prev, [step.action]: "sending" }));
          const result = await requestConsultationAction(reason, null);
          setActionStatus((prev) => ({ ...prev, [step.action]: result.ok ? "sent" : "error" }));
    }
  
    async function handleStepSubmit(questions: QuestionDefinition[], values: Record<string, AnswerValue>) {
          setError(null);
          startTransition(async () => {
                  let latestState: QuestionnaireState | null = null;
                  for (const question of questions) {
                            const value = values[question.key];
                            const result = await submitAnswerAction(question.key, value);
                            if (!result.ok) {
                                        setError(result.reason);
                                        return;
                            }
                            latestState = result.state;
                  }
                  if (latestState) {
                            setState(latestState);
                            if (reviewStepKey) setReviewStepKey(null);
                  }
          });
    }
  
    function handleBack() {
          const lastKey = visitedRef.current.pop();
          if (lastKey) setReviewStepKey(lastKey);
    }
  
    if (budgetNotice) {
          return (
                  <BudgetNoticeView
                            notice={budgetNotice}
                            actionStatus={actionStatus}
                            savedForLater={savedForLater}
                            onAction={handleNextStepAction}
                            onContinue={dismissBudgetNotice}
                          />
                );
    }
  
    if (specialAck) {
          return <SpecialAckView token={specialAck} onContinue={dismissSpecialAck} />;
    }
  
    if (buildingPlan) {
          return (
                  <section className="flow-panel building-plan">
                          <p className="eyebrow">Fusion Digital Dynamics</p>
                          <h2>Building your website plan…</h2>
                          <p className="muted">Reviewing your budget against required launch products.</p>
                  </section>
                );
    }
  
    const activeStep: QuestionnaireStep | null = reviewStepKey
          ? QUESTIONNAIRE_STEPS.find((step) => step.key === reviewStepKey) || null
          : forceShowBudget
          ? QUESTIONNAIRE_STEPS.find((step) => step.key === BUDGET_STEP_KEY) || null
          : state.nextStep;
  
    if (!activeStep) {
          return (
                  <section className="flow-panel">
                          <p className="eyebrow">Fusion Digital Dynamics</p>
                          <h2>Thanks - that's everything we need.</h2>
                  </section>
                );
    }
  
    const canGoBack = !reviewStepKey && !forceShowBudget && visitedRef.current.length > 0;
    const stepQuestions = getVisibleStepQuestions(activeStep, state.answers);
  
    return (
          <section className="flow-panel">
                <div className="progress" aria-label={`Step ${state.stepProgress.currentStepNumber} of ${state.stepProgress.totalSteps}`}>
                        <span style={{ width: `${state.stepProgress.percent}%` }} />
                </div>
          
            {activeStep.key === BUDGET_STEP_KEY ? (
                    <BudgetStep pending={pending} error={error} onSubmit={handleBudgetSubmit} />
                  ) : (
                    <StepView
                                step={activeStep}
                                questions={stepQuestions}
                                answers={state.answers}
                                pending={pending}
                                error={error}
                                onSubmit={(values) => handleStepSubmit(stepQuestions, values)}
                              />
                  )}
          
                <div className="flow-actions">
                        <button className="secondary-button" disabled={!canGoBack || pending} onClick={handleBack} type="button">
                                  <ChevronLeft size={17} /> Back
                        </button>
                </div>
          </section>
        );
}

function BudgetStep({
    pending,
    error,
    onSubmit
}: {
    pending: boolean;
    error: string | null;
    onSubmit: (raw: string) => void;
}) {
    const [value, setValue] = useState("");
  
    return (
          <>
                <p className="eyebrow">Investment</p>
                <h2>What is the total budget you are currently planning for your website project?</h2>
                <p className="muted">
                        This may need to cover both the website build and the products needed to launch it (domain, hosting, SSL, and
                        similar). Those are purchased separately through the Fusion client portal, but we estimate them here so you see
                        the full picture.
                </p>
                <div className="form-grid">
                        <label className="full-field">
                                  Total planned budget
                                  <input
                                                aria-label="Total planned budget"
                                                inputMode="decimal"
                                                onChange={(event) => setValue(event.target.value)}
                                                placeholder="e.g. 1200"
                                                value={value}
                                              />
                        </label>
                </div>
            {error ? <p className="form-error">{error}</p> : null}
                <div className="flow-actions">
                        <button className="primary-button" disabled={pending || !value.trim()} onClick={() => onSubmit(value)} type="button">
                                  Continue <ArrowRight size={17} />
                        </button>
                </div>
                <div className="option-grid budget-quick-options">
                  {SPECIAL_BUDGET_BUTTONS.map((option) => (
                      <button
                                    className="option-button"
                                    disabled={pending}
                                    key={option.token}
                                    onClick={() => onSubmit(option.token)}
                                    type="button"
                                  >
                        {option.label}
                      </button>
                    ))}
                </div>
          </>
        );
}

function buildInitialStepValues(questions: QuestionDefinition[], answers: AnswerMap): Record<string, AnswerValue> {
    const result: Record<string, AnswerValue> = {};
    for (const question of questions) {
          const existing = answers[question.key];
          if (question.type === "multi_select") {
                  result[question.key] = Array.isArray(existing) ? existing : [];
          } else {
                  result[question.key] = typeof existing === "string" ? existing : "";
          }
    }
    return result;
}

function StepView({
    step,
    questions,
    answers,
    pending,
    error,
    onSubmit
}: {
    step: QuestionnaireStep;
    questions: QuestionDefinition[];
    answers: AnswerMap;
    pending: boolean;
    error: string | null;
    onSubmit: (values: Record<string, AnswerValue>) => void;
}) {
    const [values, setValues] = useState<Record<string, AnswerValue>>(() => buildInitialStepValues(questions, answers));
  
    useEffect(() => {
          setValues(buildInitialStepValues(questions, answers));
          // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step.key]);
  
    function setFieldValue(key: string, value: AnswerValue) {
          setValues((current) => ({ ...current, [key]: value }));
    }
  
    function toggleMultiOption(key: string, option: string) {
          setValues((current) => {
                  const existing = Array.isArray(current[key]) ? (current[key] as string[]) : [];
                  const next = existing.includes(option) ? existing.filter((item) => item !== option) : [...existing, option];
                  return { ...current, [key]: next };
          });
    }
  
    const canContinue = questions.every((question) => {
          if (!question.required) return true;
          const value = values[question.key];
          if (Array.isArray(value)) return value.length > 0;
          return typeof value === "string" && value.trim().length > 0;
    });
  
    return (
          <>
                <p className="eyebrow">{step.title}</p>
                <h2>{step.heading}</h2>
          
                <div className="step-questions">
                  {questions.map((question) => (
                      <div className="step-question" key={question.key}>
                                  <p className="question-prompt">
                                    {question.prompt}
                                    {!question.required ? <span className="optional-tag"> (optional)</span> : null}
                                  </p>
                        {question.help ? <p className="muted">{question.help}</p> : null}
                                  <QuestionField
                                                  question={question}
                                                  value={values[question.key] ?? (question.type === "multi_select" ? [] : "")}
                                                  onTextChange={(value) => setFieldValue(question.key, value)}
                                                  onToggleOption={(option) =>
                                                                    question.type === "multi_select" ? toggleMultiOption(question.key, option) : setFieldValue(question.key, option)
                                                  }
                                                />
                      </div>
                    ))}
                </div>
          
            {error ? <p className="form-error">{error}</p> : null}
          
                <div className="flow-actions">
                        <button className="primary-button" disabled={pending || !canContinue} onClick={() => onSubmit(values)} type="button">
                                  Continue <ArrowRight size={17} />
                        </button>
                </div>
          </>
        );
}

function QuestionField({
    question,
    value,
    onTextChange,
    onToggleOption
}: {
    question: QuestionDefinition;
    value: AnswerValue;
    onTextChange: (value: string) => void;
    onToggleOption: (option: string) => void;
}) {
    const isTextLike = question.type === "text" || question.type === "email" || question.type === "phone";
    const textValue = typeof value === "string" ? value : "";
    const selection = Array.isArray(value) ? value : value ? [value as string] : [];
  
    if (isTextLike) {
          return (
                  <div className="form-grid">
                          <label className="full-field">
                                    <input
                                                  aria-label={question.prompt}
                                                  inputMode={question.type === "phone" ? "tel" : "text"}
                                                  onChange={(event) => onTextChange(event.target.value)}
                                                  placeholder="Type your answer"
                                                  type={question.type === "email" ? "email" : "text"}
                                                  value={textValue}
                                                />
                          </label>
                  </div>
                );
    }
  
    if (question.type === "textarea") {
          return (
                  <div className="form-grid">
                          <label className="full-field">
                                    <textarea
                                                  aria-label={question.prompt}
                                                  onChange={(event) => onTextChange(event.target.value)}
                                                  placeholder="Type your answer"
                                                  value={textValue}
                                                />
                          </label>
                  </div>
                );
    }
  
    if (question.type === "single_select" || question.type === "multi_select") {
          return (
                  <div className="option-grid">
                    {(question.options || []).map((option) => (
                              <button
                                            aria-pressed={selection.includes(option.value)}
                                            className={`option-button ${selection.includes(option.value) ? "active" : ""}`}
                                            key={option.value}
                                            onClick={() => onToggleOption(option.value)}
                                            type="button"
                                          >
                                {selection.includes(option.value) ? <Check size={15} /> : null} {option.label}
                              </button>
                            ))}
                  </div>
                );
    }
  
    return null;
}

function BudgetNoticeView({
    notice,
    actionStatus,
    savedForLater,
    onAction,
    onContinue
}: {
    notice: BudgetNotice;
    actionStatus: Record<string, "sending" | "sent" | "error">;
    savedForLater: boolean;
    onAction: (step: NextStep) => void;
    onContinue: () => void;
}) {
    return (
          <section className="flow-panel budget-notice">
                <p className="eyebrow">Let's find the right path</p>
                <h2>Here is the strongest path available at your current budget.</h2>
                <p className="muted">{notice.assessment.message}</p>
            {notice.requiredPortalCostEstimate != null ? (
                    <p className="muted">
                              Estimated required launch products (domain, hosting, SSL): ${notice.requiredPortalCostEstimate.toLocaleString()}{" "}
                              / year, purchased separately through the Fusion client portal.
                    </p>
                  ) : null}
          
                <div className="next-steps-grid">
                  {notice.assessment.nextSteps.map((step) => {
                      const status = actionStatus[step.action];
                      return (
                                    <div className="next-step-card" key={step.action}>
                                                  <h3>{step.label}</h3>
                                                  <p className="muted">{step.description}</p>
                                      {status === "sent" || (step.action === "save_for_later" && savedForLater) ? (
                                                      <span className="status-pill">
                                                                        <Check size={15} /> {step.action === "save_for_later" ? "Saved" : "Request sent"}
                                                      </span>
                                                    ) : (
                                                      <button className="secondary-button" disabled={status === "sending"} onClick={() => onAction(step)} type="button">
                                                        {status === "sending" ? "Sending…" : "Choose this"}
                                                      </button>
                                                  )}
                                    </div>
                                  );
          })}
                </div>
          
                <div className="flow-actions">
                        <button className="primary-button" onClick={onContinue} type="button">
                                  Continue planning my website <ArrowRight size={17} />
                        </button>
                </div>
          </section>
        );
}

function RecommendationSummaryView({
    status,
    recommendation
}: {
    status: "idle" | "loading" | "ready" | "error";
    recommendation: StoredRecommendation | null;
}) {
    const [paymentPending, setPaymentPending] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [checkoutPending, startCheckoutTransition] = useTransition();

  function handlePayment(paymentType: "full" | "deposit", depositPercent?: number) {
    setPaymentError(null);
    const key = paymentType === "full" ? "full" : `deposit-${depositPercent}`;
    setPaymentPending(key);
    startCheckoutTransition(async () => {
      const outcome = await createRecommendationCheckoutAction(paymentType, depositPercent ?? 50);
      if (!outcome.ok) {
        setPaymentError(outcome.reason);
        setPaymentPending(null);
        return;
      }
      window.location.href = outcome.url;
    });
  }

  if (status === "loading" || status === "idle") {
          return (
                  <section className="flow-panel building-plan">
                          <p className="eyebrow">Almost there</p>
                          <h2>Putting together your website plan…</h2>
                          <p className="muted">Reviewing your answers against Fusion&apos;s packages and launch requirements.</p>
                  </section>
                );
    }
  
    if (status === "error" || !recommendation) {
          return (
                  <section className="flow-panel questionnaire-complete">
                          <p className="eyebrow">All set</p>
                          <h2>Thanks - your website plan is on its way.</h2>
                          <p className="muted">
                                    We have everything we need to put together a clear, honest recommendation for your project. A member of the
                                    Fusion team will follow up shortly with your personalized plan.
                          </p>
                          <div className="metric-grid">
                                    <div className="metric">
                                                <ShieldCheck size={19} />
                                                <span className="muted">Your answers are saved and linked to your lead record.</span>
                                    </div>
                          </div>
                  </section>
                );
    }
  
    return (
          <section className="flow-panel questionnaire-complete">
                <p className="eyebrow">Your website plan</p>
                <h2>{FEASIBILITY_LABELS[recommendation.feasibilityStatus]}</h2>
                <p className="muted">{recommendation.recommendedNextAction}</p>
          
                <div className="metric-grid">
                        <div className="metric">
                                  <span className="muted">Total planned budget</span>
                                  <strong>${recommendation.totalPlannedBudget.toLocaleString()}</strong>
                        </div>
                        <div className="metric">
                                  <span className="muted">Estimated required launch products</span>
                                  <strong>~${recommendation.requiredPortalCost.toLocaleString()}</strong>
                        </div>
                        <div className="metric">
                                  <span className="muted">Estimated design allocation</span>
                                  <strong>${recommendation.designAllocation.toLocaleString()}</strong>
                        </div>
                  {recommendation.budgetGap > 0 ? (
                      <div className="metric">
                                  <span className="muted">Budget gap</span>
                                  <strong>${recommendation.budgetGap.toLocaleString()}</strong>
                      </div>
                    ) : (
                      <div className="metric">
                                  <span className="muted">Remaining cushion</span>
                                  <strong>${recommendation.remainingCushion.toLocaleString()}</strong>
                      </div>
                        )}
                </div>
          
                <div className="next-steps-grid">
                  {recommendation.paths.map((path) => (
                      <div className="next-step-card" key={path.kind}>
                                  <h3>{PATH_LABELS[path.kind]}</h3>
                                  <p className="muted">{path.packageName || "Custom scope"}</p>
                                  <p className="muted">{path.reason}</p>
                                  <span className="status-pill">
                                                <ShieldCheck size={15} /> ${path.totalDesignCost.toLocaleString()}
                                    {path.monthlyCost ? ` + $${path.monthlyCost.toLocaleString()}/mo` : ""}
                                  </span>
                      </div>
                    ))}
                </div>
          
            {recommendation.missingInformation.length > 0 ? (
                    <p className="muted">A few more details would sharpen this plan - our team may follow up with a couple of quick questions.</p>
                  ) : null}
          
            {recommendation.portalPricingDisclaimer ? (
                    <p className="muted">{recommendation.portalPricingDisclaimer}</p>
                  ) : null}

      {recommendation.totalPlannedBudget > 0 ? (
        <div className="result-actions payment-actions">
          <h3>Ready to get started?</h3>
          <p className="muted">
            Secure your spot on the Fusion build calendar today. Pay your full budget now, or put down a deposit to
            get started and pay the rest whenever you&apos;re ready from your client portal.
          </p>
          <div className="flow-actions">
            <button
              className="primary-button"
              disabled={checkoutPending}
              onClick={() => handlePayment("full")}
              type="button"
            >
              <CreditCard size={17} /> Pay in full - ${recommendation.totalPlannedBudget.toLocaleString()}
              {paymentPending === "full" ? "…" : ""}
            </button>
          </div>
          <div className="flow-actions deposit-presets">
            {DEPOSIT_PRESETS.map((pct) => {
              const amount = Math.round((recommendation.totalPlannedBudget * pct) / 100);
              const key = `deposit-${pct}`;
              return (
                <button
                  className="secondary-button"
                  disabled={checkoutPending}
                  key={pct}
                  onClick={() => handlePayment("deposit", pct)}
                  type="button"
                >
                  <CreditCard size={17} /> Pay {pct}% deposit - ${amount.toLocaleString()}
                  {paymentPending === key ? "…" : ""}
                </button>
              );
            })}
          </div>
          {paymentError ? <p className="form-error">{paymentError}</p> : null}
        </div>
      ) : null}
          </section>
        );
}

function SpecialAckView({ token, onContinue }: { token: SpecialAck; onContinue: () => void }) {
    const copy: Record<SpecialAck, { title: string; body: string }> = {
          not_sure: {
                  title: "No problem - we'll figure it out together.",
                  body: "Keep going with a few more questions about your project, and we'll help you land on a realistic number before you decide anything."
          },
          payment_plan: {
                  title: "We've let our team know you're interested in a payment plan.",
                  body: "A member of the Fusion team will follow up with payment plan options. In the meantime, let's keep planning your site."
          },
          talk_to_someone: {
                  title: "We've let our team know you'd like to talk.",
                  body: "Someone from Fusion will reach out soon. You're welcome to keep answering questions in the meantime so we have more to talk about."
          }
    };
  
    const { title, body } = copy[token];
  
    return (
          <section className="flow-panel">
                <p className="eyebrow">Got it</p>
                <h2>{title}</h2>
                <p className="muted">{body}</p>
                <div className="flow-actions">
                        <button className="primary-button" onClick={onContinue} type="button">
                                  Continue <ArrowRight size={17} />
                        </button>
                </div>
          </section>
        );
}
