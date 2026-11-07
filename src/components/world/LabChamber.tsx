import { LAB_ARENA } from '../../simulation/interactables'

const WALL_H = 2.55
const WALL_T = 0.18
const WALL_COLOR = '#3a4554'
const WALL_TRIM = '#2a323e'
const FLOOR_VEST = '#2a3038'
const FLOOR_SURV = '#3a3228'
const FLOOR_REST = '#2a343c'
const FLOOR_LOOK = '#243044'

function Wall({
  x,
  z,
  w,
  d,
  y = WALL_H * 0.5,
  color = WALL_COLOR,
}: {
  x: number
  z: number
  w: number
  d: number
  y?: number
  color?: string
}) {
  return (
    <mesh position={[x, y, z]} castShadow receiveShadow>
      <boxGeometry args={[w, WALL_H, d]} />
      <meshStandardMaterial color={color} roughness={0.92} />
    </mesh>
  )
}

function ChamberFloor({
  x,
  z,
  w,
  d,
  color,
}: {
  x: number
  z: number
  w: number
  d: number
  color: string
}) {
  return (
    <mesh position={[x, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  )
}

function GateOpeningCue({ x, z, labelColor }: { x: number; z: number; labelColor: string }) {
  return (
    <mesh position={[x, 0.035, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.55, 0.72, 20]} />
      <meshBasicMaterial color={labelColor} transparent opacity={0.35} depthWrite={false} />
    </mesh>
  )
}

/**
 * Procedural Lab architecture: vestibule + survival / rest / lookout chambers.
 * Gate gaps leave space for door/box interactables.
 */
export function LabChamberShell() {
  const outerHalfX = 8.2
  const outerHalfZN = 3.2
  const outerHalfZP = 8.0

  return (
    <group>
      {/* Chamber floors */}
      <ChamberFloor x={0} z={0} w={5.2} d={5.0} color={FLOOR_VEST} />
      <ChamberFloor
        x={LAB_ARENA.survival.x}
        z={LAB_ARENA.survival.z}
        w={5.4}
        d={4.6}
        color={FLOOR_SURV}
      />
      <ChamberFloor x={LAB_ARENA.rest.x} z={LAB_ARENA.rest.z} w={4.8} d={5.2} color={FLOOR_REST} />
      <ChamberFloor
        x={LAB_ARENA.lookout.x}
        z={LAB_ARENA.lookout.z}
        w={4.8}
        d={5.2}
        color={FLOOR_LOOK}
      />

      {/* Outer shell */}
      <Wall x={0} z={outerHalfZP} w={outerHalfX * 2} d={WALL_T} />
      <Wall x={0} z={-outerHalfZN} w={outerHalfX * 2} d={WALL_T} />
      <Wall x={-outerHalfX} z={(outerHalfZP - outerHalfZN) * 0.5} w={WALL_T} d={outerHalfZP + outerHalfZN} />
      <Wall x={outerHalfX} z={(outerHalfZP - outerHalfZN) * 0.5} w={WALL_T} d={outerHalfZP + outerHalfZN} />

      {/* Survival chamber side walls (+Z), gap at survivalGate */}
      <Wall x={-2.7} z={4.0} w={WALL_T} d={3.8} color={WALL_TRIM} />
      <Wall x={2.7} z={4.0} w={WALL_T} d={3.8} color={WALL_TRIM} />
      {/* Survival back wall segments with center food-station recess */}
      <Wall x={-2.0} z={7.55} w={3.2} d={WALL_T} color={WALL_TRIM} />
      <Wall x={2.0} z={7.55} w={3.2} d={WALL_T} color={WALL_TRIM} />

      {/* Dividers vestibule ↔ survival (gap at gate x≈0) */}
      <Wall x={-1.85} z={LAB_ARENA.survivalGate.z} w={2.0} d={WALL_T} />
      <Wall x={1.85} z={LAB_ARENA.survivalGate.z} w={2.0} d={WALL_T} />

      {/* Dividers vestibule ↔ rest (gap at restGate; door fills it) */}
      <Wall x={LAB_ARENA.restGate.x} z={1.85} w={WALL_T} d={2.0} />
      <Wall x={LAB_ARENA.restGate.x} z={-1.85} w={WALL_T} d={2.0} />
      {/* Rest chamber rear / side */}
      <Wall x={-7.55} z={0} w={WALL_T} d={5.4} color={WALL_TRIM} />
      <Wall x={-5.2} z={2.55} w={4.4} d={WALL_T} color={WALL_TRIM} />
      <Wall x={-5.2} z={-2.55} w={4.4} d={WALL_T} color={WALL_TRIM} />

      {/* Dividers vestibule ↔ lookout */}
      <Wall x={LAB_ARENA.lookoutGate.x} z={1.85} w={WALL_T} d={2.0} />
      <Wall x={LAB_ARENA.lookoutGate.x} z={-1.85} w={WALL_T} d={2.0} />
      <Wall x={7.55} z={0} w={WALL_T} d={5.4} color={WALL_TRIM} />
      <Wall x={5.2} z={2.55} w={4.4} d={WALL_T} color={WALL_TRIM} />
      <Wall x={5.2} z={-2.55} w={4.4} d={WALL_T} color={WALL_TRIM} />

      {/* Ceiling light strips (read as lab, not forest) */}
      <mesh position={[0, WALL_H - 0.08, 0]}>
        <boxGeometry args={[3.2, 0.06, 0.28]} />
        <meshStandardMaterial
          color="#d8e4f0"
          emissive="#a8c0d8"
          emissiveIntensity={0.55}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[LAB_ARENA.survival.x, WALL_H - 0.08, LAB_ARENA.survival.z]}>
        <boxGeometry args={[2.4, 0.06, 0.22]} />
        <meshStandardMaterial
          color="#ffe8c8"
          emissive="#ffc888"
          emissiveIntensity={0.5}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[LAB_ARENA.rest.x, WALL_H - 0.08, LAB_ARENA.rest.z]}>
        <boxGeometry args={[2.2, 0.06, 0.22]} />
        <meshStandardMaterial
          color="#e8d8c0"
          emissive="#c8a878"
          emissiveIntensity={0.4}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[LAB_ARENA.lookout.x, WALL_H - 0.08, LAB_ARENA.lookout.z]}>
        <boxGeometry args={[2.2, 0.06, 0.22]} />
        <meshStandardMaterial
          color="#c8d8f0"
          emissive="#7898c8"
          emissiveIntensity={0.55}
          roughness={0.4}
        />
      </mesh>

      <GateOpeningCue x={LAB_ARENA.survivalGate.x} z={LAB_ARENA.survivalGate.z} labelColor="#e8b070" />
      <GateOpeningCue x={LAB_ARENA.restGate.x} z={LAB_ARENA.restGate.z} labelColor="#8ab8c8" />
      <GateOpeningCue x={LAB_ARENA.lookoutGate.x} z={LAB_ARENA.lookoutGate.z} labelColor="#90b0e0" />

      {/* Survival food station (shelf + table) — food markers sit on top */}
      <group position={[LAB_ARENA.survival.x, 0, LAB_ARENA.survival.z]}>
        <mesh position={[0, 0.42, 0.35]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 0.1, 0.85]} />
          <meshStandardMaterial color="#5a4a38" roughness={0.88} />
        </mesh>
        {(
          [
            [-1.1, 0.05],
            [1.1, 0.05],
            [-1.1, 0.65],
            [1.1, 0.65],
          ] as const
        ).map(([x, z]) => (
          <mesh key={`${x},${z}`} position={[x, 0.2, z]} castShadow>
            <boxGeometry args={[0.1, 0.4, 0.1]} />
            <meshStandardMaterial color="#3a3028" roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 0.95, 0.85]} castShadow receiveShadow>
          <boxGeometry args={[2.8, 0.08, 0.35]} />
          <meshStandardMaterial color="#4a4034" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.55, 0.95]} castShadow>
          <boxGeometry args={[2.7, 0.7, 0.12]} />
          <meshStandardMaterial color="#3a3630" roughness={0.9} />
        </mesh>
      </group>
    </group>
  )
}
