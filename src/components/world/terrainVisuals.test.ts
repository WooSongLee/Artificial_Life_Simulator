import { describe, expect, it } from 'vitest'
import { DEFAULT_WORLD_CONFIG, TERRAIN_HEIGHTS } from '../../simulation/constants'
import { createEmptyTerrain } from '../../simulation/terrain'
import { sampleTerrainHeight, TERRAIN_PIXELS_PER_CELL, buildTerrainMaps } from './terrainVisuals'

describe('terrain visuals', () => {
  it('blends heights between neighboring cells', () => {
    const terrain = createEmptyTerrain(DEFAULT_WORLD_CONFIG.size, 'grassland')
    const mid = Math.floor(terrain.size / 2)
    terrain.cells[mid * terrain.size + mid] = 'water'
    const center = sampleTerrainHeight(terrain, 0, 0, DEFAULT_WORLD_CONFIG.size)
    const grass = sampleTerrainHeight(terrain, 6, 6, DEFAULT_WORLD_CONFIG.size)
    expect(center).toBeLessThan(grass)
    expect(center).toBeGreaterThan(TERRAIN_HEIGHTS.water - 0.05)
  })

  it('builds a high-resolution surface map from the cell grid', () => {
    const terrain = createEmptyTerrain(32, 'grassland')
    const maps = buildTerrainMaps(terrain, 32)
    expect(maps.albedo.image.width).toBe(terrain.size * TERRAIN_PIXELS_PER_CELL)
    expect(maps.albedo.image.height).toBe(terrain.size * TERRAIN_PIXELS_PER_CELL)
    maps.albedo.dispose()
    maps.surface.dispose()
  })

  it('paints grassland brighter and greener than forest floor', () => {
    const grassland = averageAlbedo(createEmptyTerrain(32, 'grassland'), 32)
    const forest = averageAlbedo(createEmptyTerrain(32, 'forest'), 32)
    expect(grassland.green).toBeGreaterThan(forest.green + 20)
    expect(grassland.green - grassland.red).toBeGreaterThan(forest.green - forest.red)
  })
})

function averageAlbedo(terrain: ReturnType<typeof createEmptyTerrain>, worldSize: number) {
  const maps = buildTerrainMaps(terrain, worldSize)
  const data = maps.albedo.image.data as Uint8Array
  let red = 0
  let green = 0
  let blue = 0
  const pixels = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    red += data[i] ?? 0
    green += data[i + 1] ?? 0
    blue += data[i + 2] ?? 0
  }
  maps.albedo.dispose()
  maps.surface.dispose()
  return { red: red / pixels, green: green / pixels, blue: blue / pixels }
}
