import { describe, expect, it } from 'vitest'
import { countIssues, evaluateResult } from './scoring'
import { HEALTH_WEIGHTS } from './types'
import type { Issue } from './types'
import {
  httpInfo,
  imageAnalysis as images,
  linkAnalysis as links,
  performanceAnalysis as performance,
  scoreInput as cleanPage,
  seoAnalysis as seo
} from '../test/fixtures'

const fields = (issues: Issue[]): string[] => issues.map((i) => i.field).sort()

describe('evaluateResult — baseline', () => {
  it('gives a flawless page a perfect score and no issues', () => {
    const { issues, healthScore, rowStatus, scores } = evaluateResult(cleanPage())
    expect(issues).toEqual([])
    expect(healthScore).toBe(100)
    expect(rowStatus).toBe('ok')
    expect(scores).toEqual({
      seo: 100,
      performance: 100,
      content: 100,
      technical: 100,
      social: 100,
      images: 100,
      links: 100
    })
  })

  it('keeps the category weights normalised to 1', () => {
    const total = Object.values(HEALTH_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('scores every weighted category, none left dangling', () => {
    // Guards the bug where `links` issues were produced but had no weight, so
    // a `javascript:` href was reported as critical and cost exactly 0 points.
    const { scores } = evaluateResult(cleanPage())
    expect(Object.keys(scores).sort()).toEqual(Object.keys(HEALTH_WEIGHTS).sort())
  })

  it('weights the categories when scoring (performance is 25%)', () => {
    // One warning (-5) on performance only: 95*.25 + 100*.75 = 98.75
    const r = evaluateResult(cleanPage({ performance: performance({ htmlCompressed: false }) }))
    expect(fields(r.issues)).toEqual(['compression'])
    expect(r.scores.performance).toBe(95)
    expect(r.healthScore).toBe(99)
  })
})

describe('link hygiene is scored', () => {
  it('deducts for a javascript: href', () => {
    const r = evaluateResult(cleanPage({ links: links({ javascriptLinks: 2 }) }))
    expect(fields(r.issues)).toEqual(['jsLinks'])
    expect(r.issues[0].severity).toBe('critical')
    expect(r.scores.links).toBe(90) // critical = -10
  })

  it('feeds the health score — link issues used to cost exactly nothing', () => {
    // critical (-10) + two warnings (-10) => links 80; health 95 + 80*.05 = 99
    const r = evaluateResult(
      cleanPage({ links: links({ javascriptLinks: 1, hashOnly: 1, withoutAnchorText: 3 }) })
    )
    expect(r.scores.links).toBe(80)
    expect(r.healthScore).toBe(99)
    expect(r.rowStatus).toBe('warning')
  })

  it('deducts for empty anchors and missing anchor text', () => {
    const r = evaluateResult(cleanPage({ links: links({ hashOnly: 1, withoutAnchorText: 3 }) }))
    expect(fields(r.issues)).toEqual(['anchorText', 'hashLinks'])
    expect(r.scores.links).toBe(90) // two warnings = -10
  })
})

describe('evaluateResult — hard failures', () => {
  it('zeroes every score on a 4xx', () => {
    const r = evaluateResult(cleanPage({ http: httpInfo({ statusCode: 404, statusText: 'Not Found' }) }))
    expect(r.rowStatus).toBe('error')
    expect(r.healthScore).toBe(0)
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0].severity).toBe('critical')
  })

  it('zeroes every score on a transport error', () => {
    const r = evaluateResult(
      cleanPage({ http: httpInfo({ statusCode: null }), error: 'ECONNREFUSED' })
    )
    expect(r.healthScore).toBe(0)
    expect(r.issues[0].message).toBe('ECONNREFUSED')
  })
})

describe('indexability is not double-penalised', () => {
  it('charges a missing canonical once, as a warning', () => {
    // Regression: a missing canonical used to also flip isIndexable, adding a
    // second (critical) deduction for the very same defect.
    const r = evaluateResult(
      cleanPage({ seo: seo({ canonicalStatus: 'missing', canonicalUrl: '', isIndexable: true }) })
    )
    expect(fields(r.issues)).toEqual(['canonical'])
    expect(r.scores.seo).toBe(95)
  })

  it('charges a noindex page once, via the directive that caused it', () => {
    const r = evaluateResult(
      cleanPage({ seo: seo({ metaRobots: 'noindex, follow', isIndexable: false }) })
    )
    expect(fields(r.issues)).toEqual(['metaRobots'])
    expect(r.scores.seo).toBe(90)
  })

  it('charges a canonicalised page once, via the canonical rule', () => {
    const r = evaluateResult(
      cleanPage({
        seo: seo({
          canonicalStatus: 'other',
          canonicalUrl: 'https://example.com/other',
          isIndexable: false
        })
      })
    )
    expect(fields(r.issues)).toEqual(['canonical'])
    expect(r.scores.seo).toBe(95)
  })

  it('still reports the roll-up when no specific cause fired (non-200)', () => {
    const r = evaluateResult(
      cleanPage({
        http: httpInfo({ statusCode: 301, statusText: 'Moved Permanently' }),
        seo: seo({ isIndexable: false })
      })
    )
    expect(fields(r.issues)).toEqual(['isIndexable'])
    expect(r.issues[0].severity).toBe('critical')
    expect(r.issues[0].value).toBe(301)
    expect(r.scores.seo).toBe(90)
  })
})

describe('cross-URL duplicate context', () => {
  it('is inert by default', () => {
    expect(evaluateResult(cleanPage()).issues).toEqual([])
  })

  it('flags duplicate titles and descriptions as critical when told to', () => {
    const r = evaluateResult(cleanPage(), {
      duplicateTitle: true,
      duplicateDescription: true
    })
    expect(fields(r.issues)).toEqual(['duplicateDescription', 'duplicateTitle'])
    expect(r.issues.every((i) => i.severity === 'critical')).toBe(true)
    expect(r.scores.seo).toBe(80)
  })
})

describe('countIssues', () => {
  it('counts warnings and criticals, and criticals twice over', () => {
    const r = evaluateResult(
      cleanPage({
        seo: seo({ title: '', titleLength: 0, isIndexable: false }),
        images: images({ missingAlt: 3 })
      })
    )
    const { total, critical } = countIssues(r.issues)
    expect(critical).toBeGreaterThan(0)
    expect(total).toBe(r.issues.filter((i) => i.severity !== 'info').length)
  })
})
