import type { Answers, Recommendation } from "@/lib/offers";

export type ClientRecord = { id: string; name: string; email: string; company: string; phone: string; website?: string; status: "New Lead" | "Paid" | "Onboarding" | "In Production"; recommendation: Recommendation; answers: Answers; createdAt: string };

export const demoClients: ClientRecord[] = [{
  id: "FDD-2401",
  name: "Maya Pierre",
  email: "maya@example.com",
  company: "Pierre Studio",
  phone: "(305) 555-0198",
  website: "pierrestudio.com",
  status: "Onboarding",
  recommendation: { packageKey: "growth", packageName: "Growth Engine", setupPrice: 1800, monthlyPrice: 149, discountPercent: 0, totalToday: 1800, monthlyDue: 204, headline: "A conversion-focused site built to turn visitors into booked conversations.", rationale: ["Lead capture and professional email are required.", "Managed hosting keeps the client out of technical work."], inclusions: ["8-page conversion site", "CRM-ready lead capture", "Managed hosting", "Security monitoring"], urgencyMessage: "Standard onboarding cadence recommended.", salesAngle: "Start with the complete foundation so the business is not paying twice later." },
  answers: { businessType: "professional", goal: "leads" },
  createdAt: "2026-07-09T09:00:00.000Z"
}];

export const demoTasks = [
  { id: "TASK-101", client: "Pierre Studio", title: "Confirm sitemap and domain choice", owner: "Sales", due: "Today", status: "Open" },
  { id: "TASK-102", client: "Pierre Studio", title: "Prepare hosting/security bundle", owner: "Ops", due: "Tomorrow", status: "Open" },
  { id: "TASK-103", client: "New checkout lead", title: "Follow up if payment is abandoned", owner: "CRM", due: "Automated", status: "Watching" }
];

export const pipelineSummary = [
  { label: "New leads", value: 8 },
  { label: "Checkout started", value: 3 },
  { label: "Paid clients", value: 1 },
  { label: "Open tasks", value: demoTasks.length }
];
