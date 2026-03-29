import type { Gamete, LocusAllele, ParsedGenotype } from './types'
import {
  assertGeneSymbol,
  compareGameteLabels,
  normalizeLocus,
  buildNormalizedGenotype,
  toFraction,
} from './utils'

export function parseGenotype(input: string): ParsedGenotype {
  const compact = input.replace(/\s+/g, '')
  if (compact.length === 0) {
    throw new Error('基因型不能为空。')
  }
  if (compact.length % 2 !== 0) {
    throw new Error('基因型长度必须为偶数，确保每个位点都有两个等位基因。')
  }

  const loci = []
  const seenKeys = new Set<string>()

  for (let index = 0; index < compact.length; index += 2) {
    const first = compact[index]
    const second = compact[index + 1]
    assertGeneSymbol(first)
    assertGeneSymbol(second)

    const locusKey = first.toLowerCase()
    if (second.toLowerCase() !== locusKey) {
      throw new Error(`位点不成对: "${first}${second}" 不是同一基因座。`)
    }
    if (seenKeys.has(locusKey)) {
      throw new Error(`位点 ${locusKey.toUpperCase()} 重复出现。请将每个位点只写一次。`)
    }
    seenKeys.add(locusKey)

    const alleles = [first, second].map((symbol) => ({
      locusKey,
      symbol,
      normalizedSymbol: symbol.toUpperCase(),
      isUppercase: symbol === symbol.toUpperCase(),
    })) as [LocusAllele, LocusAllele]

    loci.push(normalizeLocus(alleles))
  }

  loci.sort((left, right) => left.displayKey.localeCompare(right.displayKey))

  return {
    input,
    normalized: buildNormalizedGenotype(loci),
    loci,
    gametes: generateGametes(loci),
  }
}

export function generateGametes(loci: ParsedGenotype['loci']): Gamete[] {
  const combinations = loci.reduce<Array<Array<{ locusKey: string; symbol: string }>>>(
    (accumulator, locus) => {
      const choices = locus.alleles.map((allele) => ({
        locusKey: locus.locusKey,
        symbol: allele.symbol,
      }))

      return accumulator.flatMap((partial) => choices.map((choice) => [...partial, choice]))
    },
    [[]],
  )

  const counts = new Map<string, { alleles: Gamete['alleles']; count: number }>()
  for (const combination of combinations) {
    const label = combination.map((allele) => allele.symbol).join('')
    const existing = counts.get(label)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(label, { alleles: combination, count: 1 })
    }
  }

  const total = combinations.length

  return [...counts.entries()]
    .map(([label, item]) => ({
      id: label,
      label,
      alleles: item.alleles,
      probability: item.count / total,
      probabilityText: toFraction(item.count / total),
    }))
    .sort((left, right) => compareGameteLabels(left.label, right.label))
}
