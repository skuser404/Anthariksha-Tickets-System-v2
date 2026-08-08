/**
 * Helpers for building PostgREST filter strings safely.
 *
 * `supabase.or('a.ilike.%x%,b.ilike.%x%')` takes a *string* whose commas,
 * parentheses and dots are structural. Interpolating raw user input therefore
 * lets a search term change the shape of the filter, so every value that ends up
 * inside one of these strings must be sanitised first.
 */

/**
 * Strip the characters PostgREST treats as filter syntax, and the LIKE
 * wildcards, so a term can only ever match literally.
 */
export function sanitiseLikeTerm(term: string, maxLength = 100): string {
  return term
    .replace(/[(),."'\\]/g, ' ')  // PostgREST structure + quoting
    .replace(/[%_]/g, ' ')        // LIKE wildcards
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Build an `or=(...)` filter matching `term` across several text columns. */
export function orIlike(columns: string[], term: string): string {
  const safe = sanitiseLikeTerm(term);
  return columns.map((c) => `${c}.ilike.%${safe}%`).join(',');
}
