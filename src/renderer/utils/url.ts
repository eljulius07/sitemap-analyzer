/** First path segment used to cluster pages (e.g. "/blog"); root maps to "/". */
export function pathGroupOf(url: string): string {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean)[0]
    return seg ? `/${seg}` : '/'
  } catch {
    return '/'
  }
}

export function shortLabel(url: string, max = 28): string {
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? '/' : u.pathname.replace(/\/$/, '')
    const s = path === '/' ? u.host : path
    return s.length > max ? '…' + s.slice(-(max - 1)) : s
  } catch {
    return url.length > max ? url.slice(0, max) + '…' : url
  }
}
