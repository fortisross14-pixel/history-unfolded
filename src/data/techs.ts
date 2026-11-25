/**
 * The research tree: four ages, each with its own small tree. Prerequisites stay inside an age;
 * the way into the next age is its gate tech (Classical Age, Medieval Age, Renaissance Age),
 * open once a people knows enough of the current age's techs, whichever they are. Research unlocks parts (equipment, buildings), reveals deposits
 * and raises limits; it never hands out finished units or buildings. A tech can be cheaper for
 * peoples whose culture leans its way.
 */
import type { Mods } from './mods.ts';

export interface TechInfo {
  id: string;
  name: string;
  era: 1 | 2 | 3 | 4 | 5;
  cost: number;
  requires: string[];
  /** 20% cheaper for peoples with at least 2 nodes of this culture tag */
  favoured?: string;
  mods?: Partial<Mods>;
  note: string;
  /** an age gate: needs this many techs of its own age, and opens the next age */
  gate?: number;
  /** a national project of the Scientific victory: the order it comes in (1–3) */
  project?: number;
}

export const ERAS = ['', 'Ancient', 'Classical', 'Medieval', 'Renaissance', 'Industrial'];

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
    'Tanneries turn hides into leather: leather armour, caps, marching boots, field medics; infirmaries.',
  ),
  t('pottery', 'Pottery', 1, 12, [], 'Granaries.', { favoured: 'agrarian' }),
  t(
    'mining',
    'Mining',
    1,
    14,
    [],
    'Mines: stone anywhere; copper, tin, gold and silver where they lie.',
  ),
  t('animal-husbandry', 'Animal Husbandry', 1, 14, [], 'Pastures raise horses.', {
    favoured: 'agrarian',
    mods: { groupPct: { farming: 5 } },
  }),
  t('archery', 'Archery', 1, 16, [], 'Bows; hunting lodges (food and hides); barracks.'),
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
  t('classical-age', 'Classical Age', 1, 30, [], 'Opens the Classical age.', { gate: 9 }),
  // ---- classical
  t('iron-working', 'Iron Working', 2, 50, [], 'Reveals iron for mines. Iron swords and helmets.'),
  t('currency', 'Currency', 2, 45, [], 'Banks.', {
    favoured: 'mercantile',
    mods: { goldPct: 5 },
  }),
  t('mathematics', 'Mathematics', 2, 55, [], 'Better science.', {
    favoured: 'rationalist',
    mods: { sciencePct: 5 },
  }),
  t('construction', 'Construction', 2, 55, [], 'Better production.', {
    mods: { prodPct: 5 },
  }),
  t('carpentry', 'Carpentry', 2, 45, [], 'Lumber mills.'),
  t('priesthood', 'Priesthood', 2, 50, [], 'Temples.', {
    favoured: 'devout',
  }),
  t('literature', 'Literature', 2, 55, [], 'Amphitheatres.', { favoured: 'artistic' }),
  t('philosophy', 'Philosophy', 2, 75, [], 'Libraries.', {
    favoured: 'rationalist',
  }),
  t('law', 'Code of Laws', 2, 60, [], 'Order and taxes.', {
    mods: { goldPct: 5, tensionPct: -5 },
  }),
  t('bowyery', 'Bowyery', 2, 50, [], 'Composite bows.'),
  t('mail-making', 'Mail Making', 2, 75, ['iron-working'], 'Chain mail and kite shields.'),
  t('drill', 'Drill', 2, 65, [], 'Bigger formations.', {
    favoured: 'martial',
    mods: { commandCap: 2 },
  }),
  t('selective-breeding', 'Selective Breeding', 2, 65, [], 'Heavy horses.'),
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
  t('navigation', 'Navigation', 2, 60, [], 'Coastal cities prosper; ships see further.', {
    favoured: 'maritime',
    mods: { coastalPct: 5, navalPct: 10 },
  }),
  t('medieval-age', 'Medieval Age', 2, 100, [], 'Opens the Medieval age.', { gate: 11 }),
  // ---- medieval
  t('feudalism', 'Feudalism', 3, 120, [], 'Bigger levies.', {
    favoured: 'absolutist',
    mods: { levyCohorts: 1 },
  }),
  t('mechanics', 'Mechanics', 3, 130, [], 'Crossbows, pavises, windmills.'),
  t('chivalry', 'Chivalry', 3, 150, ['feudalism'], 'Lances and barded horses.', {
    favoured: 'martial',
  }),
  t('theology', 'Theology', 3, 140, [], 'Cathedrals.', {
    favoured: 'devout',
  }),
  t('education', 'Education', 3, 160, [], 'Universities.', {
    favoured: 'rationalist',
  }),
  t('guilds', 'Guilds', 3, 130, [], 'Guild halls.', {
    favoured: 'mercantile',
  }),
  t(
    'administration',
    'Administration',
    3,
    170,
    ['education'],
    'Wider territory and district reach.',
    { mods: { territoryRadius: 1, districtRadius: 1 } },
  ),
  t('mineralogy', 'Mineralogy', 3, 110, [], 'Reveals coal for mines.'),
  t('armour-smithing', 'Armour Smithing', 3, 180, ['mineralogy'], 'Plate armour and great helms.'),
  t('pike-tactics', 'Pike Tactics', 3, 140, ['feudalism'], 'Pikes.'),
  t('yeomanry', 'Yeomanry', 3, 120, [], 'Longbows.'),
  t('castles', 'Castles', 3, 150, ['feudalism'], 'Castles.', {
    mods: { cityDefensePct: 10 },
  }),
  t('urbanism', 'Urbanism', 3, 160, [], 'Tenements.', { mods: { housingPct: 5 } }),
  t('alchemy', 'Alchemy', 3, 150, ['mineralogy'], 'Reveals saltpeter for mines.'),
  t('compass', 'Compass', 3, 130, [], 'Coastal trade; sight.', {
    favoured: 'maritime',
    mods: { coastalPct: 10, sight: 1, navalPct: 10 },
  }),
  t('renaissance-age', 'Renaissance Age', 3, 220, [], 'Opens the Renaissance.', { gate: 10 }),
  // ---- renaissance
  t('gunpowder', 'Gunpowder', 4, 300, [], 'Arquebuses.'),
  t('printing', 'Printing Press', 4, 280, [], 'Printing houses.', {
    favoured: 'rationalist',
  }),
  t('banking', 'Banking', 4, 300, [], 'Stock exchanges.', {
    favoured: 'mercantile',
  }),
  t('astronomy', 'Astronomy', 4, 280, [], 'Observatories.', {
    favoured: 'solar',
  }),
  t('metallurgy', 'Metallurgy', 4, 320, [], 'Foundries and cuirasses.'),
  t('musketry', 'Musketry', 4, 380, ['gunpowder'], 'Muskets and bayonets.'),
  t('artillery', 'Artillery', 4, 400, ['gunpowder', 'metallurgy'], 'Field guns.', {
    mods: { siegePct: 15 },
  }),
  t('conscription', 'Conscription', 4, 360, ['musketry'], 'Much bigger levies.', {
    mods: { levyCohorts: 3 },
  }),
  t('officer-corps', 'Professional Officers', 4, 340, [], 'Much bigger formations.', {
    favoured: 'martial',
    mods: { commandCap: 3 },
  }),
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
  t('cartography', 'Cartography', 4, 300, ['printing'], 'Better maps.', {
    favoured: 'maritime',
    mods: { sight: 1, coastalPct: 5 },
  }),
  t('star-forts', 'Star Forts', 4, 350, ['gunpowder'], 'Cities hold against guns.', {
    mods: { cityDefensePct: 20 },
  }),
  t('industrial-age', 'Industrial Age', 4, 500, [], 'Opens the Industrial age.', { gate: 9 }),
  // ---- industrial: coal and steam, then steel, oil and electricity
  t(
    'steam-power',
    'Steam Power',
    5,
    420,
    [],
    'Pumping stations and steam sawmills burn coal to double their districts.',
  ),
  t(
    'railways',
    'Railways',
    5,
    480,
    ['steam-power'],
    'Railway stations burn coal for production and trade; faster roads.',
    { favoured: 'mercantile', mods: { roadCost: -0.15 } },
  ),
  t(
    'machine-tools',
    'Machine Tools',
    5,
    460,
    ['steam-power'],
    'Interchangeable parts: equipping troops costs a quarter less, and railways half the gold.',
    { mods: { refitPct: -25 } },
  ),
  t(
    'preservation',
    'Food Preservation',
    5,
    440,
    [],
    "Food packaging salts and tins: doubles a district's food.",
    {
      favoured: 'agrarian',
    },
  ),
  t(
    'oil-drilling',
    'Oil Drilling',
    5,
    500,
    ['steam-power'],
    'Reveals oil for mines. Power plants run better on it.',
  ),
  t('rifling', 'Rifling', 5, 520, ['machine-tools'], 'Rifles: steel and powder.', {
    favoured: 'martial',
  }),
  t(
    'electricity',
    'Electricity',
    5,
    600,
    ['machine-tools'],
    'Power plants make electricity; factories and research labs run on it.',
    { favoured: 'rationalist' },
  ),
  // ---- the Scientific victory: three national projects once every Industrial tech is known
  t(
    'great-observatory',
    'Great Observatory',
    5,
    900,
    [
      'steam-power',
      'railways',
      'machine-tools',
      'preservation',
      'oil-drilling',
      'rifling',
      'electricity',
    ],
    'National project 1 of 3 toward the Scientific victory: the heavens measured.',
    { project: 1 },
  ),
  t(
    'transcontinental-telegraph',
    'Transcontinental Telegraph',
    5,
    1100,
    ['great-observatory'],
    'National project 2 of 3 toward the Scientific victory: news at the speed of light.',
    { project: 2 },
  ),
  t(
    'powered-flight',
    'First Powered Flight',
    5,
    1300,
    ['transcontinental-telegraph'],
    'National project 3 of 3: completing it wins the Scientific victory.',
    { project: 3 },
  ),
];

export const TECHS: Record<string, TechInfo> = Object.fromEntries(TECH_LIST.map(x => [x.id, x]));

/** The gate tech that opens each age after the first. */
export const AGE_GATE: Record<number, string> = Object.fromEntries(
  TECH_LIST.filter(x => x.gate !== undefined).map(x => [x.era + 1, x.id]),
);

/** The latest age a people has reached: 1 + the gates it has researched. */
export const ageOf = (techs: string[]): number => {
  let age = 1;
  while (AGE_GATE[age + 1] && techs.includes(AGE_GATE[age + 1])) age++;
  return age;
};

/** Techs of an age, gates left out. */
export const ageTechs = (era: number) =>
  TECH_LIST.filter(x => x.era === era && x.gate === undefined);
