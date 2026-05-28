/**
 * Normalize a URL for crawl de-duplication. Returns null for non-HTTP(S) or
 * unparseable URLs (mailto:, tel:, javascript:, fragments-only, etc.).
 */
export function normalizeUrl(raw: string, base: string, keepQuery: boolean): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower === '#' ||
    lower.startsWith('#')
  ) {
    return null
  }

  let u: URL
  try {
    u = new URL(trimmed, base)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null

  // Lowercase scheme + host (URL already lowercases these), drop fragment.
  u.hash = ''

  // Remove default ports.
  if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
    u.port = ''
  }

  // Query params.
  if (!keepQuery) {
    u.search = ''
  } else if (u.search) {
    const params = [...u.searchParams.entries()].sort((a, b) =>
      a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1
    )
    const sp = new URLSearchParams()
    for (const [k, v] of params) sp.append(k, v)
    u.search = sp.toString()
  }

  // Decode unnecessary percent-encoding in the path.
  let pathname = u.pathname
  try {
    pathname = decodeURI(pathname)
  } catch {
    /* keep as-is if malformed */
  }

  // Remove trailing slash except for root.
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1)
  if (pathname === '') pathname = '/'

  return `${u.protocol}//${u.host}${pathname}${u.search}`
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return ''
  }
}

/** Registrable-ish root (drops leading "www."). */
function registrableHost(host: string): string {
  return host.replace(/^www\./, '')
}

export function isInternal(url: string, rootHost: string, followSubdomains: boolean): boolean {
  const host = hostOf(url)
  if (!host) return false
  if (host === rootHost) return true
  if (followSubdomains) {
    const root = registrableHost(rootHost)
    return host === root || host.endsWith('.' + root)
  }
  return false
}

/** First path segment used to cluster pages (e.g. "/blog"). Root maps to "/". */
export function pathGroupOf(url: string): string {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean)[0]
    return seg ? `/${seg}` : '/'
  } catch {
    return '/'
  }
}
