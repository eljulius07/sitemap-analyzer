import type { HreflangIssue, SitemapUrlEntry, SitemapUrlMeta } from './types'

/**
 * The BCP 47 subset Google accepts in hreflang: a 2–3 letter language, an
 * optional 4-letter script, and an optional region (ISO 3166-1 alpha-2 or a
 * UN M.49 numeric code) — plus the special `x-default`.
 */
const HREFLANG_RE = /^(x-default|[a-z]{2,3}(-[A-Za-z]{4})?(-([A-Za-z]{2}|\d{3}))?)$/i

/**
 * Compare two URLs the way a search engine clusters them: ignore the fragment
 * and a trailing slash, lower-case the host, keep the query (it can select a
 * different page) and keep path case (some servers are case-sensitive).
 */
export function alternateKey(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, '') : '/'
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`
  } catch {
    return url.trim().replace(/#.*$/, '').replace(/\/+$/, '')
  }
}

/**
 * Validate the hreflang clusters declared by a sitemap, entry by entry.
 *
 * Everything here is derivable from the sitemap alone — no crawling — so it is
 * computed once, right after parsing. The returned map is keyed by the raw
 * `<loc>`, which is exactly the URL the crawler will report back.
 *
 * Checks, per entry that declares at least one alternate:
 *  - the language code is well formed;
 *  - no language is declared twice pointing at different URLs;
 *  - the set includes a self-reference (Google requires it);
 *  - every alternate is itself listed in the sitemap;
 *  - every alternate links back (hreflang must be bidirectional).
 */
export function validateSitemapHreflang(
  entries: SitemapUrlEntry[]
): Map<string, SitemapUrlMeta> {
  const known = new Set<string>()
  const targetsOf = new Map<string, Set<string>>()
  for (const entry of entries) {
    const k = alternateKey(entry.loc)
    known.add(k)
    targetsOf.set(k, new Set(entry.alternates.map((a) => alternateKey(a.href))))
  }

  const out = new Map<string, SitemapUrlMeta>()

  for (const entry of entries) {
    const selfKey = alternateKey(entry.loc)
    const issues: HreflangIssue[] = []

    if (entry.alternates.length > 0) {
      const seenLangs = new Map<string, string>()
      let hasSelfReference = false

      for (const alt of entry.alternates) {
        const altKey = alternateKey(alt.href)
        if (altKey === selfKey) hasSelfReference = true

        if (!HREFLANG_RE.test(alt.lang)) {
          issues.push({
            code: 'invalid-hreflang-code',
            lang: alt.lang,
            href: alt.href,
            message: `Invalid hreflang value "${alt.lang}"`
          })
        }

        const lang = alt.lang.toLowerCase()
        const previous = seenLangs.get(lang)
        if (previous === undefined) {
          seenLangs.set(lang, altKey)
        } else if (previous !== altKey) {
          issues.push({
            code: 'duplicate-hreflang',
            lang: alt.lang,
            href: alt.href,
            message: `hreflang "${alt.lang}" is declared twice with different targets`
          })
        }

        if (!known.has(altKey)) {
          issues.push({
            code: 'alternate-not-in-sitemap',
            lang: alt.lang,
            href: alt.href,
            message: `Alternate "${alt.href}" is not listed in the sitemap`
          })
        } else if (altKey !== selfKey && !targetsOf.get(altKey)?.has(selfKey)) {
          issues.push({
            code: 'missing-return-link',
            lang: alt.lang,
            href: alt.href,
            message: `"${alt.href}" does not declare an hreflang back to this URL`
          })
        }
      }

      if (!hasSelfReference) {
        issues.push({
          code: 'missing-self-reference',
          lang: '',
          href: '',
          message: 'Alternate set has no self-referencing hreflang'
        })
      }
    }

    out.set(entry.loc, { alternates: entry.alternates, hreflangIssues: issues })
  }

  return out
}
