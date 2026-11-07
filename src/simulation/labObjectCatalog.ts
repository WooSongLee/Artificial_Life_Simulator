/**
 * Life Sandbox object-type catalog (P0–P1).
 * Bridged types mirror InteractableKind; kitchen core types are `runtime` (Env-P1).
 */

import type { LabObjectTypeDefinition, LabWorldLayout } from '../types/labObject'
import { defineAffordance } from './labAffordance'
import { INTERACT_RADIUS } from './interactables'
import { createLabWorldLayout } from './labZones'

const R = INTERACT_RADIUS

function typeDef(
  partial: Omit<LabObjectTypeDefinition, 'discoveryStatus' | 'implementation'> & {
    discoveryStatus?: LabObjectTypeDefinition['discoveryStatus']
    implementation?: LabObjectTypeDefinition['implementation']
  },
): LabObjectTypeDefinition {
  return {
    discoveryStatus: 'unknown',
    implementation: 'catalog_only',
    ...partial,
  }
}

/** ~38 object types across 7 zones. */
export const LAB_OBJECT_TYPE_DEFINITIONS: readonly LabObjectTypeDefinition[] = [
  // ── Bridged legacy interactables ──────────────────────────────────────
  typeDef({
    objectType: 'door',
    label: 'Door',
    category: 'portal',
    defaultZone: 'hallway',
    objectState: { open: false, locked: false, durability: 100 },
    affordances: [
      defineAffordance('open', {
        preconditions: { stateEquals: { open: false, locked: false } },
        effects: { setState: { open: true }, tags: ['door_open'] },
      }),
      defineAffordance('close', {
        preconditions: { stateEquals: { open: true } },
        effects: { setState: { open: false }, tags: ['door_close'] },
      }),
    ],
    stateTransitions: [
      { from: { open: false }, to: { open: true }, via: 'open' },
      { from: { open: true }, to: { open: false }, via: 'close' },
    ],
    durability: 100,
    interactionRange: R,
    objectRelations: [{ role: 'controls', targetType: 'wall_switch' }],
    description: 'Blocks movement when closed. Legacy Interactable door.',
    legacyInteractableKind: 'door',
    implementation: 'bridged_legacy',
  }),
  typeDef({
    objectType: 'wall_switch',
    label: 'Wall Switch',
    category: 'control',
    defaultZone: 'hallway',
    objectState: { powered: false },
    affordances: [
      defineAffordance('toggle', {
        effects: { tags: ['switch_toggle'] },
        label: 'Toggle switch',
      }),
    ],
    stateTransitions: [
      { from: { powered: false }, to: { powered: true }, via: 'toggle' },
      { from: { powered: true }, to: { powered: false }, via: 'toggle' },
    ],
    durability: null,
    interactionRange: R,
    objectRelations: [{ role: 'controls', targetType: 'door' }],
    description: 'Toggles linked door. Legacy Interactable switch → GATHER.',
    legacyInteractableKind: 'switch',
    implementation: 'bridged_legacy',
  }),
  typeDef({
    objectType: 'crate',
    label: 'Movable Crate',
    category: 'container',
    defaultZone: 'workshop',
    objectState: { filled: false, durability: 100 },
    affordances: [
      defineAffordance('move_object', {
        label: 'Push crate',
        effects: { tags: ['box_push'] },
        resourceCost: { energy: 2 },
      }),
      defineAffordance('inspect', { effects: { tags: ['inspect_crate'] } }),
    ],
    stateTransitions: [],
    durability: 100,
    interactionRange: R,
    objectRelations: [],
    description: 'Pushable obstacle. Legacy movable_box → GATHER push.',
    legacyInteractableKind: 'movable_box',
    implementation: 'bridged_legacy',
  }),
  typeDef({
    objectType: 'bed',
    label: 'Bed',
    category: 'furniture',
    defaultZone: 'bedroom',
    objectState: { used: false, cleanliness: 80, durability: 100 },
    affordances: [
      defineAffordance('rest_use', {
        label: 'Lie down',
        effects: {
          needs: { fatigue: -28, comfort: 22 },
          setState: { used: true },
          tags: ['rest_bed'],
        },
        resourceCost: { energy: 4, hunger: 3 },
      }),
      defineAffordance('inspect'),
      defineAffordance('clean', {
        preconditions: { stateMax: { cleanliness: 60 } },
        effects: { setState: { cleanliness: 95 }, tags: ['clean_bed'] },
      }),
    ],
    stateTransitions: [{ from: { used: false }, to: { used: true }, via: 'rest_use' }],
    durability: 100,
    interactionRange: R,
    objectRelations: [],
    description: 'Comfort / fatigue relief. Legacy rest_bed → GATHER.',
    legacyInteractableKind: 'rest_bed',
    implementation: 'bridged_legacy',
  }),
  typeDef({
    objectType: 'lookout_window',
    label: 'Lookout Window',
    category: 'fixture',
    defaultZone: 'workshop',
    objectState: { used: false, open: true },
    affordances: [
      defineAffordance('observe', {
        label: 'Look outside',
        effects: {
          needs: { curiosity: -32 },
          setState: { used: true },
          tags: ['lookout'],
        },
        resourceCost: { energy: 4, hunger: 3 },
      }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [{ from: { used: false }, to: { used: true }, via: 'observe' }],
    durability: null,
    interactionRange: R,
    objectRelations: [],
    description: 'Curiosity affordance. Legacy lookout → GATHER.',
    legacyInteractableKind: 'lookout',
    implementation: 'bridged_legacy',
  }),

  // ── Hallway ───────────────────────────────────────────────────────────
  typeDef({
    objectType: 'entrance_mat',
    label: 'Entrance Mat',
    category: 'decor',
    defaultZone: 'hallway',
    objectState: { cleanliness: 70 },
    affordances: [defineAffordance('inspect'), defineAffordance('clean')],
    stateTransitions: [],
    durability: 80,
    interactionRange: R,
    objectRelations: [],
    description: 'Entry cue; clean when dirty.',
  }),
  typeDef({
    objectType: 'coat_hook',
    label: 'Coat Hook',
    category: 'fixture',
    defaultZone: 'hallway',
    objectState: { filled: false },
    affordances: [
      defineAffordance('store', { label: 'Hang item' }),
      defineAffordance('retrieve', { label: 'Take item' }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [
      { from: { filled: false }, to: { filled: true }, via: 'store' },
      { from: { filled: true }, to: { filled: false }, via: 'retrieve' },
    ],
    durability: null,
    interactionRange: R,
    objectRelations: [{ role: 'contains', targetType: 'jacket' }],
    description: 'Store / retrieve carried clothing.',
  }),
  typeDef({
    objectType: 'jacket',
    label: 'Jacket',
    category: 'tool',
    defaultZone: 'hallway',
    objectState: { durability: 90 },
    affordances: [defineAffordance('pick'), defineAffordance('drop'), defineAffordance('inspect')],
    stateTransitions: [],
    durability: 90,
    interactionRange: R,
    objectRelations: [],
    description: 'Wearable / portable item for store-retrieve chains.',
  }),
  typeDef({
    objectType: 'key_hook',
    label: 'Key Hook',
    category: 'fixture',
    defaultZone: 'hallway',
    objectState: { filled: true },
    affordances: [
      defineAffordance('retrieve', {
        label: 'Take key',
        preconditions: { stateEquals: { filled: true } },
        effects: { setState: { filled: false }, tags: ['key_taken'] },
      }),
      defineAffordance('store', {
        preconditions: { stateEquals: { filled: false }, requiresHeldType: ['house_key'] },
        effects: { setState: { filled: true } },
      }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [
      { from: { filled: true }, to: { filled: false }, via: 'retrieve' },
      { from: { filled: false }, to: { filled: true }, via: 'store' },
    ],
    durability: null,
    interactionRange: R,
    objectRelations: [{ role: 'contains', targetType: 'house_key' }],
    description: 'Key storage for locked-door chains (P2).',
  }),
  typeDef({
    objectType: 'house_key',
    label: 'House Key',
    category: 'tool',
    defaultZone: 'hallway',
    objectState: {},
    affordances: [defineAffordance('pick'), defineAffordance('drop'), defineAffordance('operate')],
    stateTransitions: [],
    durability: null,
    interactionRange: R,
    objectRelations: [{ role: 'controls', targetType: 'door' }],
    description: 'Unlocks doors when held + operate.',
  }),

  // ── Bedroom ───────────────────────────────────────────────────────────
  typeDef({
    objectType: 'nightstand',
    label: 'Nightstand',
    category: 'furniture',
    defaultZone: 'bedroom',
    objectState: { open: false, filled: true },
    affordances: [
      defineAffordance('open'),
      defineAffordance('close'),
      defineAffordance('retrieve', { preconditions: { stateEquals: { open: true } } }),
      defineAffordance('store', { preconditions: { stateEquals: { open: true } } }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [
      { from: { open: false }, to: { open: true }, via: 'open' },
      { from: { open: true }, to: { open: false }, via: 'close' },
    ],
    durability: 100,
    interactionRange: R,
    objectRelations: [{ role: 'contains', targetType: 'book' }],
    description: 'Small container beside the bed.',
  }),
  typeDef({
    objectType: 'wardrobe',
    label: 'Wardrobe',
    category: 'container',
    defaultZone: 'bedroom',
    objectState: { open: false, filled: true },
    affordances: [
      defineAffordance('open'),
      defineAffordance('close'),
      defineAffordance('store', { preconditions: { stateEquals: { open: true } } }),
      defineAffordance('retrieve', { preconditions: { stateEquals: { open: true } } }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [
      { from: { open: false }, to: { open: true }, via: 'open' },
      { from: { open: true }, to: { open: false }, via: 'close' },
    ],
    durability: 100,
    interactionRange: R,
    objectRelations: [{ role: 'contains', targetType: 'jacket' }],
    description: 'Clothing storage; open → retrieve chain.',
  }),
  typeDef({
    objectType: 'desk_lamp',
    label: 'Desk Lamp',
    category: 'appliance',
    defaultZone: 'bedroom',
    objectState: { powered: false },
    affordances: [
      defineAffordance('toggle', { effects: { tags: ['light_toggle'] } }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [
      { from: { powered: false }, to: { powered: true }, via: 'toggle' },
      { from: { powered: true }, to: { powered: false }, via: 'toggle' },
    ],
    durability: 70,
    interactionRange: R,
    objectRelations: [{ role: 'powered_by', targetType: 'wall_switch' }],
    description: 'Local lighting; comfort / visibility cue (P3 env).',
  }),
  typeDef({
    objectType: 'alarm_clock',
    label: 'Alarm Clock',
    category: 'appliance',
    defaultZone: 'bedroom',
    objectState: { powered: true },
    affordances: [defineAffordance('operate'), defineAffordance('inspect'), defineAffordance('wait')],
    stateTransitions: [],
    durability: 60,
    interactionRange: R,
    objectRelations: [],
    description: 'Time cue; wait / operate for schedule habits (P3).',
  }),

  // ── Living Room ───────────────────────────────────────────────────────
  typeDef({
    objectType: 'sofa',
    label: 'Sofa',
    category: 'furniture',
    defaultZone: 'living_room',
    objectState: { used: false, cleanliness: 75 },
    affordances: [
      defineAffordance('rest_use', {
        label: 'Sit',
        effects: { needs: { fatigue: -12, comfort: 14 }, setState: { used: true } },
        resourceCost: { energy: 1 },
      }),
      defineAffordance('inspect'),
      defineAffordance('clean'),
    ],
    stateTransitions: [],
    durability: 100,
    interactionRange: R,
    objectRelations: [],
    description: 'Light rest / comfort without full bed relief.',
  }),
  typeDef({
    objectType: 'coffee_table',
    label: 'Coffee Table',
    category: 'furniture',
    defaultZone: 'living_room',
    objectState: { filled: false, cleanliness: 70 },
    affordances: [
      defineAffordance('store', { label: 'Put down' }),
      defineAffordance('retrieve'),
      defineAffordance('inspect'),
      defineAffordance('clean'),
    ],
    stateTransitions: [],
    durability: 100,
    interactionRange: R,
    objectRelations: [{ role: 'placed_on', targetType: 'book' }],
    description: 'Surface for place / retrieve chains.',
  }),
  typeDef({
    objectType: 'bookshelf',
    label: 'Bookshelf',
    category: 'furniture',
    defaultZone: 'living_room',
    objectState: { filled: true },
    affordances: [
      defineAffordance('retrieve', { label: 'Take book' }),
      defineAffordance('store'),
      defineAffordance('inspect'),
      defineAffordance('observe', {
        label: 'Browse',
        effects: { needs: { curiosity: -10 }, tags: ['browse_books'] },
      }),
    ],
    stateTransitions: [],
    durability: 100,
    interactionRange: R,
    objectRelations: [{ role: 'contains', targetType: 'book' }],
    description: 'Curiosity / competence reading source.',
  }),
  typeDef({
    objectType: 'book',
    label: 'Book',
    category: 'tool',
    defaultZone: 'living_room',
    objectState: {},
    affordances: [
      defineAffordance('pick'),
      defineAffordance('drop'),
      defineAffordance('inspect'),
      defineAffordance('observe', {
        label: 'Read',
        effects: { needs: { curiosity: -18 }, tags: ['read_book'] },
        resourceCost: { timeTicks: 8 },
      }),
    ],
    stateTransitions: [],
    durability: 40,
    interactionRange: R,
    objectRelations: [],
    description: 'Portable knowledge object.',
  }),
  typeDef({
    objectType: 'floor_lamp',
    label: 'Floor Lamp',
    category: 'appliance',
    defaultZone: 'living_room',
    objectState: { powered: false },
    affordances: [defineAffordance('toggle'), defineAffordance('inspect')],
    stateTransitions: [
      { from: { powered: false }, to: { powered: true }, via: 'toggle' },
      { from: { powered: true }, to: { powered: false }, via: 'toggle' },
    ],
    durability: 70,
    interactionRange: R,
    objectRelations: [],
    description: 'Room lighting for day/night comfort (P3).',
  }),
  typeDef({
    objectType: 'tv',
    label: 'Television',
    category: 'appliance',
    defaultZone: 'living_room',
    objectState: { powered: false },
    affordances: [
      defineAffordance('toggle'),
      defineAffordance('operate', { preconditions: { stateEquals: { powered: true } } }),
      defineAffordance('observe', {
        preconditions: { stateEquals: { powered: true } },
        effects: { needs: { curiosity: -8, comfort: 6 }, tags: ['watch_tv'] },
      }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [
      { from: { powered: false }, to: { powered: true }, via: 'toggle' },
      { from: { powered: true }, to: { powered: false }, via: 'toggle' },
    ],
    durability: 55,
    interactionRange: R,
    objectRelations: [],
    description: 'Leisure device; boredom / comfort candidate (needs P4).',
  }),

  // ── Kitchen ───────────────────────────────────────────────────────────
  typeDef({
    objectType: 'refrigerator',
    label: 'Refrigerator',
    category: 'appliance',
    defaultZone: 'kitchen',
    objectState: { open: false, powered: true, filled: true, temperature: 4 },
    affordances: [
      defineAffordance('open', {
        preconditions: { stateEquals: { open: false } },
        effects: { setState: { open: true }, tags: ['fridge_open'] },
      }),
      defineAffordance('close', {
        preconditions: { stateEquals: { open: true } },
        effects: { setState: { open: false }, tags: ['fridge_close'] },
      }),
      defineAffordance('retrieve', {
        label: 'Take food',
        preconditions: { stateEquals: { open: true, filled: true } },
        effects: { setState: { filled: false }, tags: ['fridge_retrieve'] },
      }),
      defineAffordance('store', { preconditions: { stateEquals: { open: true } } }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [
      { from: { open: false }, to: { open: true }, via: 'open' },
      { from: { open: true }, to: { open: false }, via: 'close' },
    ],
    durability: 100,
    interactionRange: R,
    objectRelations: [{ role: 'contains', targetType: 'food_item' }],
    description: 'Core cook chain: open → retrieve → prepare → consume.',
    implementation: 'runtime',
  }),
  typeDef({
    objectType: 'food_item',
    label: 'Food Item',
    category: 'consumable',
    defaultZone: 'kitchen',
    objectState: { freshness: 90, locked: true, used: false },
    affordances: [
      defineAffordance('pick', {
        preconditions: { stateEquals: { locked: false }, stateMin: { freshness: 1 } },
        effects: { tags: ['food_pick'] },
      }),
      defineAffordance('drop', {
        preconditions: { requiresHeldType: ['food_item'] },
        effects: { tags: ['food_drop'] },
      }),
      defineAffordance('consume', {
        preconditions: { stateEquals: { locked: false }, stateMin: { freshness: 1 } },
        effects: {
          needs: { hunger: -35, energy: 12 },
          setState: { freshness: 0 },
          tags: ['eat_food'],
        },
      }),
      defineAffordance('inspect'),
      defineAffordance('prepare', {
        label: 'Prep ingredient',
        preconditions: { stateEquals: { locked: false, used: false }, stateMin: { freshness: 1 } },
        effects: { setState: { used: true }, tags: ['food_prepped'] },
      }),
    ],
    stateTransitions: [{ from: { used: false }, to: { used: true }, via: 'prepare' }],
    effects: { needs: { hunger: -35 } },
    durability: null,
    interactionRange: R,
    objectRelations: [{ role: 'recipe_with', targetType: 'stove' }],
    description: 'Edible; locked while inside refrigerator until retrieve. Pick to hold for cook/table.',
    implementation: 'runtime',
  }),
  typeDef({
    objectType: 'stove',
    label: 'Stove',
    category: 'appliance',
    defaultZone: 'kitchen',
    objectState: { powered: false, open: false, temperature: 20 },
    affordances: [
      defineAffordance('toggle', {
        label: 'Ignite / off',
        effects: { tags: ['stove_toggle'] },
      }),
      defineAffordance('operate', {
        label: 'Cook',
        preconditions: {
          stateEquals: { powered: true },
          requiresHeldType: ['food_item'],
        },
        effects: { setState: { temperature: 180 }, tags: ['cook'] },
        resourceCost: { energy: 6, timeTicks: 12 },
      }),
      defineAffordance('inspect'),
      defineAffordance('clean'),
    ],
    stateTransitions: [
      { from: { powered: false }, to: { powered: true }, via: 'toggle' },
      { from: { powered: true }, to: { powered: false }, via: 'toggle' },
    ],
    durability: 90,
    interactionRange: R,
    objectRelations: [{ role: 'recipe_with', targetType: 'food_item' }],
    description: 'Cook held food (requiresHeldType). Toggle power first.',
    implementation: 'runtime',
  }),
  typeDef({
    objectType: 'sink',
    label: 'Kitchen Sink',
    category: 'fixture',
    defaultZone: 'kitchen',
    objectState: { powered: false, cleanliness: 60 },
    affordances: [
      defineAffordance('toggle', {
        label: 'Water on/off',
        effects: { tags: ['sink_toggle'] },
      }),
      defineAffordance('operate', {
        label: 'Wash',
        preconditions: { stateEquals: { powered: true } },
        effects: { tags: ['wash'] },
      }),
      defineAffordance('clean'),
      defineAffordance('inspect'),
    ],
    stateTransitions: [
      { from: { powered: false }, to: { powered: true }, via: 'toggle' },
      { from: { powered: true }, to: { powered: false }, via: 'toggle' },
    ],
    durability: null,
    interactionRange: R,
    objectRelations: [],
    description: 'Wash tools / hygiene-lite before bathroom exists.',
    implementation: 'runtime',
  }),
  typeDef({
    objectType: 'cutting_board',
    label: 'Cutting Board',
    category: 'tool',
    defaultZone: 'kitchen',
    objectState: { cleanliness: 80 },
    affordances: [
      defineAffordance('prepare', {
        preconditions: { requiresHeldType: ['food_item'] },
        effects: { tags: ['chop'] },
      }),
      defineAffordance('combine', { effects: { tags: ['combine_ingredients'] } }),
      defineAffordance('clean'),
      defineAffordance('inspect'),
    ],
    stateTransitions: [],
    durability: 70,
    interactionRange: R,
    objectRelations: [{ role: 'recipe_with', targetType: 'food_item' }],
    description: 'Prep surface for multi-step cooking.',
  }),
  typeDef({
    objectType: 'water_glass',
    label: 'Water Glass',
    category: 'consumable',
    defaultZone: 'kitchen',
    objectState: { filled: true },
    affordances: [
      defineAffordance('pick'),
      defineAffordance('drop'),
      defineAffordance('consume', {
        label: 'Drink',
        preconditions: { stateEquals: { filled: true } },
        effects: { setState: { filled: false }, tags: ['drink'], needs: { comfort: 4 } },
      }),
      defineAffordance('operate', {
        label: 'Refill',
        preconditions: { stateEquals: { filled: false } },
        effects: { setState: { filled: true } },
      }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [
      { from: { filled: true }, to: { filled: false }, via: 'consume' },
      { from: { filled: false }, to: { filled: true }, via: 'operate' },
    ],
    durability: 30,
    interactionRange: R,
    objectRelations: [],
    description: 'Thirst candidate vessel (need not wired until P4).',
  }),
  typeDef({
    objectType: 'dining_table',
    label: 'Dining Table',
    category: 'furniture',
    defaultZone: 'kitchen',
    objectState: { filled: false, cleanliness: 75 },
    affordances: [
      defineAffordance('store', {
        label: 'Set item',
        preconditions: { requiresHeldType: ['food_item'] },
        effects: { setState: { filled: true }, tags: ['table_set'] },
      }),
      defineAffordance('retrieve', {
        preconditions: { stateEquals: { filled: true } },
        effects: { setState: { filled: false }, tags: ['table_clear'] },
      }),
      defineAffordance('consume', {
        label: 'Eat at table',
        preconditions: { requiresHeldType: ['food_item'] },
        effects: { needs: { hunger: -35, comfort: 6, energy: 12 }, tags: ['eat_at_table'] },
      }),
      defineAffordance('clean', {
        preconditions: { stateEquals: { filled: false } },
        effects: { setState: { cleanliness: 100 }, tags: ['table_clean'] },
      }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [],
    durability: 100,
    interactionRange: R,
    objectRelations: [{ role: 'placed_on', targetType: 'food_item' }],
    description: 'Consume held food with comfort bonus vs raw ground eat.',
    implementation: 'runtime',
  }),
  typeDef({
    objectType: 'trash_bin',
    label: 'Trash Bin',
    category: 'container',
    defaultZone: 'kitchen',
    objectState: { filled: false, cleanliness: 50 },
    affordances: [
      defineAffordance('store', { label: 'Dispose' }),
      defineAffordance('clean', { label: 'Empty / wipe' }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [],
    durability: 80,
    interactionRange: R,
    objectRelations: [],
    description: 'Disposal step after consume / clean loops.',
  }),

  // ── Bathroom ──────────────────────────────────────────────────────────
  typeDef({
    objectType: 'bathroom_sink',
    label: 'Bathroom Sink',
    category: 'fixture',
    defaultZone: 'bathroom',
    objectState: { powered: false, cleanliness: 70 },
    affordances: [
      defineAffordance('toggle'),
      defineAffordance('operate', { label: 'Wash hands', effects: { tags: ['hygiene_hands'] } }),
      defineAffordance('clean'),
      defineAffordance('inspect'),
    ],
    stateTransitions: [],
    durability: null,
    interactionRange: R,
    objectRelations: [],
    description: 'Hygiene affordance (need wired in P4).',
  }),
  typeDef({
    objectType: 'shower',
    label: 'Shower',
    category: 'fixture',
    defaultZone: 'bathroom',
    objectState: { powered: false, cleanliness: 65 },
    affordances: [
      defineAffordance('toggle'),
      defineAffordance('operate', {
        label: 'Shower',
        effects: { needs: { comfort: 10, fatigue: -6 }, tags: ['shower'] },
        resourceCost: { timeTicks: 15, energy: 3 },
      }),
      defineAffordance('clean'),
      defineAffordance('inspect'),
    ],
    stateTransitions: [],
    durability: 90,
    interactionRange: R,
    objectRelations: [],
    description: 'Full hygiene / comfort routine.',
  }),
  typeDef({
    objectType: 'towel',
    label: 'Towel',
    category: 'tool',
    defaultZone: 'bathroom',
    objectState: { cleanliness: 80, durability: 60 },
    affordances: [
      defineAffordance('pick'),
      defineAffordance('drop'),
      defineAffordance('operate', { label: 'Dry off', effects: { tags: ['dry'] } }),
      defineAffordance('clean'),
      defineAffordance('inspect'),
    ],
    stateTransitions: [],
    durability: 60,
    interactionRange: R,
    objectRelations: [],
    description: 'Post-shower tool.',
  }),
  typeDef({
    objectType: 'mirror',
    label: 'Mirror',
    category: 'fixture',
    defaultZone: 'bathroom',
    objectState: { cleanliness: 70 },
    affordances: [
      defineAffordance('inspect', { effects: { tags: ['look_mirror'] } }),
      defineAffordance('observe'),
      defineAffordance('clean'),
    ],
    stateTransitions: [],
    durability: null,
    interactionRange: R,
    objectRelations: [],
    description: 'Inspect / self-observe cue.',
  }),
  typeDef({
    objectType: 'toilet',
    label: 'Toilet',
    category: 'fixture',
    defaultZone: 'bathroom',
    objectState: { cleanliness: 70 },
    affordances: [
      defineAffordance('operate', { effects: { tags: ['toilet'], needs: { comfort: 5 } } }),
      defineAffordance('clean'),
      defineAffordance('inspect'),
    ],
    stateTransitions: [],
    durability: 100,
    interactionRange: R,
    objectRelations: [],
    description: 'Bodily comfort fixture.',
  }),

  // ── Workshop ──────────────────────────────────────────────────────────
  typeDef({
    objectType: 'workbench',
    label: 'Workbench',
    category: 'furniture',
    defaultZone: 'workshop',
    objectState: { filled: false, cleanliness: 60, durability: 100 },
    affordances: [
      defineAffordance('operate', { label: 'Craft', effects: { tags: ['craft'] } }),
      defineAffordance('combine', { effects: { tags: ['assemble'] } }),
      defineAffordance('repair', {
        preconditions: { requiresHeldType: ['repair_kit'] },
        effects: { tags: ['bench_repair'] },
      }),
      defineAffordance('inspect'),
      defineAffordance('clean'),
    ],
    stateTransitions: [],
    durability: 100,
    interactionRange: R,
    objectRelations: [{ role: 'placed_on', targetType: 'repair_kit' }],
    description: 'Competence / crafting surface.',
  }),
  typeDef({
    objectType: 'toolbox',
    label: 'Toolbox',
    category: 'container',
    defaultZone: 'workshop',
    objectState: { open: false, filled: true },
    affordances: [
      defineAffordance('open'),
      defineAffordance('close'),
      defineAffordance('retrieve', { preconditions: { stateEquals: { open: true } } }),
      defineAffordance('store', { preconditions: { stateEquals: { open: true } } }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [
      { from: { open: false }, to: { open: true }, via: 'open' },
      { from: { open: true }, to: { open: false }, via: 'close' },
    ],
    durability: 90,
    interactionRange: R,
    objectRelations: [{ role: 'contains', targetType: 'repair_kit' }],
    description: 'Tool storage for repair chains.',
  }),
  typeDef({
    objectType: 'repair_kit',
    label: 'Repair Kit',
    category: 'tool',
    defaultZone: 'workshop',
    objectState: { durability: 80 },
    affordances: [
      defineAffordance('pick'),
      defineAffordance('drop'),
      defineAffordance('repair', { effects: { tags: ['use_repair_kit'] } }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [],
    durability: 80,
    interactionRange: R,
    objectRelations: [],
    description: 'Held tool required by repair affordances.',
  }),
  typeDef({
    objectType: 'scrap_parts',
    label: 'Scrap Parts',
    category: 'tool',
    defaultZone: 'workshop',
    objectState: {},
    affordances: [
      defineAffordance('pick'),
      defineAffordance('drop'),
      defineAffordance('combine', { effects: { tags: ['combine_scrap'] } }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [],
    durability: 40,
    interactionRange: R,
    objectRelations: [{ role: 'recipe_with', targetType: 'workbench' }],
    description: 'Crafting ingredient.',
  }),

  // ── Garden ────────────────────────────────────────────────────────────
  typeDef({
    objectType: 'soil_bed',
    label: 'Soil Bed',
    category: 'plant',
    defaultZone: 'garden',
    objectState: { growth: 0, filled: false, cleanliness: 50 },
    affordances: [
      defineAffordance('operate', {
        label: 'Plant seed',
        preconditions: { requiresHeldType: ['seed_packet'] },
        effects: { setState: { filled: true, growth: 1 }, tags: ['plant'] },
      }),
      defineAffordance('inspect'),
      defineAffordance('clean', { label: 'Weed' }),
    ],
    stateTransitions: [{ from: { filled: false }, to: { filled: true, growth: 1 }, via: 'operate' }],
    durability: null,
    interactionRange: R,
    objectRelations: [{ role: 'contains', targetType: 'seed_packet' }],
    description: 'Plant growth substrate (env tick in P3).',
  }),
  typeDef({
    objectType: 'seed_packet',
    label: 'Seed Packet',
    category: 'consumable',
    defaultZone: 'garden',
    objectState: {},
    affordances: [defineAffordance('pick'), defineAffordance('drop'), defineAffordance('inspect')],
    stateTransitions: [],
    durability: null,
    interactionRange: R,
    objectRelations: [],
    description: 'Required to plant in soil_bed.',
  }),
  typeDef({
    objectType: 'watering_can',
    label: 'Watering Can',
    category: 'tool',
    defaultZone: 'garden',
    objectState: { filled: true },
    affordances: [
      defineAffordance('pick'),
      defineAffordance('drop'),
      defineAffordance('operate', {
        label: 'Water plants',
        preconditions: { stateEquals: { filled: true } },
        effects: { tags: ['water_plants'], setState: { filled: false } },
      }),
      defineAffordance('store', {
        label: 'Refill at sink',
        effects: { setState: { filled: true } },
      }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [
      { from: { filled: true }, to: { filled: false }, via: 'operate' },
      { from: { filled: false }, to: { filled: true }, via: 'store' },
    ],
    durability: 70,
    interactionRange: R,
    objectRelations: [{ role: 'adjacent', targetType: 'soil_bed' }],
    description: 'Garden care tool.',
  }),
  typeDef({
    objectType: 'garden_plant',
    label: 'Garden Plant',
    category: 'plant',
    defaultZone: 'garden',
    objectState: { growth: 40, freshness: 80 },
    affordances: [
      defineAffordance('inspect'),
      defineAffordance('observe', { effects: { needs: { curiosity: -6, comfort: 4 } } }),
      defineAffordance('retrieve', {
        label: 'Harvest',
        preconditions: { stateMin: { growth: 80 } },
        effects: { tags: ['harvest'], setState: { growth: 10 } },
      }),
    ],
    stateTransitions: [],
    durability: null,
    interactionRange: R,
    objectRelations: [{ role: 'placed_on', targetType: 'soil_bed' }],
    description: 'Grows over time; harvest when mature.',
  }),
  typeDef({
    objectType: 'garden_bench',
    label: 'Garden Bench',
    category: 'furniture',
    defaultZone: 'garden',
    objectState: { used: false, cleanliness: 70 },
    affordances: [
      defineAffordance('rest_use', {
        label: 'Sit outside',
        effects: { needs: { fatigue: -8, comfort: 10, curiosity: -4 } },
      }),
      defineAffordance('inspect'),
    ],
    stateTransitions: [],
    durability: 90,
    interactionRange: R,
    objectRelations: [],
    description: 'Outdoor rest / observe spot.',
  }),
]

const BY_TYPE: Record<string, LabObjectTypeDefinition> = Object.fromEntries(
  LAB_OBJECT_TYPE_DEFINITIONS.map((entry) => [entry.objectType, entry]),
)

export const LAB_OBJECT_TYPE_IDS = LAB_OBJECT_TYPE_DEFINITIONS.map((entry) => entry.objectType)

export function getLabObjectType(objectType: string): LabObjectTypeDefinition | null {
  return BY_TYPE[objectType] ?? null
}

export function requireLabObjectType(objectType: string): LabObjectTypeDefinition {
  const found = getLabObjectType(objectType)
  if (!found) throw new Error(`Unknown Lab object type: ${objectType}`)
  return found
}

export function labObjectTypesInZone(zoneId: LabObjectTypeDefinition['defaultZone']): LabObjectTypeDefinition[] {
  return LAB_OBJECT_TYPE_DEFINITIONS.filter((entry) => entry.defaultZone === zoneId)
}

export function bridgedLegacyObjectTypes(): LabObjectTypeDefinition[] {
  return LAB_OBJECT_TYPE_DEFINITIONS.filter((entry) => entry.implementation === 'bridged_legacy')
}

export function createDefaultLabWorldLayout(): LabWorldLayout {
  return createLabWorldLayout(LAB_OBJECT_TYPE_IDS)
}

/** Fail fast on catalog integrity (unique ids, legacy bridge coverage). */
export function assertLabObjectCatalogIntegrity(): void {
  const seen = new Set<string>()
  for (const entry of LAB_OBJECT_TYPE_DEFINITIONS) {
    if (seen.has(entry.objectType)) {
      throw new Error(`Duplicate Lab object type: ${entry.objectType}`)
    }
    seen.add(entry.objectType)
    if (entry.affordances.length === 0) {
      throw new Error(`Lab object type has no affordances: ${entry.objectType}`)
    }
    for (const aff of entry.affordances) {
      if (!aff.executorAction) {
        throw new Error(`Missing executorAction on ${entry.objectType}.${aff.kind}`)
      }
    }
  }

  const legacyKinds = new Set(
    bridgedLegacyObjectTypes()
      .map((entry) => entry.legacyInteractableKind)
      .filter(Boolean),
  )
  for (const kind of ['door', 'switch', 'movable_box', 'rest_bed', 'lookout'] as const) {
    if (!legacyKinds.has(kind)) {
      throw new Error(`Missing legacy bridge for InteractableKind: ${kind}`)
    }
  }
}
