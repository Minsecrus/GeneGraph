import { genotypeToPattern, toFraction } from './utils'
import type {
  ExtraRule,
  OffspringCell,
  SexState,
  WeightedGamete,
  ZygoteState,
} from './types'

function normalizeGametePool(gametes: WeightedGamete[]) {
  const viableGametes = gametes.filter((gamete) => gamete.isViable)
  const totalProbability = viableGametes.reduce(
    (sum, gamete) => sum + gamete.probability,
    0,
  )

  if (viableGametes.length === 0 || totalProbability <= 0) {
    throw new Error('额外规则移除了某一亲本的全部可用配子。')
  }

  return viableGametes.map((gamete) => {
    const probability = gamete.probability / totalProbability
    return {
      ...gamete,
      probability,
      probabilityText: toFraction(probability),
    }
  })
}

function normalizeSexLabel(parentId: WeightedGamete['sourceParentId']) {
  return parentId === 'parent1' ? '雌' : '雄'
}

function matchesGametePattern(pattern: string, label: string) {
  return label.includes(pattern)
}

function matchesZygotePattern(pattern: string, genotype: string, normalizedPattern: string) {
  return genotype.includes(pattern) || normalizedPattern.includes(pattern)
}

function matchesGameteRule(rule: ExtraRule, gamete: WeightedGamete) {
  const [scope, pattern] = rule.when.split(/\s+/)
  const gameteSex = normalizeSexLabel(gamete.sourceParentId)
  const slot = gamete.sourceParentId === 'parent1' ? 'P1' : 'P2'
  const scopeMatched =
    scope === '全部' ||
    scope === gameteSex ||
    scope === slot
  return scopeMatched && matchesGametePattern(pattern, gamete.label)
}

function matchesZygoteRule(
  rule: ExtraRule,
  zygote: ZygoteState,
  sexState?: SexState,
) {
  const pattern = genotypeToPattern(zygote.loci)
  return (
    matchesZygotePattern(rule.when, zygote.genotype, pattern) ||
    rule.when === sexState?.chromosomalSex ||
    rule.when === sexState?.developmentalSex ||
    rule.when === sexState?.phenotypicSex
  )
}

export function applyGameteRules(
  gametes: WeightedGamete[],
  extraRules: ExtraRule[],
) {
  const relevantRules = extraRules.filter((rule) => rule.stage === 'gamete')
  if (relevantRules.length === 0) {
    return gametes
  }

  const mutated = gametes.map((gamete) => ({ ...gamete }))

  for (const gamete of mutated) {
    for (const rule of relevantRules) {
      if (!matchesGameteRule(rule, gamete)) {
        continue
      }
      if (rule.effect.type === 'block-gamete') {
        gamete.isViable = false
        gamete.blockedBy = rule.effect.reason || rule.label
      }
    }
  }

  return normalizeGametePool(mutated)
}

export function applySexRules(
  zygote: ZygoteState,
  extraRules: ExtraRule[],
  initialState?: Partial<SexState>,
) {
  const sexState: SexState = {
    chromosomalSex: initialState?.chromosomalSex ?? null,
    developmentalSex: initialState?.developmentalSex ?? null,
    phenotypicSex: initialState?.phenotypicSex ?? null,
    gameteRole: initialState?.gameteRole ?? null,
    reversalApplied: initialState?.reversalApplied ?? false,
  }

  for (const rule of extraRules.filter((candidate) => candidate.stage === 'sex')) {
    if (!matchesZygoteRule(rule, zygote, sexState)) {
      continue
    }

    switch (rule.effect.type) {
      case 'set-chromosomal-sex':
        sexState.chromosomalSex = rule.effect.value
        break
      case 'set-developmental-sex':
        sexState.developmentalSex = rule.effect.value
        break
      case 'set-phenotypic-sex':
        sexState.phenotypicSex = rule.effect.value
        break
      case 'set-gamete-role':
        sexState.gameteRole = rule.effect.value
        break
      case 'mark-reversal':
        sexState.reversalApplied = true
        break
      default:
        break
    }
  }

  return sexState
}

export function applyViabilityRules(
  cell: OffspringCell,
  zygote: ZygoteState,
  extraRules: ExtraRule[],
) {
  const relevantRules = extraRules.filter((rule) => rule.stage === 'viability')
  if (relevantRules.length === 0) {
    return cell
  }

  const nextCell = {
    ...cell,
    viability: { ...cell.viability },
  }

  for (const rule of relevantRules) {
    if (!matchesZygoteRule(rule, zygote, nextCell.sexContext)) {
      continue
    }
    if (rule.effect.type === 'kill-zygote') {
      nextCell.viability.isViable = false
      nextCell.viability.reason = rule.effect.reason || rule.label
    }
  }

  return nextCell
}
