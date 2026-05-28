import { countIssues } from '@shared/scoring'
import type { UrlResult } from '@shared/types'
import type { TabId } from '../stores/analysisStore'

export type CellValue = string | number | boolean | string[] | null
export type FlagLevel = 'critical' | 'warning' | null

export interface Column {
  id: string
  header: string
  size: number
  get: (r: UrlResult) => CellValue
  flag?: (r: UrlResult) => FlagLevel
  align?: 'left' | 'center' | 'right'
  /** Special renderers handled by the table. */
  kind?: 'url' | 'status' | 'health'
}

const hasIssueField =
  (field: string) =>
  (r: UrlResult): boolean =>
    r.issues.some((i) => i.field === field)

// ---- shared leading columns ----
export const urlColumn: Column = {
  id: 'url',
  header: 'URL',
  size: 300,
  get: (r) => r.url,
  kind: 'url'
}

export const statusColumn: Column = {
  id: 'status',
  header: 'Status',
  size: 80,
  get: (r) => r.http.statusCode,
  kind: 'status',
  align: 'center'
}

const healthColumn: Column = {
  id: 'health',
  header: 'Health',
  size: 80,
  get: (r) => r.healthScore,
  kind: 'health',
  align: 'center'
}

// ---- category column groups ----
export const SEO_COLUMNS: Column[] = [
  { id: 'title', header: 'Title', size: 240, get: (r) => r.seo?.title ?? null, flag: (r) => (r.seo && !r.seo.title ? 'warning' : null) },
  { id: 'titleLength', header: 'Title Len', size: 80, align: 'right', get: (r) => r.seo?.titleLength ?? null, flag: (r) => (r.seo && r.seo.title && (r.seo.titleLength < 30 || r.seo.titleLength > 60) ? 'warning' : null) },
  { id: 'titlePixelWidth', header: 'Px Width', size: 80, align: 'right', get: (r) => r.seo?.titlePixelWidth ?? null, flag: (r) => (r.seo && r.seo.titlePixelWidth > 580 ? 'warning' : null) },
  { id: 'titleHasBrand', header: 'Has Brand', size: 80, align: 'center', get: (r) => r.seo?.titleHasBrand ?? null },
  { id: 'duplicateTitle', header: 'Dup Title', size: 80, align: 'center', get: (r) => hasIssueField('duplicateTitle')(r), flag: (r) => (hasIssueField('duplicateTitle')(r) ? 'critical' : null) },
  { id: 'metaDescription', header: 'Meta Desc', size: 260, get: (r) => r.seo?.metaDescription ?? null, flag: (r) => (r.seo && !r.seo.metaDescription ? 'warning' : null) },
  { id: 'metaDescriptionLength', header: 'Desc Len', size: 80, align: 'right', get: (r) => r.seo?.metaDescriptionLength ?? null, flag: (r) => (r.seo && r.seo.metaDescription && (r.seo.metaDescriptionLength < 70 || r.seo.metaDescriptionLength > 160) ? 'warning' : null) },
  { id: 'duplicateDescription', header: 'Dup Desc', size: 80, align: 'center', get: (r) => hasIssueField('duplicateDescription')(r), flag: (r) => (hasIssueField('duplicateDescription')(r) ? 'critical' : null) },
  { id: 'h1', header: 'H1', size: 200, get: (r) => r.seo?.h1 ?? null, flag: (r) => (r.seo && !r.seo.h1 ? 'warning' : null) },
  { id: 'h1Count', header: 'H1#', size: 60, align: 'right', get: (r) => r.seo?.h1Count ?? null, flag: (r) => (r.seo && r.seo.h1Count !== 1 ? 'warning' : null) },
  { id: 'h2Count', header: 'H2#', size: 60, align: 'right', get: (r) => r.seo?.h2Count ?? null },
  { id: 'h3Count', header: 'H3#', size: 60, align: 'right', get: (r) => r.seo?.h3Count ?? null },
  { id: 'headingHierarchy', header: 'Hierarchy', size: 90, align: 'center', get: (r) => r.seo?.headingHierarchyValid ?? null, flag: (r) => (r.seo && !r.seo.headingHierarchyValid ? 'warning' : null) },
  { id: 'metaRobots', header: 'Meta Robots', size: 140, get: (r) => r.seo?.metaRobots ?? null, flag: (r) => (r.seo && /noindex/i.test(r.seo.metaRobots) ? 'critical' : null) },
  { id: 'xRobotsTag', header: 'X-Robots', size: 120, get: (r) => r.seo?.xRobotsTag ?? null, flag: (r) => (r.seo && /noindex/i.test(r.seo.xRobotsTag) ? 'critical' : null) },
  { id: 'canonicalUrl', header: 'Canonical', size: 240, get: (r) => r.seo?.canonicalUrl ?? null, flag: (r) => (r.seo && r.seo.canonicalStatus === 'missing' ? 'warning' : null) },
  { id: 'canonicalStatus', header: 'Canon Status', size: 110, get: (r) => r.seo?.canonicalStatus ?? null, flag: (r) => (r.seo && r.seo.canonicalStatus !== 'self' ? 'warning' : null) },
  { id: 'isIndexable', header: 'Indexable', size: 90, align: 'center', get: (r) => r.seo?.isIndexable ?? null, flag: (r) => (r.seo && !r.seo.isIndexable ? 'critical' : null) },
  { id: 'urlLength', header: 'URL Len', size: 80, align: 'right', get: (r) => r.seo?.urlLength ?? null, flag: (r) => (r.seo && r.seo.urlLength > 115 ? 'warning' : null) },
  { id: 'urlDepth', header: 'Depth', size: 70, align: 'right', get: (r) => r.seo?.urlDepth ?? null, flag: (r) => (r.seo && r.seo.urlDepth > 4 ? 'warning' : null) },
  { id: 'hasUppercase', header: 'Uppercase', size: 90, align: 'center', get: (r) => r.seo?.hasUppercase ?? null, flag: (r) => (r.seo && r.seo.hasUppercase ? 'warning' : null) },
  { id: 'hasUnderscores', header: 'Underscores', size: 100, align: 'center', get: (r) => r.seo?.hasUnderscores ?? null, flag: (r) => (r.seo && r.seo.hasUnderscores ? 'warning' : null) },
  { id: 'hasParameters', header: 'Params', size: 70, align: 'center', get: (r) => r.seo?.hasParameters ?? null },
  { id: 'htmlLang', header: 'Lang', size: 70, get: (r) => r.seo?.htmlLang ?? null, flag: (r) => (r.seo && !r.seo.htmlLang ? 'warning' : null) },
  { id: 'hreflang', header: 'Hreflang', size: 140, get: (r) => r.seo?.hreflang ?? null },
  { id: 'hreflangCount', header: 'Hreflang#', size: 90, align: 'right', get: (r) => r.seo?.hreflangCount ?? null },
  { id: 'hreflangSelf', header: 'Hreflang Self', size: 110, align: 'center', get: (r) => r.seo?.hreflangSelfReference ?? null, flag: (r) => (r.seo && r.seo.hreflangCount > 0 && !r.seo.hreflangSelfReference ? 'warning' : null) }
]

export const PERF_COLUMNS: Column[] = [
  { id: 'ttfb', header: 'TTFB (ms)', size: 90, align: 'right', get: (r) => r.performance?.ttfbMs ?? null, flag: (r) => (r.performance ? (r.performance.ttfbMs > 2000 ? 'critical' : r.performance.ttfbMs > 800 ? 'warning' : null) : null) },
  { id: 'totalDownload', header: 'Download (ms)', size: 110, align: 'right', get: (r) => r.performance?.totalDownloadMs ?? null, flag: (r) => (r.performance && r.performance.totalDownloadMs > 3000 ? 'warning' : null) },
  { id: 'redirectTime', header: 'Redirect (ms)', size: 110, align: 'right', get: (r) => r.performance?.redirectTimeMs ?? null, flag: (r) => (r.performance && r.performance.redirectTimeMs > 500 ? 'warning' : null) },
  { id: 'numRedirects', header: 'Redirects', size: 80, align: 'right', get: (r) => r.performance?.numRedirects ?? null, flag: (r) => (r.performance ? (r.performance.numRedirects > 3 ? 'critical' : r.performance.numRedirects > 1 ? 'warning' : null) : null) },
  { id: 'htmlSize', header: 'HTML KB', size: 90, align: 'right', get: (r) => r.performance?.htmlSizeKb ?? null, flag: (r) => (r.performance && r.performance.htmlSizeKb > 100 ? 'warning' : null) },
  { id: 'pageWeight', header: 'Weight KB', size: 90, align: 'right', get: (r) => r.performance?.totalPageWeightKb ?? null, flag: (r) => (r.performance && r.performance.totalPageWeightKb > 3000 ? 'warning' : null) },
  { id: 'compressed', header: 'Compressed', size: 100, align: 'center', get: (r) => r.performance?.htmlCompressed ?? null, flag: (r) => (r.performance && !r.performance.htmlCompressed ? 'warning' : null) },
  { id: 'jsFiles', header: 'JS Files', size: 80, align: 'right', get: (r) => r.performance?.jsFilesCount ?? null, flag: (r) => (r.performance && r.performance.jsFilesCount > 15 ? 'warning' : null) },
  { id: 'cssFiles', header: 'CSS Files', size: 80, align: 'right', get: (r) => r.performance?.cssFilesCount ?? null, flag: (r) => (r.performance && r.performance.cssFilesCount > 8 ? 'warning' : null) },
  { id: 'imageCountP', header: 'Images', size: 70, align: 'right', get: (r) => r.performance?.imageCount ?? null },
  { id: 'fontPreloads', header: 'Font Preloads', size: 110, align: 'right', get: (r) => r.performance?.fontPreloads ?? null },
  { id: 'inlineScripts', header: 'Inline JS', size: 80, align: 'right', get: (r) => r.performance?.inlineScriptCount ?? null, flag: (r) => (r.performance && r.performance.inlineScriptCount > 10 ? 'warning' : null) },
  { id: 'inlineStyles', header: 'Inline CSS', size: 80, align: 'right', get: (r) => r.performance?.inlineStyleCount ?? null, flag: (r) => (r.performance && r.performance.inlineStyleCount > 5 ? 'warning' : null) },
  { id: 'lazyLoading', header: 'Lazy Load', size: 90, align: 'center', get: (r) => r.performance?.hasLazyLoading ?? null, flag: (r) => (r.performance && r.performance.imageCount > 0 && !r.performance.hasLazyLoading ? 'warning' : null) },
  { id: 'preconnect', header: 'Preconnect', size: 90, align: 'center', get: (r) => r.performance?.hasPreconnect ?? null },
  { id: 'dnsPrefetch', header: 'DNS Prefetch', size: 100, align: 'center', get: (r) => r.performance?.hasDnsPrefetch ?? null },
  { id: 'resourceHints', header: 'Resource Hints', size: 110, align: 'center', get: (r) => r.performance?.hasResourceHints ?? null },
  { id: 'renderBlocking', header: 'Render-Block', size: 100, align: 'right', get: (r) => r.performance?.renderBlockingCount ?? null, flag: (r) => (r.performance ? (r.performance.renderBlockingCount > 10 ? 'critical' : r.performance.renderBlockingCount > 5 ? 'warning' : null) : null) }
]

const PERF_EXPORT_EXTRA: Column[] = [
  { id: 'jsFileUrls', header: 'JS File URLs', size: 200, get: (r) => r.performance?.jsFileUrls ?? null },
  { id: 'cssFileUrls', header: 'CSS File URLs', size: 200, get: (r) => r.performance?.cssFileUrls ?? null },
  { id: 'renderBlockingJs', header: 'Render-Blocking JS', size: 200, get: (r) => r.performance?.renderBlockingJs ?? null },
  { id: 'renderBlockingCss', header: 'Render-Blocking CSS', size: 200, get: (r) => r.performance?.renderBlockingCss ?? null }
]

export const CONTENT_COLUMNS: Column[] = [
  { id: 'wordCount', header: 'Words', size: 80, align: 'right', get: (r) => r.content?.wordCount ?? null, flag: (r) => (r.content && r.content.wordCount < 300 ? 'warning' : null) },
  { id: 'textRatio', header: 'Text/HTML %', size: 100, align: 'right', get: (r) => r.content?.textHtmlRatio ?? null, flag: (r) => (r.content && r.content.textHtmlRatio < 10 ? 'warning' : null) },
  { id: 'readingLevel', header: 'Reading Lvl', size: 100, align: 'right', get: (r) => r.content?.readingLevel ?? null },
  { id: 'paragraphs', header: 'Paragraphs', size: 90, align: 'right', get: (r) => r.content?.paragraphCount ?? null },
  { id: 'hasTable', header: 'Table', size: 70, align: 'center', get: (r) => r.content?.hasTable ?? null },
  { id: 'hasVideo', header: 'Video', size: 70, align: 'center', get: (r) => r.content?.hasVideo ?? null },
  { id: 'hasAudio', header: 'Audio', size: 70, align: 'center', get: (r) => r.content?.hasAudio ?? null },
  { id: 'hasIframe', header: 'iframe', size: 70, align: 'center', get: (r) => r.content?.hasIframe ?? null },
  { id: 'contentLanguage', header: 'Language', size: 100, get: (r) => r.content?.contentLanguage ?? null }
]

const CONTENT_EXPORT_EXTRA: Column[] = [
  { id: 'iframeDomains', header: 'iframe Domains', size: 200, get: (r) => r.content?.iframeDomains ?? null }
]

export const TECH_COLUMNS: Column[] = [
  { id: 'https', header: 'HTTPS', size: 70, align: 'center', get: (r) => r.technical?.https ?? null, flag: (r) => (r.technical && !r.technical.https ? 'critical' : null) },
  { id: 'http2', header: 'HTTP/2', size: 70, align: 'center', get: (r) => r.technical?.http2 ?? null },
  { id: 'doctype', header: 'Doctype', size: 80, align: 'center', get: (r) => r.technical?.hasDoctype ?? null, flag: (r) => (r.technical && !r.technical.hasDoctype ? 'warning' : null) },
  { id: 'charset', header: 'Charset', size: 80, align: 'center', get: (r) => r.technical?.hasCharset ?? null, flag: (r) => (r.technical && !r.technical.hasCharset ? 'warning' : null) },
  { id: 'viewport', header: 'Viewport', size: 80, align: 'center', get: (r) => r.technical?.hasViewport ?? null, flag: (r) => (r.technical && !r.technical.hasViewport ? 'warning' : null) },
  { id: 'favicon', header: 'Favicon', size: 80, align: 'center', get: (r) => r.technical?.hasFavicon ?? null, flag: (r) => (r.technical && !r.technical.hasFavicon ? 'warning' : null) },
  { id: 'sitemapRef', header: 'Sitemap Ref', size: 100, align: 'center', get: (r) => r.technical?.hasSitemapReference ?? null },
  { id: 'contentTypeHeader', header: 'Content-Type', size: 160, get: (r) => r.technical?.contentTypeHeader ?? null },
  { id: 'server', header: 'Server', size: 140, get: (r) => r.technical?.serverHeader ?? null },
  { id: 'xFrameOptions', header: 'X-Frame-Opts', size: 120, get: (r) => r.technical?.xFrameOptions ?? null },
  { id: 'csp', header: 'CSP', size: 70, align: 'center', get: (r) => (r.technical ? r.technical.contentSecurityPolicy !== '' : null) },
  { id: 'hsts', header: 'HSTS', size: 70, align: 'center', get: (r) => (r.technical ? r.technical.strictTransportSecurity !== '' : null), flag: (r) => (r.technical && r.technical.https && !r.technical.strictTransportSecurity ? 'warning' : null) },
  { id: 'cacheControl', header: 'Cache-Control', size: 150, get: (r) => r.technical?.cacheControl ?? null },
  { id: 'etag', header: 'ETag', size: 80, align: 'center', get: (r) => (r.technical ? r.technical.etag !== '' : null) }
]

export const SOCIAL_COLUMNS: Column[] = [
  { id: 'ogTitle', header: 'OG Title', size: 200, get: (r) => r.social?.ogTitle ?? null, flag: (r) => (r.social && !r.social.ogTitle ? 'warning' : null) },
  { id: 'ogDescription', header: 'OG Desc', size: 220, get: (r) => r.social?.ogDescription ?? null, flag: (r) => (r.social && !r.social.ogDescription ? 'warning' : null) },
  { id: 'ogImage', header: 'OG Image', size: 200, get: (r) => r.social?.ogImage ?? null, flag: (r) => (r.social && !r.social.ogImage ? 'warning' : null) },
  { id: 'ogImageDims', header: 'OG Img Dims', size: 110, get: (r) => (r.social ? (r.social.ogImageWidth || r.social.ogImageHeight ? `${r.social.ogImageWidth || '?'}×${r.social.ogImageHeight || '?'}` : '') : null), flag: (r) => (r.social && r.social.ogImage && !r.social.ogImageWidth && !r.social.ogImageHeight ? 'warning' : null) },
  { id: 'ogType', header: 'OG Type', size: 100, get: (r) => r.social?.ogType ?? null, flag: (r) => (r.social && !r.social.ogType ? 'warning' : null) },
  { id: 'ogUrl', header: 'OG URL', size: 200, get: (r) => r.social?.ogUrl ?? null, flag: (r) => (r.social && !r.social.ogUrl ? 'warning' : null) },
  { id: 'ogComplete', header: 'OG Complete', size: 100, align: 'center', get: (r) => r.social?.ogComplete ?? null, flag: (r) => (r.social && !r.social.ogComplete ? 'critical' : null) },
  { id: 'twitterCard', header: 'Twitter Card', size: 120, get: (r) => r.social?.twitterCard ?? null, flag: (r) => (r.social && !r.social.twitterCard ? 'warning' : null) },
  { id: 'twitterTitle', header: 'Twitter Title', size: 180, get: (r) => r.social?.twitterTitle ?? null },
  { id: 'twitterDescription', header: 'Twitter Desc', size: 200, get: (r) => r.social?.twitterDescription ?? null },
  { id: 'twitterImage', header: 'Twitter Image', size: 180, get: (r) => r.social?.twitterImage ?? null },
  { id: 'hasStructuredData', header: 'Structured', size: 90, align: 'center', get: (r) => r.social?.hasStructuredData ?? null, flag: (r) => (r.social && !r.social.hasStructuredData ? 'warning' : null) },
  { id: 'schemaTypes', header: 'Schema Types', size: 180, get: (r) => r.social?.schemaTypes ?? null },
  { id: 'schemaCount', header: 'Schema#', size: 80, align: 'right', get: (r) => r.social?.schemaCount ?? null },
  { id: 'hasBreadcrumb', header: 'Breadcrumb', size: 100, align: 'center', get: (r) => r.social?.hasBreadcrumb ?? null },
  { id: 'hasFaq', header: 'FAQ', size: 70, align: 'center', get: (r) => r.social?.hasFaq ?? null },
  { id: 'hasArticle', header: 'Article', size: 80, align: 'center', get: (r) => r.social?.hasArticle ?? null },
  { id: 'hasProduct', header: 'Product', size: 80, align: 'center', get: (r) => r.social?.hasProduct ?? null },
  { id: 'hasLocalBusiness', header: 'LocalBiz', size: 90, align: 'center', get: (r) => r.social?.hasLocalBusiness ?? null },
  { id: 'jsonLdValid', header: 'JSON-LD Valid', size: 110, align: 'center', get: (r) => r.social?.jsonLdValid ?? null, flag: (r) => (r.social && !r.social.jsonLdValid ? 'critical' : null) }
]

const SOCIAL_EXPORT_EXTRA: Column[] = [
  { id: 'rawJsonLd', header: 'Raw JSON-LD', size: 200, get: (r) => r.social?.rawJsonLd ?? null }
]

export const IMAGES_COLUMNS: Column[] = [
  { id: 'totalImages', header: 'Total', size: 70, align: 'right', get: (r) => r.images?.totalImages ?? null },
  { id: 'missingAlt', header: 'Missing Alt', size: 90, align: 'right', get: (r) => r.images?.missingAlt ?? null, flag: (r) => (r.images && r.images.missingAlt > 0 ? 'critical' : null) },
  { id: 'emptyAlt', header: 'Empty Alt', size: 90, align: 'right', get: (r) => r.images?.emptyAlt ?? null },
  { id: 'missingDims', header: 'Missing Dims', size: 100, align: 'right', get: (r) => r.images?.missingDimensions ?? null, flag: (r) => (r.images && r.images.missingDimensions > 0 ? 'warning' : null) },
  { id: 'nextGen', header: 'Next-Gen', size: 90, align: 'right', get: (r) => r.images?.nextGenFormats ?? null },
  { id: 'legacy', header: 'Legacy', size: 80, align: 'right', get: (r) => r.images?.legacyFormats ?? null, flag: (r) => (r.images && r.images.totalImages > 0 && r.images.legacyFormats > 0 && r.images.nextGenFormats === 0 ? 'warning' : null) },
  { id: 'lazyLoaded', header: 'Lazy', size: 70, align: 'right', get: (r) => r.images?.lazyLoaded ?? null },
  { id: 'withSrcset', header: 'srcset', size: 80, align: 'right', get: (r) => r.images?.withSrcset ?? null }
]

const IMAGES_EXPORT_EXTRA: Column[] = [
  { id: 'imageUrls', header: 'Image URLs', size: 200, get: (r) => r.images?.imageUrls ?? null }
]

export const LINKS_COLUMNS: Column[] = [
  { id: 'totalLinks', header: 'Total', size: 70, align: 'right', get: (r) => r.links?.totalLinks ?? null },
  { id: 'internalLinks', header: 'Internal', size: 80, align: 'right', get: (r) => r.links?.internalLinks ?? null },
  { id: 'externalLinks', header: 'External', size: 80, align: 'right', get: (r) => r.links?.externalLinks ?? null },
  { id: 'nofollow', header: 'Nofollow', size: 80, align: 'right', get: (r) => r.links?.nofollow ?? null },
  { id: 'sponsored', header: 'Sponsored', size: 90, align: 'right', get: (r) => r.links?.sponsored ?? null },
  { id: 'ugc', header: 'UGC', size: 60, align: 'right', get: (r) => r.links?.ugc ?? null },
  { id: 'withoutAnchorText', header: 'No Anchor Text', size: 110, align: 'right', get: (r) => r.links?.withoutAnchorText ?? null, flag: (r) => (r.links && r.links.withoutAnchorText > 0 ? 'warning' : null) },
  { id: 'hashOnly', header: '# Only', size: 70, align: 'right', get: (r) => r.links?.hashOnly ?? null, flag: (r) => (r.links && r.links.hashOnly > 0 ? 'warning' : null) },
  { id: 'javascriptLinks', header: 'javascript:', size: 90, align: 'right', get: (r) => r.links?.javascriptLinks ?? null, flag: (r) => (r.links && r.links.javascriptLinks > 0 ? 'critical' : null) }
]

const LINKS_EXPORT_EXTRA: Column[] = [
  { id: 'externalDomains', header: 'External Domains', size: 200, get: (r) => r.links?.externalDomains ?? null }
]

export const SPIDER_COLUMNS: Column[] = [
  { id: 'depth', header: 'Depth', size: 70, align: 'right', get: (r) => r.spider?.depth ?? null },
  { id: 'discoveredFrom', header: 'Discovered From', size: 240, get: (r) => r.spider?.discoveredFrom ?? null },
  { id: 'parents', header: 'All Parents', size: 200, get: (r) => r.spider?.parents ?? null },
  { id: 'inboundInternal', header: 'Inbound', size: 80, align: 'right', get: (r) => r.spider?.inboundInternal ?? null },
  { id: 'outboundInternal', header: 'Out (int)', size: 80, align: 'right', get: (r) => r.spider?.outboundInternal ?? null },
  { id: 'outboundExternal', header: 'Out (ext)', size: 80, align: 'right', get: (r) => r.spider?.outboundExternal ?? null },
  { id: 'isOrphan', header: 'Orphan', size: 70, align: 'center', get: (r) => r.spider?.isOrphan ?? null, flag: (r) => (r.spider?.isOrphan ? 'warning' : null) },
  { id: 'isDeadEnd', header: 'Dead End', size: 80, align: 'center', get: (r) => r.spider?.isDeadEnd ?? null, flag: (r) => (r.spider?.isDeadEnd ? 'warning' : null) },
  { id: 'pathGroup', header: 'Path Group', size: 110, get: (r) => r.spider?.pathGroup ?? null }
]

export const OVERVIEW_COLUMNS: Column[] = [
  statusColumn,
  healthColumn,
  { id: 'seoScore', header: 'SEO', size: 70, align: 'center', get: (r) => r.scores.seo },
  { id: 'perfScore', header: 'Perf', size: 70, align: 'center', get: (r) => r.scores.performance },
  { id: 'issues', header: 'Issues', size: 70, align: 'right', get: (r) => countIssues(r.issues).total, flag: (r) => (countIssues(r.issues).total > 0 ? 'warning' : null) },
  { id: 'criticalIssues', header: 'Critical', size: 70, align: 'right', get: (r) => countIssues(r.issues).critical, flag: (r) => (countIssues(r.issues).critical > 0 ? 'critical' : null) },
  { id: 'responseTime', header: 'TTFB (ms)', size: 90, align: 'right', get: (r) => r.http.ttfbMs }
]

export const TAB_COLUMNS: Record<TabId, Column[]> = {
  overview: [urlColumn, ...OVERVIEW_COLUMNS],
  seo: [urlColumn, statusColumn, ...SEO_COLUMNS],
  performance: [urlColumn, statusColumn, ...PERF_COLUMNS],
  content: [urlColumn, statusColumn, ...CONTENT_COLUMNS],
  technical: [urlColumn, statusColumn, ...TECH_COLUMNS],
  social: [urlColumn, statusColumn, ...SOCIAL_COLUMNS],
  images: [urlColumn, statusColumn, ...IMAGES_COLUMNS],
  links: [urlColumn, statusColumn, ...LINKS_COLUMNS],
  graph: [],
  sitemap: []
}

export const TAB_LABELS: Record<TabId, string> = {
  overview: 'Overview',
  seo: 'SEO',
  performance: 'Performance',
  content: 'Content',
  technical: 'Technical',
  social: 'Social & Schema',
  images: 'Images',
  links: 'Links',
  graph: '🗺️ Site Graph',
  sitemap: '📝 Generate Sitemap'
}

/** Full flat column list for "export all" (URL, Status, Health, then by category). */
export const ALL_COLUMNS: Column[] = [
  urlColumn,
  statusColumn,
  healthColumn,
  ...SEO_COLUMNS,
  ...PERF_COLUMNS,
  ...PERF_EXPORT_EXTRA,
  ...CONTENT_COLUMNS,
  ...CONTENT_EXPORT_EXTRA,
  ...TECH_COLUMNS,
  ...SOCIAL_COLUMNS,
  ...SOCIAL_EXPORT_EXTRA,
  ...IMAGES_COLUMNS,
  ...IMAGES_EXPORT_EXTRA,
  ...LINKS_COLUMNS,
  ...LINKS_EXPORT_EXTRA,
  ...SPIDER_COLUMNS
]

/** Columns for the spider "Site Structure" XLSX sheet (depth-sorted). */
export const SITE_STRUCTURE_COLUMNS: Column[] = [
  urlColumn,
  { id: 'ss-depth', header: 'Depth', size: 70, align: 'right', get: (r) => r.spider?.depth ?? null },
  { id: 'ss-parent', header: 'Parent URL', size: 240, get: (r) => r.spider?.discoveredFrom ?? null },
  { id: 'ss-inbound', header: 'Inbound Links', size: 90, align: 'right', get: (r) => r.spider?.inboundInternal ?? null },
  { id: 'ss-outbound', header: 'Outbound Links', size: 90, align: 'right', get: (r) => r.spider?.outboundInternal ?? null },
  healthColumn,
  statusColumn
]

/** Columns grouped per sheet for XLSX export. */
export const SHEET_COLUMNS: { name: string; columns: Column[] }[] = [
  { name: 'Overview', columns: [urlColumn, ...OVERVIEW_COLUMNS] },
  { name: 'SEO', columns: [urlColumn, statusColumn, ...SEO_COLUMNS] },
  { name: 'Performance', columns: [urlColumn, statusColumn, ...PERF_COLUMNS, ...PERF_EXPORT_EXTRA] },
  { name: 'Content', columns: [urlColumn, statusColumn, ...CONTENT_COLUMNS, ...CONTENT_EXPORT_EXTRA] },
  { name: 'Technical', columns: [urlColumn, statusColumn, ...TECH_COLUMNS] },
  { name: 'Social & Schema', columns: [urlColumn, statusColumn, ...SOCIAL_COLUMNS, ...SOCIAL_EXPORT_EXTRA] },
  { name: 'Images', columns: [urlColumn, statusColumn, ...IMAGES_COLUMNS, ...IMAGES_EXPORT_EXTRA] },
  { name: 'Links', columns: [urlColumn, statusColumn, ...LINKS_COLUMNS, ...LINKS_EXPORT_EXTRA] }
]

// ---- value helpers shared by table + exports ----
export function sortValue(v: CellValue): string | number {
  if (v === null) return -Infinity
  if (typeof v === 'boolean') return v ? 1 : 0
  if (Array.isArray(v)) return v.length
  if (typeof v === 'number') return v
  return v.toLowerCase()
}

export function csvValue(v: CellValue): string {
  if (v === null) return ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return v.join(' | ')
  return String(v)
}

export function displayValue(v: CellValue): string {
  if (v === null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
  return String(v)
}
