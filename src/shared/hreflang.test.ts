import { describe, expect, it } from 'vitest'
import { alternateKey, validateSitemapHreflang } from './hreflang'
import type { SitemapUrlEntry } from './types'

const codesFor = (map: Map<string, { hreflangIssues: { code: string }[] }>, loc: string): string[] =>
  (map.get(loc)?.hreflangIssues ?? []).map((i) => i.code).sort()

/** The shape the user's real sitemap uses: es ⇄ en, both self-referencing. */
const HEALTHY: SitemapUrlEntry[] = [
  {
    loc: 'https://www.pricetravel.com/es/hoteles',
    alternates: [
      { lang: 'es', href: 'https://www.pricetravel.com/es/hoteles' },
      { lang: 'en', href: 'https://www.pricetravel.com/en/hotels' }
    ]
  },
  {
    loc: 'https://www.pricetravel.com/en/hotels',
    alternates: [
      { lang: 'es', href: 'https://www.pricetravel.com/es/hoteles' },
      { lang: 'en', href: 'https://www.pricetravel.com/en/hotels' }
    ]
  }
]

describe('alternateKey', () => {
  it('ignores the fragment, a trailing slash and host case', () => {
    expect(alternateKey('https://X.com/a/#top')).toBe(alternateKey('https://x.com/a'))
  })

  it('keeps the query and the path case', () => {
    expect(alternateKey('https://x.com/a?p=1')).not.toBe(alternateKey('https://x.com/a'))
    expect(alternateKey('https://x.com/A')).not.toBe(alternateKey('https://x.com/a'))
  })

  it('degrades gracefully on unparseable input', () => {
    expect(alternateKey('  not a url/  ')).toBe('not a url')
  })
})

describe('a well-formed cluster', () => {
  it('reports nothing', () => {
    const map = validateSitemapHreflang(HEALTHY)
    expect(codesFor(map, HEALTHY[0].loc)).toEqual([])
    expect(codesFor(map, HEALTHY[1].loc)).toEqual([])
  })

  it('carries the alternates through untouched', () => {
    const map = validateSitemapHreflang(HEALTHY)
    expect(map.get(HEALTHY[0].loc)?.alternates).toEqual(HEALTHY[0].alternates)
  })

  it('leaves an entry with no alternates alone', () => {
    const map = validateSitemapHreflang([{ loc: 'https://x.com/a', alternates: [] }])
    expect(codesFor(map, 'https://x.com/a')).toEqual([])
  })
})

describe('missing self-reference', () => {
  it('is reported when the set never points at its own loc', () => {
    const map = validateSitemapHreflang([
      { loc: 'https://x.com/es/a', alternates: [{ lang: 'en', href: 'https://x.com/en/a' }] },
      { loc: 'https://x.com/en/a', alternates: [{ lang: 'en', href: 'https://x.com/en/a' }] }
    ])
    expect(codesFor(map, 'https://x.com/es/a')).toContain('missing-self-reference')
  })

  it('accepts a self-reference that differs only by trailing slash', () => {
    const map = validateSitemapHreflang([
      { loc: 'https://x.com/es/a', alternates: [{ lang: 'es', href: 'https://x.com/es/a/' }] }
    ])
    expect(codesFor(map, 'https://x.com/es/a')).toEqual([])
  })
})

describe('return links', () => {
  it('flags an alternate that does not link back', () => {
    const map = validateSitemapHreflang([
      {
        loc: 'https://x.com/es/a',
        alternates: [
          { lang: 'es', href: 'https://x.com/es/a' },
          { lang: 'en', href: 'https://x.com/en/a' }
        ]
      },
      { loc: 'https://x.com/en/a', alternates: [{ lang: 'en', href: 'https://x.com/en/a' }] }
    ])
    expect(codesFor(map, 'https://x.com/es/a')).toEqual(['missing-return-link'])
  })

  it('does not also complain about a return link when the target is absent', () => {
    const map = validateSitemapHreflang([
      {
        loc: 'https://x.com/es/a',
        alternates: [
          { lang: 'es', href: 'https://x.com/es/a' },
          { lang: 'en', href: 'https://x.com/en/a' }
        ]
      }
    ])
    expect(codesFor(map, 'https://x.com/es/a')).toEqual(['alternate-not-in-sitemap'])
  })
})

describe('malformed declarations', () => {
  it('flags an invalid language code', () => {
    const map = validateSitemapHreflang([
      { loc: 'https://x.com/a', alternates: [{ lang: 'espanol', href: 'https://x.com/a' }] }
    ])
    expect(codesFor(map, 'https://x.com/a')).toEqual(['invalid-hreflang-code'])
  })

  it('accepts region, script and x-default forms', () => {
    const alternates = [
      { lang: 'es', href: 'https://x.com/a' },
      { lang: 'es-MX', href: 'https://x.com/mx' },
      { lang: 'zh-Hant-TW', href: 'https://x.com/tw' },
      { lang: 'es-419', href: 'https://x.com/latam' },
      { lang: 'x-default', href: 'https://x.com/a' }
    ]
    const map = validateSitemapHreflang([{ loc: 'https://x.com/a', alternates }])
    expect(codesFor(map, 'https://x.com/a').filter((c) => c === 'invalid-hreflang-code')).toEqual([])
  })

  it('flags one language pointing at two different URLs', () => {
    const map = validateSitemapHreflang([
      {
        loc: 'https://x.com/a',
        alternates: [
          { lang: 'es', href: 'https://x.com/a' },
          { lang: 'es', href: 'https://x.com/otro' }
        ]
      }
    ])
    expect(codesFor(map, 'https://x.com/a')).toContain('duplicate-hreflang')
  })
})
