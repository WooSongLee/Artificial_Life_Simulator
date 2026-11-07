import { SoftShadows } from '@react-three/drei'
import { useShallow } from 'zustand/react/shallow'
import { LAB_ARENA } from '../../simulation/interactables'
import { isHumanBehaviorLab } from '../../simulation/labMode'
import { useSimulationStore } from '../../store/useSimulationStore'
import { Agents } from './Agents'
import { AgentTrail } from './AgentTrail'
import { CameraRig } from './CameraRig'
import { FoodSeekPath } from './FoodSeekPath'
import { LabChamberShell } from './LabChamber'
import { Terrain } from './Terrain'
import { CombatCues } from './CombatCues'
import { ForageAndTools } from './ForageAndTools'
import { Interactables } from './Interactables'
import { WorldObjects } from './WorldObjects'

/** Lab base slab under the chamber shell. */
function LabFloor() {
  const size = useSimulationStore((state) => state.world.config.size)
  const divisions = useSimulationStore((state) => state.world.config.gridDivisions)
  const showGrid = useSimulationStore((state) => state.settings.showGrid)
  const selectObject = useSimulationStore((state) => state.selectObject)

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#12151a" roughness={1} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={() => selectObject(null)}
      >
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#2e323c" roughness={0.94} metalness={0.04} />
      </mesh>
      <LabChamberShell />
      {showGrid ? (
        <gridHelper args={[size, divisions, '#5a6470', '#262a32']} position={[0, 0.02, 0]} />
      ) : null}
    </group>
  )
}

/** Lab food as shelf packs / plates — Ecology still uses WorldObjects. */
function LabFood() {
  const foodIds = useSimulationStore(
    useShallow((state) =>
      state.world.objects.filter((object) => object.type === 'food').map((object) => object.id),
    ),
  )

  return (
    <group>
      {foodIds.map((id) => (
        <LabFoodMarker key={id} objectId={id} />
      ))}
    </group>
  )
}

function LabFoodMarker({ objectId }: { objectId: string }) {
  const food = useSimulationStore((state) => state.world.objects.find((object) => object.id === objectId))
  if (!food || food.type !== 'food') return null

  const shelfY = 0.52
  return (
    <group position={[food.position.x, 0, food.position.z]} scale={food.scale}>
      {/* Tray */}
      <mesh position={[0, shelfY, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.04, 0.32]} />
        <meshStandardMaterial color="#8a8e94" metalness={0.35} roughness={0.45} />
      </mesh>
      {/* Pack / ration brick */}
      <mesh position={[0, shelfY + 0.1, 0]} castShadow>
        <boxGeometry args={[0.28, 0.14, 0.2]} />
        <meshStandardMaterial color="#c45a3a" roughness={0.7} />
      </mesh>
      <mesh position={[0.02, shelfY + 0.2, 0.02]} castShadow>
        <boxGeometry args={[0.16, 0.08, 0.12]} />
        <meshStandardMaterial color="#d4a03a" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 12]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  )
}

function EcologyLights() {
  return (
    <>
      <color attach="background" args={['#1a261c']} />
      <fog attach="fog" args={['#1a261c', 58, 150]} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#e7eef8', '#3d4a28', 0.64]} />
      <directionalLight
        position={[20, 32, 14]}
        intensity={1.72}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
    </>
  )
}

/** Chamber-biased lighting: warm survival, soft rest, cool lookout. */
function LabLights() {
  return (
    <>
      <SoftShadows size={14} samples={18} focus={0.65} />
      <color attach="background" args={['#0c1016']} />
      <fog attach="fog" args={['#0c1016', 16, 42]} />
      <ambientLight intensity={0.28} />
      <hemisphereLight args={['#e8eef6', '#1a2030', 0.42]} />
      <directionalLight
        position={[3.8, 8.2, 4.5]}
        intensity={0.95}
        color="#fff2e4"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00012}
        shadow-normalBias={0.03}
        shadow-camera-near={0.5}
        shadow-camera-far={28}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[-4, 5, -2]} intensity={0.22} color="#9eb0cc" />
      <pointLight
        position={[LAB_ARENA.survival.x, 2.5, LAB_ARENA.survival.z]}
        intensity={0.78}
        distance={9}
        color="#ffd2a0"
      />
      <pointLight
        position={[LAB_ARENA.rest.x, 2.2, LAB_ARENA.rest.z]}
        intensity={0.48}
        distance={7}
        color="#e8c8a0"
      />
      <pointLight
        position={[LAB_ARENA.lookout.x + 0.6, 2.6, LAB_ARENA.lookout.z]}
        intensity={0.7}
        distance={8}
        color="#a8c4f0"
      />
      <pointLight position={[0, 2.4, 0]} intensity={0.35} distance={7} color="#d0d8e4" />
    </>
  )
}

export function WorldScene() {
  const lab = useSimulationStore((state) => isHumanBehaviorLab(state.world.config.mode))

  return (
    <>
      {lab ? <LabLights /> : <EcologyLights />}

      <CameraRig />
      {lab ? <LabFloor /> : <Terrain />}
      {lab ? null : <WorldObjects />}
      {lab ? <LabFood /> : null}
      {lab ? null : <ForageAndTools />}
      <Interactables />
      <AgentTrail />
      {lab ? null : <FoodSeekPath />}
      {lab ? null : <CombatCues />}
      <Agents />
    </>
  )
}
