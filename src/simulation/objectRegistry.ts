import type { ObjectDefinition, WorldObjectType } from '../types/world'

export const OBJECT_REGISTRY: Record<WorldObjectType, ObjectDefinition> = {
  tree: {
    type: 'tree',
    label: '나무',
    category: 'environment',
    description: '지형에 고정된 환경 오브젝트. 이후 에이전트의 엄폐 및 탐색 지점으로 사용한다.',
  },
  rock: {
    type: 'rock',
    label: '바위',
    category: 'environment',
    description: '이동을 제한하는 장애물. 이후 경로 탐색과 충돌 처리의 기준이 된다.',
  },
  food: {
    type: 'food',
    label: '먹이',
    category: 'resource',
    description: '소모 가능한 자원. 이후 강화학습 보상과 진화 압력의 원천이 된다.',
  },
}

export const OBJECT_TYPES = Object.keys(OBJECT_REGISTRY) as WorldObjectType[]
