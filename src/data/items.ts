/**
 * Equipment. Research unlocks items; the player combines them into cohort loadouts.
 * Numbers are first-pass placeholders, tuned later.
 */
export type Slot = 'weapon' | 'armour' | 'mount' | 'kit';
export type DamageType = 'cut' | 'pierce' | 'crush' | 'missile';

export interface ItemInfo {
  id: string;
  name: string;
  slot: Slot;
  tech?: string;
  /** goods per cohort (100 people) to equip */
  cost: Record<string, number>;
  /** gold per cohort per turn */
  upkeep: number;
  weight: number;
  attack?: number;
  damage?: DamageType;
  ranged?: boolean;
  charge?: number;
  antiCharge?: number;
  protection?: Partial<Record<DamageType, number>>;
  /** movement points granted (mounts) or added (kit) */
  move?: number;
  sight?: number;
  twoHanded?: boolean;
  note: string;
}

const list: ItemInfo[] = [
  // weapons
  {
    id: 'improvised',
    name: 'Improvised weapons',
    slot: 'weapon',
    cost: {},
    upkeep: 0,
    weight: 0,
    attack: 2,
    damage: 'crush',
    note: 'Clubs, knives and farm tools.',
  },
  {
    id: 'sling',
    name: 'Sling',
    slot: 'weapon',
    cost: { stone: 1 },
    upkeep: 0,
    weight: 0,
    attack: 2,
    damage: 'missile',
    ranged: true,
    note: 'Cheap ranged harassment.',
  },
  {
    id: 'spear',
    name: 'Spear',
    slot: 'weapon',
    cost: { wood: 1 },
    upkeep: 0,
    weight: 1,
    attack: 3,
    damage: 'pierce',
    antiCharge: 3,
    note: 'Holds off mounted charges.',
  },
  {
    id: 'bow',
    name: 'Bow',
    slot: 'weapon',
    tech: 'archery',
    cost: { wood: 2 },
    upkeep: 0,
    weight: 0,
    attack: 3,
    damage: 'missile',
    ranged: true,
    twoHanded: true,
    note: 'Fires before melee.',
  },
  {
    id: 'bronze-sword',
    name: 'Bronze sword',
    slot: 'weapon',
    tech: 'bronze-working',
    cost: { copper: 1, tin: 1 },
    upkeep: 1,
    weight: 1,
    attack: 5,
    damage: 'cut',
    note: 'Strong in melee.',
  },
  // armour
  {
    id: 'no-armour',
    name: 'No armour',
    slot: 'armour',
    cost: {},
    upkeep: 0,
    weight: 0,
    protection: {},
    note: '',
  },
  {
    id: 'leather',
    name: 'Leather armour',
    slot: 'armour',
    tech: 'tanning',
    cost: { hides: 2 },
    upkeep: 0,
    weight: 1,
    protection: { cut: 1, missile: 1, crush: 1 },
    note: 'Light all-round protection.',
  },
  {
    id: 'bronze-scale',
    name: 'Bronze scale',
    slot: 'armour',
    tech: 'bronze-working',
    cost: { copper: 2, tin: 1 },
    upkeep: 1,
    weight: 2,
    protection: { cut: 3, pierce: 2, missile: 2, crush: 1 },
    note: 'Heavy. Slows foot troops.',
  },
  {
    id: 'ivory-lamellar',
    name: 'Ivory lamellar',
    slot: 'armour',
    cost: { ivory: 2, hides: 1 },
    upkeep: 1,
    weight: 1,
    protection: { cut: 2, pierce: 2, missile: 2 },
    note: 'Light and strong, needs ivory.',
  },
  // mounts
  { id: 'foot', name: 'On foot', slot: 'mount', cost: {}, upkeep: 0, weight: 0, move: 2, note: '' },
  {
    id: 'horse',
    name: 'Horse',
    slot: 'mount',
    tech: 'horseback-riding',
    cost: { horses: 1 },
    upkeep: 1,
    weight: 0,
    move: 4,
    charge: 3,
    note: 'Fast, charges. Poor in forest and marsh.',
  },
  // kit
  { id: 'no-kit', name: 'No kit', slot: 'kit', cost: {}, upkeep: 0, weight: 0, note: '' },
  {
    id: 'shield',
    name: 'Shield',
    slot: 'kit',
    cost: { wood: 1, hides: 1 },
    upkeep: 0,
    weight: 1,
    protection: { missile: 2, cut: 1 },
    note: 'Not with two-handed weapons.',
  },
  {
    id: 'scouting-gear',
    name: 'Scouting gear',
    slot: 'kit',
    cost: { hides: 1 },
    upkeep: 0,
    weight: 0,
    move: 1,
    sight: 1,
    note: '+1 move, +1 sight.',
  },
];

export const ITEMS: Record<string, ItemInfo> = Object.fromEntries(list.map(i => [i.id, i]));
export const ITEM_LIST = list;
export const SLOTS: Slot[] = ['weapon', 'armour', 'mount', 'kit'];
export const SLOT_NAMES: Record<Slot, string> = {
  weapon: 'Weapon',
  armour: 'Armour',
  mount: 'Mount',
  kit: 'Kit',
};

export interface Loadout {
  weapon: string;
  armour: string;
  mount: string;
  kit: string;
}

export const DEFAULT_LOADOUT: Loadout = {
  weapon: 'improvised',
  armour: 'no-armour',
  mount: 'foot',
  kit: 'no-kit',
};

export const loadoutKey = (l: Loadout) => `${l.weapon}|${l.armour}|${l.mount}|${l.kit}`;
