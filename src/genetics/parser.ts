import type { Gamete, GenotypeLocus, LocusAllele, ParsedGenotype, SexChromosomeCopy } from './types'
import {
  assertGeneSymbol,
  buildFullGenotypeLabel,
  compareGameteLabels,
  normalizeLocus,
  toFraction,
} from './utils'

function buildAllele(locusKey: string, symbol: string): LocusAllele {
  return {
    locusKey,
    symbol,
    normalizedSymbol: symbol.toUpperCase(),
    isUppercase: symbol === symbol.toUpperCase(),
  }
}

function parseAutosomeToken(token: string): GenotypeLocus {
  if (!/^[A-Za-z]+$/.test(token)) {
    throw new Error(`常染色体位点 "${token}" 只能包含英文字母。`)
  }

  const locusKey = token[0].toLowerCase()
  for (const symbol of token) {
    assertGeneSymbol(symbol)
    if (symbol.toLowerCase() !== locusKey) {
      throw new Error(`位点 "${token}" 内部必须属于同一基因座。`)
    }
  }

  if (token.length > 3) {
    throw new Error(`位点 "${token}" 当前只支持单体、二体或三体。`)
  }

  return normalizeLocus(token.split('').map((symbol) => buildAllele(locusKey, symbol)))
}

function parseSexChromosomes(input: string): SexChromosomeCopy[] {
  const compact = input.replace(/\s+/g, '')
  if (!compact) {
    return []
  }

  const copies: SexChromosomeCopy[] = []
  let index = 0
  while (index < compact.length) {
    const chromosome = compact[index] as SexChromosomeCopy['chromosome']
    if (!['X', 'Y', 'Z', 'W'].includes(chromosome)) {
      throw new Error(`性染色体片段 "${compact.slice(index)}" 无法解析。`)
    }
    index += 1

    let genes: SexChromosomeCopy['genes'] = []
    let raw: string = chromosome
    if (compact[index] === '(') {
      const closeIndex = compact.indexOf(')', index)
      if (closeIndex === -1) {
        throw new Error('性染色体位点缺少右括号。')
      }
      const genePart = compact.slice(index + 1, closeIndex)
      if (!genePart || !/^[A-Za-z]+$/.test(genePart)) {
        throw new Error(`性染色体位点 "${genePart}" 无效。`)
      }
      genes = genePart.split('').map((symbol) => ({
        locusKey: symbol.toLowerCase(),
        symbol,
      }))
      raw = `${chromosome}(${genePart})`
      index = closeIndex + 1
    }

    copies.push({ chromosome, genes, raw })
  }

  return copies
}

function buildLocusGameteStates(locus: GenotypeLocus) {
  const states = new Map<string, { symbols: string[]; probability: number }>()
  const symbols = locus.alleles.map((allele) => allele.symbol)

  if (symbols.length === 1) {
    states.set(symbols[0], { symbols: [symbols[0]], probability: 1 })
  } else if (symbols.length === 2) {
    for (const symbol of symbols) {
      const existing = states.get(symbol)
      if (existing) {
        existing.probability += 1 / 2
      } else {
        states.set(symbol, { symbols: [symbol], probability: 1 / 2 })
      }
    }
  } else if (symbols.length === 3) {
    for (let index = 0; index < symbols.length; index += 1) {
      const single = symbols[index]
      const pairSymbols = symbols.filter((_, candidate) => candidate !== index)
      const pairLabel = pairSymbols.join('')

      const singleState = states.get(single)
      if (singleState) {
        singleState.probability += 1 / 6
      } else {
        states.set(single, { symbols: [single], probability: 1 / 6 })
      }

      const pairState = states.get(pairLabel)
      if (pairState) {
        pairState.probability += 1 / 6
      } else {
        states.set(pairLabel, { symbols: pairSymbols, probability: 1 / 6 })
      }
    }
  } else {
    throw new Error(`位点 ${locus.displayKey} 当前只支持单体、二体或三体。`)
  }

  return [...states.entries()].map(([label, state]) => ({
    label,
    alleles: state.symbols.map((symbol) => ({ locusKey: locus.locusKey, symbol })),
    probability: state.probability,
  }))
}

function buildSexChromosomeGameteStates(copies: SexChromosomeCopy[]) {
  if (copies.length === 0) {
    return [{ label: '', sexChromosomes: [] as string[], alleles: [] as Gamete['alleles'], probability: 1 }]
  }

  const states = new Map<string, { sexChromosomes: string[]; alleles: Gamete['alleles']; probability: number }>()
  for (const copy of copies) {
    const alleles = copy.genes.map((gene) => ({ locusKey: gene.locusKey, symbol: gene.symbol }))
    const existing = states.get(copy.raw)
    if (existing) {
      existing.probability += 1 / copies.length
    } else {
      states.set(copy.raw, {
        sexChromosomes: [copy.raw],
        alleles,
        probability: 1 / copies.length,
      })
    }
  }

  return [...states.entries()].map(([label, state]) => ({
    label,
    sexChromosomes: state.sexChromosomes,
    alleles: state.alleles,
    probability: state.probability,
  }))
}

export function parseGenotype(input: string): ParsedGenotype {
  const [autosomePartRaw, sexPartRaw = ''] = input.split(';')
  const autosomeTokens = autosomePartRaw
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)

  if (autosomeTokens.length === 0 && !sexPartRaw.trim()) {
    throw new Error('基因型不能为空。')
  }

  const loci = autosomeTokens.map(parseAutosomeToken)
  loci.sort((left, right) => left.displayKey.localeCompare(right.displayKey))

  const sexChromosomes = parseSexChromosomes(sexPartRaw)
  const normalized = buildFullGenotypeLabel(
    loci,
    sexChromosomes.map((copy) => copy.raw),
  )

  return {
    input,
    normalized,
    loci,
    sexChromosomes,
    gametes: generateGametes({ loci, sexChromosomes }),
  }
}

export function generateGametes(parsed: Pick<ParsedGenotype, 'loci' | 'sexChromosomes'>): Gamete[] {
  const autosomeLoci = parsed.loci.filter(
    (locus, index, source) =>
      source.findIndex((candidate) => candidate.locusKey === locus.locusKey) === index,
  )
  const locusStates = autosomeLoci.map(buildLocusGameteStates)
  const sexStates = buildSexChromosomeGameteStates(parsed.sexChromosomes)

  const combinations = locusStates.reduce<
    Array<{ labelParts: string[]; alleles: Gamete['alleles']; probability: number }>
  >(
    (accumulator, states) =>
      accumulator.flatMap((partial) =>
        states.map((state) => ({
          labelParts: [...partial.labelParts, state.label],
          alleles: [...partial.alleles, ...state.alleles],
          probability: partial.probability * state.probability,
        })),
      ),
    [{ labelParts: [], alleles: [], probability: 1 }],
  )

  const withSex = combinations.flatMap((partial) =>
    sexStates.map((sexState) => ({
      label: [...partial.labelParts, ...sexState.sexChromosomes].join(''),
      alleles: [...partial.alleles, ...sexState.alleles],
      sexChromosomes: sexState.sexChromosomes,
      probability: partial.probability * sexState.probability,
    })),
  )

  const counts = new Map<string, { alleles: Gamete['alleles']; sexChromosomes: string[]; probability: number }>()
  for (const state of withSex) {
    const existing = counts.get(state.label)
    if (existing) {
      existing.probability += state.probability
    } else {
      counts.set(state.label, {
        alleles: state.alleles,
        sexChromosomes: state.sexChromosomes,
        probability: state.probability,
      })
    }
  }

  return [...counts.entries()]
    .map(([label, item]) => ({
      id: label || '∅',
      label: label || '∅',
      alleles: item.alleles,
      sexChromosomes: item.sexChromosomes,
      probability: item.probability,
      probabilityText: toFraction(item.probability),
    }))
    .sort((left, right) => compareGameteLabels(left.label, right.label))
}
