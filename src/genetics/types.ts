export type LocusAllele = {
  locusKey: string
  symbol: string
  normalizedSymbol: string
  isUppercase: boolean
}

export type GenotypeLocus = {
  locusKey: string
  displayKey: string
  alleles: [LocusAllele, LocusAllele]
}

export type Gamete = {
  id: string
  label: string
  alleles: Array<{ locusKey: string; symbol: string }>
  probability: number
  probabilityText: string
}

export type ParsedGenotype = {
  input: string
  normalized: string
  loci: GenotypeLocus[]
  gametes: Gamete[]
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
  phenotype: PhenotypeDisplay
  match: MatchResult[]
  viability: {
    isViable: boolean
    reason: string | null
  }
  sexContext: {
    chromosomalSex: string | null
    phenotypicSex: string | null
    reversalApplied: boolean
  }
}

export type CrossAnalysis = {
  loci: string[]
  parents: {
    parent1: ParsedGenotype
    parent2: ParsedGenotype
  }
  grid: Array<{
    gamete: Gamete
    cells: OffspringCell[]
  }>
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

export const DEFAULT_RULES = `A_ -> 黄色
bb -> 皱粒`
