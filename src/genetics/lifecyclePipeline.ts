import { applySexRules, applyViabilityRules } from './extraRuleEngine'
import { matchPhenotype } from './rules'
import type {
  ExtraRule,
  OffspringCell,
  PhenotypeRule,
  SexState,
  ZygoteState,
} from './types'

function defaultSexState(previous?: Partial<SexState>): SexState {
  return {
    chromosomalSex: previous?.chromosomalSex ?? null,
    developmentalSex: previous?.developmentalSex ?? null,
    phenotypicSex: previous?.phenotypicSex ?? null,
    gameteRole: previous?.gameteRole ?? null,
    reversalApplied: previous?.reversalApplied ?? false,
  }
}

function inferDefaultSexState(zygote: ZygoteState): Partial<SexState> {
  const chromosomes = [...zygote.sexChromosomes]
    .map((item) => item[0])
    .filter((item): item is 'X' | 'Y' | 'Z' | 'W' => ['X', 'Y', 'Z', 'W'].includes(item))
    .sort()
    .join('')

  switch (chromosomes) {
    case 'XX':
      return { chromosomalSex: 'XX', phenotypicSex: '雌' }
    case 'XY':
      return { chromosomalSex: 'XY', phenotypicSex: '雄' }
    case 'ZW':
      return { chromosomalSex: 'ZW', phenotypicSex: '雌' }
    case 'ZZ':
      return { chromosomalSex: 'ZZ', phenotypicSex: '雄' }
    default:
      return {}
  }
}

export function resolveZygoteLifecycle(
  zygote: ZygoteState,
  rules: PhenotypeRule[],
  extraRules: ExtraRule[] = [],
): OffspringCell {
  const matched = matchPhenotype(zygote.loci, rules)
  const sexContext = applySexRules(
    zygote,
    extraRules,
    defaultSexState(inferDefaultSexState(zygote)),
  )
  const baseCell: OffspringCell = {
    id: zygote.id,
    genotype: zygote.genotype,
    probability: zygote.probability,
    probabilityText: zygote.probabilityText,
    phenotype: matched.phenotype,
    match: matched.match,
    viability: { isViable: true, reason: null },
    sexContext,
  }

  return applyViabilityRules(baseCell, zygote, extraRules)
}
