"use client";

import { ArrowRight, Check, ChevronLeft, CreditCard, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Answers, calculateRecommendation, questions } from "@/lib/offers";

export function SalesFlow() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const question = questions[step];
  const recommendation = useMemo(() => calculateRecommendation(answers), [answers]);
  const progress = Math.round(((step + 1) / questions.length) * 100);

  function select(value: string) {
    if (question.multi) {
      const current = Array.isArray(answers[question.key]) ? (answers[question.key] as string[]) : [];
      const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      setAnswers({ ...answers, [question.key]: next });
      return;
    }

    setAnswers({ ...answers, [question.key]: value });
  }

  function isActive(value: string) {
    const current = answers[question.key];
    return Array.isArray(current) ? current.includes(value) : current === value;
  }

  async function checkout() {
    setIsCheckingOut(true);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: {
          name: "Fusion Prospect",
          email: "prospect@example.com",
          company: "New Website Client"
        },
        answers,
        recommendation
      })
    });
    const payload = await response.json();
    if (payload.url) {
      window.location.href = payload.url;
      return;
    }
    setIsCheckingOut(false);
    window.location.href = "/portal?demo=1";
  }

  return (
    <div className="sales-grid" id="sales-flow">
      <section className="flow-panel">
        <div className="progress" aria-label={`Progress ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="eyebrow">{question.eyebrow}</p>
        <h2>{question.title}</h2>
        <p className="muted">{question.help}</p>
        <div className="option-grid">
          {question.options.map((option) => (
            <button
              className={`option-button ${isActive(option.value) ? "active" : ""}`}
              key={option.value}
              onClick={() => select(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flow-actions">
          <button className="secondary-button" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))} type="button">
            <ChevronLeft size={17} /> Back
          </button>
          <button className="primary-button" onClick={() => setStep(Math.min(questions.length - 1, step + 1))} type="button">
            {step === questions.length - 1 ? "Refine offer" : "Continue"} <ArrowRight size={17} />
          </button>
        </div>
      </section>

      <aside className="result-panel">
        <p className="eyebrow">Live recommendation</p>
        <h2>{recommendation.packageName}</h2>
        <p className="muted">{recommendation.headline}</p>
        {recommendation.discountPercent > 0 ? <span className="discount">{recommendation.discountPercent}% close-save offer</span> : null}
        <div className="result-price">
          <strong>${recommendation.totalToday.toLocaleString()}</strong>
          <span className="muted">today</span>
        </div>
        <p className="muted">${recommendation.monthlyDue.toLocaleString()} / month for managed services</p>
        <ul className="inclusion-list">
          {recommendation.inclusions.slice(0, 5).map((item) => (
            <li key={item}>
              <Check size={17} color="var(--green)" /> {item}
            </li>
          ))}
        </ul>
        <p>{recommendation.salesAngle}</p>
        <button className="primary-button" disabled={isCheckingOut} onClick={checkout} type="button">
          {isCheckingOut ? "Preparing checkout..." : "Secure this offer"} <CreditCard size={17} />
        </button>
        <p className="muted">
          <ShieldCheck size={15} /> Payment is handled through Stripe Checkout. Client portal opens after purchase.
        </p>
      </aside>
    </div>
  );
}

export function ClosingSignals() {
  return (
    <div className="metric-grid">
      <div className="metric">
        <Sparkles size={19} />
        <strong>75%</strong>
        <span className="muted">maximum save offer, used only at high friction</span>
      </div>
      <div className="metric">
        <ShieldCheck size={19} />
        <strong>Full stack</strong>
        <span className="muted">domain, hosting, SSL, security, email, marketing</span>
      </div>
    </div>
  );
}
