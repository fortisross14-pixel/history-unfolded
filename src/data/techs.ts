/** Starter tech list. The full era tree comes with the research milestone. */
export interface TechInfo {
  id: string;
  name: string;
  cost: number;
  requires: string[];
  note: string;
}

export const TECH_LIST: TechInfo[] = [
  {
    id: 'tanning',
    name: 'Tanning',
    cost: 12,
    requires: [],
    note: 'Leather armour, caps, marching boots, medics, infirmaries.',
  },
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
    note: 'Bronze sword, axe, helmet, shield, scale armour.',
  },
  { id: 'currency', name: 'Currency', cost: 30, requires: [], note: 'Banks.' },
  { id: 'banking', name: 'Banking', cost: 70, requires: ['currency'], note: 'Stock exchanges.' },
  {
    id: 'mineralogy',
    name: 'Mineralogy',
    cost: 60,
    requires: ['iron-working'],
    note: 'Reveals coal; coal mines.',
  },
  {
    id: 'iron-working',
    name: 'Iron Working',
    cost: 45,
    requires: ['bronze-working'],
    note: 'Reveals iron deposits; iron mines.',
  },
];

export const TECHS: Record<string, TechInfo> = Object.fromEntries(TECH_LIST.map(t => [t.id, t]));
