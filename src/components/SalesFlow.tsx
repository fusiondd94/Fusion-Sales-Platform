"use client";

import { ArrowRight, Check, ChevronLeft, CreditCard, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { CustomerInfo, emptyCustomer } from "@/lib/customer";
import { Answers, calculateRecommendation, questions } from "@/lib/offers";

export function SalesFlow() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [customer, setCustomer] = useState<CustomerInfo>(emptyCustomer);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const question = questions[Math.min(step, questions.length - 1)];
  const recommendation = useMemo(() => calculateRecommendation(answers), [answers]);
  const isContactStep = step === questions.length;
  const progress = Math.round(((step + 1) / (questions.length + 1)) * 100);

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
    setError("");
    if (!customer.name || !customer.email || !customer.phone || !customer.company) {
      setError("Add your name, email, phone, and business name so Fusion can create your client record.");
      setStep(questions.length);
      return;
    }

    setIsCheckingOut(true);
    const leadResponse = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer, answers, recommendation })
    });
    const leadPayload = await leadResponse.json();
    const capturedLeadId = leadPayload.leadId as string | undefined;
    if (capturedLeadId) setLeadId(capturedLeadId);

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: capturedLeadId,
        customer,
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

  function updateCustomer(key: keyof CustomerInfo, value: string) {
    setCustomer((current) => ({ ...current, [key]: value }));
  }

  function nextStep() {
    setError("");
    setStep(Math.min(questions.length, step + 1));
  }

  return (
    <div className="sales-grid" id="sales-flow">
      <section className="flow-panel">
        <div className="progress" aria-label={`Progress ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        {isContactStep ? (
          <>
            <p className="eyebrow">Client record</p>
            <h2>Where should Fusion send your proposal and onboarding access?</h2>
            <p className="muted">This creates the lead record for follow-up and becomes the client account profile after payment.</p>
            <div className="form-grid">
              <label>
                Full name
                <input aria-label="Full name" value={customer.name} onChange={(event) => updateCustomer("name", event.target.value)} placeholder="Your name" />
              </label>
              <label>
                Business email
                <input aria-label="Business email" value={customer.email} onChange={(event) => updateCustomer("email", event.target.value)} placeholder="you@business.com" />
              </label>
              <label>
                Phone
                <input aria-label="Phone" value={customer.phone} onChange={(event) => updateCustomer("phone", event.target.value)} placeholder="Best callback number" />
              </label>
              <label>
                Business name
                <input aria-label="Business name" value={customer.company} onChange={(event) => updateCustomer("company", event.target.value)} placeholder="Company LLC" />
              </label>
              <label className="full-field">
                Current website or domain
                <input aria-label="Current website or domain" value={customer.website} onChange={(event) => updateCustomer("website", event.target.value)} placeholder="example.com or not yet purchased" />
              </label>
              <label className="full-field">
                Anything Fusion should know?
                <textarea aria-label="Project notes" value={customer.projectNotes} onChange={(event) => updateCustomer("projectNotes", event.target.value)} placeholder="Tell us about your offer, market, competitors, or deadline." />
              </label>
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow">{question.eyebrow}</p>
            <h2>{question.title}</h2>
            <p className="muted">{question.help}</p>
            <div className="option-grid">
              {question.options.map((option) => (
                <button
                  aria-pressed={isActive(option.value)}
                  className={`option-button ${isActive(option.value) ? "active" : ""}`}
                  key={option.value}
                  onClick={() => select(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}
        {error ? <p className="form-error">{error}</p> : null}
        <div className="flow-actions">
          <button className="secondary-button" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))} type="button">
            <ChevronLeft size={17} /> Back
          </button>
          <button className="primary-button" onClick={isContactStep ? checkout : nextStep} type="button">
            {isContactStep ? "Save lead and checkout" : "Continue"} <ArrowRight size={17} />
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
        {leadId ? <p className="status-pill">Lead captured: {leadId}</p> : null}
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
