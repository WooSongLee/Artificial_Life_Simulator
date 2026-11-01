import { Agents } from './Agents'
import { AgentTrail } from './AgentTrail'
import { CameraRig } from './CameraRig'
import { FoodSeekPath } from './FoodSeekPath'
import { Terrain } from './Terrain'
import { CombatCues } from './CombatCues'
import { ForageAndTools } from './ForageAndTools'
import { WorldObjects } from './WorldObjects'

export function WorldScene() {
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

      <CameraRig />
      <Terrain />
      <WorldObjects />
      <ForageAndTools />
      <AgentTrail />
      <FoodSeekPath />
      <CombatCues />
      <Agents />
    </>
  )
}
