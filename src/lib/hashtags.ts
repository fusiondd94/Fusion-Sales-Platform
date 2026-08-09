/**
 * src/lib/hashtags.ts
 *
 * Hashtag pool for social content posts. Every post's caption can contain
 * inline hashtags (e.g. "...#WebDesign #SmallBusiness"); this module tracks
 * a reusable pool of hashtags per organization so admins can:
 *   1. See every hashtag that has ever been used, plus any added manually,
 *      color-coded by whether it's been used yet.
 *   2. One-click "Add hashtags" on a scheduled post that has none - picks
 *      ~7 hashtags from the pool (unused ones first) and appends them to
 *      the post's caption directly, without touching platforms/targets.
 *
 * Hashtags are stored inline in crm_content_posts.caption (there is no
 * separate hashtags column), so extraction is always done via regex over
 * the caption text - this keeps the pool in sync with reality even if a
 * caption is hand-edited outside of this tool.
 */

import { createSupabaseServiceClient } from "@/lib/supabase/server";

type ServiceClient = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

const HASHTAG_PATTERN = /#[A-Za-z0-9_]+/g;

export function extractHashtags(text: string): string[] {
  return Array.from(text.matchAll(HASHTAG_PATTERN)).map((m) => m[0]);
}

export function hasHashtags(text: string): boolean {
  return new RegExp(HASHTAG_PATTERN).test(text);
}

function normalizeHashtag(raw: string): string | null {
  const cleaned = raw.trim().replace(/^#+/, "");
  if (!cleaned) return null;
  const safe = cleaned.replace(/[^A-Za-z0-9_]/g, "");
  if (!safe) return null;
  return "#" + safe;
}

export type HashtagPoolEntry = {
  id: string;
  tag: string;
  used: boolean;
  useCount: number;
  createdAt: string;
  updatedAt: string;
};

async function resolveOrganizationId(supabase: ServiceClient): Promise<string | null> {
  const { data } = await supabase
    .from("crm_organizations")
    .select("id")
    .eq("slug", "fusion-digital-dynamics")
    .maybeSingle<{ id: string }>();
  return data?.id || null;
}

/**
 * All pool entries for the org, unused (orange) first, then used (green),
 * alphabetically within each group.
 */
export async function getHashtagPool(): Promise<HashtagPoolEntry[]> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  const organizationId = await resolveOrganizationId(supabase);
  if (!organizationId) return [];

  const { data } = await supabase
    .from("hashtag_pool")
    .select("id, tag, used, use_count, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("used", { ascending: true })
    .order("tag", { ascending: true })
    .returns<
      Array<{ id: string; tag: string; used: boolean; use_count: number; created_at: string; updated_at: string }>
    >();

  return (data || []).map((row) => ({
    id: row.id,
    tag: row.tag,
    used: row.used,
    useCount: row.use_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

/**
 * Adds one or more hashtags to the pool (comma, space, or newline
 * separated, leading "#" optional). New hashtags start unused (orange).
 * Hashtags that already exist in the pool are left untouched - adding a
 * hashtag that's already used does not reset it back to unused.
 */
export async function addHashtagsToPool(
  rawInput: string
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const organizationId = await resolveOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "Unable to resolve organization." };

  const candidates = rawInput
    .split(/[\s,]+/)
    .map(normalizeHashtag)
    .filter((tag): tag is string => Boolean(tag));

  const unique = Array.from(new Set(candidates));
  if (!unique.length) return { ok: false, error: "Enter at least one hashtag." };

  const { data: existing } = await supabase
    .from("hashtag_pool")
    .select("tag")
    .eq("organization_id", organizationId)
    .in("tag", unique)
    .returns<Array<{ tag: string }>>();

  const existingTags = new Set((existing || []).map((row) => row.tag));
  const toInsert = unique.filter((tag) => !existingTags.has(tag));
  if (!toInsert.length) return { ok: true, added: 0 };

  const { error } = await supabase.from("hashtag_pool").insert(
    toInsert.map((tag) => ({
      organization_id: organizationId,
      tag,
      used: false,
      use_count: 0
    }))
  );

  if (error) return { ok: false, error: "Unable to add hashtags to the pool." };
  return { ok: true, added: toInsert.length };
}

function shuffle<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Picks ~count hashtags from the pool - unused (orange) ones first,
 * falling back to used (green) ones if the pool doesn't have enough unused
 * tags - appends them to the post's caption, and marks every picked tag as
 * used. Does not touch the post's platforms/targets, so it's safe to call
 * directly from a scheduled-post card without going through the full edit
 * form. A no-op (not an error) if the post already has hashtags, so it's
 * safe to call defensively.
 */
export async function applyRandomHashtagsToPost(
  postId: string,
  count = 7
): Promise<{ ok: true; addedTags: string[] } | { ok: false; error: string }> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!postId) return { ok: false, error: "Post id is required." };

  const { data: post } = await supabase
    .from("crm_content_posts")
    .select("id, caption, organization_id")
    .eq("id", postId)
    .maybeSingle<{ id: string; caption: string; organization_id: string }>();

  if (!post) return { ok: false, error: "Post not found." };
  if (hasHashtags(post.caption)) return { ok: true, addedTags: [] };

  const { data: pool } = await supabase
    .from("hashtag_pool")
    .select("id, tag, used, use_count")
    .eq("organization_id", post.organization_id)
    .returns<Array<{ id: string; tag: string; used: boolean; use_count: number }>>();

  if (!pool || !pool.length) {
    return { ok: false, error: "The hashtag pool is empty. Add some hashtags to the pool first." };
  }

  const unused = shuffle(pool.filter((row) => !row.used));
  const used = shuffle(pool.filter((row) => row.used));
  const selected = [...unused, ...used].slice(0, count);

  if (!selected.length) return { ok: false, error: "No hashtags available to add." };

  const newCaption = `${post.caption}\n\n${selected.map((row) => row.tag).join(" ")}`;
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("crm_content_posts")
    .update({ caption: newCaption, updated_at: now })
    .eq("id", post.id);

  if (updateError) return { ok: false, error: "Unable to update the post caption." };

  for (const row of selected) {
    await supabase
      .from("hashtag_pool")
      .update({ used: true, use_count: row.use_count + 1, updated_at: now })
      .eq("id", row.id);
  }

  return { ok: true, addedTags: selected.map((row) => row.tag) };
}

/**
 * Removes a single hashtag from the pool by id. Scoped to the org so a
 * stray/incorrect id can't delete another organization's row. Does not
 * touch any post captions - this only removes the tag from future
 * randomizer picks and from the pool listing.
 */
export async function deleteHashtagFromPool(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!id) return { ok: false, error: "Hashtag id is required." };

  const organizationId = await resolveOrganizationId(supabase);
  if (!organizationId) return { ok: false, error: "Unable to resolve organization." };

  const { error } = await supabase
    .from("hashtag_pool")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, error: "Unable to delete hashtag from the pool." };
  return { ok: true };
}
