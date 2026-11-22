/** Starter tech list. The full era tree comes with the research milestone. */
export interface TechInfo {
  id: string;
  name: string;
  cost: number;
  requires: string[];
  note: string;
}

export const TECH_LIST: TechInfo[] = [
  { id: 'tanning', name: 'Tanning', cost: 12, requires: [], note: 'Leather armour.' },
  { id: 'archery', name: 'Archery', cost: 16, requires: [], note: 'Bow.' },
  {
    id: 'horseback-riding',
    name: 'Horseback Riding',
    cost: 24,
    requires: [],
    note: 'Horse mount.',
  },
  {
    id: 'bronze-working',
    name: 'Bronze Working',
    cost: 28,
    requires: [],
    note: 'Bronze sword, bronze scale.',
  },
  {
    id: 'iron-working',
    name: 'Iron Working',
    cost: 45,
    requires: ['bronze-working'],
    note: 'Reveals iron deposits.',
  },
];

export const TECHS: Record<string, TechInfo> = Object.fromEntries(TECH_LIST.map(t => [t.id, t]));
