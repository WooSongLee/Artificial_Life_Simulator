export const COMBAT_CUE_KINDS = ['attack', 'defend', 'flee'] as const
export type CombatCueKind = (typeof COMBAT_CUE_KINDS)[number]

export interface CombatCue {
  kind: CombatCueKind
  targetId: string | null
  x: number
  z: number
}

export interface AttackIntent {
  attackerId: string
  targetId: string
  inRange: boolean
}

export interface CombatHit {
  attackerId: string
  defenderId: string
  rawDamage: number
  damage: number
  reduced: number
  defended: boolean
  usedSpear: boolean
  usedShield: boolean
  attackerDurabilityDelta: number
  defenderDurabilityDelta: number
  died: boolean
}
