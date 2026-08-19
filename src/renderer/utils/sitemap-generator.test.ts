import { describe, expect, it } from 'vitest'
import { DEFAULT_SITEMAP_CONFIG, type SitemapConfig, type UrlResult } from '@shared/types'
import { httpInfo, seoAnalysis, urlResult } from '../../test/fixtures'
import { generateSitemap, selectEntries } from './sitemap-generator'

const config = (patch: Partial<SitemapConfig> = {}): SitemapConfig => ({
  ...DEFAULT_SITEMAP_CONFIG,
  ...patch
})

const withHreflang = (
  patch: Partial<SitemapConfig['hreflang']> = {},
  rest: Partial<SitemapConfig> = {}
): SitemapConfig =>
  config({ hreflang: { ...DEFAULT_SITEMAP_CONFIG.hreflang, enabled: true, ...patch }, ...rest })

const ok = (url: string, patch: Partial<UrlResult> = {}): UrlResult => urlResult({ url, ...patch })

const redirecting = (from: string, to: string): UrlResult =>
  urlResult({
    url: from,
    http: httpInfo({
      statusCode: 200,
      redirectChain: [
        { url: from, status: 301 },
        { url: to, status: 200 }
      ]
    })
  })

const locsIn = (xml: string): string[] =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

const altsIn = (xml: string): string[] =>
  [...xml.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => `${m[1]}=${m[2]}`)

const single = (results: UrlResult[], cfg: SitemapConfig): string =>
  generateSitemap(results, cfg).files[0].content

describe('excluding broken URLs', () => {
  it('drops 4xx, 5xx and dead requests', () => {
    const results = [
      ok('https://x.com/good'),
      urlResult({ url: 'https://x.com/gone', http: httpInfo({ statusCode: 404 }) }),
      urlResult({ url: 'https://x.com/boom', http: httpInfo({ statusCode: 500 }) }),
      urlResult({
        url: 'https://x.com/dead',
        http: httpInfo({ statusCode: null }),
        error: 'ECONNREFUSED'
      })
    ]
    const { included, stats } = selectEntries(results, config())
    expect(included.map((r) => r.url)).toEqual(['https://x.com/good'])
    expect(stats.status).toBe(3)
  })

  it('drops URLs that redirect, even though the crawl reports them as 200', () => {
    // Regression: the crawler follows redirects, so a 301 source lands in the
    // results with statusCode 200 and used to sail straight into the sitemap.
    const results = [ok('https://x.com/good'), redirecting('https://x.com/old', 'https://x.com/new')]
    const { included, stats } = selectEntries(results, config())
    expect(included.map((r) => r.url)).toEqual(['https://x.com/good'])
    expect(stats.redirected).toBe(1)
  })

  it('keeps redirecting URLs when the rule is switched off', () => {
    const results = [redirecting('https://x.com/old', 'https://x.com/new')]
    expect(selectEntries(results, config({ excludeRedirected: false })).included).toHaveLength(1)
  })

  it('drops URLs canonicalised elsewhere only when asked', () => {
    const canonicalised = ok('https://x.com/dup', {
      seo: seoAnalysis({ canonicalStatus: 'other', canonicalUrl: 'https://x.com/main' })
    })
    expect(selectEntries([canonicalised], config()).included).toHaveLength(1)
    const strict = selectEntries([canonicalised], config({ excludeNonCanonical: true }))
    expect(strict.included).toHaveLength(0)
    expect(strict.stats.nonCanonical).toBe(1)
  })
})

describe('collapsing duplicates', () => {
  it('keeps the first of two identical URLs', () => {
    const { included, stats } = selectEntries([ok('https://x.com/a'), ok('https://x.com/a')], config())
    expect(included).toHaveLength(1)
    expect(stats.duplicate).toBe(1)
  })

  it('collapses URLs that resolve to the same destination', () => {
    const results = [
      redirecting('https://x.com/one', 'https://x.com/target'),
      redirecting('https://x.com/two', 'https://x.com/target')
    ]
    const { included, stats } = selectEntries(results, config({ excludeRedirected: false }))
    expect(included.map((r) => r.url)).toEqual(['https://x.com/one'])
    expect(stats.duplicate).toBe(1)
  })

  it('leaves genuinely distinct URLs alone', () => {
    const { included } = selectEntries([ok('https://x.com/a'), ok('https://x.com/b')], config())
    expect(included).toHaveLength(2)
  })
})

describe('hreflang alternates', () => {
  const es = ok('https://x.com/es/login', {
    sitemap: {
      alternates: [
        { lang: 'es', href: 'https://x.com/es/login' },
        { lang: 'en', href: 'https://x.com/en/login' }
      ],
      hreflangIssues: []
    }
  })
  const en = ok('https://x.com/en/login', {
    sitemap: {
      alternates: [
        { lang: 'es', href: 'https://x.com/es/login' },
        { lang: 'en', href: 'https://x.com/en/login' }
      ],
      hreflangIssues: []
    }
  })

  it('carries the source sitemap alternates into the new one', () => {
    const xml = single([es, en], withHreflang({ source: 'sitemap' }))
    expect(altsIn(xml)).toEqual([
      'es=https://x.com/es/login',
      'en=https://x.com/en/login',
      'es=https://x.com/es/login',
      'en=https://x.com/en/login'
    ])
  })

  it('emits nothing when hreflang is off', () => {
    expect(altsIn(single([es, en], config()))).toEqual([])
  })

  it('lets the page tags win per language and fills gaps from the sitemap', () => {
    const page = ok('https://x.com/es/login', {
      seo: seoAnalysis({ hreflangLinks: [{ lang: 'es', href: 'https://x.com/es/login-v2' }] }),
      sitemap: {
        alternates: [
          { lang: 'es', href: 'https://x.com/es/login' },
          { lang: 'en', href: 'https://x.com/en/login' }
        ],
        hreflangIssues: []
      }
    })
    const cfg = withHreflang({ source: 'both', pruneExcluded: false })
    expect(altsIn(single([page], cfg))).toEqual([
      'es=https://x.com/es/login-v2',
      'en=https://x.com/en/login'
    ])
  })

  it('ignores page tags when the source is sitemap-only', () => {
    const page = ok('https://x.com/es/login', {
      seo: seoAnalysis({ hreflangLinks: [{ lang: 'fr', href: 'https://x.com/fr/login' }] }),
      sitemap: {
        alternates: [{ lang: 'es', href: 'https://x.com/es/login' }],
        hreflangIssues: []
      }
    })
    expect(altsIn(single([page], withHreflang({ source: 'sitemap' })))).toEqual([
      'es=https://x.com/es/login'
    ])
  })

  it('prunes alternates whose target was excluded', () => {
    // The English page 404s, so it never reaches the sitemap — and the Spanish
    // entry must stop advertising it.
    const broken = urlResult({ url: 'https://x.com/en/login', http: httpInfo({ statusCode: 404 }) })
    const result = generateSitemap([es, broken], withHreflang({ source: 'sitemap' }))
    expect(locsIn(result.files[0].content)).toEqual(['https://x.com/es/login'])
    expect(altsIn(result.files[0].content)).toEqual(['es=https://x.com/es/login'])
    expect(result.warnings).toContain(
      '1 hreflang alternate(s) dropped — target is not in the new sitemap.'
    )
  })

  it('keeps dangling alternates when pruning is switched off', () => {
    const broken = urlResult({ url: 'https://x.com/en/login', http: httpInfo({ statusCode: 404 }) })
    const xml = single([es, broken], withHreflang({ source: 'sitemap', pruneExcluded: false }))
    expect(altsIn(xml)).toEqual(['es=https://x.com/es/login', 'en=https://x.com/en/login'])
  })
})

describe('warnings', () => {
  it('reports what each exclusion rule removed', () => {
    const results = [
      ok('https://x.com/good'),
      urlResult({ url: 'https://x.com/gone', http: httpInfo({ statusCode: 404 }) }),
      redirecting('https://x.com/old', 'https://x.com/new'),
      ok('https://x.com/good')
    ]
    const { warnings } = generateSitemap(results, config())
    expect(warnings).toContain('1 URL(s) excluded — error or non-allowed status.')
    expect(warnings).toContain('1 URL(s) excluded — they redirect elsewhere.')
    expect(warnings).toContain('1 duplicate URL(s) collapsed to one entry.')
  })
})
