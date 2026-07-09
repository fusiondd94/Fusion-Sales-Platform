export type StepKey = "businessType" | "goal" | "urgency" | "budget" | "needs" | "objection";
export type Answers = Partial<Record<StepKey, string | string[]>>;
export type PackageKey = "launch" | "growth" | "commerce" | "authority";
export type Recommendation = { packageKey: PackageKey; packageName: string; setupPrice: number; monthlyPrice: number; discountPercent: number; totalToday: number; monthlyDue: number; headline: string; rationale: string[]; inclusions: string[]; urgencyMessage: string; salesAngle: string };

export const questions: Array<{ key: StepKey; eyebrow: string; title: string; help: string; multi?: boolean; options: Array<{ label: string; value: string }> }> = [
  { key: "businessType", eyebrow: "Business profile", title: "What kind of business are we building revenue around?", help: "This shapes the structure, conversion flow, and add-ons we recommend.", options: [{ label: "Local service business", value: "local-service" }, { label: "E-commerce / products", value: "ecommerce" }, { label: "Professional services", value: "professional" }, { label: "Creator / personal brand", value: "creator" }] },
  { key: "goal", eyebrow: "Revenue target", title: "What must the website accomplish first?", help: "The platform adapts the pitch toward bookings, trust, checkout, or lead capture.", options: [{ label: "Generate qualified leads", value: "leads" }, { label: "Sell products online", value: "sell-online" }, { label: "Look premium and trustworthy", value: "authority" }, { label: "Launch fast and validate", value: "fast-launch" }] },
  { key: "urgency", eyebrow: "Timeline", title: "How soon do you want the new website working for you?", help: "Urgency changes implementation intensity and the close strategy.", options: [{ label: "This week", value: "this-week" }, { label: "Within 30 days", value: "month" }, { label: "This quarter", value: "quarter" }, { label: "Still exploring", value: "exploring" }] },
  { key: "budget", eyebrow: "Investment range", title: "Which investment range feels realistic today?", help: "We use this to protect the sale while keeping the recommendation honest.", options: [{ label: "$300 - $750", value: "starter" }, { label: "$750 - $1,500", value: "standard" }, { label: "$1,500 - $3,000", value: "premium" }, { label: "$3,000+", value: "scale" }] },
  { key: "needs", eyebrow: "Attach services", title: "Which must be handled with the website?", help: "Fusion offers the full stack: domain, hosting, SSL, security, email, marketing, and WordPress.", multi: true, options: [{ label: "Domain", value: "domain" }, { label: "Hosting", value: "hosting" }, { label: "SSL and security", value: "security" }, { label: "Professional email", value: "email" }, { label: "Marketing setup", value: "marketing" }, { label: "WordPress management", value: "wordpress" }] },
  { key: "objection", eyebrow: "Decision blocker", title: "What could stop you from moving forward today?", help: "The close gets stronger only when there is real friction.", options: [{ label: "Price", value: "price" }, { label: "Need to think about it", value: "think" }, { label: "Need trust/proof", value: "trust" }, { label: "Nothing if the offer fits", value: "none" }] }
];

const packages: Record<PackageKey, Omit<Recommendation, "discountPercent" | "totalToday" | "monthlyDue" | "rationale" | "urgencyMessage" | "salesAngle">> = {
  launch: { packageKey: "launch", packageName: "Launch Foundation", setupPrice: 900, monthlyPrice: 89, headline: "A clean business website with domain, hosting, SSL, and launch support.", inclusions: ["5-page responsive website", "Domain connection", "Managed hosting", "SSL setup", "Lead form", "Basic analytics"] },
  growth: { packageKey: "growth", packageName: "Growth Engine", setupPrice: 1800, monthlyPrice: 149, headline: "A conversion-focused site built to turn visitors into booked conversations.", inclusions: ["8-page conversion site", "Copy structure", "CRM-ready lead capture", "Managed hosting", "Security monitoring", "Professional email"] },
  commerce: { packageKey: "commerce", packageName: "Commerce Builder", setupPrice: 2600, monthlyPrice: 229, headline: "An online store package with checkout, product structure, hosting, SSL, and support.", inclusions: ["E-commerce website", "Product catalog setup", "Payment-ready checkout", "Security hardening", "Managed hosting", "Launch QA"] },
  authority: { packageKey: "authority", packageName: "Authority Suite", setupPrice: 3400, monthlyPrice: 299, headline: "A premium brand presence for service businesses that need trust immediately.", inclusions: ["Premium design system", "Brand messaging", "Portfolio/case-study sections", "Marketing setup", "Email and hosting", "Ongoing optimization"] }
};

export function calculateRecommendation(answers: Answers): Recommendation {
  const needs = Array.isArray(answers.needs) ? answers.needs : [];
  const goal = answers.goal;
  const businessType = answers.businessType;
  const budget = answers.budget;
  const objection = answers.objection;
  const urgency = answers.urgency;
  let packageKey: PackageKey = "growth";
  if (goal === "sell-online" || businessType === "ecommerce") packageKey = "commerce";
  if (goal === "authority" || businessType === "professional") packageKey = "authority";
  if (goal === "fast-launch" || budget === "starter") packageKey = "launch";
  const selected = packages[packageKey];
  const frictionScore = (budget === "starter" ? 3 : budget === "standard" ? 2 : 0) + (objection === "price" ? 3 : objection === "think" ? 2 : objection === "trust" ? 1 : 0) + (urgency === "exploring" ? 1 : 0);
  let discountPercent = 0;
  if (frictionScore >= 6) discountPercent = 45;
  if (frictionScore >= 7) discountPercent = 60;
  if (frictionScore >= 8) discountPercent = 75;
  if (urgency === "this-week" && discountPercent > 0) discountPercent = Math.min(75, discountPercent + 10);
  const addOnMonthly = needs.reduce((sum, need) => need === "marketing" ? sum + 80 : need === "email" ? sum + 20 : need === "security" ? sum + 35 : need === "wordpress" ? sum + 55 : sum, 0);
  const totalToday = Math.round(selected.setupPrice * (1 - discountPercent / 100));
  const monthlyDue = selected.monthlyPrice + addOnMonthly;
  return { ...selected, discountPercent, totalToday, monthlyDue, rationale: [goal === "sell-online" ? "The sales path needs product discovery, checkout readiness, and trust signals." : "The sales path needs a direct conversion story, not just a brochure.", needs.length ? `Bundling ${needs.length} operational service${needs.length > 1 ? "s" : ""} reduces vendor friction.` : "Keeping launch scope focused protects speed and budget.", discountPercent ? `A ${discountPercent}% close-save incentive is being held because the buyer showed real friction.` : "No discount is used yet, preserving margin while the offer is strong."], urgencyMessage: urgency === "this-week" ? "Fast-track launch slot recommended." : "Standard onboarding cadence recommended.", salesAngle: discountPercent >= 60 ? "This is the retention offer: lock in today, reduce the upfront risk, and let Fusion own the launch burden." : "The strongest move is to start with the complete foundation so the business is not paying twice later." };
}
