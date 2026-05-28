import axios from 'axios'
import robotsParser from 'robots-parser'

export interface RobotsRules {
  isAllowed: (url: string) => boolean
  crawlDelayMs: number
  sitemaps: string[]
}

const PERMISSIVE: RobotsRules = {
  isAllowed: () => true,
  crawlDelayMs: 0,
  sitemaps: []
}

/**
 * Fetch and parse robots.txt for the root of the given URL. On any failure
 * (404, timeout, parse error) returns a permissive ruleset (crawl everything).
 */
export async function fetchRobots(
  startUrl: string,
  userAgent: string,
  timeoutMs: number
): Promise<RobotsRules> {
  let robotsUrl: string
  try {
    const u = new URL(startUrl)
    robotsUrl = `${u.protocol}//${u.host}/robots.txt`
  } catch {
    return PERMISSIVE
  }

  try {
    const res = await axios.get<string>(robotsUrl, {
      timeout: timeoutMs,
      responseType: 'text',
      maxRedirects: 3,
      headers: { 'User-Agent': userAgent },
      validateStatus: (s) => s >= 200 && s < 400,
      transformResponse: [(d) => d]
    })
    const robots = robotsParser(robotsUrl, String(res.data))
    const delaySec = robots.getCrawlDelay(userAgent)
    return {
      isAllowed: (url: string) => robots.isAllowed(url, userAgent) ?? true,
      crawlDelayMs: typeof delaySec === 'number' ? delaySec * 1000 : 0,
      sitemaps: robots.getSitemaps()
    }
  } catch {
    return PERMISSIVE
  }
}
