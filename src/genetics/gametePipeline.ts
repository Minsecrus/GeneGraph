import { applyGameteRules } from './extraRuleEngine'
import type { ExtraRule, ParentState, WeightedGamete } from './types'

export function buildGametePool(
  parent: ParentState,
  extraRules: ExtraRule[] = [],
): WeightedGamete[] {
  const baseGametes = parent.genotype.gametes.map((gamete) => ({
    ...gamete,
    sourceParentId: parent.parentId,
    isViable: true,
    blockedBy: null,
  }))

  return applyGameteRules(baseGametes, extraRules)
}
