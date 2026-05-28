import {
  HEALTH_WEIGHTS,
  type Category,
  type CategoryScores,
  type Issue,
  type RowStatus,
  type Severity,
  type UrlResult
} from './types'

/** Point deduction applied to a category sub-score per issue severity. */
const DEDUCTION: Record<Severity, number> = {
  critical: 10,
  warning: 5,
  info: 2
}

export interface EvalContext {
  /** This URL's title is shared by another crawled URL. */
  duplicateTitle: boolean
  /** This URL's meta description is shared by another crawled URL. */
  duplicateDescription: boolean
}

export const EMPTY_CONTEXT: EvalContext = {
  duplicateTitle: false,
  duplicateDescription: false
}

export type ScoreInput = Pick<
  UrlResult,
  | 'url'
  | 'http'
  | 'seo'
  | 'performance'
  | 'content'
  | 'technical'
  | 'social'
  | 'images'
  | 'links'
  | 'error'
>

export interface Evaluation {
  issues: Issue[]
  scores: CategoryScores
  healthScore: number
  rowStatus: RowStatus
}

function issue(
  category: Category,
  severity: Severity,
  field: string,
  message: string,
  value: string | number | null = null
): Issue {
  return { category, severity, field, message, value }
}

function seoIssues(r: ScoreInput, ctx: EvalContext): Issue[] {
  const out: Issue[] = []
  const s = r.seo
  if (!s) return out

  if (!s.title) out.push(issue('seo', 'warning', 'title', 'Missing title tag'))
  else {
    if (s.titleLength < 30) out.push(issue('seo', 'warning', 'titleLength', `Title too short (${s.titleLength} chars, <30)`, s.titleLength))
    else if (s.titleLength > 60) out.push(issue('seo', 'warning', 'titleLength', `Title too long (${s.titleLength} chars, >60)`, s.titleLength))
    if (s.titlePixelWidth > 580) out.push(issue('seo', 'warning', 'titlePixelWidth', `Title may truncate in SERP (~${s.titlePixelWidth}px)`, s.titlePixelWidth))
  }
  if (ctx.duplicateTitle) out.push(issue('seo', 'critical', 'duplicateTitle', 'Title duplicated on another page', s.title))

  if (!s.metaDescription) out.push(issue('seo', 'warning', 'metaDescription', 'Missing meta description'))
  else {
    if (s.metaDescriptionLength < 70) out.push(issue('seo', 'warning', 'metaDescriptionLength', `Meta description short (${s.metaDescriptionLength}, <70)`, s.metaDescriptionLength))
    else if (s.metaDescriptionLength > 160) out.push(issue('seo', 'warning', 'metaDescriptionLength', `Meta description long (${s.metaDescriptionLength}, >160)`, s.metaDescriptionLength))
  }
  if (ctx.duplicateDescription) out.push(issue('seo', 'critical', 'duplicateDescription', 'Meta description duplicated on another page'))

  if (!s.h1) out.push(issue('seo', 'warning', 'h1', 'Missing H1'))
  if (s.h1Count === 0) out.push(issue('seo', 'warning', 'h1Count', 'No H1 tag', 0))
  else if (s.h1Count > 1) out.push(issue('seo', 'warning', 'h1Count', `Multiple H1 tags (${s.h1Count})`, s.h1Count))
  if (!s.headingHierarchyValid) out.push(issue('seo', 'warning', 'headingHierarchy', 'Heading levels skip (broken hierarchy)'))

  if (/noindex/i.test(s.metaRobots)) out.push(issue('seo', 'critical', 'metaRobots', 'meta robots is noindex', s.metaRobots))
  if (/noindex/i.test(s.xRobotsTag)) out.push(issue('seo', 'critical', 'xRobotsTag', 'X-Robots-Tag is noindex', s.xRobotsTag))

  if (s.canonicalStatus === 'missing') out.push(issue('seo', 'warning', 'canonical', 'Missing canonical tag'))
  else if (s.canonicalStatus === 'other') out.push(issue('seo', 'warning', 'canonical', 'Canonical points to another URL', s.canonicalUrl))

  if (!s.isIndexable) out.push(issue('seo', 'critical', 'isIndexable', 'Page is not indexable'))

  if (s.urlLength > 115) out.push(issue('seo', 'warning', 'urlLength', `URL very long (${s.urlLength} chars)`, s.urlLength))
  if (s.urlDepth > 4) out.push(issue('seo', 'warning', 'urlDepth', `Deep URL (${s.urlDepth} levels)`, s.urlDepth))
  if (s.hasUppercase) out.push(issue('seo', 'warning', 'urlCase', 'URL contains uppercase letters'))
  if (s.hasUnderscores) out.push(issue('seo', 'warning', 'urlUnderscores', 'URL uses underscores instead of hyphens'))

  if (!s.htmlLang) out.push(issue('seo', 'warning', 'htmlLang', 'Missing html lang attribute'))
  if (s.hreflangCount > 0 && !s.hreflangSelfReference) out.push(issue('seo', 'warning', 'hreflang', 'hreflang set missing self-reference'))

  return out
}

function performanceIssues(r: ScoreInput): Issue[] {
  const out: Issue[] = []
  const p = r.performance
  if (!p) return out

  if (p.ttfbMs > 2000) out.push(issue('performance', 'critical', 'ttfb', `Very slow TTFB (${p.ttfbMs}ms)`, p.ttfbMs))
  else if (p.ttfbMs > 800) out.push(issue('performance', 'warning', 'ttfb', `Slow TTFB (${p.ttfbMs}ms)`, p.ttfbMs))

  if (p.totalDownloadMs > 3000) out.push(issue('performance', 'warning', 'download', `Slow download (${p.totalDownloadMs}ms)`, p.totalDownloadMs))
  if (p.redirectTimeMs > 500) out.push(issue('performance', 'warning', 'redirectTime', `Slow redirects (${p.redirectTimeMs}ms)`, p.redirectTimeMs))

  if (p.numRedirects > 3) out.push(issue('performance', 'critical', 'redirects', `Redirect chain too long (${p.numRedirects})`, p.numRedirects))
  else if (p.numRedirects > 1) out.push(issue('performance', 'warning', 'redirects', `Multiple redirects (${p.numRedirects})`, p.numRedirects))

  if (p.htmlSizeKb > 100) out.push(issue('performance', 'warning', 'htmlSize', `Large HTML (${p.htmlSizeKb}KB)`, p.htmlSizeKb))
  if (p.totalPageWeightKb > 3000) out.push(issue('performance', 'warning', 'pageWeight', `Heavy page (${p.totalPageWeightKb}KB)`, p.totalPageWeightKb))
  if (!p.htmlCompressed) out.push(issue('performance', 'warning', 'compression', 'Response not compressed'))

  if (p.jsFilesCount > 15) out.push(issue('performance', 'warning', 'jsFiles', `Many JS files (${p.jsFilesCount})`, p.jsFilesCount))
  if (p.cssFilesCount > 8) out.push(issue('performance', 'warning', 'cssFiles', `Many CSS files (${p.cssFilesCount})`, p.cssFilesCount))
  if (p.inlineScriptCount > 10) out.push(issue('performance', 'warning', 'inlineScripts', `Many inline scripts (${p.inlineScriptCount})`, p.inlineScriptCount))
  if (p.inlineStyleCount > 5) out.push(issue('performance', 'warning', 'inlineStyles', `Many inline style blocks (${p.inlineStyleCount})`, p.inlineStyleCount))

  if (p.imageCount > 0 && !p.hasLazyLoading) out.push(issue('performance', 'warning', 'lazyLoading', 'No images use lazy loading'))

  if (p.renderBlockingCount > 10) out.push(issue('performance', 'critical', 'renderBlocking', `Many render-blocking resources (${p.renderBlockingCount})`, p.renderBlockingCount))
  else if (p.renderBlockingCount > 5) out.push(issue('performance', 'warning', 'renderBlocking', `Render-blocking resources (${p.renderBlockingCount})`, p.renderBlockingCount))

  return out
}

function contentIssues(r: ScoreInput): Issue[] {
  const out: Issue[] = []
  const c = r.content
  if (!c) return out
  if (c.wordCount < 300) out.push(issue('content', 'warning', 'wordCount', `Thin content (${c.wordCount} words, <300)`, c.wordCount))
  if (c.textHtmlRatio < 10) out.push(issue('content', 'warning', 'textRatio', `Low text/HTML ratio (${c.textHtmlRatio}%)`, c.textHtmlRatio))
  return out
}

function technicalIssues(r: ScoreInput): Issue[] {
  const out: Issue[] = []
  const t = r.technical
  if (!t) return out
  if (!t.https) out.push(issue('technical', 'critical', 'https', 'Not served over HTTPS'))
  if (!t.hasDoctype) out.push(issue('technical', 'warning', 'doctype', 'Missing doctype'))
  if (!t.hasCharset) out.push(issue('technical', 'warning', 'charset', 'Missing charset declaration'))
  if (!t.hasViewport) out.push(issue('technical', 'warning', 'viewport', 'Missing viewport meta'))
  if (!t.hasFavicon) out.push(issue('technical', 'warning', 'favicon', 'No favicon found'))
  if (t.https && !t.strictTransportSecurity) out.push(issue('technical', 'warning', 'hsts', 'Missing HSTS header on HTTPS'))
  return out
}

function socialIssues(r: ScoreInput): Issue[] {
  const out: Issue[] = []
  const s = r.social
  if (!s) return out
  if (!s.ogTitle) out.push(issue('social', 'warning', 'ogTitle', 'Missing og:title'))
  if (!s.ogDescription) out.push(issue('social', 'warning', 'ogDescription', 'Missing og:description'))
  if (!s.ogImage) out.push(issue('social', 'warning', 'ogImage', 'Missing og:image'))
  else if (!s.ogImageWidth && !s.ogImageHeight) out.push(issue('social', 'warning', 'ogImageDimensions', 'Missing og:image dimensions'))
  if (!s.ogType) out.push(issue('social', 'warning', 'ogType', 'Missing og:type'))
  if (!s.ogUrl) out.push(issue('social', 'warning', 'ogUrl', 'Missing og:url'))
  if (!s.ogComplete) out.push(issue('social', 'critical', 'ogComplete', 'Open Graph tags incomplete'))
  if (!s.twitterCard) out.push(issue('social', 'warning', 'twitterCard', 'Missing twitter:card'))
  if (!s.hasStructuredData) out.push(issue('social', 'warning', 'structuredData', 'No structured data found'))
  if (!s.jsonLdValid) out.push(issue('social', 'critical', 'jsonLd', 'Invalid JSON-LD'))
  return out
}

function imageIssues(r: ScoreInput): Issue[] {
  const out: Issue[] = []
  const i = r.images
  if (!i) return out
  if (i.missingAlt > 0) out.push(issue('images', 'critical', 'missingAlt', `${i.missingAlt} image(s) missing alt`, i.missingAlt))
  if (i.missingDimensions > 0) out.push(issue('images', 'warning', 'missingDimensions', `${i.missingDimensions} image(s) missing dimensions (CLS risk)`, i.missingDimensions))
  if (i.totalImages > 0 && i.legacyFormats > 0 && i.nextGenFormats === 0)
    out.push(issue('images', 'warning', 'legacyFormats', 'No next-gen image formats used'))
  return out
}

function linkIssues(r: ScoreInput): Issue[] {
  const out: Issue[] = []
  const l = r.links
  if (!l) return out
  if (l.withoutAnchorText > 0) out.push(issue('links', 'warning', 'anchorText', `${l.withoutAnchorText} link(s) without anchor text`, l.withoutAnchorText))
  if (l.hashOnly > 0) out.push(issue('links', 'warning', 'hashLinks', `${l.hashOnly} empty (#) link(s)`, l.hashOnly))
  if (l.javascriptLinks > 0) out.push(issue('links', 'critical', 'jsLinks', `${l.javascriptLinks} javascript: link(s)`, l.javascriptLinks))
  return out
}

const CATEGORIES: (keyof CategoryScores)[] = [
  'seo',
  'performance',
  'content',
  'technical',
  'social',
  'images'
]

export function evaluateResult(r: ScoreInput, ctx: EvalContext = EMPTY_CONTEXT): Evaluation {
  const code = r.http.statusCode

  // Hard failure: request error or 4xx/5xx — page is effectively broken.
  if (r.error || code === null || code >= 400) {
    const msg = r.error ?? `HTTP ${code} ${r.http.statusText}`
    const issues: Issue[] = [issue('technical', 'critical', 'request', msg, code)]
    const scores: CategoryScores = {
      seo: 0,
      performance: 0,
      content: 0,
      technical: 0,
      social: 0,
      images: 0
    }
    return { issues, scores, healthScore: 0, rowStatus: 'error' }
  }

  const issues: Issue[] = [
    ...seoIssues(r, ctx),
    ...performanceIssues(r),
    ...contentIssues(r),
    ...technicalIssues(r),
    ...socialIssues(r),
    ...imageIssues(r),
    ...linkIssues(r)
  ]

  // Per-category score: start at 100, deduct per issue, floor at 0.
  const scores: CategoryScores = {
    seo: 100,
    performance: 100,
    content: 100,
    technical: 100,
    social: 100,
    images: 100
  }
  for (const cat of CATEGORIES) {
    const deductions = issues
      .filter((i) => i.category === cat)
      .reduce((sum, i) => sum + DEDUCTION[i.severity], 0)
    scores[cat] = Math.max(0, 100 - deductions)
  }

  const healthScore = Math.round(
    CATEGORIES.reduce((sum, cat) => sum + scores[cat] * HEALTH_WEIGHTS[cat], 0)
  )

  const hasWarningOrWorse = issues.some(
    (i) => i.severity === 'warning' || i.severity === 'critical'
  )
  const rowStatus: RowStatus = hasWarningOrWorse ? 'warning' : 'ok'

  return { issues, scores, healthScore, rowStatus }
}

export function countIssues(issues: Issue[]): { total: number; critical: number } {
  let total = 0
  let critical = 0
  for (const i of issues) {
    if (i.severity === 'critical') {
      critical++
      total++
    } else if (i.severity === 'warning') {
      total++
    }
  }
  return { total, critical }
}
