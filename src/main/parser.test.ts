import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/types'
import { parseSitemapFromFile } from './parser'

const dir = mkdtempSync(join(tmpdir(), 'sitemap-parser-'))
let counter = 0

async function parse(xml: string) {
  const file = join(dir, `sitemap-${counter++}.xml`)
  writeFileSync(file, xml, 'utf-8')
  return parseSitemapFromFile(file, DEFAULT_SETTINGS)
}

const wrap = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>`

describe('sitemap alternates', () => {
  it('extracts xhtml:link alternates alongside the loc', async () => {
    const res = await parse(
      wrap(`<url>
  <loc>https://www.pricetravel.com/es/login</loc>
  <xhtml:link rel="alternate" hreflang="es" href="https://www.pricetravel.com/es/login"/>
  <xhtml:link rel="alternate" type="text/html" hreflang="en" href="https://www.pricetravel.com/en/login"/>
</url>`)
    )
    expect(res.error).toBeUndefined()
    expect(res.urls).toEqual(['https://www.pricetravel.com/es/login'])
    expect(res.entries[0].alternates).toEqual([
      { lang: 'es', href: 'https://www.pricetravel.com/es/login' },
      { lang: 'en', href: 'https://www.pricetravel.com/en/login' }
    ])
  })

  it('accepts a bare <link> without the xhtml prefix', async () => {
    const res = await parse(
      wrap(`<url>
  <loc>https://x.com/a</loc>
  <link rel="alternate" hreflang="en" href="https://x.com/en/a"/>
</url>`)
    )
    expect(res.entries[0].alternates).toEqual([{ lang: 'en', href: 'https://x.com/en/a' }])
  })

  it('handles a single alternate as well as many', async () => {
    const res = await parse(
      wrap(`<url>
  <loc>https://x.com/only</loc>
  <xhtml:link rel="alternate" hreflang="es" href="https://x.com/only"/>
</url>`)
    )
    expect(res.entries[0].alternates).toHaveLength(1)
  })

  it('ignores links whose rel is not alternate', async () => {
    const res = await parse(
      wrap(`<url>
  <loc>https://x.com/a</loc>
  <xhtml:link rel="stylesheet" hreflang="en" href="https://x.com/style.css"/>
  <xhtml:link rel="alternate" hreflang="en" href="https://x.com/en/a"/>
</url>`)
    )
    expect(res.entries[0].alternates).toEqual([{ lang: 'en', href: 'https://x.com/en/a' }])
  })

  it('skips alternates missing hreflang or href', async () => {
    const res = await parse(
      wrap(`<url>
  <loc>https://x.com/a</loc>
  <xhtml:link rel="alternate" href="https://x.com/en/a"/>
  <xhtml:link rel="alternate" hreflang="en"/>
</url>`)
    )
    expect(res.entries[0].alternates).toEqual([])
  })

  it('leaves entries without alternates with an empty list', async () => {
    const res = await parse(wrap('<url><loc>https://x.com/plain</loc></url>'))
    expect(res.entries).toEqual([{ loc: 'https://x.com/plain', alternates: [] }])
  })
})

describe('duplicate <loc> entries', () => {
  it('collapses them, counts them, and merges their alternates', async () => {
    const res = await parse(
      wrap(`<url>
  <loc>https://x.com/a</loc>
  <xhtml:link rel="alternate" hreflang="es" href="https://x.com/a"/>
</url>
<url>
  <loc>https://x.com/a</loc>
  <xhtml:link rel="alternate" hreflang="en" href="https://x.com/en/a"/>
</url>
<url><loc>https://x.com/b</loc></url>`)
    )
    expect(res.urls).toEqual(['https://x.com/a', 'https://x.com/b'])
    expect(res.duplicateLocs).toBe(1)
    expect(res.entries[0].alternates).toEqual([
      { lang: 'es', href: 'https://x.com/a' },
      { lang: 'en', href: 'https://x.com/en/a' }
    ])
  })
})

describe('failure modes', () => {
  it('reports a non-sitemap file without throwing', async () => {
    const res = await parse('just some text')
    expect(res.error).toBe('File is not a valid XML sitemap.')
    expect(res.entries).toEqual([])
    expect(res.duplicateLocs).toBe(0)
  })
})
