import type { SimulationStatus } from '../types/simulation'

export const SIMULATION_STATUS_LABEL: Record<SimulationStatus, string> = {
  idle: '대기',
  running: '실행 중',
  paused: '일시정지',
  ended: '종료',
}
