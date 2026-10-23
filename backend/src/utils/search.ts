/**
 * Search strategy: normalized, prefix-anchored token matching.
 *
 * Each searchable document stores `searchTokens`: lowercase, accent-stripped words (plus the full
 * e-mail address / digits-only phone). A query is split on whitespace and every term must match
 * the START of at least one token (AND semantics). Anchored regexes (`^term`) can use the
 * multikey index on `searchTokens`, unlike a contains-regex which always scans.
 *
 * Safety: terms are escaped (no user-controlled regex syntax), capped in count and length, and
 * only ever used as the value of `$regex` - never as an operator key.
 */

export const MAX_SEARCH_TERMS = 5;
export const MAX_TERM_LENGTH = 50;
export const MAX_TOKENS_PER_DOC = 48;

export function stripDiacritics(input: string): string {
  return input.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

export function normalizeText(input: string): string {
  return stripDiacritics(input).toLowerCase().trim().replace(/\s+/g, ' ');
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
}

/** Split free text into alphanumeric words. */
function words(input: string): string[] {
  return normalizeText(input)
    .split(/[^a-z0-9ঀ-৿]+/i) // keep Bengali block so local names stay searchable
    .filter((w) => w.length > 0);
}

export function digitsOnly(input: string): string {
  return input.replace(/\D+/g, '');
}

export interface TokenSource {
  names?: string[];
  texts?: string[];
  emails?: Array<string | null | undefined>;
  phones?: Array<string | null | undefined>;
}

export function buildSearchTokens(source: TokenSource): string[] {
  const out = new Set<string>();
  for (const n of source.names ?? []) words(n).forEach((w) => out.add(w));
  for (const t of source.texts ?? []) words(t).forEach((w) => out.add(w));
  for (const e of source.emails ?? []) {
    if (!e) continue;
    const email = normalizeText(e);
    out.add(email); // lets "john.doe@ex" prefix-match the whole address
    const [local] = email.split('@');
    if (local) {
      out.add(local);
      words(local).forEach((w) => out.add(w));
    }
    words(email.split('@')[1] ?? '').forEach((w) => out.add(w));
  }
  for (const p of source.phones ?? []) {
    if (!p) continue;
    const d = digitsOnly(p);
    if (d.length >= 3) out.add(d);
  }
  return [...out].slice(0, MAX_TOKENS_PER_DOC);
}

/** Returns normalized, deduplicated search terms (empty array = no search). */
export function parseSearchTerms(search: string | undefined): string[] {
  if (!search) return [];
  const terms = normalizeText(search)
    .split(' ')
    .map((t) => t.slice(0, MAX_TERM_LENGTH))
    .filter(Boolean);
  // A phone typed as "+880 1712-345" should still match the digits token.
  const expanded = terms.flatMap((t) => (/^[+\d()\-.]+$/.test(t) && digitsOnly(t).length >= 3 ? [digitsOnly(t)] : [t]));
  return [...new Set(expanded)].slice(0, MAX_SEARCH_TERMS);
}

/** Mongo filter fragment for the given terms, or null when there is nothing to search. */
export function searchFilter(search: string | undefined): { $and: Array<{ searchTokens: { $regex: string } }> } | null {
  const terms = parseSearchTerms(search);
  if (terms.length === 0) return null;
  return { $and: terms.map((t) => ({ searchTokens: { $regex: `^${escapeRegex(t)}` } })) };
}

/** Lowercase accent-free key used for case-insensitive, index-friendly name sorting. */
export function sortKey(input: string): string {
  return normalizeText(input);
}
