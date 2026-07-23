import type { Civilization, EventCategory, GreatPerson, HistoryEvent, Province, Rank, Religion, Terrain, WorldState } from './types';

const COLORS = ['#cf6b4f','#d3a84c','#6da86b','#4f90b8','#8a72c8','#c45f89','#6cb7ad','#c9874a','#7c9b52','#aa665c','#6f83c2','#b497d6','#be7a9d','#4fa3a5','#d47b56','#9ca34f','#748cbe','#b96d78','#689e7f','#9a7db7','#d19a52','#67a6b0','#8b9f64','#be6a5a','#7d79b8','#ca8461','#5c9b8c','#a98a54','#758fc0','#b06c96'];
const TRIBE_ROOTS = ['Amara','Achaean','Aksum','Alani','Andari','Arveni','Aureli','Bactri','Beran','Carthi','Celtai','Dacari','Etruri','Franci','Garam','Helveni','Iberi','Illyri','Kushai','Lusani','Mauri','Nabari','Numari','Ostari','Phoeni','Sabari','Sarmati','Thracai','Umbri','Vandari','Veneti','Yamari','Zagri'];
const PROCEDURAL_ROOTS = ['Ar','Bel','Cor','Dra','El','Fal','Gar','Hel','Ily','Kor','Lum','Mor','Nor','Or','Pra','Quel','Rav','Sol','Tor','Ur','Val','Wes','Xan','Yor','Zen'];
const PROCEDURAL_ENDS = ['ama','ara','eni','ari','ori','ani','iri','athi','uni','esi'];
const SETTLEMENT_ENDS = ['polis','ton','dun','grad','burg','ford','haven','ara','ium','essa','on','um'];
const HISTORIC_POLITIES = ['Athens','Sparta','Thebes','Rome','Carthage','Byzantium','Macedon','Persia','Egypt','Sumer','Babylon','Assyria','Numidia','Gaul','Iberia','Armenia','Georgia','Arabia','Scythia','Etruria','Phoenicia','Lydia','Media','Kush','Aksum','Mali','Songhai','China','India','Rus','Siam','Japan'];
const REGIONAL_NAMES = ['Albion','Anatolia','Arcadia','Baltica','Caledonia','Danubia','Hesperia','Levant','Maghreb','Pannonia','Sarmatia','Tartaria','Thule','Transoxiana','Valeria','Vesperia'];
const CULTURES = ['Riverfolk','Highlanders','Steppeborn','Coastlanders','Sunward','Forest Kin','Dune Clans','Lake People','Ironlanders','Northern Houses'];
const PERSON_FIRST = ['Cassian','Elira','Marcus','Loran','Aurelia','Tavian','Neris','Ilyan','Seraph','Mara','Oren','Valeria','Darius','Kael','Sorin','Lysandra','Theon','Mira','Edrin','Sabine'];
const TRAITS = ['Ambitious','Charismatic','Cruel','Genius','Diplomatic','Zealous','Bold','Patient','Builder','Reformer','Cautious','Visionary'];
const RANKS: Rank[] = ['Tribe','Settlement','City-State','Duchy','Kingdom','Empire'];

class RNG {
  constructor(public seed: number) {}
  next() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  int(min: number, max: number) { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick<T>(arr: T[]): T { return arr[this.int(0, arr.length - 1)]; }
  chance(p: number) { return this.next() < p; }
}

const cleanRoot = (name: string) => name.replace(/\s+(Tribe|Settlement|League|Duchy|Kingdom|Empire)$/i,'').replace(/(polis|grad|burg|ium|land)$/i,'');
const adjectiveFor = (name: string) => `${cleanRoot(name).replace(/[^A-Za-z]/g,'') || 'Realm'}${/a$/.test(name) ? 'n' : 'ian'}`;
const tribalName = (rng: RNG) => rng.chance(.6) ? rng.pick(TRIBE_ROOTS) : `${rng.pick(PROCEDURAL_ROOTS)}${rng.pick(PROCEDURAL_ENDS)}`;
const settlementName = (root: string, rng: RNG) => `${cleanRoot(root)}${rng.pick(SETTLEMENT_ENDS)}`;
const formatYear = (year: number) => year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;

function person(rng: RNG, id: number, year: number, role: GreatPerson['role'] = 'Ruler'): GreatPerson {
  const n = `${rng.pick(PERSON_FIRST)} ${tribalName(rng)}`;
  return { id, name: n, role, trait: rng.pick(TRAITS), born: year - rng.int(18, 45), fame: rng.int(10, 45), achievement: 'Their legacy has not yet been written.' };
}

function terrainFor(rng: RNG, x: number, y: number, width: number, height: number): Terrain {
  const edge = x < 1 || y < 1 || x > width - 2 || y > height - 2;
  if (edge && rng.chance(.72)) return 'ocean';
  const roll = rng.next();
  if (roll < .11) return 'ocean';
  if (roll < .23) return 'mountain';
  if (roll < .42) return 'forest';
  if (roll < .54) return 'desert';
  if (roll < .61) return 'tundra';
  return 'plains';
}

function getNeighbors(p: Province, provinces: Province[]): Province[] {
  const dirs = p.y % 2 === 0 ? [[-1,0],[1,0],[-1,-1],[0,-1],[-1,1],[0,1]] : [[-1,0],[1,0],[0,-1],[1,-1],[0,1],[1,1]];
  return dirs.map(([dx,dy]) => provinces.find(q => q.x === p.x + dx && q.y === p.y + dy)).filter(Boolean) as Province[];
}

function event(state: WorldState, category: EventCategory, title: string, description: string, importance: number, civIds: number[]) {
  const e: HistoryEvent = { id: state.nextEventId++, year: state.year, category, title, description, importance, civIds };
  state.events.unshift(e);
  civIds.forEach(id => state.civilizations.find(c => c.id === id)?.history.unshift(e.id));
}

function uniqueName(state: WorldState, proposed: string, id: number) {
  if (!state.civilizations.some(c => c.id !== id && c.name === proposed && c.provinces.length > 0)) return proposed;
  const suffixes = ['the Elder','the Younger','of the North','of the South','of the East','of the West'];
  return `${proposed} ${suffixes[id % suffixes.length]}`;
}

function renameCivilization(state: WorldState, civ: Civilization, newName: string, reason: string, importance = 7) {
  newName = uniqueName(state, newName, civ.id);
  if (civ.name === newName) return;
  const oldName = civ.name;
  civ.name = newName;
  civ.adjective = adjectiveFor(newName);
  civ.nameHistory.push({ name: newName, rank: civ.rank, from: state.year, reason });
  event(state, 'culture', `${oldName} becomes ${newName}`, `${oldName} adopted the name ${newName} ${reason}. Its people still traced their oldest identity to the ${civ.originTribe} tribe.`, importance, [civ.id]);
}

function politicalName(civ: Civilization, rank: Rank, state: WorldState, rng: RNG): string {
  const root = cleanRoot(civ.originTribe);
  if (rank === 'Settlement') return settlementName(root, rng);
  if (rank === 'City-State') {
    if (rng.chance(.48)) return rng.pick(HISTORIC_POLITIES);
    return civ.capital;
  }
  if (rank === 'Duchy') return rng.chance(.45) ? `Duchy of ${civ.capital}` : `${root} League`;
  if (rank === 'Kingdom') {
    if (rng.chance(.35)) return rng.pick(REGIONAL_NAMES);
    return rng.chance(.55) ? `${root}land` : `Kingdom of ${civ.capital}`;
  }
  if (rank === 'Empire') {
    const base = rng.chance(.30) ? rng.pick(HISTORIC_POLITIES) : (rng.chance(.35) ? rng.pick(REGIONAL_NAMES) : root);
    return `${base} Empire`;
  }
  return `${root} Tribe`;
}

function rankFor(c: Civilization): Rank {
  const p = c.provinces.length, pop = c.population, pres = c.prestige;
  if (p >= 18 && pop >= 160000 && pres >= 80) return 'Empire';
  if (p >= 10 && pop >= 65000) return 'Kingdom';
  if (p >= 6 && pop >= 22000) return 'Duchy';
  if (p >= 3 && pop >= 6500) return 'City-State';
  if (pop >= 1800) return 'Settlement';
  return 'Tribe';
}

function eraTechCap(year: number) {
  if (year < -1800) return 18; if (year < -700) return 32; if (year < 500) return 46; if (year < 1400) return 60; if (year < 1750) return 73; if (year < 1950) return 90; return 100;
}

export function createWorld(seed = Date.now()): WorldState {
  const rng = new RNG(seed >>> 0);
  const width = 22, height = 13;
  const provinces: Province[] = [];
  for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
    const terrain = terrainFor(rng,x,y,width,height);
    const fertility = terrain === 'plains' ? rng.int(55,95) : terrain === 'forest' ? rng.int(40,78) : terrain === 'desert' ? rng.int(8,35) : terrain === 'mountain' ? rng.int(15,45) : terrain === 'tundra' ? rng.int(10,38) : 0;
    provinces.push({ id:y*width+x, x, y, terrain, fertility, ownerId:null, population:terrain === 'ocean' ? 0 : rng.int(40,260) });
  }
  const land = provinces.filter(p => p.terrain !== 'ocean');
  const civilizations: Civilization[] = [];
  const usedRoots = new Set<string>();
  for (let i=0; i<30; i++) {
    const available = land.filter(p => p.ownerId === null && getNeighbors(p,provinces).some(n => n.terrain !== 'ocean'));
    const start = rng.pick(available.length ? available : land);
    start.ownerId = i;
    let root = tribalName(rng); while (usedRoots.has(root)) root = tribalName(rng); usedRoots.add(root);
    const name = `${root} Tribe`;
    const ruler = person(rng,i+1,-3000,'Ruler');
    civilizations.push({
      id:i, name, adjective:adjectiveFor(root), color:COLORS[i%COLORS.length], rank:'Tribe', founded:-3000, originTribe:root,
      capital:`Camp ${root}`, culture:rng.pick(CULTURES), ruler, population:start.population, economy:rng.int(8,18), military:rng.int(8,18),
      technology:rng.int(2,8), stability:rng.int(45,85), prestige:rng.int(3,12), faithId:null, allies:[], rivals:[], provinces:[start.id], history:[],
      nameHistory:[{name,rank:'Tribe',from:-3000,reason:'as its first recorded tribal identity'}], absorbedCultures:[], predecessorIds:[],
      peakPopulation:start.population, peakProvinces:1, warsWon:0, warsLost:0,
    });
  }
  return { seed, year:-3000, provinces, civilizations, religions:[], events:[], nextEventId:1, nextPersonId:31, nextReligionId:1, nextCivilizationId:30 };
}

function handleRankChange(state: WorldState, civ: Civilization, oldRank: Rank, rng: RNG) {
  if (civ.rank === oldRank) return;
  const rose = RANKS.indexOf(civ.rank) > RANKS.indexOf(oldRank);
  if (rose) {
    if (civ.rank === 'Settlement') civ.capital = settlementName(civ.originTribe,rng);
    const newName = politicalName(civ,civ.rank,state,rng);
    renameCivilization(state,civ,newName,`after rising from ${oldRank} to ${civ.rank}`,8);
  } else {
    event(state,'culture',`${civ.name} falls to ${civ.rank}`,`Political decline reduced ${civ.name} from ${oldRank} to ${civ.rank}, though its inherited name and civilizational memory endured.`,6,[civ.id]);
    civ.nameHistory.push({name:civ.name,rank:civ.rank,from:state.year,reason:`after declining from ${oldRank}`});
  }
}

function mergeCivilizations(state: WorldState, a: Civilization, b: Civilization, rng: RNG) {
  const leader = (a.prestige+a.economy+a.population/10000) >= (b.prestige+b.economy+b.population/10000) ? a : b;
  const partner = leader === a ? b : a;
  const oldLeaderName = leader.name, oldPartnerName = partner.name;
  partner.provinces.forEach(id => { state.provinces[id].ownerId = leader.id; if (!leader.provinces.includes(id)) leader.provinces.push(id); });
  leader.population += Math.round(partner.population*.92);
  leader.economy = Math.min(100,(leader.economy+partner.economy)/2+5);
  leader.military = Math.min(100,(leader.military+partner.military)/2+3);
  leader.prestige = Math.min(100,leader.prestige+12);
  leader.stability = Math.max(20,leader.stability-4);
  leader.absorbedCultures = [...new Set([...leader.absorbedCultures,partner.culture,partner.originTribe,...partner.absorbedCultures])];
  leader.predecessorIds = [...new Set([...leader.predecessorIds,partner.id,...partner.predecessorIds])];
  partner.provinces = [];
  partner.population = Math.max(80,Math.round(partner.population*.08));
  partner.stability = 0;
  const rank = rankFor(leader); leader.rank = RANKS.indexOf(rank)>RANKS.indexOf(leader.rank)?rank:leader.rank;
  const unionName = rng.chance(.5) ? rng.pick(HISTORIC_POLITIES) : `${cleanRoot(leader.originTribe)}-${cleanRoot(partner.originTribe)} Union`;
  renameCivilization(state,leader,leader.rank==='Kingdom'?`Kingdom of ${unionName}`:unionName,`after ${oldLeaderName} and ${oldPartnerName} were joined by marriage and compact`,10);
  event(state,'diplomacy',`${oldLeaderName} and ${oldPartnerName} unite`,`A dynastic marriage and agreement among their leading settlements peacefully combined both realms. ${leader.name} inherited the lands, peoples and rivalries of both predecessors.`,10,[leader.id,partner.id]);
}

function splitEmpire(state: WorldState, parent: Civilization, rng: RNG) {
  if (parent.provinces.length < 15) return;
  const pieces = rng.chance(.28) ? 3 : 2;
  const shuffled = [...parent.provinces].sort(()=>rng.next()-.5);
  const inheritedNames = ['Western','Eastern','Northern','Southern'];
  const oldName = parent.name;
  for (let piece=1; piece<pieces; piece++) {
    const take = shuffled.slice(Math.floor(shuffled.length*piece/pieces),Math.floor(shuffled.length*(piece+1)/pieces));
    if (take.length < 3) continue;
    const id = state.nextCivilizationId++;
    const successorRoot = rng.chance(.45) ? parent.originTribe : tribalName(rng);
    const successorName = rng.chance(.55) ? `${inheritedNames[piece-1]} ${oldName}` : `${successorRoot} Empire`;
    const successor: Civilization = {
      ...structuredClone(parent), id, name:uniqueName(state,successorName,id), adjective:adjectiveFor(successorName), color:COLORS[id%COLORS.length],
      founded:state.year, originTribe:successorRoot, capital:settlementName(successorRoot,rng), ruler:person(rng,state.nextPersonId++,state.year,'Ruler'),
      population:Math.round(parent.population*(take.length/parent.provinces.length)), provinces:take, history:[], allies:[], rivals:[parent.id],
      nameHistory:[{name:successorName,rank:'Empire',from:state.year,reason:`as a successor to ${oldName}`}], predecessorIds:[parent.id,...parent.predecessorIds], parentEmpireId:parent.id,
      peakPopulation:0, peakProvinces:take.length, warsWon:0, warsLost:0, stability:rng.int(28,58), prestige:Math.max(25,parent.prestige-rng.int(10,25)),
    };
    successor.peakPopulation=successor.population;
    take.forEach(pid=>state.provinces[pid].ownerId=id);
    state.civilizations.push(successor);
    parent.provinces=parent.provinces.filter(pid=>!take.includes(pid));
    parent.population=Math.max(100,parent.population-successor.population);
    parent.rivals.push(id);
    event(state,'society',`${successor.name} emerges from ${oldName}`,`Governors, generals and regional peoples broke from ${oldName}, creating ${successor.name}. It claimed the imperial legacy while developing an identity rooted in the ${successor.originTribe} tradition.`,10,[parent.id,id]);
  }
  parent.stability=Math.max(8,parent.stability-25);
  parent.rank=rankFor(parent);
  renameCivilization(state,parent,`Western ${oldName}`,`after the imperial succession crisis divided the old realm`,10);
}

function simulateYear(state: WorldState, rng: RNG) {
  state.year++;
  for (const c of state.civilizations.filter(c=>c.provinces.length>0)) {
    const oldRank=c.rank;
    const fertility=c.provinces.reduce((s,id)=>s+(state.provinces[id]?.fertility??0),0)/Math.max(1,c.provinces.length);
    const growth=Math.max(-.02,.012+fertility/10000+c.stability/18000-c.population/9000000);
    c.population=Math.max(80,Math.round(c.population*(1+growth)));
    c.economy=Math.min(100,c.economy+rng.next()*.7+c.provinces.length*.012);
    c.technology=Math.min(eraTechCap(state.year),c.technology+rng.next()*.18+c.economy/2200);
    c.military=Math.min(100,Math.max(2,c.military+rng.next()*.6-.17+c.population/6000000));
    c.stability=Math.max(5,Math.min(100,c.stability+rng.next()*2-1));
    c.prestige=Math.max(0,Math.min(100,c.prestige+rng.next()*.5-.1));
    c.peakPopulation=Math.max(c.peakPopulation,c.population); c.peakProvinces=Math.max(c.peakProvinces,c.provinces.length);

    if (rng.chance(.018)) {
      const border=c.provinces.flatMap(id=>getNeighbors(state.provinces[id],state.provinces)).filter(p=>p.terrain!=='ocean'&&p.ownerId===null);
      if (border.length) { const target=rng.pick(border); target.ownerId=c.id; c.provinces.push(target.id); c.population+=target.population; if(rng.chance(.25)) event(state,'society',`${c.name} settles new lands`,`${c.adjective} settlers founded another community, extending the realm to ${c.provinces.length} provinces.`,2,[c.id]); }
    }

    c.rank=rankFor(c); handleRankChange(state,c,oldRank,rng);

    if (rng.chance(.004)) { const old=c.ruler; old.died=state.year; c.ruler=person(rng,state.nextPersonId++,state.year,'Ruler'); event(state,'society',`${c.ruler.name} takes power`,`${old.name} was succeeded by ${c.ruler.name}, a ${c.ruler.trait.toLowerCase()} ruler of ${c.name}.`,4,[c.id]); }
    if (rng.chance(.0022)&&state.religions.length<20) { const prophet=person(rng,state.nextPersonId++,state.year,'Prophet'); const religion:Religion={id:state.nextReligionId++,name:`${rng.pick(['Solar','River','Sky','Sacred','Radiant','Eternal','Moon','Dawn'])} ${rng.pick(['Faith','Way','Church','Path','Order','Covenant'])}`,founder:prophet.name,founded:state.year,followers:Math.round(c.population*.55),color:rng.pick(COLORS),holyCity:c.capital}; state.religions.push(religion); c.faithId=religion.id; c.prestige=Math.min(100,c.prestige+8); event(state,'religion',`${religion.name} is founded`,`${prophet.name} began preaching in ${c.capital}. The new faith rapidly spread through ${c.name}.`,9,[c.id]); }
    if (rng.chance(.0035)) { const type=rng.pick(['great harvest','merchant boom','mining discovery','new trade route']); c.economy=Math.min(100,c.economy+rng.int(3,8)); event(state,'economy',`${c.name} enjoys a ${type}`,`Prosperity enriched ${c.capital} and strengthened the ${c.adjective} economy.`,4,[c.id]); }
    if (rng.chance(.0025)) { const loss=rng.int(5,18)/100; c.population=Math.round(c.population*(1-loss)); c.stability=Math.max(5,c.stability-rng.int(3,10)); event(state,'society',`Famine strikes ${c.name}`,`Poor harvests killed or displaced roughly ${Math.round(loss*100)}% of the population.`,6,[c.id]); }
    if (rng.chance(.002)&&!c.goldenAge) { c.goldenAge={start:state.year}; c.prestige=Math.min(100,c.prestige+10); event(state,'culture',`A golden age begins in ${c.name}`,`Artists, scholars and builders transformed ${c.capital} into a great cultural center.`,7,[c.id]); }
    else if(c.goldenAge&&!c.goldenAge.end&&state.year-c.goldenAge.start>40&&rng.chance(.01)){c.goldenAge.end=state.year;event(state,'culture',`${c.name}'s golden age ends`,`The cultural flowering that began in ${formatYear(c.goldenAge.start)} came to an end.`,5,[c.id]);}
    if(c.rank==='Empire'&&c.stability<28&&c.provinces.length>=15&&rng.chance(.018)) splitEmpire(state,c,rng);
  }

  if(rng.chance(.085)) simulateConflict(state,rng);
  if(rng.chance(.028)) simulateDiplomacy(state,rng);
  if(rng.chance(.0015)) worldDisaster(state,rng);
  for(const r of state.religions){const hostPop=state.civilizations.filter(c=>c.faithId===r.id&&c.provinces.length).reduce((s,c)=>s+c.population,0);r.followers=Math.max(r.followers,Math.round(hostPop*(.65+rng.next()*.25)));if(rng.chance(.006)){const candidates=state.civilizations.filter(c=>c.faithId!==r.id&&c.provinces.length);if(candidates.length){const c=rng.pick(candidates);c.faithId=r.id;event(state,'religion',`${r.name} spreads to ${c.name}`,`Missionaries and merchants carried ${r.name} into ${c.capital}, where the court embraced it.`,5,[c.id]);}}}
}

function simulateConflict(state: WorldState,rng:RNG){
  const alive=state.civilizations.filter(c=>c.provinces.length>0); if(alive.length<2)return;
  const attacker=rng.pick(alive); const frontier=attacker.provinces.flatMap(id=>getNeighbors(state.provinces[id],state.provinces)).filter(p=>p.ownerId!==null&&p.ownerId!==attacker.id); if(!frontier.length)return;
  const targetProv=rng.pick(frontier), defender=state.civilizations.find(c=>c.id===targetProv.ownerId)!;
  const a=attacker.military*(.6+rng.next()*.8)*Math.log10(attacker.population+10), d=defender.military*(.7+rng.next()*.9)*Math.log10(defender.population+10);
  const winner=a>d?attacker:defender, loser=a>d?defender:attacker; winner.warsWon++;loser.warsLost++;winner.prestige=Math.min(100,winner.prestige+2);loser.stability=Math.max(5,loser.stability-3);
  if(winner===attacker){targetProv.ownerId=attacker.id;defender.provinces=defender.provinces.filter(id=>id!==targetProv.id);attacker.provinces.push(targetProv.id);attacker.population+=Math.round(targetProv.population*.7);defender.population=Math.max(80,defender.population-Math.round(targetProv.population*.7));if(!attacker.absorbedCultures.includes(defender.originTribe))attacker.absorbedCultures.push(defender.originTribe);}
  const dramatic=Math.min(a,d)/Math.max(a,d)>.82;
  event(state,'military',`${winner.name} defeats ${loser.name}`,`${winner.ruler.name}'s forces won ${dramatic?'a fiercely contested':'a decisive'} war against ${loser.name}${winner===attacker?', seizing a frontier province':''}.`,dramatic?7:5,[winner.id,loser.id]);
  if(defender.provinces.length===0){attacker.predecessorIds=[...new Set([...attacker.predecessorIds,defender.id,...defender.predecessorIds])];event(state,'military',`${defender.name} is absorbed by ${attacker.name}`,`${attacker.name} conquered the last territory of ${defender.name}. Its state disappeared, but the ${defender.originTribe} people and culture survived inside the victorious realm.`,10,[attacker.id,defender.id]);}
}

function simulateDiplomacy(state:WorldState,rng:RNG){
  const alive=state.civilizations.filter(c=>c.provinces.length>0);if(alive.length<2)return;
  const a=rng.pick(alive),b=rng.pick(alive.filter(c=>c.id!==a.id));
  const canUnite=a.allies.includes(b.id)&&RANKS.indexOf(a.rank)>=1&&RANKS.indexOf(b.rank)>=1&&a.provinces.length+b.provinces.length<=18;
  if(canUnite&&rng.chance(.16)){mergeCivilizations(state,a,b,rng);return;}
  if(rng.chance(.58)){if(!a.allies.includes(b.id)){a.allies.push(b.id);b.allies.push(a.id);event(state,'diplomacy',`${a.name} and ${b.name} form an alliance`,`A pact of friendship, trade and mutual defense was sealed between ${a.capital} and ${b.capital}.`,4,[a.id,b.id]);}}
  else if(!a.rivals.includes(b.id)){a.rivals.push(b.id);b.rivals.push(a.id);event(state,'diplomacy',`A rivalry begins between ${a.name} and ${b.name}`,`Competing claims, trade disputes and courtly insults turned the two powers into lasting rivals.`,4,[a.id,b.id]);}
}

function worldDisaster(state:WorldState,rng:RNG){const kind=rng.pick(['volcanic winter','great plague','mega-drought','earthquake age','cold decade']);const loss=rng.int(3,12)/100;state.civilizations.filter(c=>c.provinces.length).forEach(c=>{c.population=Math.round(c.population*(1-loss));c.stability=Math.max(5,c.stability-rng.int(2,8));});event(state,'world',`The ${kind} reshapes the world`,`Across continents, harvests failed and populations declined by roughly ${Math.round(loss*100)}%. Strong states endured; fragile realms began to fracture.`,10,[]);}

export function advanceWorld(input:WorldState,years:number):WorldState{const state=structuredClone(input) as WorldState;if(state.nextCivilizationId===undefined)state.nextCivilizationId=state.civilizations.length;const rng=new RNG((state.seed+state.year*2654435761+state.nextEventId*97)>>>0);for(let i=0;i<years;i++)simulateYear(state,rng);state.events=state.events.slice(0,1500);return state;}
export const rankWeight=(rank:Rank)=>RANKS.indexOf(rank);
export const displayYear=formatYear;
export const eraName=(year:number)=>year<-2000?'Age of Tribes':year<-800?'Bronze Age':year<400?'Classical Age':year<1200?'Age of Kingdoms':year<1550?'Late Medieval Age':year<1800?'Age of Discovery':year<1914?'Industrial Age':year<2000?'Modern Age':'Information Age';
