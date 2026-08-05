import { cookies } from "next/headers";
import { ArrowRight, BarChart3, Globe2, LockKeyhole, Mail, Megaphone, Server, ShoppingCart, Wand2 } from "lucide-react";
import { ClosingSignals } from "@/components/SalesFlow";
import { QuestionnaireFlow } from "@/components/QuestionnaireFlow";
import { Reveal } from "@/components/Reveal";
import { getFusionAdminUser } from "@/lib/auth";
import { getFusionAdminSettings } from "@/lib/crm";
import { QUESTIONNAIRE_COOKIE_NAME } from "@/lib/questionnaire-cookie";
import { loadQuestionnaireState } from "@/lib/sales-questionnaire";

const offers = [
  { icon: Globe2, title: "Domains", text: "Secure the name, connect DNS, and make launch clean." },
  { icon: Server, title: "Hosting", text: "Managed hosting paths for WordPress and growth sites." },
  { icon: LockKeyhole, title: "SSL & Security", text: "Trust, protection, and monitoring built into the offer." },
  { icon: Mail, title: "Professional Email", text: "Branded email that reinforces credibility after the sale." },
  { icon: ShoppingCart, title: "E-commerce", text: "Product structure, checkout readiness, and launch QA." },
  { icon: Megaphone, title: "Marketing", text: "Lead capture, analytics, and campaign-ready pages." },
  { icon: Wand2, title: "Website Design", text: "Elegant websites designed to convert and scale." },
  { icon: BarChart3, title: "Follow-up Workflow", text: "Every paid intake becomes a managed client workflow." }
];

const process = [
  { title: "Tell us about your business", text: "A short, guided questionnaire — no forms to dig through, no jargon." },
  { title: "Get a tailored plan instantly", text: "Pricing and package recommendations update live as you answer." },
  { title: "Check out securely", text: "Stripe-secured checkout captures payment and your client record in one step." },
  { title: "Launch and grow, managed", text: "Your client portal opens right after purchase for onboarding and updates." }
];

export default async function Home() {
  const store = await cookies();
  const token = store.get(QUESTIONNAIRE_COOKIE_NAME)?.value || null;

  const [adminUser, admin, initialState] = await Promise.all([
    getFusionAdminUser(),
    getFusionAdminSettings(),
    token ? loadQuestionnaireState(token) : Promise.resolve(null)
  ]);
  const logoUrl = admin.settings?.logo_url;

  return (
    <main className="shell shell-light">
      <nav className="nav">
        <a className="brand" href="#">
          {logoUrl ? <img alt="Brand logo" className="brand-mark brand-mark--logo" src={logoUrl} /> : <span className="brand-mark">FDD</span>}
          <span>Fusion Digital Dynamics</span>
        </a>
        <div className="nav-links">
          <a href="#offers">Services</a>
          <a href="#sales-flow">Sales Flow</a>
          {adminUser?.isAllowed ? <a href="/fusionadmin">CRM</a> : null}
          <a href="/portal">Portal</a>
          {adminUser?.isAllowed ? <span className="nav-user">Signed in as {adminUser.displayName}</span> : null}
        </div>
        <a className="nav-cta" href="#sales-flow">Start</a>
      </nav>

      <section className="hero">
        <Reveal as="div">
          <p className="eyebrow">Fusion Digital Dynamics</p>
          <h1>A website that works as hard as you do.</h1>
          <p className="hero-copy">
            Domain, hosting, security, professional email, and marketing — designed, launched, and managed
            as one elegant package. Answer a few questions and get a tailored plan in minutes.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#sales-flow">Build my plan <ArrowRight size={17} /></a>
            <a className="secondary-button" href="#offers">Explore services</a>
          </div>
        </Reveal>
        <Reveal as="aside" className="hero-panel" delayMs={140}>
          <div className="pulse-bar" />
          <div className="panel-body">
            <p className="eyebrow">Why Fusion</p>
            <h2>Built to launch, built to last.</h2>
            <p className="muted">
              One team designs the site, secures the stack, and stays on for the long run — so growth never
              waits on a plugin update or an expired certificate.
            </p>
            <ClosingSignals />
          </div>
        </Reveal>
      </section>

      <section className="section" id="offers">
        <Reveal as="div" className="section-heading">
          <div>
            <p className="eyebrow">Fusion offer stack</p>
            <h2>Everything a client needs to launch, trust, and grow online.</h2>
          </div>
        </Reveal>
        <div className="offer-grid">
          {offers.map((offer, index) => {
            const Icon = offer.icon;
            return (
              <Reveal as="article" className="offer-tile" delayMs={index * 70} key={offer.title}>
                <Icon size={22} />
                <h3>{offer.title}</h3>
                <p className="muted">{offer.text}</p>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="section process-band">
        <Reveal as="div" className="section-heading">
          <div>
            <p className="eyebrow">How it works</p>
            <h2>From first click to launched site, without the back-and-forth.</h2>
          </div>
        </Reveal>
        <div className="process-steps">
          {process.map((step, index) => (
            <Reveal as="div" className="process-step" delayMs={index * 90} key={step.title}>
              <h3>{step.title}</h3>
              <p className="muted">{step.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section" id="sales-flow">
        <Reveal as="div" className="section-heading">
          <div>
            <p className="eyebrow">Get your plan</p>
            <h2>Answer a few questions. Get a tailored plan and price, today.</h2>
          </div>
        </Reveal>
        <div className="questionnaire-container">
          <QuestionnaireFlow initialState={initialState} />
        </div>
      </section>

      <section className="cta-band">
        <Reveal as="div">
          <p className="eyebrow">Ready when you are</p>
          <h2>Let&apos;s build something elegant.</h2>
          <p className="muted">No pressure, no obligation — just a clear plan and a price, built around your business.</p>
          <a className="primary-button" href="#sales-flow">Start now <ArrowRight size={17} /></a>
        </Reveal>
      </section>

      <footer className="site-footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <a className="brand" href="#">
              {logoUrl ? <img alt="Brand logo" className="brand-mark brand-mark--logo" src={logoUrl} /> : <span className="brand-mark">FDD</span>}
              <span>Fusion Digital Dynamics</span>
            </a>
            <p className="muted">
              A guided website sales and growth platform — domain to launch to long-term management, in one
              elegant package.
            </p>
          </div>
          <div className="footer-col">
            <h4>Services</h4>
            <ul>
              <li><a href="#offers">Website Design</a></li>
              <li><a href="#offers">Hosting &amp; Security</a></li>
              <li><a href="#offers">Marketing</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Get Started</h4>
            <ul>
              <li><a href="#sales-flow">Build my plan</a></li>
              <li><a href="/portal">Client portal</a></li>
              {adminUser?.isAllowed ? <li><a href="/fusionadmin">CRM</a></li> : null}
            </ul>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="#offers">Services</a></li>
              <li><a href="#sales-flow">Sales flow</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Fusion Digital Dynamics LLC. All rights reserved.</span>
          <span className="muted">Payments secured by Stripe.</span>
        </div>
      </footer>
    </main>
  );
}
