import type { GenotypeLocus } from './types'
export {
  clamp,
  genotypeToPattern,
  getLabelGroupKey,
  hashText,
  matchesToken,
  normalizeRuleToken,
  splitPatternIntoClauses,
  wrapHue,
} from './utils'

export function locusToPatternToken(locus: GenotypeLocus) {
  const hasDominant = locus.alleles.some((allele) => allele.isUppercase)
  const isRecessiveHomozygous = locus.alleles.every((allele) => !allele.isUppercase)

  if (isRecessiveHomozygous) {
    return `${locus.locusKey}${locus.locusKey}`
  }
  if (hasDominant) {
    return `${locus.displayKey}_`
  }
  return locus.alleles.map((allele) => allele.symbol).join('')
}
