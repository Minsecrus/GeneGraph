import {
  DEFAULT_FALLBACK_COLOR,
  type GenotypeLocus,
  type MatchResult,
  type PhenotypeDisplay,
  type PhenotypeRule,
  type RuleClause,
  type RuleParseResult,
} from './types'
import {
  clamp,
  genotypeToPattern,
  getLabelGroupKey,
  hashText,
  locusToPatternToken,
  matchesToken,
  normalizeRuleToken,
  splitPatternIntoClauses,
  wrapHue,
} from './ruleUtils'

type DraftRule = Omit<PhenotypeRule, 'color' | 'inferredLocusOrder'> & {
  isRecessive: boolean
  clauseCount: number
}

function buildRuleClauseMap(pattern: string) {
  const clauses = splitPatternIntoClauses(pattern)
  const clauseMap = new Map<string, RuleClause>()

  for (const clause of clauses) {
    if (clause.locusKey) {
      clauseMap.set(clause.locusKey, clause)
    }
  }

  return { clauses, clauseMap }
}

function isRecessiveClausePattern(pattern: string) {
  const clauses = buildRuleClauseMap(pattern).clauses
  return (
    clauses.length === 1 &&
    clauses[0].token !== '__' &&
    clauses[0].token === clauses[0].token.toLowerCase()
  )
}

function colorFromLabelGroup(
  groupKey: string,
  variantIndex: number,
  variantCount: number,
  isCombined: boolean,
  isRecessive: boolean,
) {
  const baseHash = hashText(groupKey || '#')
  const baseHue = wrapHue((baseHash * 47) % 360)
  const steps = Math.max(variantCount - 1, 1)
  const relative = steps === 0 ? 0 : variantIndex / steps
  const hueOffset = (relative - 0.5) * 28
  const hue = wrapHue(baseHue + hueOffset)

  let saturation = 96
  let lightness = 76

  if (isRecessive) {
    saturation = 86
    lightness = 84
  }

  if (isCombined) {
    saturation = 100
    lightness = 72
  }

  const centered = relative - 0.5
  saturation = clamp(saturation - Math.abs(centered) * 10, 72, 100)
  lightness = clamp(lightness + centered * 18, 58, 92)

  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

export function parseRules(input: string): RuleParseResult {
  const lines = input.split('\n').map((line) => line.trim()).filter(Boolean)
  const draftRules: DraftRule[] = []
  const errors: string[] = []

  for (const [index, line] of lines.entries()) {
    let pattern = ''
    let label = ''

    if (line.includes('->')) {
      const parts = line.split('->')
      if (parts.length !== 2) {
        errors.push(`规则第 ${index + 1} 行格式无效。`)
        continue
      }
      pattern = parts[0].trim()
      label = parts[1].trim()
    } else {
      const match = line.match(/^(\S+)\s+(.+)$/)
      if (!match) {
        errors.push(`规则第 ${index + 1} 行格式无效。`)
        continue
      }
      pattern = match[1].trim()
      label = match[2].trim()
    }

    if (!pattern || !label) {
      errors.push(`规则第 ${index + 1} 行必须同时提供模式和名称。`)
      continue
    }

    const groupKey = getLabelGroupKey(label)

    try {
      const { clauses } = buildRuleClauseMap(pattern)
      draftRules.push({
        id: `rule-${index}`,
        pattern,
        label,
        source: line,
        locusScope: [
          ...new Set(
            clauses
              .map((clause) => clause.locusKey)
              .filter((locusKey): locusKey is string => Boolean(locusKey)),
          ),
        ].sort(),
        groupKey,
        isRecessive: isRecessiveClausePattern(pattern),
        clauseCount: clauses.length,
      })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `规则第 ${index + 1} 行无效。`)
    }
  }

  const groupVariants = new Map<string, string[]>()
  const groupLocusOrders = new Map<string, string[]>()

  for (const rule of draftRules) {
    const labels = groupVariants.get(rule.groupKey) ?? []
    if (!labels.includes(rule.label)) {
      labels.push(rule.label)
      labels.sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'))
    }
    groupVariants.set(rule.groupKey, labels)

    const loci = groupLocusOrders.get(rule.groupKey) ?? []
    for (const locusKey of rule.locusScope) {
      if (!loci.includes(locusKey)) {
        loci.push(locusKey)
      }
    }
    loci.sort()
    groupLocusOrders.set(rule.groupKey, loci)
  }

  const rules: PhenotypeRule[] = draftRules.map((rule) => {
    const variants = groupVariants.get(rule.groupKey) ?? [rule.label]
    const variantIndex = Math.max(0, variants.indexOf(rule.label))
    const inferredLocusOrder = (groupLocusOrders.get(rule.groupKey) ?? rule.locusScope).slice(
      0,
      rule.clauseCount,
    )

    return {
      id: rule.id,
      pattern: rule.pattern,
      label: rule.label,
      color: colorFromLabelGroup(
        rule.groupKey,
        variantIndex,
        variants.length,
        rule.locusScope.length > 1,
        rule.isRecessive,
      ),
      source: rule.source,
      locusScope: rule.locusScope,
      groupKey: rule.groupKey,
      inferredLocusOrder,
    }
  })

  return { rules, errors }
}

export function matchPhenotype(
  loci: GenotypeLocus[],
  rules: PhenotypeRule[],
): {
  phenotype: PhenotypeDisplay
  match: MatchResult[]
} {
  const lociMap = new Map(loci.map((locus) => [locus.locusKey, locusToPatternToken(locus)]))
  const exactLociMap = new Map(
    loci.map((locus) => [locus.locusKey, locus.alleles.map((allele) => allele.symbol).join('')]),
  )
  const matches: MatchResult[] = []

  for (const rule of rules) {
    const clauses = splitPatternIntoClauses(rule.pattern)
    const matched = clauses.every((clause, index) => {
      if (clause.token === '__') {
        return true
      }

      const targetLocusKey = clause.locusKey ?? rule.inferredLocusOrder[index]
      if (!targetLocusKey) {
        return false
      }

      const stateActual = lociMap.get(targetLocusKey)
      const exactActual = exactLociMap.get(targetLocusKey)
      if (!stateActual || !exactActual) {
        return false
      }

      const normalizedToken = normalizeRuleToken(clause.token)
      const isExactToken = !normalizedToken.includes('_')
      return isExactToken
        ? normalizedToken === exactActual
        : matchesToken(normalizedToken, stateActual)
    })

    if (matched) {
      matches.push({ pattern: rule.pattern, ruleId: rule.id })
    }
  }

  if (matches.length === 0) {
    return {
      phenotype: {
        label: '未命中规则',
        parts: [{ label: '未命中规则', color: DEFAULT_FALLBACK_COLOR, groupKey: '#' }],
      },
      match: [{ pattern: genotypeToPattern(loci), ruleId: 'fallback' }],
    }
  }

  const matchedRules = matches
    .map((match) => rules.find((rule) => rule.id === match.ruleId))
    .filter((rule): rule is PhenotypeRule => Boolean(rule))

  const combinedRules = matchedRules.filter((rule) => rule.locusScope.length > 1)
  const singleLocusRules = matchedRules.filter((rule) => rule.locusScope.length <= 1)
  const combinedGroupKeys = new Set(combinedRules.map((rule) => rule.groupKey))
  const effectiveRules = [
    ...combinedRules,
    ...singleLocusRules.filter((rule) => !combinedGroupKeys.has(rule.groupKey)),
  ]

  return {
    phenotype: {
      label: effectiveRules.map((rule) => rule.label).join(' '),
      parts: effectiveRules.map((rule) => ({
        label: rule.label,
        color: rule.color,
        groupKey: rule.groupKey,
      })),
    },
    match: matches,
  }
}
