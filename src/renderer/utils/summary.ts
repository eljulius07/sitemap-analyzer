import { countIssues } from '@shared/scoring'
import type { Category, UrlResult } from '@shared/types'

export interface CategoryIssueCount {
  critical: number
  warning: number
}

export interface Summary {
  total: number
  status2xx: number
  status3xx: number
  status4xx: number
  status5xx: number
  errors: number
  avgTtfbMs: number
  avgHealth: number
  totalIssues: number
  criticalIssues: number
  missingTitle: number
  missingMetaDescription: number
  missingH1: number
  duplicateTitles: number
  duplicateDescriptions: number
  imagesMissingAltTotal: number
  notIndexable: number
  byCategory: Record<Category, CategoryIssueCount>
  worst: UrlResult[]
}

const CATEGORIES: Category[] = [
  'seo',
  'performance',
  'content',
  'technical',
  'social',
  'images',
  'links'
]

export function computeSummary(results: UrlResult[]): Summary {
  const byCategory = Object.fromEntries(
    CATEGORIES.map((c) => [c, { critical: 0, warning: 0 }])
  ) as Record<Category, CategoryIssueCount>

  let status2xx = 0
  let status3xx = 0
  let status4xx = 0
  let status5xx = 0
  let errors = 0
  let totalTtfb = 0
  let totalHealth = 0
  let totalIssues = 0
  let criticalIssues = 0
  let missingTitle = 0
  let missingMetaDescription = 0
  let missingH1 = 0
  let duplicateTitles = 0
  let duplicateDescriptions = 0
  let imagesMissingAltTotal = 0
  let notIndexable = 0

  for (const r of results) {
    const code = r.http.statusCode
    if (code === null) errors++
    else if (code >= 500) status5xx++
    else if (code >= 400) status4xx++
    else if (code >= 300) status3xx++
    else status2xx++

    totalTtfb += r.http.ttfbMs
    totalHealth += r.healthScore

    const { total, critical } = countIssues(r.issues)
    totalIssues += total
    criticalIssues += critical

    for (const issue of r.issues) {
      if (issue.severity === 'critical') byCategory[issue.category].critical++
      else if (issue.severity === 'warning') byCategory[issue.category].warning++
    }

    if (r.seo) {
      if (!r.seo.title) missingTitle++
      if (!r.seo.metaDescription) missingMetaDescription++
      if (r.seo.h1Count === 0) missingH1++
      if (!r.seo.isIndexable) notIndexable++
    }
    if (r.issues.some((i) => i.field === 'duplicateTitle')) duplicateTitles++
    if (r.issues.some((i) => i.field === 'duplicateDescription')) duplicateDescriptions++
    if (r.images) imagesMissingAltTotal += r.images.missingAlt
  }

  const worst = [...results].sort((a, b) => a.healthScore - b.healthScore).slice(0, 10)

  return {
    total: results.length,
    status2xx,
    status3xx,
    status4xx,
    status5xx,
    errors,
    avgTtfbMs: results.length ? Math.round(totalTtfb / results.length) : 0,
    avgHealth: results.length ? Math.round(totalHealth / results.length) : 0,
    totalIssues,
    criticalIssues,
    missingTitle,
    missingMetaDescription,
    missingH1,
    duplicateTitles,
    duplicateDescriptions,
    imagesMissingAltTotal,
    notIndexable,
    byCategory,
    worst
  }
}
