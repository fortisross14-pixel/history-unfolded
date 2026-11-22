/** Checks research goals and costs, the culture web (forks, tags, bonuses) and upheavals. */
import { CULTURE } from '../src/data/culture.ts';
import { TECHS } from '../src/data/techs.ts';
import {
  nodeStatus,
  resolveUpheaval,
  startUpheaval,
  takeNode,
  UPHEAVAL_TURNS,
} from '../src/engine/culture.ts';
import {
  availableTechs,
  endTurn,
  foundCity,
  newGame,
  player,
  setResearchGoal,
  techCost,
} from '../src/engine/game.ts';
import { civMods, identity } from '../src/engine/mods.ts';
import { capOf } from '../src/engine/units.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

const s = newGame({
  map: {
    type: 'pangaea',
    size: 'small',
    seaLevel: 'normal',
    climate: 'normal',
    rainfall: 'normal',
    resources: 'normal',
    mountains: 'normal',
    seed: 5,
  },
  civCount: 4,
  playerName: 'Test',
});
const me = player(s);
foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);

// ---- research
check(techCost(s, me, 'mining') < techCost(s, me, 'iron-working'), 'later eras cost more');
check(
  techCost(s, me, 'iron-working') === Math.round(TECHS['iron-working'].cost * 2),
  'classical techs cost 2x their base',
);
check(!availableTechs(me).some(t => t.era > 1), 'only the Ancient age is open at the start');
check(
  !availableTechs(me).some(t => t.id === 'classical-age'),
  'the Classical Age needs Ancient techs first',
);
const g = setResearchGoal(s, me.id, 'iron-working');
check(
  g.ok && !!me.researching && TECHS[me.researching].era === 1,
  `goal Iron Working starts with an Ancient tech (${me.researching})`,
);
me.science = 100000;
for (let t = 0; t < 14 && !me.techs.includes('iron-working'); t++) endTurn(s);
check(
  me.techs.includes('classical-age') && me.techs.includes('iron-working'),
  `goal reached through the Classical Age: ${me.techs.join(', ')}`,
);
check(
  me.techs.filter(t => TECHS[t].era === 1 && !TECHS[t].gate).length >= 9,
  'the age gate took 9 Ancient techs',
);
check(me.researchGoal === null || me.techs.includes('iron-working'), 'goal cleared once reached');

// ---- culture: forks, tags, bonuses
me.culture.points = 1000;
check(takeNode(s, me.id, 'star-lore').ok, 'adopt Star Lore');
check(!takeNode(s, me.id, 'sun-cult').ok, 'Sun Cult needs the Solar Calendar first');
check(takeNode(s, me.id, 'solar-calendar').ok, 'adopt the Solar Calendar');
const lunar = nodeStatus(me, CULTURE['lunar-calendar']);
check(lunar.kind === 'locked' && lunar.by === 'solar-calendar', 'the Lunar Calendar is now closed');
check(
  nodeStatus(me, CULTURE['tide-lore']).kind === 'needs',
  'and so is everything that grows from it',
);
const farm0 = civMods(s, me.id).groupPct.farming ?? 0;
check(farm0 >= 10, `Solar Calendar gives +10% farming (${farm0})`);
takeNode(s, me.id, 'sun-cult');
takeNode(s, me.id, 'monumental-astronomy');
const solar = identity(me).find(i => i.tag === 'solar');
check(
  solar && solar.count === 3 && solar.tier === 1,
  'three solar choices reach the first identity tier',
);
check(
  (civMods(s, me.id).groupPct.farming ?? 0) >= farm0 + 10,
  'the solar tier adds its own farming bonus',
);
// cross-domain requirement
check(
  nodeStatus(me, CULTURE['rational-astronomy']).kind === 'needs',
  'Rational Astronomy also needs a Knowledge choice',
);
takeNode(s, me.id, 'oral-tradition');
takeNode(s, me.id, 'scribes');
check(
  nodeStatus(me, CULTURE['rational-astronomy']).kind === 'available',
  '…which Scribes provides',
);
// caps from culture
const army = s.formations.find(f => f.civId === me.id && f.kind === 'army')!;
const cap0 = capOf(army, s);
takeNode(s, me.id, 'chiefdom');
check(capOf(army, s) === cap0 + 1, `Chiefdom raises the command cap (${cap0} → ${capOf(army, s)})`);

// ---- upheaval: the calendar reform reopens the closed fork
me.culture.tension.cosmology = 120;
const up = startUpheaval(s, me.id, 'cosmology');
check(up.ok && me.culture.upheaval?.domain === 'cosmology', 'calendar reform starts: ' + up.msg);
check(!takeNode(s, me.id, 'rational-astronomy').ok, 'no new cosmology choices during the upheaval');
check(civMods(s, me.id).sciencePct < 0 || civMods(s, me.id).prodPct < 0, 'upheaval hurts yields');
for (let t = 0; t < UPHEAVAL_TURNS && !me.culture.choosing; t++) endTurn(s);
check(me.culture.choosing === 'cosmology', 'when it ends the player chooses what to keep');
const r = resolveUpheaval(s, me.id, ['star-lore']);
check(
  r.ok && me.culture.legacy.includes('solar-calendar') && me.culture.taken.includes('star-lore'),
  'kept Star Lore; the Solar Calendar became legacy',
);
check(
  nodeStatus(me, CULTURE['lunar-calendar']).kind === 'available',
  'the Lunar Calendar is open again',
);
check(!identity(me).some(i => i.tag === 'solar'), 'legacy choices give no tags');
check((civMods(s, me.id).groupPct.farming ?? 0) > 0, 'but keep half their effect');
check(me.culture.tension.cosmology === 0, 'tension reset');
me.culture.points = 1000;
check(takeNode(s, me.id, 'lunar-calendar').ok, 'take the new path: Lunar Calendar');

// ---- AI peoples build identities over a long game
for (let t = 0; t < 200; t++) endTurn(s);
const ais = s.civs.filter(c => !c.isPlayer && c.alive);
for (const c of ais)
  console.log(
    `     ${c.name}: ${c.techs.length} techs, ${c.culture.taken.length} choices, identity ${identity(
      c,
    )
      .slice(0, 3)
      .map(i => `${i.tag}${i.count}`)
      .join(' ')}`,
  );
check(
  ais.every(c => c.culture.taken.length >= 5 && c.techs.length >= 15),
  'every AI people researches and adopts culture',
);
const ids = new Set(ais.map(c => identity(c)[0]?.tag));
check(ids.size >= Math.min(2, ais.length), `peoples grow apart: top tags ${[...ids].join(', ')}`);

console.log(failures ? `${failures} failures` : 'all culture checks passed');
process.exit(failures ? 1 : 0);
