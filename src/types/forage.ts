export const FORAGE_KINDS = ['berry_bush', 'root_patch'] as const
export type ForageKind = (typeof FORAGE_KINDS)[number]

export const TOOL_TYPES = ['basket', 'digging_stick', 'spear', 'shield'] as const
export type ToolType = (typeof TOOL_TYPES)[number]

export const TOOL_LABELS: Record<ToolType, string> = {
  basket: 'Basket',
  digging_stick: 'Digging Stick',
  spear: 'Spear',
  shield: 'Shield',
}

export interface ForageNode {
  id: string
  kind: ForageKind
  position: { x: number; y: number; z: number }
  scale: number
  rotation: number
  quantity: number
  maxQuantity: number
}

export interface WorldTool {
  id: string
  toolType: ToolType
  position: { x: number; y: number; z: number }
  scale: number
  rotation: number
  durability: number
  maxDurability: number
}

export interface EquippedTool {
  toolType: ToolType
  durability: number
  maxDurability: number
}
