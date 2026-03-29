import type { CrossAnalysis, LocusAllele, OffspringCell, PhenotypeRule } from './types'
import { parseGenotype } from './parser'
import { matchPhenotype } from './rules'
import {
  buildLocusDisplayKey,
  buildNormalizedGenotype,
  normalizeOffspringLoci,
  toFraction,
} from './utils'

function defaultLifecycleStage(cell: OffspringCell): OffspringCell {
  return {
    ...cell,
    viability: { isViable: true, reason: null },
    sexContext: {
      chromosomalSex: null,
      phenotypicSex: null,
      reversalApplied: false,
    },
  }
}

function buildPhenotypeFactorization(cells: OffspringCell[]) {
  const groupCounts = new Map<string, Map<string, number>>()

  for (const cell of cells) {
    for (const part of cell.phenotype.parts) {
      const labels = groupCounts.get(part.groupKey) ?? new Map<string, number>()
      labels.set(part.label, (labels.get(part.label) ?? 0) + 1)
      groupCounts.set(part.groupKey, labels)
    }
  }

  const groupedRatios = [...groupCounts.values()]
    .filter((labels) => labels.size > 1)
    .map((labels) => [...labels.values()].sort((a, b) => b - a))

  const rawCounts = new Map<string, number>()
  for (const cell of cells) {
    rawCounts.set(cell.phenotype.label, (rawCounts.get(cell.phenotype.label) ?? 0) + 1)
  }
  const raw = [...rawCounts.values()].sort((a, b) => b - a).join(':')

  if (groupedRatios.length < 2) {
    return { raw, grouped: null }
  }

  const product = groupedRatios.reduce<number[]>(
    (accumulator, ratio) =>
      accumulator.flatMap((left) => ratio.map((right) => left * right)),
    [1],
  )
  const sortedProduct = product.sort((a, b) => b - a)
  const sortedRaw = [...rawCounts.values()].sort((a, b) => b - a)

  const matches =
    sortedProduct.length === sortedRaw.length &&
    sortedProduct.every((value, index) => value === sortedRaw[index])

  return {
    raw,
    grouped: matches ? groupedRatios.map((ratio) => `(${ratio.join(':')})`).join('') : null,
  }
}

export function runCrossAnalysis(
  parent1Input: string,
  parent2Input: string,
  rules: PhenotypeRule[],
): CrossAnalysis {
  const parent1 = parseGenotype(parent1Input)
  const parent2 = parseGenotype(parent2Input)

  const parent1Loci = parent1.loci.map((locus) => locus.locusKey).join(',')
  const parent2Loci = parent2.loci.map((locus) => locus.locusKey).join(',')
  if (parent1Loci !== parent2Loci) {
    throw new Error('父本与母本的位点集合不一致，当前版本要求两者使用相同位点。')
  }

  const lociOrder = parent1.loci.map((locus) => locus.locusKey)
  const grid = parent1.gametes.map((rowGamete) => ({
    gamete: rowGamete,
    cells: parent2.gametes.map((columnGamete) => {
      const allelesByLocus = new Map<string, [LocusAllele, LocusAllele]>()

      for (const allele of rowGamete.alleles) {
        const partner = columnGamete.alleles.find(
          (candidate) => candidate.locusKey === allele.locusKey,
        )
        if (!partner) {
          throw new Error(`配子缺少位点 ${allele.locusKey}。`)
        }

        allelesByLocus.set(allele.locusKey, [
          {
            locusKey: allele.locusKey,
            symbol: allele.symbol,
            normalizedSymbol: allele.symbol.toUpperCase(),
            isUppercase: allele.symbol === allele.symbol.toUpperCase(),
          },
          {
            locusKey: partner.locusKey,
            symbol: partner.symbol,
            normalizedSymbol: partner.symbol.toUpperCase(),
            isUppercase: partner.symbol === partner.symbol.toUpperCase(),
          },
        ])
      }

      const offspringLoci = normalizeOffspringLoci(lociOrder, allelesByLocus)
      const genotype = buildNormalizedGenotype(offspringLoci)
      const matched = matchPhenotype(offspringLoci, rules)

      return defaultLifecycleStage({
        id: `${rowGamete.id}-${columnGamete.id}`,
        genotype,
        phenotype: matched.phenotype,
        match: matched.match,
        viability: { isViable: true, reason: null },
        sexContext: {
          chromosomalSex: null,
          phenotypicSex: null,
          reversalApplied: false,
        },
      })
    }),
  }))

  const allCells = grid.flatMap((row) => row.cells)
  const genotypeCounts = new Map<string, number>()
  const phenotypeCounts = new Map<string, { count: number; label: string }>()

  for (const cell of allCells) {
    genotypeCounts.set(cell.genotype, (genotypeCounts.get(cell.genotype) ?? 0) + 1)
    const phenotypeKey = cell.phenotype.label
    const existing = phenotypeCounts.get(phenotypeKey)
    if (existing) {
      existing.count += 1
    } else {
      phenotypeCounts.set(phenotypeKey, { count: 1, label: cell.phenotype.label })
    }
  }

  const totalCells = allCells.length
  const phenotypeFactorization = buildPhenotypeFactorization(allCells)
  return {
    loci: lociOrder.map((locusKey) => buildLocusDisplayKey(locusKey)),
    parents: { parent1, parent2 },
    grid,
    genotypeStats: [...genotypeCounts.entries()]
      .map(([label, count]) => ({
        label,
        count,
        probabilityText: toFraction(count / totalCells),
        token: label,
      }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
    phenotypeStats: [...phenotypeCounts.entries()]
      .map(([token, item]) => ({
        label: item.label,
        count: item.count,
        probabilityText: toFraction(item.count / totalCells),
        token,
      }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
    phenotypeFactorization,
    errors: [],
  }
}
