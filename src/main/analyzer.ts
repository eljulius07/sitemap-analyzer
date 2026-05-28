import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type {
  ContentAnalysis,
  HttpInfo,
  ImageAnalysis,
  LinkAnalysis,
  PerformanceAnalysis,
  SeoAnalysis,
  SocialAnalysis,
  TechnicalAnalysis
} from '@shared/types'

export interface PageAnalysis {
  seo: SeoAnalysis
  performance: PerformanceAnalysis
  content: ContentAnalysis
  technical: TechnicalAnalysis
  social: SocialAnalysis
  images: ImageAnalysis
  links: LinkAnalysis
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    u.hash = ''
    let path = u.pathname
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`
  } catch {
    return raw.trim().replace(/#.*$/, '').replace(/\/$/, '')
  }
}

function resolveUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return ''
  }
}

function brandFromHost(host: string): string {
  const parts = host.replace(/^www\./, '').split('.')
  if (parts.length >= 2) return parts[parts.length - 2]
  return parts[0] ?? ''
}

function round(n: number, dp = 0): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

function analyzeSeo($: CheerioAPI, pageUrl: string, http: HttpInfo): SeoAnalysis {
  const title = $('head > title').first().text().trim()
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() ?? ''
  const h1 = $('h1').first().text().trim()
  const h1Count = $('h1').length
  const h2Count = $('h2').length
  const h3Count = $('h3').length

  // Heading hierarchy: levels must not jump by more than 1 going deeper.
  let headingHierarchyValid = true
  let prev = 0
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const level = Number((el as { tagName?: string }).tagName?.[1] ?? 0)
    if (prev !== 0 && level > prev + 1) headingHierarchyValid = false
    if (level > prev) prev = level
    else prev = level
  })

  const metaRobots = $('meta[name="robots"]').attr('content')?.trim() ?? ''
  const xRobotsTag = http.headers['x-robots-tag'] ?? ''
  const canonicalRaw = $('link[rel="canonical"]').attr('href')?.trim() ?? ''

  let canonicalUrl = canonicalRaw
  let canonicalStatus: SeoAnalysis['canonicalStatus'] = 'missing'
  if (canonicalRaw) {
    const resolved = resolveUrl(canonicalRaw, pageUrl)
    if (resolved) canonicalUrl = resolved
    canonicalStatus =
      resolved && normalizeUrl(resolved) === normalizeUrl(pageUrl) ? 'self' : 'other'
  }

  const noindex = /noindex/i.test(metaRobots) || /noindex/i.test(xRobotsTag)
  const isIndexable = !noindex && canonicalStatus !== 'missing' && http.statusCode === 200

  const u = (() => {
    try {
      return new URL(pageUrl)
    } catch {
      return null
    }
  })()
  const pathname = u?.pathname ?? pageUrl
  const segments = pathname.split('/').filter(Boolean)

  const hreflang: string[] = []
  const hreflangLinks: { lang: string; href: string }[] = []
  let hreflangSelfReference = false
  const normSelf = normalizeUrl(pageUrl)
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = $(el).attr('hreflang')?.trim()
    const href = $(el).attr('href')?.trim()
    if (lang) hreflang.push(lang)
    if (href) {
      const resolved = resolveUrl(href, pageUrl)
      if (lang && resolved) hreflangLinks.push({ lang, href: resolved })
      if (resolved && normalizeUrl(resolved) === normSelf) hreflangSelfReference = true
    }
  })

  return {
    title,
    titleLength: title.length,
    titlePixelWidth: round(title.length * 6),
    titleHasBrand: (() => {
      const brand = brandFromHost(hostOf(pageUrl))
      return brand.length > 1 && title.toLowerCase().includes(brand.toLowerCase())
    })(),
    metaDescription,
    metaDescriptionLength: metaDescription.length,
    h1,
    h1Count,
    h2Count,
    h3Count,
    headingHierarchyValid,
    metaRobots,
    xRobotsTag,
    canonicalUrl,
    canonicalStatus,
    isIndexable,
    urlLength: pageUrl.length,
    urlDepth: segments.length,
    hasUppercase: /[A-Z]/.test(pathname),
    hasUnderscores: pathname.includes('_'),
    hasParameters: (u?.search ?? '') !== '',
    htmlLang: $('html').attr('lang')?.trim() ?? '',
    hreflang,
    hreflangLinks,
    hreflangCount: hreflang.length,
    hreflangSelfReference: hreflang.length > 0 ? hreflangSelfReference : false
  }
}

function analyzePerformance($: CheerioAPI, pageUrl: string, http: HttpInfo, htmlSizeKb: number): PerformanceAnalysis {
  const jsFileUrls: string[] = []
  const renderBlockingJs: string[] = []
  let inlineScriptCount = 0
  $('script').each((_, el) => {
    const src = $(el).attr('src')?.trim()
    if (src) {
      const resolved = resolveUrl(src, pageUrl) ?? src
      jsFileUrls.push(resolved)
      const inHead = $(el).parents('head').length > 0
      const async = $(el).attr('async') !== undefined
      const defer = $(el).attr('defer') !== undefined
      const moduleType = $(el).attr('type') === 'module'
      if (inHead && !async && !defer && !moduleType) renderBlockingJs.push(resolved)
    } else {
      inlineScriptCount++
    }
  })

  const cssFileUrls: string[] = []
  const renderBlockingCss: string[] = []
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href')?.trim()
    if (!href) return
    const resolved = resolveUrl(href, pageUrl) ?? href
    cssFileUrls.push(resolved)
    const inHead = $(el).parents('head').length > 0
    const media = ($(el).attr('media') ?? '').toLowerCase().trim()
    const blocking = media === '' || media === 'all' || media === 'screen'
    if (inHead && blocking) renderBlockingCss.push(resolved)
  })

  const fontPreloads = $('link[rel="preload"][as="font"]').length
  const inlineStyleCount = $('style').length
  const imageCount = $('img').length
  const hasLazyLoading = $('img[loading="lazy"]').length > 0
  const hasPreconnect = $('link[rel="preconnect"]').length > 0
  const hasDnsPrefetch = $('link[rel="dns-prefetch"]').length > 0
  const hasResourceHints =
    $('link[rel="preload"], link[rel="prefetch"], link[rel="prerender"]').length > 0

  const renderBlockingCount = renderBlockingJs.length + renderBlockingCss.length

  return {
    ttfbMs: http.ttfbMs,
    totalDownloadMs: http.totalDownloadMs,
    redirectTimeMs: http.redirectTimeMs,
    numRedirects: http.redirectChain.filter((h) => h.status >= 300 && h.status < 400).length,
    htmlSizeKb,
    totalPageWeightKb: htmlSizeKb,
    htmlCompressed: http.compressed,
    jsFilesCount: jsFileUrls.length,
    cssFilesCount: cssFileUrls.length,
    imageCount,
    fontPreloads,
    inlineScriptCount,
    inlineStyleCount,
    jsFileUrls,
    cssFileUrls,
    renderBlockingJs,
    renderBlockingCss,
    hasLazyLoading,
    hasPreconnect,
    hasDnsPrefetch,
    hasResourceHints,
    renderBlockingCount
  }
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (w.length <= 3) return w ? 1 : 0
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').match(/[aeiouy]{1,2}/g)
  return groups ? groups.length : 1
}

function detectLanguage(text: string): string {
  const sample = text.toLowerCase().slice(0, 5000)
  const dict: Record<string, string[]> = {
    English: [' the ', ' and ', ' of ', ' to ', ' is ', ' in '],
    Spanish: [' el ', ' la ', ' de ', ' que ', ' y ', ' los '],
    French: [' le ', ' la ', ' les ', ' des ', ' et ', ' une '],
    German: [' der ', ' die ', ' und ', ' den ', ' ist ', ' das ']
  }
  let best = 'Unknown'
  let bestScore = 0
  for (const [lang, words] of Object.entries(dict)) {
    const score = words.reduce((s, w) => s + (sample.split(w).length - 1), 0)
    if (score > bestScore) {
      bestScore = score
      best = lang
    }
  }
  return bestScore > 2 ? best : 'Unknown'
}

function analyzeContent($: CheerioAPI, htmlBytes: number): ContentAnalysis {
  const body = $('body').clone()
  body.find('script, style, noscript, template, nav, footer').remove()
  const visibleText = body.text().replace(/\s+/g, ' ').trim()
  const words = visibleText ? visibleText.split(' ').filter(Boolean) : []
  const wordCount = words.length

  const sentences = Math.max(1, (visibleText.match(/[.!?]+/g) ?? []).length)
  const syllables = words.reduce((s, w) => s + countSyllables(w), 0)
  const readingLevel =
    wordCount > 0
      ? Math.max(
          0,
          round(0.39 * (wordCount / sentences) + 11.8 * (syllables / wordCount) - 15.59, 1)
        )
      : 0

  const iframeDomains = new Set<string>()
  let hasVideo = $('video').length > 0
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') ?? ''
    const host = hostOf(src)
    if (host) iframeDomains.add(host)
    if (/youtube\.com|youtu\.be|vimeo\.com/i.test(src)) hasVideo = true
  })

  return {
    wordCount,
    textHtmlRatio: htmlBytes > 0 ? round((visibleText.length / htmlBytes) * 100, 1) : 0,
    readingLevel,
    paragraphCount: $('p').length,
    hasTable: $('table').length > 0,
    hasVideo,
    hasAudio: $('audio').length > 0,
    hasIframe: $('iframe').length > 0,
    iframeDomains: [...iframeDomains],
    contentLanguage: detectLanguage(visibleText)
  }
}

function analyzeTechnical($: CheerioAPI, pageUrl: string, html: string, http: HttpInfo): TechnicalAnalysis {
  const h = http.headers
  return {
    https: pageUrl.toLowerCase().startsWith('https://'),
    http2: http.httpVersion.startsWith('2'),
    hasDoctype: /<!doctype\s+html/i.test(html.slice(0, 200)),
    hasCharset:
      $('meta[charset]').length > 0 || $('meta[http-equiv="Content-Type"]').length > 0,
    hasViewport: $('meta[name="viewport"]').length > 0,
    hasFavicon:
      $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').length > 0,
    hasSitemapReference: $('link[rel="sitemap"]').length > 0,
    contentTypeHeader: http.contentType,
    serverHeader: h['server'] ?? '',
    xFrameOptions: h['x-frame-options'] ?? '',
    contentSecurityPolicy: h['content-security-policy'] ?? '',
    strictTransportSecurity: h['strict-transport-security'] ?? '',
    cacheControl: h['cache-control'] ?? '',
    etag: h['etag'] ?? ''
  }
}

function collectSchemaTypes(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectSchemaTypes(item, out)
    return
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    const type = obj['@type']
    if (typeof type === 'string') out.add(type)
    else if (Array.isArray(type)) type.forEach((t) => typeof t === 'string' && out.add(t))
    if (Array.isArray(obj['@graph'])) collectSchemaTypes(obj['@graph'], out)
  }
}

function analyzeSocial($: CheerioAPI): SocialAnalysis {
  const meta = (sel: string): string => $(sel).attr('content')?.trim() ?? ''
  const ogTitle = meta('meta[property="og:title"]')
  const ogDescription = meta('meta[property="og:description"]')
  const ogImage = meta('meta[property="og:image"]')
  const ogImageWidth = meta('meta[property="og:image:width"]')
  const ogImageHeight = meta('meta[property="og:image:height"]')
  const ogType = meta('meta[property="og:type"]')
  const ogUrl = meta('meta[property="og:url"]')
  const ogComplete = !!(ogTitle && ogDescription && ogImage && ogType && ogUrl)

  const schemaTypes = new Set<string>()
  const rawJsonLd: string[] = []
  let schemaCount = 0
  let jsonLdValid = true
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text()
    if (!raw.trim()) return
    schemaCount++
    rawJsonLd.push(raw.trim())
    try {
      collectSchemaTypes(JSON.parse(raw), schemaTypes)
    } catch {
      jsonLdValid = false
    }
  })
  const types = [...schemaTypes]
  const hasMicrodata = $('[itemscope]').length > 0
  const lc = types.map((t) => t.toLowerCase())

  return {
    ogTitle,
    ogDescription,
    ogImage,
    ogImageWidth,
    ogImageHeight,
    ogType,
    ogUrl,
    ogComplete,
    twitterCard: meta('meta[name="twitter:card"]'),
    twitterTitle: meta('meta[name="twitter:title"]'),
    twitterDescription: meta('meta[name="twitter:description"]'),
    twitterImage: meta('meta[name="twitter:image"]'),
    hasStructuredData: types.length > 0 || hasMicrodata,
    schemaTypes: types,
    schemaCount,
    hasBreadcrumb: lc.includes('breadcrumblist'),
    hasFaq: lc.includes('faqpage'),
    hasArticle: lc.some((t) => ['article', 'newsarticle', 'blogposting'].includes(t)),
    hasProduct: lc.includes('product'),
    hasLocalBusiness: lc.includes('localbusiness'),
    jsonLdValid,
    rawJsonLd
  }
}

function analyzeImages($: CheerioAPI, pageUrl: string): ImageAnalysis {
  let missingAlt = 0
  let emptyAlt = 0
  let missingDimensions = 0
  let nextGenFormats = 0
  let legacyFormats = 0
  let lazyLoaded = 0
  let withSrcset = 0
  const imageUrls: string[] = []

  $('img').each((_, el) => {
    const $el = $(el)
    const alt = $el.attr('alt')
    if (alt === undefined) missingAlt++
    else if (alt.trim() === '') emptyAlt++

    const width = $el.attr('width')
    const height = $el.attr('height')
    if (width === undefined || height === undefined) missingDimensions++

    const src = $el.attr('src')?.trim() ?? ''
    if (src) {
      imageUrls.push(resolveUrl(src, pageUrl) ?? src)
      const clean = src.split('?')[0].toLowerCase()
      if (/\.(webp|avif)$/.test(clean)) nextGenFormats++
      else if (/\.(jpe?g|png|gif)$/.test(clean)) legacyFormats++
    }

    if ($el.attr('loading') === 'lazy') lazyLoaded++
    if ($el.attr('srcset') !== undefined) withSrcset++
  })

  return {
    totalImages: $('img').length,
    missingAlt,
    emptyAlt,
    missingDimensions,
    nextGenFormats,
    legacyFormats,
    lazyLoaded,
    withSrcset,
    imageUrls
  }
}

function analyzeLinks($: CheerioAPI, pageUrl: string): LinkAnalysis {
  const pageHost = hostOf(pageUrl)
  let internalLinks = 0
  let externalLinks = 0
  let nofollow = 0
  let sponsored = 0
  let ugc = 0
  let withoutAnchorText = 0
  let hashOnly = 0
  let javascriptLinks = 0
  const externalDomains = new Set<string>()

  const anchors = $('a')
  anchors.each((_, el) => {
    const $el = $(el)
    const href = $el.attr('href')?.trim() ?? ''
    const rel = ($el.attr('rel') ?? '').toLowerCase()
    if (rel.includes('nofollow')) nofollow++
    if (rel.includes('sponsored')) sponsored++
    if (rel.includes('ugc')) ugc++

    const text = $el.text().trim()
    const hasMedia = $el.find('img, svg, picture').length > 0
    if (!text && !hasMedia) withoutAnchorText++

    if (href === '#') hashOnly++
    if (href.toLowerCase().startsWith('javascript:')) {
      javascriptLinks++
      return
    }
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return
    }
    const resolved = resolveUrl(href, pageUrl)
    if (!resolved) return
    const host = hostOf(resolved)
    if (host === pageHost) internalLinks++
    else if (host) {
      externalLinks++
      externalDomains.add(host)
    }
  })

  return {
    totalLinks: anchors.length,
    internalLinks,
    externalLinks,
    nofollow,
    sponsored,
    ugc,
    withoutAnchorText,
    hashOnly,
    javascriptLinks,
    externalDomains: [...externalDomains]
  }
}

export function analyzeHtml(html: string, pageUrl: string, http: HttpInfo): PageAnalysis {
  const $ = cheerio.load(html)
  const htmlBytes = Buffer.byteLength(html, 'utf-8')
  const htmlSizeKb = round(htmlBytes / 1024, 1)

  return {
    seo: analyzeSeo($, pageUrl, http),
    performance: analyzePerformance($, pageUrl, http, htmlSizeKb),
    content: analyzeContent($, htmlBytes),
    technical: analyzeTechnical($, pageUrl, html, http),
    social: analyzeSocial($),
    images: analyzeImages($, pageUrl),
    links: analyzeLinks($, pageUrl)
  }
}
