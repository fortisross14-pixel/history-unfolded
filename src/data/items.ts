/**
 * Equipment. Research unlocks items; the player combines them into named unit designs
 * ("Hoplites", "Foot Falcons") and assigns cohorts to designs. Numbers are first-pass.
 */
export type Slot = 'weapon' | 'shield' | 'helmet' | 'armour' | 'boots' | 'mount' | 'kit';
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
  /** morale bonus (share of losses a formation can take before breaking, in %) */
  morale?: number;
  /** foot troops ignore one point of rough-terrain cost */
  rough?: boolean;
  twoHanded?: boolean;
  /** marks the "nothing in this slot" item */
  empty?: boolean;
  note: string;
}

const list: ItemInfo[] = [
  // weapons
  {
    id: 'improvised',
    name: 'Improvised weapons',
    slot: 'weapon',
    empty: true,
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
    id: 'javelins',
    name: 'Javelins',
    slot: 'weapon',
    cost: { wood: 1 },
    upkeep: 0,
    weight: 1,
    attack: 3,
    damage: 'pierce',
    ranged: true,
    note: 'Short-range volleys; usable with a shield.',
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
    antiCharge: 4,
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
    attack: 4,
    damage: 'missile',
    ranged: true,
    twoHanded: true,
    note: 'Strong volleys. Two-handed.',
  },
  {
    id: 'axe',
    name: 'Bronze axe',
    slot: 'weapon',
    tech: 'bronze-working',
    cost: { copper: 1, wood: 1 },
    upkeep: 1,
    weight: 1,
    attack: 5,
    damage: 'crush',
    twoHanded: true,
    note: 'Breaks armour. Two-handed: no shield.',
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
  // shields
  {
    id: 'no-shield',
    name: 'No shield',
    slot: 'shield',
    empty: true,
    cost: {},
    upkeep: 0,
    weight: 0,
    note: '',
  },
  {
    id: 'wicker-shield',
    name: 'Wicker shield',
    slot: 'shield',
    cost: { wood: 1 },
    upkeep: 0,
    weight: 0,
    protection: { missile: 2 },
    note: 'Light cover from missiles.',
  },
  {
    id: 'hide-shield',
    name: 'Hide shield',
    slot: 'shield',
    cost: { wood: 1, hides: 1 },
    upkeep: 0,
    weight: 1,
    protection: { missile: 2, cut: 1, pierce: 1 },
    note: 'All-round cover.',
  },
  {
    id: 'bronze-shield',
    name: 'Bronze shield',
    slot: 'shield',
    tech: 'bronze-working',
    cost: { copper: 2, wood: 1 },
    upkeep: 1,
    weight: 2,
    protection: { missile: 3, cut: 2, pierce: 2 },
    note: 'Heavy, near unbreakable.',
  },
  // helmets
  {
    id: 'no-helmet',
    name: 'No helmet',
    slot: 'helmet',
    empty: true,
    cost: {},
    upkeep: 0,
    weight: 0,
    note: '',
  },
  {
    id: 'leather-cap',
    name: 'Leather cap',
    slot: 'helmet',
    tech: 'tanning',
    cost: { hides: 1 },
    upkeep: 0,
    weight: 0,
    protection: { crush: 1, missile: 1 },
    note: '',
  },
  {
    id: 'bronze-helmet',
    name: 'Bronze helmet',
    slot: 'helmet',
    tech: 'bronze-working',
    cost: { copper: 1, tin: 1 },
    upkeep: 0,
    weight: 1,
    protection: { crush: 2, cut: 1, missile: 1 },
    morale: 5,
    note: 'Steadies the line.',
  },
  // body armour
  {
    id: 'no-armour',
    name: 'No armour',
    slot: 'armour',
    empty: true,
    cost: {},
    upkeep: 0,
    weight: 0,
    note: '',
  },
  {
    id: 'padded',
    name: 'Padded jacket',
    slot: 'armour',
    cost: { hides: 1 },
    upkeep: 0,
    weight: 0,
    protection: { missile: 1, cut: 1 },
    note: 'Cheap and light.',
  },
  {
    id: 'leather',
    name: 'Leather armour',
    slot: 'armour',
    tech: 'tanning',
    cost: { hides: 2 },
    upkeep: 0,
    weight: 1,
    protection: { cut: 2, missile: 1, crush: 1 },
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
    protection: { cut: 3, pierce: 2, missile: 2 },
    note: 'Heavy. Weak to crushing blows.',
  },
  {
    id: 'ivory-lamellar',
    name: 'Ivory lamellar',
    slot: 'armour',
    cost: { ivory: 2, hides: 1 },
    upkeep: 1,
    weight: 1,
    protection: { cut: 2, pierce: 3, missile: 2 },
    note: 'Light and strong, needs ivory.',
  },
  // boots
  {
    id: 'barefoot',
    name: 'Barefoot',
    slot: 'boots',
    empty: true,
    cost: {},
    upkeep: 0,
    weight: 0,
    note: '',
  },
  {
    id: 'sandals',
    name: 'Sandals',
    slot: 'boots',
    cost: { hides: 1 },
    upkeep: 0,
    weight: 0,
    morale: 2,
    note: '',
  },
  {
    id: 'marching-boots',
    name: 'Marching boots',
    slot: 'boots',
    tech: 'tanning',
    cost: { hides: 2 },
    upkeep: 0,
    weight: 0,
    rough: true,
    note: 'Foot troops cross rough ground faster.',
  },
  // mounts
  {
    id: 'foot',
    name: 'On foot',
    slot: 'mount',
    empty: true,
    cost: {},
    upkeep: 0,
    weight: 0,
    move: 2,
    note: '',
  },
  {
    id: 'horse',
    name: 'Horse',
    slot: 'mount',
    tech: 'horseback-riding',
    cost: { horses: 1 },
    upkeep: 1,
    weight: 0,
    move: 4,
    charge: 4,
    note: 'Fast, charges, flanks. Poor in forest and marsh.',
  },
  // kit
  {
    id: 'no-kit',
    name: 'No kit',
    slot: 'kit',
    empty: true,
    cost: {},
    upkeep: 0,
    weight: 0,
    note: '',
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
  {
    id: 'war-banner',
    name: 'War banner',
    slot: 'kit',
    cost: { wood: 1, hides: 1 },
    upkeep: 0,
    weight: 0,
    morale: 10,
    note: 'The whole formation holds longer.',
  },
  {
    id: 'field-medics',
    name: 'Field medics',
    slot: 'kit',
    tech: 'tanning',
    cost: { hides: 1 },
    upkeep: 1,
    weight: 0,
    note: 'The formation heals faster.',
  },
];

export const ITEMS: Record<string, ItemInfo> = Object.fromEntries(list.map(i => [i.id, i]));
export const ITEM_LIST = list;
export const SLOTS: Slot[] = ['weapon', 'shield', 'helmet', 'armour', 'boots', 'mount', 'kit'];
export const SLOT_NAMES: Record<Slot, string> = {
  weapon: 'Weapon',
  shield: 'Shield',
  helmet: 'Helmet',
  armour: 'Body armour',
  boots: 'Footwear',
  mount: 'Ride',
  kit: 'Kit',
};

export type Loadout = Record<Slot, string>;

export const DEFAULT_LOADOUT: Loadout = {
  weapon: 'improvised',
  shield: 'no-shield',
  helmet: 'no-helmet',
  armour: 'no-armour',
  boots: 'barefoot',
  mount: 'foot',
  kit: 'no-kit',
};

export const loadoutKey = (l: Loadout) => SLOTS.map(s => l[s]).join('|');
export const sameLoadout = (a: Loadout, b: Loadout) => loadoutKey(a) === loadoutKey(b);
