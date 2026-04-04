import { parseGenotype } from './parser'
import type { ParentState, SexState } from './types'

function createDefaultSexState(): SexState {
  return {
    chromosomalSex: null,
    developmentalSex: null,
    phenotypicSex: null,
    gameteRole: 'gamete',
    reversalApplied: false,
  }
}

export function buildParentState(
  parentId: ParentState['parentId'],
  input: string,
): ParentState {
  return {
    parentId,
    genotype: parseGenotype(input),
    ploidy: 'diploid',
    sex: createDefaultSexState(),
    traits: [],
  }
}
