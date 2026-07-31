"use server";

/**
 * src/app/get-started/actions.ts
 *
 * Server Actions bridging the client-facing QuestionnaireFlow component to
 * the server-only src/lib/sales-questionnaire.ts orchestration module. No
 * business logic lives here - this file only manages the resume cookie and
 * forwards to the library functions.
 */

import { cookies } from "next/headers";
import { QUESTIONNAIRE_COOKIE_NAME } from "@/lib/questionnaire-cookie";
import {
  createConsultationRequest,
  createQuestionnaireSession,
  loadQuestionnaireState,
  markSessionAbandoned,
  submitAnswer,
  submitBudgetAnswer,
  type ConsultationReason,
  type QuestionnaireState,
  type SubmitAnswerResult,
  type SubmitBudgetResult
} from "@/lib/sales-questionnaire";
import type { AnswerValue } from "@/lib/questionnaire-schema";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days - "allow the client to return later"

async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(QUESTIONNAIRE_COOKIE_NAME)?.value || null;
}

async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(QUESTIONNAIRE_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS
  });
}

export async function resumeQuestionnaireAction(): Promise<QuestionnaireState | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const state = await loadQuestionnaireState(token);
  if (!state) return null;
  return state;
}

export async function startQuestionnaireAction(input: {
  entryUrl?: string;
  referrerUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}): Promise<QuestionnaireState | null> {
  const state = await createQuestionnaireSession(input);
  if (!state) return null;
  await setSessionCookie(state.session.session_token);
  return state;
}

export async function submitBudgetAction(rawInput: string): Promise<SubmitBudgetResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, reason: "Your session has expired. Please refresh and start again." };
  return submitBudgetAnswer(token, rawInput);
}

export async function submitAnswerAction(questionKey: string, rawValue: AnswerValue): Promise<SubmitAnswerResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, reason: "Your session has expired. Please refresh and start again." };
  return submitAnswer(token, questionKey, rawValue);
}

export async function requestConsultationAction(
  reason: ConsultationReason,
  preferredContactMethod: string | null
): Promise<{ ok: boolean; reason?: string }> {
  const token = await getSessionToken();
  if (!token) return { ok: false, reason: "Your session has expired. Please refresh and start again." };
  return createConsultationRequest(token, reason, preferredContactMethod);
}

export async function saveForLaterAction(): Promise<{ ok: boolean }> {
  // Progress is already persisted after every answer; this action exists so
  // the UI has an explicit confirmation step without inventing new storage.
  const token = await getSessionToken();
  return { ok: Boolean(token) };
}

export async function abandonQuestionnaireAction(): Promise<{ ok: boolean }> {
  const token = await getSessionToken();
  if (!token) return { ok: false };
  await markSessionAbandoned(token);
  return { ok: true };
}
