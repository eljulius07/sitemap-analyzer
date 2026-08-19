import { evaluateResult, type ScoreInput } from '@shared/scoring'
import type {
  ContentAnalysis,
  HttpInfo,
  ImageAnalysis,
  LinkAnalysis,
  PerformanceAnalysis,
  SeoAnalysis,
  SocialAnalysis,
  TechnicalAnalysis,
  UrlResult
} from '@shared/types'

// A page that trips none of the scoring rules. Tests start from here and break
// exactly one thing, so any score delta is attributable to a single rule.

/** A plain, healthy 200 response. */
export function httpInfo(patch: Partial<HttpInfo> = {}): HttpInfo {
  return {
    statusCode: 200,
    statusText: 'OK',
    redirectChain: [],
    ttfbMs: 120,
    totalDownloadMs: 300,
    redirectTimeMs: 0,
    contentType: 'text/html; charset=utf-8',
    contentLengthKb: 20,
    httpVersion: '1.1',
    compressed: true,
    contentEncoding: 'gzip',
    supportsH2: true,
    supportsH3: false,
    headers: { 'strict-transport-security': 'max-age=31536000' },
    ...patch
  }
}

export const seoAnalysis = (patch: Partial<SeoAnalysis> = {}): SeoAnalysis => ({
  title: 'A perfectly reasonable page title here',
  titleLength: 38,
  titlePixelWidth: 228,
  titleHasBrand: true,
  metaDescription: 'x'.repeat(120),
  metaDescriptionLength: 120,
  h1: 'Heading',
  h1Count: 1,
  h2Count: 3,
  h3Count: 2,
  headingHierarchyValid: true,
  metaRobots: 'index, follow',
  xRobotsTag: '',
  canonicalUrl: 'https://example.com/page',
  canonicalStatus: 'self',
  isIndexable: true,
  urlLength: 24,
  urlDepth: 1,
  hasUppercase: false,
  hasUnderscores: false,
  hasParameters: false,
  htmlLang: 'en',
  hreflang: [],
  hreflangLinks: [],
  hreflangCount: 0,
  hreflangSelfReference: false,
  outdatedYearInTitle: null,
  outdatedYearInMetaDescription: null,
  ...patch
})

export const performanceAnalysis = (
  patch: Partial<PerformanceAnalysis> = {}
): PerformanceAnalysis => ({
  ttfbMs: 150,
  totalDownloadMs: 400,
  redirectTimeMs: 0,
  numRedirects: 0,
  htmlSizeKb: 40,
  totalPageWeightKb: 40,
  htmlCompressed: true,
  jsFilesCount: 4,
  cssFilesCount: 2,
  imageCount: 5,
  fontPreloads: 1,
  inlineScriptCount: 1,
  inlineStyleCount: 1,
  jsFileUrls: [],
  cssFileUrls: [],
  renderBlockingJs: [],
  renderBlockingCss: [],
  hasLazyLoading: true,
  hasPreconnect: true,
  hasDnsPrefetch: true,
  hasResourceHints: true,
  renderBlockingCount: 1,
  ...patch
})

export const contentAnalysis = (patch: Partial<ContentAnalysis> = {}): ContentAnalysis => ({
  wordCount: 850,
  textHtmlRatio: 24.5,
  readingLevel: 8,
  paragraphCount: 12,
  hasTable: false,
  hasVideo: false,
  hasAudio: false,
  hasIframe: false,
  iframeDomains: [],
  contentLanguage: 'English',
  ...patch
})

export const technicalAnalysis = (patch: Partial<TechnicalAnalysis> = {}): TechnicalAnalysis => ({
  https: true,
  http2: true,
  http3: true,
  hasDoctype: true,
  hasCharset: true,
  hasViewport: true,
  hasFavicon: true,
  hasSitemapReference: true,
  contentTypeHeader: 'text/html; charset=utf-8',
  serverHeader: 'nginx',
  xFrameOptions: 'SAMEORIGIN',
  contentSecurityPolicy: "default-src 'self'",
  strictTransportSecurity: 'max-age=31536000',
  cacheControl: 'public, max-age=3600',
  etag: 'W/"abc"',
  ...patch
})

export const socialAnalysis = (patch: Partial<SocialAnalysis> = {}): SocialAnalysis => ({
  ogTitle: 'Title',
  ogDescription: 'Description',
  ogImage: 'https://example.com/og.png',
  ogImageWidth: '1200',
  ogImageHeight: '630',
  ogType: 'website',
  ogUrl: 'https://example.com/page',
  ogComplete: true,
  twitterCard: 'summary_large_image',
  twitterTitle: 'Title',
  twitterDescription: 'Description',
  twitterImage: 'https://example.com/tw.png',
  hasStructuredData: true,
  schemaTypes: ['Article'],
  schemaCount: 1,
  hasBreadcrumb: false,
  hasFaq: false,
  hasArticle: true,
  hasProduct: false,
  hasLocalBusiness: false,
  jsonLdValid: true,
  rawJsonLd: ['{}'],
  ...patch
})

export const imageAnalysis = (patch: Partial<ImageAnalysis> = {}): ImageAnalysis => ({
  totalImages: 5,
  missingAlt: 0,
  emptyAlt: 0,
  missingDimensions: 0,
  nextGenFormats: 5,
  legacyFormats: 0,
  lazyLoaded: 4,
  withSrcset: 5,
  imageUrls: [],
  ...patch
})

export const linkAnalysis = (patch: Partial<LinkAnalysis> = {}): LinkAnalysis => ({
  totalLinks: 30,
  internalLinks: 25,
  externalLinks: 5,
  nofollow: 1,
  sponsored: 0,
  ugc: 0,
  withoutAnchorText: 0,
  hashOnly: 0,
  javascriptLinks: 0,
  externalDomains: ['other.com'],
  ...patch
})

/** A flawless page, as the scorer sees it. */
export function scoreInput(patch: Partial<ScoreInput> = {}): ScoreInput {
  return {
    url: 'https://example.com/page',
    http: httpInfo(),
    seo: seoAnalysis(),
    performance: performanceAnalysis(),
    content: contentAnalysis(),
    technical: technicalAnalysis(),
    social: socialAnalysis(),
    images: imageAnalysis(),
    links: linkAnalysis(),
    error: null,
    ...patch
  }
}

/** A full crawl result, scored, ready for the generator and the UI layers. */
export function urlResult(patch: Partial<UrlResult> = {}): UrlResult {
  // Spreading an explicit `undefined` would clobber the default, so only carry
  // over the keys the caller actually set.
  const overrides: Partial<ScoreInput> = {}
  if (patch.url !== undefined) overrides.url = patch.url
  if (patch.http !== undefined) overrides.http = patch.http
  if (patch.seo !== undefined) overrides.seo = patch.seo
  if (patch.error !== undefined) overrides.error = patch.error
  const base = scoreInput(overrides)
  return { id: 0, ...base, ...evaluateResult(base), ...patch }
}
