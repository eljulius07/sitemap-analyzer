import { describe, expect, it } from 'vitest'
import { hostOf, isInternal, normalizeUrl, pathGroupOf } from './url-normalizer'

const BASE = 'https://example.com/section/page'

describe('normalizeUrl', () => {
  it('resolves relative hrefs against the base', () => {
    expect(normalizeUrl('/about', BASE, false)).toBe('https://example.com/about')
    expect(normalizeUrl('sibling', BASE, false)).toBe('https://example.com/section/sibling')
    expect(normalizeUrl('../up', BASE, false)).toBe('https://example.com/up')
  })

  it('drops the fragment and the trailing slash, but keeps root "/"', () => {
    expect(normalizeUrl('/about/#team', BASE, false)).toBe('https://example.com/about')
    expect(normalizeUrl('https://example.com/', BASE, false)).toBe('https://example.com/')
  })

  it('lowercases the host but preserves path case', () => {
    expect(normalizeUrl('https://EXAMPLE.com/Path', BASE, false)).toBe('https://example.com/Path')
  })

  it('strips default ports and keeps non-default ones', () => {
    expect(normalizeUrl('https://example.com:443/x', BASE, false)).toBe('https://example.com/x')
    expect(normalizeUrl('http://example.com:80/x', BASE, false)).toBe('http://example.com/x')
    expect(normalizeUrl('http://example.com:8080/x', BASE, false)).toBe('http://example.com:8080/x')
  })

  it('drops the query when keepQuery is false', () => {
    expect(normalizeUrl('/x?b=2&a=1', BASE, false)).toBe('https://example.com/x')
  })

  it('sorts query params when keepQuery is true, so param order is not a new URL', () => {
    expect(normalizeUrl('/x?b=2&a=1', BASE, true)).toBe('https://example.com/x?a=1&b=2')
    expect(normalizeUrl('/x?a=1&b=2', BASE, true)).toBe('https://example.com/x?a=1&b=2')
  })

  it('decodes unnecessary percent-encoding in the path', () => {
    expect(normalizeUrl('https://example.com/caf%C3%A9', BASE, false)).toBe(
      'https://example.com/café'
    )
  })

  it('rejects non-crawlable schemes, fragments and blanks', () => {
    for (const raw of ['mailto:a@b.com', 'tel:+34600', 'javascript:void(0)', 'data:text/plain,x', '#', '#top', '   ']) {
      expect(normalizeUrl(raw, BASE, false)).toBeNull()
    }
    expect(normalizeUrl('ftp://example.com/f', BASE, false)).toBeNull()
  })
})

describe('hostOf', () => {
  it('returns the lowercased host, or empty for garbage', () => {
    expect(hostOf('https://EXAMPLE.com:8080/x')).toBe('example.com:8080')
    expect(hostOf('not a url')).toBe('')
  })
})

describe('isInternal', () => {
  it('matches the exact host', () => {
    expect(isInternal('https://example.com/a', 'example.com', false)).toBe(true)
    expect(isInternal('https://other.com/a', 'example.com', false)).toBe(false)
  })

  it('excludes subdomains unless followSubdomains is set', () => {
    expect(isInternal('https://blog.example.com/a', 'example.com', false)).toBe(false)
    expect(isInternal('https://blog.example.com/a', 'example.com', true)).toBe(true)
  })

  it('treats www as the same site when following subdomains', () => {
    expect(isInternal('https://example.com/a', 'www.example.com', true)).toBe(true)
  })

  it('does not treat a look-alike host as a subdomain', () => {
    expect(isInternal('https://notexample.com/a', 'example.com', true)).toBe(false)
  })
})

describe('pathGroupOf', () => {
  it('clusters by the first path segment', () => {
    expect(pathGroupOf('https://example.com/')).toBe('/')
    expect(pathGroupOf('https://example.com/blog/post-1')).toBe('/blog')
    expect(pathGroupOf('garbage')).toBe('/')
  })
})
