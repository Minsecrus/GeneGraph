import { buildGametePool } from './gametePipeline'
import { resolveZygoteLifecycle } from './lifecyclePipeline'
import { DIPLOID_BIPARENTAL_MODEL } from './models'
import { buildParentState } from './parentState'
import type { CrossAnalysis, ExtraRule, OffspringCell, PhenotypeRule } from './types'
import { buildLocusDisplayKey, toFraction } from './utils'
import { buildDiploidZygote } from './zygotePipeline'

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
  extraRules: ExtraRule[] = [],
): CrossAnalysis {
  const parent1 = buildParentState('parent1', parent1Input)
  const parent2 = buildParentState('parent2', parent2Input)

  const parent1Loci = [...new Set(parent1.genotype.loci.map((locus) => locus.locusKey))]
    .sort()
    .join(',')
  const parent2Loci = [...new Set(parent2.genotype.loci.map((locus) => locus.locusKey))]
    .sort()
    .join(',')
  if (parent1Loci !== parent2Loci) {
    throw new Error('父本与母本的位点集合不一致，当前版本要求两者使用相同位点。')
  }

  const lociOrder = parent1.genotype.loci.map((locus) => locus.locusKey)
  const gametePool1 = buildGametePool(parent1, extraRules)
  const gametePool2 = buildGametePool(parent2, extraRules)
  const zygotes = gametePool1.flatMap((rowGamete) =>
    gametePool2.map((columnGamete) => buildDiploidZygote(rowGamete, columnGamete, lociOrder)),
  )
  const resolvedCells = new Map(
    zygotes.map((zygote) => [zygote.id, resolveZygoteLifecycle(zygote, rules, extraRules)]),
  )
  const grid = gametePool1.map((rowGamete) => ({
    gamete: rowGamete,
    cells: gametePool2.map((columnGamete) => {
      const cell = resolvedCells.get(`${rowGamete.id}-${columnGamete.id}`)
      if (!cell) {
        throw new Error('合子生命周期解析失败。')
      }
      return cell
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
    model: DIPLOID_BIPARENTAL_MODEL,
    parents: { parent1, parent2 },
    gametePools: {
      parent1: gametePool1,
      parent2: gametePool2,
    },
    zygotes,
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
