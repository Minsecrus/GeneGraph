import type { GenotypeLocus, LocusAllele, WeightedGamete, ZygoteState } from './types'
import {
  buildFullGenotypeLabel,
  normalizeOffspringLoci,
  toFraction,
} from './utils'

function alleleFromGameteEntry(entry: { locusKey: string; symbol: string }): LocusAllele {
  return {
    locusKey: entry.locusKey,
    symbol: entry.symbol,
    normalizedSymbol: entry.symbol.toUpperCase(),
    isUppercase: entry.symbol === entry.symbol.toUpperCase(),
  }
}

export function buildDiploidZygote(
  rowGamete: WeightedGamete,
  columnGamete: WeightedGamete,
  lociOrder: string[],
): ZygoteState {
  const allelesByLocus = new Map<string, GenotypeLocus['alleles']>()

  for (const allele of [...rowGamete.alleles, ...columnGamete.alleles]) {
    const existing = allelesByLocus.get(allele.locusKey) ?? []
    existing.push(alleleFromGameteEntry(allele))
    allelesByLocus.set(allele.locusKey, existing)
  }

  const zygoteSexChromosomes = [...rowGamete.sexChromosomes, ...columnGamete.sexChromosomes]
  const combinedOrder = [
    ...lociOrder,
    ...[...allelesByLocus.keys()].filter((key) => !lociOrder.includes(key)).sort(),
  ]
  const loci = normalizeOffspringLoci(combinedOrder, allelesByLocus)
  const displayLoci = normalizeOffspringLoci(lociOrder, allelesByLocus)
  const probability = rowGamete.probability * columnGamete.probability

  return {
    id: `${rowGamete.id}-${columnGamete.id}`,
    genotype: buildFullGenotypeLabel(displayLoci, zygoteSexChromosomes),
    loci,
    sexChromosomes: zygoteSexChromosomes,
    ploidy: 'diploid',
    origin: {
      maternalGamete: rowGamete,
      paternalGamete: columnGamete,
    },
    probability,
    probabilityText: toFraction(probability),
  }
}
