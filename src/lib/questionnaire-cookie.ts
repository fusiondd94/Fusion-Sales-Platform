/**
 * src/lib/questionnaire-cookie.ts
 *
 * Shared constant only. Kept in its own file (rather than in
 * src/app/get-started/actions.ts) because a "use server" file may only
 * export async functions - it cannot also export a plain constant.
 */
export const QUESTIONNAIRE_COOKIE_NAME = "fusion_qs_token";
