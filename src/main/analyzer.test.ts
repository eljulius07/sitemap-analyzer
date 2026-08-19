import { describe, expect, it } from 'vitest'
import { httpInfo } from '../test/fixtures'
import { analyzeHtml } from './analyzer'

const URL_UNDER_TEST = 'https://example.com/section/page'

function page(head: string, body = '<h1>Hello</h1>'): string {
  return `<!doctype html><html lang="en"><head><title>Page</title>${head}</head><body>${body}</body></html>`
}

const seoOf = (head: string, url = URL_UNDER_TEST, http = httpInfo()) =>
  analyzeHtml(page(head), url, http).seo

describe('indexability', () => {
  it('treats a page with no canonical as indexable', () => {
    // Regression: a missing canonical used to force isIndexable = false, which
    // both mis-reported the page and deducted the SEO score twice.
    const seo = seoOf('')
    expect(seo.canonicalStatus).toBe('missing')
    expect(seo.isIndexable).toBe(true)
  })

  it('treats a self-referencing canonical as indexable', () => {
    const seo = seoOf(`<link rel="canonical" href="${URL_UNDER_TEST}">`)
    expect(seo.canonicalStatus).toBe('self')
    expect(seo.isIndexable).toBe(true)
  })

  it('ignores a trailing slash when comparing the canonical to the page URL', () => {
    const seo = seoOf(`<link rel="canonical" href="${URL_UNDER_TEST}/">`)
    expect(seo.canonicalStatus).toBe('self')
  })

  it('marks a page canonicalised to another URL as not indexable', () => {
    const seo = seoOf('<link rel="canonical" href="https://example.com/other">')
    expect(seo.canonicalStatus).toBe('other')
    expect(seo.isIndexable).toBe(false)
  })

  it('marks meta robots noindex as not indexable', () => {
    const seo = seoOf('<meta name="robots" content="noindex, follow">')
    expect(seo.isIndexable).toBe(false)
  })

  it('marks an X-Robots-Tag noindex header as not indexable', () => {
    const http = httpInfo({ headers: { 'x-robots-tag': 'noindex' } })
    const seo = seoOf(`<link rel="canonical" href="${URL_UNDER_TEST}">`, URL_UNDER_TEST, http)
    expect(seo.xRobotsTag).toBe('noindex')
    expect(seo.isIndexable).toBe(false)
  })

  it('marks a non-200 response as not indexable', () => {
    const http = httpInfo({ statusCode: 301, statusText: 'Moved Permanently' })
    const seo = seoOf(`<link rel="canonical" href="${URL_UNDER_TEST}">`, URL_UNDER_TEST, http)
    expect(seo.isIndexable).toBe(false)
  })
})

describe('heading hierarchy', () => {
  it('accepts H1 → H2 → H3', () => {
    const html = page('', '<h1>a</h1><h2>b</h2><h3>c</h3>')
    expect(analyzeHtml(html, URL_UNDER_TEST, httpInfo()).seo.headingHierarchyValid).toBe(true)
  })

  it('rejects a skipped level (H1 → H3)', () => {
    const html = page('', '<h1>a</h1><h3>c</h3>')
    expect(analyzeHtml(html, URL_UNDER_TEST, httpInfo()).seo.headingHierarchyValid).toBe(false)
  })
})

describe('outdated year detection', () => {
  const titled = (title: string) =>
    analyzeHtml(
      `<!doctype html><html><head><title>${title}</title></head><body></body></html>`,
      URL_UNDER_TEST,
      httpInfo()
    ).seo

  it('reports the most recent past year in the title', () => {
    expect(titled('Mejores hosting 2015 y 2018').outdatedYearInTitle).toBe(2018)
  })

  it('ignores the current year and future years', () => {
    const year = new Date().getFullYear()
    expect(titled(`Guía ${year}`).outdatedYearInTitle).toBeNull()
    expect(titled(`Guía ${year + 1}`).outdatedYearInTitle).toBeNull()
  })

  it('ignores four-digit numbers that are not years', () => {
    expect(titled('Comprar por 1999 euros').outdatedYearInTitle).toBeNull()
  })
})

describe('link and image counting', () => {
  it('separates internal from external links and flags unusable hrefs', () => {
    const html = page(
      '',
      `<a href="/a">a</a>
       <a href="https://other.com/b">b</a>
       <a href="#">empty</a>
       <a href="javascript:void(0)">js</a>
       <a href="/c"><img src="/i.png" alt="pic"></a>
       <a href="/d"></a>`
    )
    const { links } = analyzeHtml(html, URL_UNDER_TEST, httpInfo())
    expect(links.internalLinks).toBe(3) // /a, /c, /d — hash- and javascript-only hrefs do not count
    expect(links.externalLinks).toBe(1)
    expect(links.externalDomains).toEqual(['other.com'])
    expect(links.hashOnly).toBe(1)
    expect(links.javascriptLinks).toBe(1)
    expect(links.withoutAnchorText).toBe(1) // only the empty <a> — an <a> wrapping an <img> counts as labelled
  })

  it('counts missing alt separately from empty alt', () => {
    const html = page('', '<img src="/a.webp"><img src="/b.jpg" alt=""><img src="/c.png" alt="ok">')
    const { images } = analyzeHtml(html, URL_UNDER_TEST, httpInfo())
    expect(images.totalImages).toBe(3)
    expect(images.missingAlt).toBe(1)
    expect(images.emptyAlt).toBe(1)
    expect(images.nextGenFormats).toBe(1)
    expect(images.legacyFormats).toBe(2)
    expect(images.missingDimensions).toBe(3)
  })
})
