import { ArrowRight, BarChart3, Globe2, LockKeyhole, Mail, Megaphone, Server, ShoppingCart, Wand2 } from "lucide-react";
import { ClosingSignals, SalesFlow } from "@/components/SalesFlow";

const offers = [
  { icon: Globe2, title: "Domains", text: "Secure the name, connect DNS, and make launch clean." },
  { icon: Server, title: "Hosting", text: "Managed hosting paths for WordPress and growth sites." },
  { icon: LockKeyhole, title: "SSL & Security", text: "Trust, protection, and monitoring built into the offer." },
  { icon: Mail, title: "Professional Email", text: "Branded email that reinforces credibility after the sale." },
  { icon: ShoppingCart, title: "E-commerce", text: "Product structure, checkout readiness, and launch QA." },
  { icon: Megaphone, title: "Marketing", text: "Lead capture, analytics, and campaign-ready pages." },
  { icon: Wand2, title: "Website Design", text: "Elegant websites designed to convert and scale." },
  { icon: BarChart3, title: "CRM Follow-up", text: "Every paid intake becomes a managed client workflow." }
];

export default function Home() {
  return (
    <main className="shell">
      <nav className="nav">
        <a className="brand" href="#">
          <span className="brand-mark">FDD</span>
          <span>Fusion Digital Dynamics</span>
        </a>
        <div className="nav-links">
          <a href="#offers">Services</a>
          <a href="#sales-flow">Sales Flow</a>
          <a href="/fusionadmin">CRM</a>
          <a href="/portal">Portal</a>
        </div>
        <a className="nav-cta" href="#sales-flow">Start</a>
      </nav>

      <section className="hero">
        <div>
          <p className="eyebrow">Website sales platform</p>
          <h1>Sell the site, the stack, and the next step.</h1>
          <p className="hero-copy">
            A guided Fusion Digital Dynamics experience that diagnoses the business, frames the right website package,
            bundles domain, hosting, SSL, security, marketing, and email, then moves the client into checkout and onboarding.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#sales-flow">Build my offer <ArrowRight size={17} /></a>
            <a className="secondary-button" href="#offers">View services</a>
          </div>
        </div>
        <aside className="hero-panel" aria-label="Sales engine summary">
          <div className="pulse-bar" />
          <div className="panel-body">
            <p className="eyebrow">Algorithm posture</p>
            <h2>Persistent, polished, margin-aware.</h2>
            <p className="muted">
              The close strengthens as the buyer reveals friction. Discounts are protected until the deal needs a save.
            </p>
            <ClosingSignals />
          </div>
        </aside>
      </section>

      <section className="section" id="offers">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Fusion offer stack</p>
            <h2>Everything a client needs to launch, trust, and grow online.</h2>
          </div>
        </div>
        <div className="offer-grid">
          {offers.map((offer) => {
            const Icon = offer.icon;
            return (
              <article className="offer-tile" key={offer.title}>
                <Icon size={22} />
                <h3>{offer.title}</h3>
                <p className="muted">{offer.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Interactive closer</p>
            <h2>The questionnaire adapts the recommendation while the client is still engaged.</h2>
          </div>
        </div>
        <SalesFlow />
      </section>
    </main>
  );
}
