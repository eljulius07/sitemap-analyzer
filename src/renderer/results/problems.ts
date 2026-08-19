import type { HreflangIssueCode, UrlResult } from '@shared/types'
import type { TabId } from '../stores/analysisStore'

export type ProblemSeverity = 'problem' | 'warning' | 'opportunity'
export type ProblemPriority = 'high' | 'medium' | 'low'

export interface ProblemDef {
  id: string
  name: string
  description: string
  howToFix: string
  severity: ProblemSeverity
  priority: ProblemPriority
  /** Tab whose table is most relevant when the user clicks "View URLs". */
  category: TabId
  check: (r: UrlResult) => boolean
}

export interface Problem extends Omit<ProblemDef, 'check'> {
  urlCount: number
  percentage: number
  affectedUrls: string[]
}

const hasIssue = (field: string) => (r: UrlResult): boolean => r.issues.some((i) => i.field === field)

/** Matches a finding from validating the source sitemap's hreflang clusters. */
const hasHreflangIssue =
  (code: HreflangIssueCode) =>
  (r: UrlResult): boolean =>
    !!r.sitemap && r.sitemap.hreflangIssues.some((i) => i.code === code)

export const PROBLEM_DEFS: ProblemDef[] = [
  // ----- SEO Problems (critical) -----
  { id: 'title-missing', severity: 'problem', priority: 'high', category: 'seo',
    name: 'Títulos de página: Falta',
    description: 'Páginas sin etiqueta <title>. El título es uno de los factores SEO on-page más importantes y es lo primero que los usuarios ven en los resultados de búsqueda.',
    howToFix: 'Agrega una etiqueta <title> única y descriptiva. Debe tener entre 30-60 caracteres e incluir la palabra clave principal.',
    check: (r) => !!r.seo && !r.seo.title.trim() },
  { id: 'meta-desc-missing', severity: 'problem', priority: 'high', category: 'seo',
    name: 'Meta description: Falta',
    description: 'Páginas sin meta description. Aunque no es un factor directo de ranking, influye en el CTR desde los resultados de búsqueda.',
    howToFix: 'Agrega una meta description única de 70-160 caracteres que resuma el contenido e incluya un call-to-action.',
    check: (r) => !!r.seo && !r.seo.metaDescription.trim() },
  { id: 'h1-missing', severity: 'problem', priority: 'high', category: 'seo',
    name: 'H1: Falta',
    description: 'Páginas sin encabezado H1. El H1 indica a buscadores y usuarios cuál es el tema principal de la página.',
    howToFix: 'Agrega exactamente un H1 por página que describa el contenido principal.',
    check: (r) => !!r.seo && r.seo.h1Count === 0 },
  { id: 'canonical-missing', severity: 'problem', priority: 'high', category: 'seo',
    name: 'Canonical: Falta',
    description: 'Páginas sin etiqueta canonical. Sin ella los buscadores podrían indexar versiones duplicadas.',
    howToFix: 'Agrega <link rel="canonical" href="URL"> apuntando a la versión preferida. Normalmente debe ser self-referencing.',
    check: (r) => !!r.seo && r.seo.canonicalStatus === 'missing' },
  { id: 'not-indexable', severity: 'problem', priority: 'high', category: 'seo',
    name: 'Indexabilidad: Página no indexable',
    description: 'Páginas marcadas como no indexables (noindex, sin canonical o con error).',
    howToFix: 'Verifica que el bloqueo sea intencional. Si la página debe indexarse, elimina noindex y/o agrega un canonical válido.',
    check: (r) => !!r.seo && !r.seo.isIndexable },
  { id: 'noindex', severity: 'problem', priority: 'high', category: 'seo',
    name: 'Indexabilidad: Página con noindex',
    description: 'Páginas con directiva noindex (meta robots o X-Robots-Tag) que no serán indexadas.',
    howToFix: 'Si el noindex no es intencional, elimínalo del meta robots o del header X-Robots-Tag.',
    check: (r) => !!r.seo && (/noindex/i.test(r.seo.metaRobots) || /noindex/i.test(r.seo.xRobotsTag)) },
  { id: 'http-url', severity: 'problem', priority: 'high', category: 'technical',
    name: 'Seguridad: URL HTTP',
    description: 'Páginas servidas por HTTP en lugar de HTTPS. Los navegadores las marcan como "No seguras" y Google penaliza sitios sin HTTPS.',
    howToFix: 'Migra todas las URLs a HTTPS con redirecciones 301 desde HTTP y actualiza los enlaces internos.',
    check: (r) => !!r.technical && !r.technical.https },
  { id: 'client-error-4xx', severity: 'problem', priority: 'high', category: 'overview',
    name: 'Códigos de respuesta: Error de cliente (4xx)',
    description: 'Páginas que devuelven 4xx (404, 403, etc.). Crean mala experiencia y desperdician crawl budget.',
    howToFix: 'Para 404 redirige con 301 a la página más relevante o restaura el contenido. Para 403 revisa permisos. Elimina los enlaces internos que apunten a ellas.',
    check: (r) => r.http.statusCode !== null && r.http.statusCode >= 400 && r.http.statusCode < 500 },
  { id: 'server-error-5xx', severity: 'problem', priority: 'high', category: 'overview',
    name: 'Códigos de respuesta: Error de servidor (5xx)',
    description: 'Páginas que devuelven 5xx (500, 502, 503). Indican problemas en el servidor.',
    howToFix: 'Revisa los logs del servidor para identificar la causa (base de datos, timeout, errores de código).',
    check: (r) => r.http.statusCode !== null && r.http.statusCode >= 500 },

  // ----- SEO Warnings -----
  { id: 'canonicalized', severity: 'warning', priority: 'high', category: 'seo',
    name: 'Canonicals: Apunta a otra URL',
    description: 'Páginas cuya canonical apunta a una URL distinta — indican contenido duplicado consolidado en otra URL.',
    howToFix: 'Verifica que la canonical apunte a la versión correcta. Si la página no debe existir, considera redirigirla con 301.',
    check: (r) => !!r.seo && r.seo.canonicalStatus === 'other' },
  { id: 'hreflang-missing-return', severity: 'warning', priority: 'high', category: 'seo',
    name: 'Hreflang: Falta enlace de vuelta',
    description: 'Páginas con hreflang donde la página referenciada no tiene hreflang de vuelta. Google requiere hreflang bidireccional.',
    howToFix: 'Asegúrate de que cada página referenciada también incluya un hreflang apuntando de vuelta a esta página.',
    check: (r) => !!r.seo && r.seo.hreflangCount > 0 && !r.seo.hreflangSelfReference },
  { id: 'redirect-chain', severity: 'warning', priority: 'high', category: 'performance',
    name: 'Redirecciones: Cadena',
    description: 'URLs que pasan por múltiples redirecciones antes del destino final. Cada salto pierde tiempo y posiblemente PageRank.',
    howToFix: 'Actualiza los enlaces para apuntar directamente a la URL final y elimina redirecciones intermedias.',
    check: (r) => !!r.performance && r.performance.numRedirects > 1 },

  // ----- SEO Opportunities -----
  { id: 'title-duplicate', severity: 'opportunity', priority: 'medium', category: 'seo',
    name: 'Títulos de página: Duplicado',
    description: 'Páginas que comparten el mismo <title> con otras páginas. Confunden a los buscadores sobre cuál mostrar.',
    howToFix: 'Reescribe los títulos duplicados para que cada página tenga uno único y descriptivo de su contenido específico.',
    check: hasIssue('duplicateTitle') },
  { id: 'meta-desc-duplicate', severity: 'opportunity', priority: 'medium', category: 'seo',
    name: 'Meta description: Duplicada',
    description: 'Páginas que comparten la misma meta description con otras páginas.',
    howToFix: 'Escribe meta descriptions únicas que describan específicamente el contenido de cada página.',
    check: hasIssue('duplicateDescription') },
  { id: 'title-too-short', severity: 'opportunity', priority: 'medium', category: 'seo',
    name: 'Títulos de página: Menos de 30 caracteres',
    description: 'Títulos demasiado cortos que no aprovechan el espacio disponible en los SERP.',
    howToFix: 'Expande el título incluyendo más contexto, la palabra clave principal y diferenciadores. Objetivo 30-60 caracteres.',
    check: (r) => !!r.seo && !!r.seo.title && r.seo.titleLength < 30 },
  { id: 'title-too-long', severity: 'opportunity', priority: 'medium', category: 'seo',
    name: 'Títulos de página: Más de 60 caracteres',
    description: 'Títulos que exceden 60 caracteres y serán truncados en los resultados de búsqueda.',
    howToFix: 'Acorta el título a máximo 60 caracteres con la información más importante al inicio.',
    check: (r) => !!r.seo && r.seo.titleLength > 60 },
  { id: 'title-pixel-long', severity: 'opportunity', priority: 'medium', category: 'seo',
    name: 'Títulos de página: Más de 580 píxeles',
    description: 'Títulos que exceden el ancho visible en Google y serán truncados visualmente.',
    howToFix: 'Acorta el título; ten en cuenta que los caracteres anchos (W, M) consumen más espacio.',
    check: (r) => !!r.seo && r.seo.titlePixelWidth > 580 },
  { id: 'meta-desc-too-short', severity: 'opportunity', priority: 'medium', category: 'seo',
    name: 'Meta description: Menos de 70 caracteres',
    description: 'Meta descriptions demasiado cortas que no aprovechan el espacio disponible.',
    howToFix: 'Expande a 70-160 caracteres con un resumen atractivo y un call-to-action.',
    check: (r) => !!r.seo && !!r.seo.metaDescription && r.seo.metaDescriptionLength < 70 },
  { id: 'meta-desc-too-long', severity: 'opportunity', priority: 'medium', category: 'seo',
    name: 'Meta description: Más de 160 caracteres',
    description: 'Meta descriptions que exceden 160 caracteres y serán truncadas en los resultados.',
    howToFix: 'Acorta a 160 caracteres; pon el mensaje principal y el call-to-action al inicio.',
    check: (r) => !!r.seo && r.seo.metaDescriptionLength > 160 },
  { id: 'h1-multiple', severity: 'opportunity', priority: 'medium', category: 'seo',
    name: 'H1: Múltiple',
    description: 'Páginas con más de un H1. La práctica recomendada es tener exactamente uno por página.',
    howToFix: 'Mantén un solo H1 por página y baja los demás a H2/H3 según la jerarquía del contenido.',
    check: (r) => !!r.seo && r.seo.h1Count > 1 },
  { id: 'heading-hierarchy-broken', severity: 'opportunity', priority: 'low', category: 'seo',
    name: 'Estructura: Jerarquía de encabezados rota',
    description: 'La página salta niveles de encabezados (ej. H1 → H3 sin H2). La jerarquía correcta favorece accesibilidad y comprensión.',
    howToFix: 'Asegúrate de que los encabezados sigan el orden H1 → H2 → H3 sin saltar niveles.',
    check: (r) => !!r.seo && !r.seo.headingHierarchyValid },
  { id: 'title-outdated-year', severity: 'warning', priority: 'medium', category: 'seo',
    name: 'Títulos de página: Año desactualizado',
    description: 'Páginas cuyo <title> incluye un año anterior al actual (por ejemplo "Mejores X 2025" cuando ya estamos en 2026). Suele ser contenido evergreen al que olvidaron actualizarle la fecha — pierde clicks y señales de frescura en los SERP.',
    howToFix: 'Actualiza el título reemplazando el año por el actual y refresca el contenido. Si la página es histórica (no evergreen), considera quitar el año del title o moverlo al subtítulo.',
    check: (r) => !!r.seo && r.seo.outdatedYearInTitle !== null },
  { id: 'meta-desc-outdated-year', severity: 'opportunity', priority: 'low', category: 'seo',
    name: 'Meta description: Año desactualizado',
    description: 'Meta descriptions con un año anterior al actual. Aunque tiene menos peso que el title, mantenerla actualizada mejora el CTR y la percepción de frescura.',
    howToFix: 'Actualiza la meta description con el año actual o quítale la referencia temporal si la página es atemporal.',
    check: (r) => !!r.seo && r.seo.outdatedYearInMetaDescription !== null },

  // ----- Hreflang declarado en el sitemap -----
  { id: 'sitemap-hreflang-no-self', severity: 'problem', priority: 'high', category: 'seo',
    name: 'Sitemap hreflang: Sin auto-referencia',
    description: 'Entradas del sitemap que declaran alternates pero ninguno apunta a su propia URL. Google exige que cada página de un clúster hreflang se incluya a sí misma; sin eso puede ignorar el clúster entero.',
    howToFix: 'Añade a la entrada un <xhtml:link rel="alternate"> con el idioma de la propia página y su <loc> como href.',
    check: hasHreflangIssue('missing-self-reference') },
  { id: 'sitemap-hreflang-no-return', severity: 'problem', priority: 'high', category: 'seo',
    name: 'Sitemap hreflang: Falta enlace de vuelta',
    description: 'La entrada declara un alternate hacia otra URL del sitemap, pero esa URL no declara un hreflang de vuelta. hreflang debe ser bidireccional: si A apunta a B, B tiene que apuntar a A o Google descarta la relación.',
    howToFix: 'Añade el hreflang recíproco en la entrada de destino. Lo habitual es que todas las URLs del clúster declaren exactamente el mismo bloque de alternates.',
    check: hasHreflangIssue('missing-return-link') },
  { id: 'sitemap-hreflang-orphan-target', severity: 'warning', priority: 'high', category: 'seo',
    name: 'Sitemap hreflang: Alternate fuera del sitemap',
    description: 'La entrada apunta a una URL alternativa que no aparece como <loc> en ningún sitemap. No se puede verificar el enlace de vuelta y probablemente la página no se rastree.',
    howToFix: 'Incluye la URL alternativa como entrada propia del sitemap, o corrige el href si está mal escrito.',
    check: hasHreflangIssue('alternate-not-in-sitemap') },
  { id: 'sitemap-hreflang-duplicate', severity: 'problem', priority: 'medium', category: 'seo',
    name: 'Sitemap hreflang: Idioma duplicado',
    description: 'La misma clave hreflang aparece dos veces en una entrada apuntando a URLs distintas. Google no puede decidir cuál es la versión de ese idioma y descarta el conflicto.',
    howToFix: 'Deja un único href por clave de idioma. Si necesitas variantes regionales usa códigos distintos (es, es-MX, es-419).',
    check: hasHreflangIssue('duplicate-hreflang') },
  { id: 'sitemap-hreflang-invalid-code', severity: 'warning', priority: 'medium', category: 'seo',
    name: 'Sitemap hreflang: Código de idioma inválido',
    description: 'El valor de hreflang no es un código válido. Debe ser ISO 639-1 de idioma, opcionalmente con script y región (es, en-GB, zh-Hant-TW, es-419) o el especial x-default.',
    howToFix: 'Corrige el código: idioma primero y región después, nunca al revés, y usa el nombre corto ("es", no "espanol"; "en-GB", no "GB-en").',
    check: hasHreflangIssue('invalid-hreflang-code') },

  // ----- Performance -----
  { id: 'slow-ttfb', severity: 'problem', priority: 'high', category: 'performance',
    name: 'Rendimiento: TTFB lento (> 2s)',
    description: 'Páginas con Time To First Byte superior a 2 segundos — indica problemas de servidor o backend.',
    howToFix: 'Optimiza queries de base de datos, añade caché de servidor, usa CDN, revisa la configuración del hosting.',
    check: (r) => !!r.performance && r.performance.ttfbMs > 2000 },
  { id: 'heavy-page', severity: 'warning', priority: 'high', category: 'performance',
    name: 'Rendimiento: Página pesada (> 3MB)',
    description: 'Páginas con peso superior a 3MB. Cargan lentamente, sobre todo en conexiones móviles.',
    howToFix: 'Optimiza imágenes (WebP/AVIF), minifica JS/CSS, implementa lazy loading.',
    check: (r) => !!r.performance && r.performance.totalPageWeightKb > 3000 },
  { id: 'not-compressed', severity: 'warning', priority: 'high', category: 'performance',
    name: 'Rendimiento: Sin compresión',
    description: 'Respuestas servidas sin gzip o brotli. La compresión puede reducir el peso 60-80%.',
    howToFix: 'Habilita compresión gzip o brotli en el servidor web (Nginx, Apache, CloudFront).',
    check: (r) => !!r.performance && !r.performance.htmlCompressed },
  { id: 'render-blocking', severity: 'opportunity', priority: 'medium', category: 'performance',
    name: 'Rendimiento: Recursos que bloquean renderizado',
    description: 'Páginas con muchos archivos JS/CSS que bloquean el primer renderizado.',
    howToFix: 'Agrega async/defer a scripts no críticos, usa media queries en stylesheets, inline el critical CSS.',
    check: (r) => !!r.performance && r.performance.renderBlockingCount > 5 },
  { id: 'too-many-js', severity: 'opportunity', priority: 'medium', category: 'performance',
    name: 'Rendimiento: Demasiados archivos JS (> 15)',
    description: 'Páginas con más de 15 JS externos — más solicitudes HTTP y tiempo de parsing.',
    howToFix: 'Combina y minifica los archivos, usa code splitting, carga módulos bajo demanda.',
    check: (r) => !!r.performance && r.performance.jsFilesCount > 15 },
  { id: 'no-lazy-loading', severity: 'opportunity', priority: 'medium', category: 'performance',
    name: 'Rendimiento: Sin lazy loading en imágenes',
    description: 'Páginas con imágenes sin lazy loading — se descargan todas al cargar la página.',
    howToFix: 'Agrega loading="lazy" a las imágenes que estén below the fold.',
    check: (r) => !!r.performance && r.performance.imageCount > 3 && !r.performance.hasLazyLoading },

  // ----- Content -----
  { id: 'thin-content', severity: 'opportunity', priority: 'medium', category: 'content',
    name: 'Contenido: Páginas con poco contenido (< 300 palabras)',
    description: 'Páginas con poco contenido visible — tienen dificultad para rankear.',
    howToFix: 'Expande el contenido con información útil y relevante (mínimo 300 palabras recomendadas para informativas).',
    check: (r) => !!r.content && r.content.wordCount < 300 },
  { id: 'low-text-ratio', severity: 'opportunity', priority: 'low', category: 'content',
    name: 'Contenido: Ratio texto/HTML bajo (< 10%)',
    description: 'Páginas donde el texto visible es menos del 10% del HTML — indica exceso de código o poco contenido.',
    howToFix: 'Reduce HTML innecesario (scripts inline, comentarios) y agrega más contenido de texto visible.',
    check: (r) => !!r.content && r.content.textHtmlRatio < 10 },

  // ----- Images -----
  { id: 'images-missing-alt', severity: 'problem', priority: 'high', category: 'images',
    name: 'Imágenes: Falta atributo alt',
    description: 'Imágenes sin alt — esencial para accesibilidad y para que los buscadores entiendan la imagen.',
    howToFix: 'Agrega un alt descriptivo y conciso a cada imagen relevante.',
    check: (r) => !!r.images && r.images.missingAlt > 0 },
  { id: 'images-missing-dimensions', severity: 'warning', priority: 'medium', category: 'images',
    name: 'Imágenes: Sin dimensiones (CLS)',
    description: 'Imágenes sin width/height — causan Cumulative Layout Shift al cargar la página.',
    howToFix: 'Agrega width y height a cada <img> para que el navegador reserve el espacio antes de cargar la imagen.',
    check: (r) => !!r.images && r.images.missingDimensions > 0 },
  { id: 'images-no-nextgen', severity: 'opportunity', priority: 'medium', category: 'images',
    name: 'Imágenes: Sin formatos modernos',
    description: 'Todas las imágenes usan formatos legacy (JPG/PNG/GIF) en lugar de WebP o AVIF.',
    howToFix: 'Convierte imágenes a WebP/AVIF y usa <picture> con fallback a JPG/PNG para navegadores antiguos.',
    check: (r) => !!r.images && r.images.totalImages > 0 && r.images.nextGenFormats === 0 },

  // ----- Social & Schema -----
  { id: 'og-incomplete', severity: 'warning', priority: 'medium', category: 'social',
    name: 'Open Graph: Etiquetas incompletas',
    description: 'Páginas sin todas las etiquetas Open Graph — al compartir en redes sociales no se mostrará una vista previa adecuada.',
    howToFix: 'Agrega og:title, og:description, og:image, og:type y og:url a cada página.',
    check: (r) => !!r.social && !r.social.ogComplete },
  { id: 'structured-data-missing', severity: 'opportunity', priority: 'medium', category: 'social',
    name: 'Schema: Sin datos estructurados',
    description: 'Páginas sin JSON-LD ni microdata. Los datos estructurados pueden generar rich snippets.',
    howToFix: 'Agrega JSON-LD relevante: Article para blog, Product para productos, FAQPage, BreadcrumbList, etc.',
    check: (r) => !!r.social && !r.social.hasStructuredData },
  { id: 'jsonld-invalid', severity: 'problem', priority: 'high', category: 'social',
    name: 'Schema: JSON-LD inválido',
    description: 'El JSON-LD de la página tiene errores de sintaxis y los buscadores no lo interpretarán.',
    howToFix: 'Valida con el Rich Results Test de Google y corrige los errores de sintaxis.',
    check: (r) => !!r.social && r.social.schemaCount > 0 && !r.social.jsonLdValid },

  // ----- Technical -----
  { id: 'no-viewport', severity: 'problem', priority: 'high', category: 'technical',
    name: 'Técnico: Sin meta viewport',
    description: 'Páginas sin meta viewport — no se renderizan correctamente en dispositivos móviles.',
    howToFix: 'Agrega <meta name="viewport" content="width=device-width, initial-scale=1"> al <head>.',
    check: (r) => !!r.technical && !r.technical.hasViewport },
  { id: 'no-hsts', severity: 'warning', priority: 'medium', category: 'technical',
    name: 'Seguridad: Sin HSTS',
    description: 'Páginas HTTPS sin header Strict-Transport-Security — vulnerables a downgrade attacks.',
    howToFix: 'Agrega Strict-Transport-Security: max-age=31536000; includeSubDomains en el servidor.',
    check: (r) => !!r.technical && r.technical.https && !r.technical.strictTransportSecurity },

  // ----- Links -----
  { id: 'js-links', severity: 'problem', priority: 'high', category: 'links',
    name: 'Enlaces: javascript: en href',
    description: 'Enlaces con href "javascript:..." — no son crawleables por buscadores.',
    howToFix: 'Reemplaza por URLs reales y maneja la lógica con event handlers separados.',
    check: (r) => !!r.links && r.links.javascriptLinks > 0 },
  { id: 'links-hash-only', severity: 'warning', priority: 'medium', category: 'links',
    name: 'Enlaces: href "#" sin destino',
    description: 'Enlaces con href "#" — no llevan a ninguna parte y crean mala UX.',
    howToFix: 'Asigna una URL real al href o usa un <button> si el elemento solo dispara JS.',
    check: (r) => !!r.links && r.links.hashOnly > 0 },
  { id: 'links-no-anchor', severity: 'warning', priority: 'medium', category: 'links',
    name: 'Enlaces: Sin anchor text',
    description: 'Enlaces sin texto visible y sin imagen — invisibles para usuarios y poco útiles para SEO.',
    howToFix: 'Añade texto descriptivo dentro del <a> o, si solo lleva una imagen, asegúrate de que tenga alt.',
    check: (r) => !!r.links && r.links.withoutAnchorText > 0 }
]

export function computeProblems(results: UrlResult[]): Problem[] {
  const total = results.length || 1
  const out: Problem[] = []
  for (const def of PROBLEM_DEFS) {
    const affected: string[] = []
    for (const r of results) {
      try {
        if (def.check(r)) affected.push(r.url)
      } catch {
        /* ignore checks that fail on partial data */
      }
    }
    if (affected.length === 0) continue
    const { check: _check, ...rest } = def
    out.push({
      ...rest,
      affectedUrls: affected,
      urlCount: affected.length,
      percentage: Math.round((affected.length / total) * 1000) / 10
    })
  }
  const sevRank: Record<ProblemSeverity, number> = { problem: 0, warning: 1, opportunity: 2 }
  out.sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || b.urlCount - a.urlCount)
  return out
}

export function countBySeverity(problems: Problem[]): { problem: number; warning: number; opportunity: number } {
  const c = { problem: 0, warning: 0, opportunity: 0 }
  for (const p of problems) c[p.severity]++
  return c
}
