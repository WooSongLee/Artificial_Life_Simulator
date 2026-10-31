import { Agents } from './Agents'
import { AgentTrail } from './AgentTrail'
import { CameraRig } from './CameraRig'
import { FoodSeekPath } from './FoodSeekPath'
import { Terrain } from './Terrain'
import { WorldObjects } from './WorldObjects'

export function WorldScene() {
  return (
    <>
      <color attach="background" args={['#1c2a1e']} />

      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#d7e7ff', '#4a5a32', 0.55]} />
      <directionalLight
        position={[18, 28, 12]}
        intensity={1.35}
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
      <AgentTrail />
      <FoodSeekPath />
      <Agents />
    </>
  )
}
