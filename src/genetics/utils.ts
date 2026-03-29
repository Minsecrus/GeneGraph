import type { GenotypeLocus, RuleClause } from './types'

export function gcd(a: number, b: number): number {
  let x = a
  let y = b
  while (y !== 0) {
    const temp = y
    y = x % y
    x = temp
  }
  return x
}

export function toFraction(probability: number) {
  const precision = 1024
  const numerator = Math.round(probability * precision)
  const denominator = precision
  const divisor = gcd(numerator, denominator)
  return `${numerator / divisor}/${denominator / divisor}`
}

export function assertGeneSymbol(char: string) {
  if (!/^[a-zA-Z]$/.test(char)) {
    throw new Error(`非法字符 "${char}"。当前解析器只接受英文字母等位基因符号。`)
  }
}

export function buildLocusDisplayKey(locusKey: string) {
  return locusKey.toUpperCase()
}

export function compareAlleleSymbols(left: string, right: string) {
  const leftUpper = left === left.toUpperCase()
  const rightUpper = right === right.toUpperCase()

  if (leftUpper !== rightUpper) {
    return leftUpper ? -1 : 1
  }

  return left.localeCompare(right)
}

export function compareGameteLabels(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length)

  for (let index = 0; index < maxLength; index += 1) {
    const leftSymbol = left[index]
    const rightSymbol = right[index]

    if (!leftSymbol) {
      return 1
    }
    if (!rightSymbol) {
      return -1
    }

    const comparison = compareAlleleSymbols(leftSymbol, rightSymbol)
    if (comparison !== 0) {
      return comparison
    }
  }

  return 0
}

export function normalizeLocus(alleles: GenotypeLocus['alleles']): GenotypeLocus {
  const sortedAlleles = [...alleles].sort((left, right) => {
    if (left.isUppercase !== right.isUppercase) {
      return left.isUppercase ? -1 : 1
    }

    return left.symbol.localeCompare(right.symbol)
  }) as GenotypeLocus['alleles']

  return {
    locusKey: alleles[0].locusKey,
    displayKey: buildLocusDisplayKey(alleles[0].locusKey),
    alleles: sortedAlleles,
  }
}

export function genotypeToPattern(loci: GenotypeLocus[]) {
  return loci
    .map((locus) => {
      const hasDominant = locus.alleles.some((allele) => allele.isUppercase)
      const isRecessiveHomozygous = locus.alleles.every((allele) => !allele.isUppercase)

      if (isRecessiveHomozygous) {
        return `${locus.locusKey}${locus.locusKey}`
      }

      if (hasDominant) {
        return `${locus.displayKey}_`
      }

      return locus.alleles.map((allele) => allele.symbol).join('')
    })
    .join('')
}

export function splitPatternIntoClauses(pattern: string): RuleClause[] {
  if (pattern.length % 2 !== 0) {
    throw new Error(`规则模式 "${pattern}" 长度必须为偶数。`)
  }

  const clauses: RuleClause[] = []
  for (let index = 0; index < pattern.length; index += 2) {
    const token = pattern.slice(index, index + 2)
    const locusSymbol = token.replace(/_/g, '')[0] ?? null
    clauses.push({
      locusKey: locusSymbol ? locusSymbol.toLowerCase() : null,
      token,
      index: index / 2,
    })
  }
  return clauses
}

export function normalizeRuleToken(token: string) {
  if (token.length !== 2) {
    return token
  }

  const [left, right] = token
  if (left === '_' || right === '_') {
    return token
  }
  if (left.toLowerCase() !== right.toLowerCase()) {
    return token
  }

  return [left, right].sort((a, b) => compareAlleleSymbols(a, b)).join('')
}

export function matchesToken(expected: string, actual: string) {
  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index] === '_') {
      continue
    }
    if (expected[index] !== actual[index]) {
      return false
    }
  }
  return true
}

export function getLabelGroupKey(label: string) {
  const trimmed = label.trim()
  return trimmed ? ([...trimmed].at(-1) ?? '#') : '#'
}

export function hashText(text: string) {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return hash
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function wrapHue(value: number) {
  const hue = value % 360
  return hue < 0 ? hue + 360 : hue
}

export function buildNormalizedGenotype(loci: GenotypeLocus[]) {
  return loci.map((locus) => locus.alleles.map((allele) => allele.symbol).join('')).join('')
}

export function normalizeOffspringLoci(
  lociOrder: string[],
  allelesByLocus: Map<string, GenotypeLocus['alleles']>,
) {
  return lociOrder.map((locusKey) => {
    const locus = allelesByLocus.get(locusKey)
    if (!locus) {
      throw new Error(`缺少位点 ${locusKey} 的合子信息。`)
    }
    return normalizeLocus(locus)
  })
}
