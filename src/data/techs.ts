/**
 * The research tree: four eras. Research unlocks parts (equipment, buildings), reveals deposits
 * and raises limits; it never hands out finished units or buildings. A tech can be cheaper for
 * peoples whose culture leans its way.
 */
import type { Mods } from './mods.ts';

export interface TechInfo {
  id: string;
  name: string;
  era: 1 | 2 | 3 | 4;
  cost: number;
  requires: string[];
  /** 20% cheaper for peoples with at least 2 nodes of this culture tag */
  favoured?: string;
  mods?: Partial<Mods>;
  note: string;
}

export const ERAS = ['', 'Ancient', 'Classical', 'Medieval', 'Renaissance'];

const t = (
  id: string,
  name: string,
  era: TechInfo['era'],
  cost: number,
  requires: string[],
  note: string,
  extra: Partial<TechInfo> = {},
): TechInfo => ({ id, name, era, cost, requires, note, ...extra });

export const TECH_LIST: TechInfo[] = [
  // ---- ancient
  t('mysticism', 'Mysticism', 1, 12, [], 'Shrines.', { favoured: 'devout' }),
  t(
    'tanning',
    'Tanning',
    1,
    12,
    [],
    'Leather armour, caps, marching boots, field medics, infirmaries.',
  ),
  t('pottery', 'Pottery', 1, 12, [], 'Granaries.', { favoured: 'agrarian' }),
  t('mining', 'Mining', 1, 14, [], 'Copper, tin, gold and silver mines.'),
  t('animal-husbandry', 'Animal Husbandry', 1, 14, [], 'Horse studs.', { favoured: 'agrarian' }),
  t('archery', 'Archery', 1, 16, [], 'Bows.'),
  t('masonry', 'Masonry', 1, 18, [], 'Monuments and city walls.'),
  t('sailing', 'Sailing', 1, 18, [], 'Harbours.', { favoured: 'maritime' }),
  t('writing', 'Writing', 1, 22, [], 'Schools.', { favoured: 'rationalist' }),
  t('irrigation', 'Irrigation', 1, 20, ['pottery'], 'Farms produce more.', {
    mods: { groupPct: { farming: 10 } },
  }),
  t('the-wheel', 'The Wheel', 1, 20, [], 'Carts: faster on roads.', { mods: { roadCost: -0.1 } }),
  t('horseback-riding', 'Horseback Riding', 1, 24, ['animal-husbandry'], 'Horses as mounts.', {
    favoured: 'martial',
  }),
  t(
    'bronze-working',
    'Bronze Working',
    1,
    28,
    ['mining'],
    'Bronze swords, axes, helmets, shields and scale.',
  ),
  // ---- classical
  t(
    'iron-working',
    'Iron Working',
    2,
    50,
    ['bronze-working'],
    'Reveals iron. Iron mines, swords and helmets.',
  ),
  t('currency', 'Currency', 2, 45, ['writing'], 'Banks.', {
    favoured: 'mercantile',
    mods: { goldPct: 5 },
  }),
  t('mathematics', 'Mathematics', 2, 55, ['writing'], 'Better science.', {
    favoured: 'rationalist',
    mods: { sciencePct: 5 },
  }),
  t('construction', 'Construction', 2, 55, ['masonry'], 'Better production.', {
    mods: { prodPct: 5 },
  }),
  t('carpentry', 'Carpentry', 2, 45, ['bronze-working'], 'Lumber mills.'),
  t('priesthood', 'Priesthood', 2, 50, ['mysticism', 'writing'], 'Temples.', {
    favoured: 'devout',
  }),
  t('literature', 'Literature', 2, 55, ['writing'], 'Amphitheatres.', { favoured: 'artistic' }),
  t('philosophy', 'Philosophy', 2, 75, ['writing', 'mysticism'], 'Libraries.', {
    favoured: 'rationalist',
  }),
  t('law', 'Code of Laws', 2, 60, ['writing'], 'Order and taxes.', {
    mods: { goldPct: 5, tensionPct: -5 },
  }),
  t('bowyery', 'Bowyery', 2, 50, ['archery'], 'Composite bows.'),
  t('mail-making', 'Mail Making', 2, 75, ['iron-working'], 'Chain mail and kite shields.'),
  t('drill', 'Drill', 2, 65, ['bronze-working'], 'Bigger formations.', {
    favoured: 'martial',
    mods: { commandCap: 2 },
  }),
  t('selective-breeding', 'Selective Breeding', 2, 65, ['horseback-riding'], 'Heavy horses.'),
  t(
    'engineering',
    'Engineering',
    2,
    80,
    ['construction', 'mathematics'],
    'Aqueducts, hobnailed boots, faster roads.',
    { mods: { roadCost: -0.1 } },
  ),
  t(
    'siegecraft',
    'Siegecraft',
    2,
    75,
    ['mathematics', 'carpentry'],
    'Siege ladders; better assaults.',
    { mods: { siegePct: 10 } },
  ),
  t('navigation', 'Navigation', 2, 60, ['sailing'], 'Coastal cities prosper; ships see further.', {
    favoured: 'maritime',
    mods: { coastalPct: 5, navalPct: 10 },
  }),
  // ---- medieval
  t('feudalism', 'Feudalism', 3, 120, ['law', 'drill'], 'Bigger levies.', {
    favoured: 'absolutist',
    mods: { levyCohorts: 1 },
  }),
  t('mechanics', 'Mechanics', 3, 130, ['engineering'], 'Crossbows, pavises, windmills.'),
  t(
    'chivalry',
    'Chivalry',
    3,
    150,
    ['feudalism', 'selective-breeding'],
    'Lances and barded horses.',
    { favoured: 'martial' },
  ),
  t('theology', 'Theology', 3, 140, ['philosophy', 'priesthood'], 'Cathedrals.', {
    favoured: 'devout',
  }),
  t('education', 'Education', 3, 160, ['philosophy', 'literature'], 'Universities.', {
    favoured: 'rationalist',
  }),
  t('guilds', 'Guilds', 3, 130, ['currency', 'carpentry'], 'Guild halls.', {
    favoured: 'mercantile',
  }),
  t(
    'administration',
    'Administration',
    3,
    170,
    ['law', 'education'],
    'Wider territory and district reach.',
    { mods: { territoryRadius: 1, districtRadius: 1 } },
  ),
  t('mineralogy', 'Mineralogy', 3, 110, ['iron-working', 'mining'], 'Reveals coal. Coal mines.'),
  t(
    'armour-smithing',
    'Armour Smithing',
    3,
    180,
    ['mail-making', 'mineralogy'],
    'Plate armour and great helms.',
  ),
  t('pike-tactics', 'Pike Tactics', 3, 140, ['feudalism'], 'Pikes.'),
  t('yeomanry', 'Yeomanry', 3, 120, ['bowyery'], 'Longbows.'),
  t('castles', 'Castles', 3, 150, ['construction', 'feudalism'], 'Castles.', {
    mods: { cityDefensePct: 10 },
  }),
  t('urbanism', 'Urbanism', 3, 160, ['engineering'], 'Tenements.', { mods: { housingPct: 5 } }),
  t(
    'alchemy',
    'Alchemy',
    3,
    150,
    ['philosophy', 'mineralogy'],
    'Reveals saltpeter. Saltpeter works.',
  ),
  t('compass', 'Compass', 3, 130, ['navigation'], 'Coastal trade; sight.', {
    favoured: 'maritime',
    mods: { coastalPct: 10, sight: 1, navalPct: 10 },
  }),
  // ---- renaissance
  t('gunpowder', 'Gunpowder', 4, 300, ['alchemy', 'mechanics'], 'Arquebuses.'),
  t('printing', 'Printing Press', 4, 280, ['education', 'guilds'], 'Printing houses.', {
    favoured: 'rationalist',
  }),
  t('banking', 'Banking', 4, 300, ['guilds', 'currency'], 'Stock exchanges.', {
    favoured: 'mercantile',
  }),
  t('astronomy', 'Astronomy', 4, 280, ['education', 'compass'], 'Observatories.', {
    favoured: 'solar',
  }),
  t('metallurgy', 'Metallurgy', 4, 320, ['armour-smithing'], 'Foundries and cuirasses.'),
  t('musketry', 'Musketry', 4, 380, ['gunpowder'], 'Muskets and bayonets.'),
  t('artillery', 'Artillery', 4, 400, ['gunpowder', 'metallurgy'], 'Field guns.', {
    mods: { siegePct: 15 },
  }),
  t('conscription', 'Conscription', 4, 360, ['administration', 'musketry'], 'Much bigger levies.', {
    mods: { levyCohorts: 3 },
  }),
  t(
    'officer-corps',
    'Professional Officers',
    4,
    340,
    ['administration', 'drill'],
    'Much bigger formations.',
    { favoured: 'martial', mods: { commandCap: 3 } },
  ),
  t(
    'scientific-method',
    'Scientific Method',
    4,
    420,
    ['printing', 'astronomy'],
    'Science surges.',
    { favoured: 'rationalist', mods: { sciencePct: 20 } },
  ),
  t('joint-stock', 'Joint-Stock Companies', 4, 400, ['banking'], 'Commerce booms.', {
    favoured: 'mercantile',
    mods: { groupPct: { commerce: 20 } },
  }),
  t('cartography', 'Cartography', 4, 300, ['compass', 'printing'], 'Better maps.', {
    favoured: 'maritime',
    mods: { sight: 1, coastalPct: 5 },
  }),
  t('star-forts', 'Star Forts', 4, 350, ['castles', 'gunpowder'], 'Cities hold against guns.', {
    mods: { cityDefensePct: 20 },
  }),
];

export const TECHS: Record<string, TechInfo> = Object.fromEntries(TECH_LIST.map(x => [x.id, x]));
