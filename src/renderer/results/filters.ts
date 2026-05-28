import type { UrlResult } from '@shared/types'
import type { TabId } from '../stores/analysisStore'

export interface TabFilter {
  id: string
  label: string
  test: (r: UrlResult) => boolean
}

const hasIssue =
  (field: string) =>
  (r: UrlResult): boolean =>
    r.issues.some((i) => i.field === field)

export const TAB_FILTERS: Record<TabId, TabFilter[]> = {
  overview: [],
  seo: [
    { id: 'seo-missing-title', label: 'Missing Title', test: (r) => !!r.seo && !r.seo.title },
    { id: 'seo-missing-desc', label: 'Missing Description', test: (r) => !!r.seo && !r.seo.metaDescription },
    { id: 'seo-missing-h1', label: 'Missing H1', test: (r) => !!r.seo && r.seo.h1Count === 0 },
    { id: 'seo-missing-canonical', label: 'Missing Canonical', test: (r) => !!r.seo && r.seo.canonicalStatus === 'missing' },
    { id: 'seo-dup-title', label: 'Duplicate Titles', test: hasIssue('duplicateTitle') },
    { id: 'seo-dup-desc', label: 'Duplicate Descriptions', test: hasIssue('duplicateDescription') },
    { id: 'seo-not-indexable', label: 'Not Indexable', test: (r) => !!r.seo && !r.seo.isIndexable }
  ],
  performance: [
    { id: 'perf-slow-ttfb', label: 'Slow TTFB (>800ms)', test: (r) => !!r.performance && r.performance.ttfbMs > 800 },
    { id: 'perf-heavy', label: 'Heavy Page (>3MB)', test: (r) => !!r.performance && r.performance.totalPageWeightKb > 3000 },
    { id: 'perf-many-js', label: 'Too Many JS Files', test: (r) => !!r.performance && r.performance.jsFilesCount > 15 },
    { id: 'perf-render-blocking', label: 'Render-Blocking', test: (r) => !!r.performance && r.performance.renderBlockingCount > 0 },
    { id: 'perf-not-compressed', label: 'Not Compressed', test: (r) => !!r.performance && !r.performance.htmlCompressed }
  ],
  content: [
    { id: 'content-thin', label: 'Thin Content (<300)', test: (r) => !!r.content && r.content.wordCount < 300 },
    { id: 'content-low-ratio', label: 'Low Text Ratio (<10%)', test: (r) => !!r.content && r.content.textHtmlRatio < 10 }
  ],
  technical: [
    { id: 'tech-no-https', label: 'Not HTTPS', test: (r) => !!r.technical && !r.technical.https },
    { id: 'tech-no-hsts', label: 'Missing HSTS', test: (r) => !!r.technical && r.technical.https && !r.technical.strictTransportSecurity },
    { id: 'tech-no-viewport', label: 'No Viewport', test: (r) => !!r.technical && !r.technical.hasViewport },
    { id: 'tech-no-doctype', label: 'No Doctype', test: (r) => !!r.technical && !r.technical.hasDoctype }
  ],
  social: [
    { id: 'social-missing-og', label: 'Missing OG Tags', test: (r) => !!r.social && !r.social.ogComplete },
    { id: 'social-missing-twitter', label: 'Missing Twitter Card', test: (r) => !!r.social && !r.social.twitterCard },
    { id: 'social-no-schema', label: 'No Structured Data', test: (r) => !!r.social && !r.social.hasStructuredData },
    { id: 'social-invalid-jsonld', label: 'Invalid JSON-LD', test: (r) => !!r.social && !r.social.jsonLdValid }
  ],
  images: [
    { id: 'img-missing-alt', label: 'Missing Alt Text', test: (r) => !!r.images && r.images.missingAlt > 0 },
    { id: 'img-no-lazy', label: 'No Lazy Loading', test: (r) => !!r.images && r.images.totalImages > 0 && r.images.lazyLoaded === 0 },
    { id: 'img-no-nextgen', label: 'No Next-Gen Formats', test: (r) => !!r.images && r.images.totalImages > 0 && r.images.nextGenFormats === 0 },
    { id: 'img-missing-dims', label: 'Missing Dimensions', test: (r) => !!r.images && r.images.missingDimensions > 0 }
  ],
  links: [
    { id: 'links-broken', label: 'Broken Anchors', test: (r) => !!r.links && r.links.hashOnly > 0 },
    { id: 'links-js', label: 'javascript: Links', test: (r) => !!r.links && r.links.javascriptLinks > 0 },
    { id: 'links-no-text', label: 'No Anchor Text', test: (r) => !!r.links && r.links.withoutAnchorText > 0 }
  ],
  graph: [],
  sitemap: []
}
