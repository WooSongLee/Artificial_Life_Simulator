export const TERRAIN_TYPES = ['grassland', 'forest', 'rocky', 'wetland', 'water'] as const

export type TerrainType = (typeof TERRAIN_TYPES)[number]

export const TERRAIN_PRESETS = ['balanced', 'forest', 'rocky', 'wetland', 'lakes'] as const

export type TerrainPreset = (typeof TERRAIN_PRESETS)[number]

export interface TerrainResourceWeights {
  food: number
  tree: number
  rock: number
}

export interface TerrainProfile {
  moveSpeedMultiplier: number
  energyDrainMultiplier: number
  visionMultiplier: number
  concealment: number
  walkable: boolean
  resourceSpawnWeights: TerrainResourceWeights
}

export interface TerrainGrid {
  cellSize: number
  size: number
  cells: TerrainType[]
}

export type TerrainRatioMap = Record<TerrainType, number>
