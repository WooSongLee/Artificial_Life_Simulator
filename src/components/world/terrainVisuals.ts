import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three'
import { TERRAIN_COLORS, TERRAIN_HEIGHTS } from '../../simulation/constants'
import { cellIndex, getTerrainTypeAt } from '../../simulation/terrain'
import type { TerrainGrid, TerrainType } from '../../types/terrain'
import { clamp } from '../../utils/math'

export const TERRAIN_PIXELS_PER_CELL = 16
export const TERRAIN_HEIGHT_SEGMENTS_PER_CELL = 3

export function sampleTerrainHeight(terrain: TerrainGrid, x: number, z: number, worldSize: number): number {
  const fx = (x + worldSize * 0.5) / terrain.cellSize - 0.5
  const fz = (z + worldSize * 0.5) / terrain.cellSize - 0.5
  const col0 = Math.floor(fx)
  const row0 = Math.floor(fz)
  const tx = smoothstep(fx - col0)
  const tz = smoothstep(fz - row0)
  const h00 = cellBaseHeight(terrain, col0, row0)
  const h10 = cellBaseHeight(terrain, col0 + 1, row0)
  const h01 = cellBaseHeight(terrain, col0, row0 + 1)
  const h11 = cellBaseHeight(terrain, col0 + 1, row0 + 1)
  const blended = mix(mix(h00, h10, tx), mix(h01, h11, tx), tz)
  const type = getTerrainTypeAt(terrain, x, z, worldSize)
  const micro = (fbm(x * 2.3, z * 2.3) - 0.5) * microScale(type)
  return blended + micro
}

export function createTerrainVisuals(terrain: TerrainGrid, worldSize: number) {
  const geometry = buildTerrainGeometry(terrain, worldSize)
  const maps = buildTerrainMaps(terrain, worldSize)

  return {
    geometry,
    albedo: maps.albedo,
    surface: maps.surface,
    dispose() {
      geometry.dispose()
      maps.albedo.dispose()
      maps.surface.dispose()
    },
  }
}

export function buildTerrainGeometry(terrain: TerrainGrid, worldSize: number): PlaneGeometry {
  const segments = terrain.size * TERRAIN_HEIGHT_SEGMENTS_PER_CELL
  const geometry = new PlaneGeometry(worldSize, worldSize, segments, segments)
  const position = geometry.getAttribute('position')

  for (let i = 0; i < position.count; i += 1) {
    const worldX = position.getX(i)
    const worldZ = -position.getY(i)
    position.setZ(i, sampleTerrainHeight(terrain, worldX, worldZ, worldSize))
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

export function buildTerrainMaps(terrain: TerrainGrid, worldSize: number): {
  albedo: DataTexture
  surface: DataTexture
} {
  const size = terrain.size * TERRAIN_PIXELS_PER_CELL
  const albedoData = new Uint8Array(size * size * 4)
  const surfaceData = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      const worldX = (u - 0.5) * worldSize
      const worldZ = (0.5 - v) * worldSize
      const warped = warpedPoint(worldX, worldZ, terrain.cellSize)
      const type = getTerrainTypeAt(terrain, warped.x, warped.z, worldSize)
      const rawType = getTerrainTypeAt(terrain, worldX, worldZ, worldSize)
      const color = surfaceColor(type, rawType, worldX, worldZ, terrain, worldSize)
      const finish = surfaceFinish(type, rawType, worldX, worldZ)
      const index = (y * size + x) * 4
      albedoData[index] = color[0]
      albedoData[index + 1] = color[1]
      albedoData[index + 2] = color[2]
      albedoData[index + 3] = 255
      surfaceData[index] = 255
      surfaceData[index + 1] = finish.roughness
      surfaceData[index + 2] = finish.metalness
      surfaceData[index + 3] = 255
    }
  }

  return {
    albedo: makeDataTexture(albedoData, size, true),
    surface: makeDataTexture(surfaceData, size, false),
  }
}

function surfaceColor(
  type: TerrainType,
  rawType: TerrainType,
  x: number,
  z: number,
  terrain: TerrainGrid,
  worldSize: number,
): [number, number, number] {
  const n = fbm(x * 1.6, z * 1.6)
  const detail = fbm(x * 5.1 + 9, z * 5.1 + 4)
  let color = baseSurfaceColor(type, x, z, n, detail)

  if (type !== 'water' && rawType === 'water') {
    color = mixRgb(color, hexToRgb('#2f5d68'), 0.45)
  }
  if (type === 'water' && rawType !== 'water') {
    color = mixRgb(hexToRgb('#8bb8a4'), hexToRgb('#d5e4c8'), 0.35 + detail * 0.3)
  }
  if (nearWater(terrain, x, z, worldSize) && type !== 'water') {
    color = mixRgb(color, hexToRgb('#3f6a4e'), 0.22)
  }

  return color
}

function baseSurfaceColor(
  type: TerrainType,
  x: number,
  z: number,
  n: number,
  detail: number,
): [number, number, number] {
  if (type === 'grassland') {
    const clump = fbm(x * 0.42, z * 0.42)
    const grain = fbm(x * 7.4, z * 7.4)
    if (detail > 0.93) return mixRgb(hexToRgb('#7d6e46'), hexToRgb('#5c5638'), n)
    const shade = mixRgb(hexToRgb('#5f8c3c'), hexToRgb(TERRAIN_COLORS.grassland), 0.5 + clump * 0.4)
    return mixRgb(shade, hexToRgb('#9cbc5e'), grain * 0.2 + n * 0.08)
  }
  if (type === 'forest') {
    const litter = fbm(x * 2.4 + 11, z * 2.4 + 6)
    if (detail > 0.68) return mixRgb(hexToRgb('#4a3822'), hexToRgb('#2c2216'), n)
    const shade = mixRgb(hexToRgb('#242016'), hexToRgb(TERRAIN_COLORS.forest), 0.28 + n * 0.28)
    return mixRgb(shade, hexToRgb('#5a4a2c'), litter * 0.32)
  }
  if (type === 'rocky') {
    const stone = voronoi(x * 1.35, z * 1.35)
    if (stone < 0.08) return mixRgb(hexToRgb('#3d3832'), hexToRgb('#2a2622'), detail)
    return mixRgb(hexToRgb('#6d6356'), hexToRgb(TERRAIN_COLORS.rocky), 0.35 + stone * 0.5)
  }
  if (type === 'wetland') {
    const grain = fbm(x * 6.2, z * 6.2)
    if (n < 0.32) return mixRgb(hexToRgb('#2c4538'), hexToRgb('#1f332c'), detail)
    const mud = mixRgb(hexToRgb('#3a5344'), hexToRgb(TERRAIN_COLORS.wetland), 0.45 + n * 0.3)
    return mixRgb(mud, hexToRgb('#5f7a48'), grain * 0.22)
  }

  const deep = mixRgb(hexToRgb('#1a3f58'), hexToRgb(TERRAIN_COLORS.water), 0.4 + n * 0.35)
  return mixRgb(deep, hexToRgb('#7ec0c8'), detail * 0.35)
}

function surfaceFinish(
  type: TerrainType,
  rawType: TerrainType,
  x: number,
  z: number,
): { roughness: number; metalness: number } {
  const n = fbm(x * 3.2, z * 3.2)
  if (type === 'water' || rawType === 'water') {
    return { roughness: 28 + n * 22, metalness: 36 + n * 18 }
  }
  if (type === 'wetland') {
    return { roughness: 92 + n * 28, metalness: 10 + n * 8 }
  }
  if (type === 'rocky') {
    return { roughness: 200 + n * 40, metalness: 6 }
  }
  return { roughness: 220 + n * 25, metalness: 0 }
}

function nearWater(terrain: TerrainGrid, x: number, z: number, worldSize: number): boolean {
  const offsets = [
    [terrain.cellSize * 0.55, 0],
    [-terrain.cellSize * 0.55, 0],
    [0, terrain.cellSize * 0.55],
    [0, -terrain.cellSize * 0.55],
  ] as const
  return offsets.some(
    ([dx, dz]) => getTerrainTypeAt(terrain, x + dx, z + dz, worldSize) === 'water',
  )
}

function cellType(terrain: TerrainGrid, col: number, row: number): TerrainType {
  const nextCol = clamp(col, 0, terrain.size - 1)
  const nextRow = clamp(row, 0, terrain.size - 1)
  return terrain.cells[cellIndex(nextCol, nextRow, terrain.size)] ?? 'grassland'
}

function cellBaseHeight(terrain: TerrainGrid, col: number, row: number): number {
  const nextCol = clamp(col, 0, terrain.size - 1)
  const nextRow = clamp(row, 0, terrain.size - 1)
  const type = cellType(terrain, nextCol, nextRow)
  const jitter = hash2(nextCol + 0.3, nextRow + 0.7)
  if (type === 'rocky') return TERRAIN_HEIGHTS.rocky + jitter * 0.07
  if (type === 'forest') return TERRAIN_HEIGHTS.forest + jitter * 0.028
  if (type === 'grassland') return TERRAIN_HEIGHTS.grassland + jitter * 0.014
  if (type === 'wetland') return TERRAIN_HEIGHTS.wetland + jitter * 0.018
  return TERRAIN_HEIGHTS.water
}

function microScale(type: TerrainType): number {
  if (type === 'rocky') return 0.05
  if (type === 'water') return 0.006
  if (type === 'forest') return 0.024
  return 0.018
}

function warpedPoint(x: number, z: number, cellSize: number): { x: number; z: number } {
  const coarse = cellSize * 0.82
  const fine = cellSize * 0.34
  return {
    x:
      x +
      (fbm(x * 0.34, z * 0.34) - 0.5) * coarse +
      (fbm(x * 0.95 + 8, z * 0.95 + 5) - 0.5) * fine,
    z:
      z +
      (fbm(x * 0.34 + 21, z * 0.34 + 16) - 0.5) * coarse +
      (fbm(x * 0.95 + 29, z * 0.95 + 12) - 0.5) * fine,
  }
}

function makeDataTexture(data: Uint8Array, size: number, color: boolean): DataTexture {
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = color ? SRGBColorSpace : LinearSRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function hexToRgb(color: string): [number, number, number] {
  const value = Number.parseInt(color.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  const amount = clamp(t, 0, 1)
  return [
    Math.round(mix(a[0], b[0], amount)),
    Math.round(mix(a[1], b[1], amount)),
    Math.round(mix(a[2], b[2], amount)),
  ]
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

function hash2(x: number, y: number): number {
  const value = Math.imul(Math.floor(x * 1024) + 1, 374761393) ^ Math.imul(Math.floor(y * 1024) + 1, 668265263)
  return ((value >>> 0) % 10_000) / 10_000
}

function valueNoise(x: number, z: number): number {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const tx = smoothstep(x - x0)
  const tz = smoothstep(z - z0)
  return mix(mix(hash2(x0, z0), hash2(x0 + 1, z0), tx), mix(hash2(x0, z0 + 1), hash2(x0 + 1, z0 + 1), tx), tz)
}

function fbm(x: number, z: number): number {
  return valueNoise(x, z) * 0.5 + valueNoise(x * 2.13, z * 2.13) * 0.32 + valueNoise(x * 4.27, z * 4.27) * 0.18
}

function voronoi(x: number, z: number): number {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  let minDist = 8
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const px = xi + dx + hash2(xi + dx, zi + dz)
      const pz = zi + dz + hash2(xi + dx + 8, zi + dz + 3)
      const distX = x - px
      const distZ = z - pz
      minDist = Math.min(minDist, distX * distX + distZ * distZ)
    }
  }
  return Math.sqrt(minDist)
}

