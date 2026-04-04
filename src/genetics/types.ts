export type LocusAllele = {
  locusKey: string
  symbol: string
  normalizedSymbol: string
  isUppercase: boolean
}

export type GenotypeLocus = {
  locusKey: string
  displayKey: string
  alleles: LocusAllele[]
}

export type Gamete = {
  id: string
  label: string
  alleles: Array<{ locusKey: string; symbol: string }>
  sexChromosomes: string[]
  probability: number
  probabilityText: string
}

export type SexChromosomeCopy = {
  chromosome: 'X' | 'Y' | 'Z' | 'W'
  genes: Array<{ locusKey: string; symbol: string }>
  raw: string
}

export type ParsedGenotype = {
  input: string
  normalized: string
  loci: GenotypeLocus[]
  sexChromosomes: SexChromosomeCopy[]
  gametes: Gamete[]
}

export type SexState = {
  chromosomalSex: string | null
  developmentalSex: string | null
  phenotypicSex: string | null
  gameteRole: 'sperm' | 'egg' | 'gamete' | 'both' | 'none' | null
  reversalApplied: boolean
}

export type ParentState = {
  parentId: 'parent1' | 'parent2'
  genotype: ParsedGenotype
  ploidy: 'haploid' | 'diploid'
  sex: SexState
  traits: string[]
}

export type WeightedGamete = Gamete & {
  sourceParentId: ParentState['parentId']
  isViable: boolean
  blockedBy: string | null
}

export type ZygoteState = {
  id: string
  genotype: string
  loci: GenotypeLocus[]
  sexChromosomes: string[]
  ploidy: 'haploid' | 'diploid'
  origin: {
    maternalGamete: WeightedGamete | null
    paternalGamete: WeightedGamete | null
  }
  probability: number
  probabilityText: string
}

export type RuleClause = {
  locusKey: string | null
  token: string
  index: number
}

export type PhenotypeRule = {
  id: string
  pattern: string
  label: string
  color: string
  source: string
  locusScope: string[]
  groupKey: string
  inferredLocusOrder: string[]
}

export type RuleParseResult = {
  rules: PhenotypeRule[]
  errors: string[]
}

export type ExtraRuleParseResult = {
  rules: ExtraRule[]
  errors: string[]
}

export type MatchResult = {
  pattern: string
  ruleId: string
}

export type PhenotypePart = {
  label: string
  color: string
  groupKey: string
}

export type PhenotypeDisplay = {
  label: string
  parts: PhenotypePart[]
}

export type OffspringCell = {
  id: string
  genotype: string
  probability: number
  probabilityText: string
  phenotype: PhenotypeDisplay
  match: MatchResult[]
  viability: {
    isViable: boolean
    reason: string | null
  }
  sexContext: SexState
}

export type OffspringGridRow = {
  gamete: WeightedGamete
  cells: OffspringCell[]
}

export type ExtraRuleStage =
  | 'parent'
  | 'gamete'
  | 'zygote'
  | 'viability'
  | 'sex'
  | 'phenotype'

export type ExtraRuleEffect =
  | { type: 'block-gamete'; reason: string }
  | { type: 'kill-zygote'; reason: string }
  | { type: 'set-chromosomal-sex'; value: string }
  | { type: 'set-developmental-sex'; value: string }
  | { type: 'set-phenotypic-sex'; value: string }
  | { type: 'set-gamete-role'; value: SexState['gameteRole'] }
  | { type: 'mark-reversal' }

export type ExtraRule = {
  id: string
  stage: ExtraRuleStage
  label: string
  source: string
  when: string
  effect: ExtraRuleEffect
}

export type ReproductionModel = {
  id: string
  label: string
  description: string
  supportsPloidy: Array<'haploid' | 'diploid'>
}

export type CrossAnalysis = {
  loci: string[]
  model: ReproductionModel
  parents: {
    parent1: ParentState
    parent2: ParentState
  }
  gametePools: {
    parent1: WeightedGamete[]
    parent2: WeightedGamete[]
  }
  zygotes: ZygoteState[]
  grid: OffspringGridRow[]
  genotypeStats: Array<{
    label: string
    count: number
    probabilityText: string
    token: string
  }>
  phenotypeStats: Array<{
    label: string
    count: number
    probabilityText: string
    token: string
  }>
  phenotypeFactorization: {
    raw: string
    grouped: string | null
  }
  errors: string[]
}

export const DEFAULT_FALLBACK_COLOR = '#a3a3a3'

export const DEFAULT_RULES = `A_ 黄色
aa 绿色
B_ 圆粒
bb 皱粒`

export const DEFAULT_EXTRA_RULES = ``
