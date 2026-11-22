# Game Design Document — working title "History Unfolded: Forge"

Status: draft 0.2 (decisions from review applied, see §17) · Scope: a turn-based, hex-map 4X in the classic civilization-builder mould, where
**armies, buildings and cultures are all assembled by the player** instead of picked from fixed lists.

---

## 1. One-line pitch

Every civilization starts the same. What you research gives you *parts*, not finished things:
you build your own troops from equipment, your own districts from building slots, and your own
culture from a branching web of choices that close other doors. By the late game, no two
civilizations look, fight or think alike, and each got that way through its own choices.

## 2. Design pillars

1. **Familiar chassis.** Hex map, fog of war, cities, units that move and fight, resources on the
   map, a tech tree, turns. If you have played a civ-style game you know how to play in 5 minutes.
   We do not reinvent any of this.
2. **Parts, not products.** Research unlocks *components* (a bow, plate armour, a cattle pen, a
   bank). The player combines them. There is no "Musketman" or "Bank building" in the game data.
3. **Real people, real goods.** Soldiers are population. Equipment is made of goods that come
   from real places on the map. A strong army costs you citizens and resources.
4. **Choices that close doors.** Culture choices lock other options. Changing course is possible,
   but only through upheaval (revolution, reformation, schism) and it costs something.
5. **Emergent dominance, temporary.** Finding a combination that crushes your neighbours is a
   feature, not a bug. The counter-play is that others can research and design their way past it.

## 3. What we keep, cut and add

| Keep (standard 4X) | Cut | Add / change |
|---|---|---|
| Hex map, terrain, rivers, coasts, fog of war | Fixed unit types and unit upgrade lines | Units built from cohorts of 100 people with editable loadouts |
| Cities that grow and claim territory | Fixed building lists per city | Districts: a 3×3 slot grid the player designs and names |
| Map resources (bonus, strategic, luxury) | Unique civ abilities, unique units, unique buildings | All civs start identical; identity comes from the culture web |
| Movement points, zones of control, combat odds preview | "One unit per tile" stacking rule | Moving a formation onto a friendly one merges them |
| Tech tree with eras | Tech that unlocks finished units/buildings | Tech unlocks equipment, slot types and caps |
| Diplomacy, war, peace, borders | Civics/policy cards swapped freely | Culture web with exclusive branches and upheaval events |
| Turn-based, single player vs AI | Global/national resource pool | Goods stored per city; roads join cities into shared **markets** |

## 4. The map

- **Always procedural.** Every game generates a new map from a seed; there is no Earth or fixed
  map. Map *types* make games feel different, not just reshuffled:
  - **Continents** (2–4 large landmasses), **Pangaea** (one landmass, land war heavy),
    **Archipelago** (many islands, sea game), **Inland Sea** (land ring around a central sea),
    **Highlands** (mountain chains and valleys, choke points), **Fractal/Random** (anything).
  - Settings: size, sea level, climate (cold ↔ hot), rainfall (dry ↔ wet), resource abundance,
    mountain density, seed (shareable). "Random" picks all of them.
  - Generation pipeline: heightmap (layered noise + plate-like ridges) → land/sea by sea level →
    temperature by latitude and height → moisture → terrain/feature → rivers flowing downhill to
    sea → deposits placed by terrain rules → start positions balanced.
- **Art is swappable.** Terrain, features, deposits and units are drawn through a tile/sprite
  registry keyed by id. The first version uses simple generated shapes and colours; the owner's
  existing art packs can be dropped in later without engine changes.
- **Hex grid**, axial coordinates, pointy-top. Map sizes from Small (~1,500 hexes, 4 civs) to
  Huge (~6,000 hexes, 10 civs).
- **Terrain** (one per hex): grassland, plains, desert, tundra, snow, coast, ocean, lake.
  **Features** (optional, on top): forest, jungle, marsh, hills, mountains (impassable early),
  river edges, oasis, floodplain.
- **Deposits** (zero or one per hex, some hidden until researched):
  - *Food & animals:* wild game, pigs, cattle, sheep, horses, fish, whales, wheat, rice, maize.
  - *Raw materials:* wood (forests), stone, clay, copper, tin, iron, coal, saltpeter, sulfur, oil.
  - *Luxuries:* ivory, furs, silk, spices, dyes, gold, silver, gems, wine, incense.
  - Each deposit has a **richness** (1–3) that scales what slots built on it produce.
- **Revealing deposits.** Iron, coal, saltpeter and oil are invisible until the right tech
  ("Prospecting", "Mineralogy", "Chemistry", "Geology") is known, as in the genre standard.
- **Goods on the map.** Deposits are what you can *extract*. Districts turn them into goods
  (§7). Trade routes and roads move goods between your cities.

## 5. Units: designs, cohorts and formations

### 5.1 The model

- A **unit design** is a named unit type the player creates: a name ("Hoplites", "Foot Falcons",
  "Iron Wall") plus one item in every equipment slot. Designs belong to the civilization, not to a
  city or a formation, and there is no limit on how many you keep.
- A **cohort** is **100 people**. Each cohort is assigned to one design and carries that design's
  gear.
- A **formation** is what you see on the map: one counter on one hex, made of cohorts.
- **The combination is what is powerful.** A levy of 500 can become 200 *Foot Falcons*
  (spear and shield) and 300 *Hornets* (javelins). The formation's strength comes from how its
  designs work together in battle (§6), not from any single design.
- The formation panel groups cohorts by design, e.g.
  `"Northern Host" — 10 cohorts (1,000 people): 6 × Hoplites, 4 × Longbows`.

### 5.2 Raising troops

- A city **levies** a new formation of **5 cohorts (500 people)**. These come out of the city's
  population and only return when the troops heal at home or are disbanded there.
- A fresh levy carries no gear (improvised weapons). It shows as *Levy* until assigned a design.
- Later techs raise levy size (Conscription → 8 cohorts) and the formation cap (§5.5).

### 5.3 Equipment slots

| Slot | Examples (by era) | What it mostly affects |
|---|---|---|
| **Weapon** | club, sling, javelins, spear, bow, axe, sword, crossbow, pike, musket | attack, ranged or melee, damage type, anti-charge |
| **Shield** | wicker, hide, bronze, kite, pavise | protection, mostly against missiles; not with two-handed weapons |
| **Helmet** | leather cap, bronze helmet, great helm | protection against crushing blows, morale |
| **Body armour** | padded, leather, bronze scale, ivory lamellar, chain, plate | protection by damage type, weight |
| **Footwear** | sandals, marching boots | morale, crossing rough ground faster |
| **Ride** | on foot, horse, camel, elephant, later wagons and trucks | movement, charge, flanking, upkeep |
| **Kit** | scouting gear, war banner, field medics, siege tools | special effects for the cohort or the whole formation |

Very few combinations are forbidden; the only hard rule so far is no shield with a two-handed
weapon (bow, axe). Everything else is "allowed, but here is the trade-off": weight slows foot
troops, horses are poor in forest and marsh, heavy gear costs scarce metals.

Each item has a tech requirement (if any), a goods cost per cohort, gold upkeep per turn, weight,
and its combat numbers: attack and damage type (*cut, pierce, crush, missile*), protection per
damage type, charge, anti-charge, morale, movement, sight.

### 5.4 Designing and assigning

- **Unit designs screen:** name the design, pick an item per slot, see the per-cohort numbers
  (role, melee, ranged, charge, anti-charge, protection by type, morale, moves, upkeep, gear
  cost). Save, save as new, or retire it.
- **Assigning:** in a formation, choose how many cohorts of each group to select (e.g. 2 of the
  5 levy cohorts), pick a design, see the goods it will cost from the nearest city, and equip.
  Only slots that change are paid for; gear taken off returns 50% to the city's store.
- **Editing a design** does not re-arm troops in the field. Their cohorts show as *outdated*
  until they are equipped again (paying only for the difference).
- Equipping is done inside your own territory, paid from the city whose territory the formation
  stands in (+50% away from the city itself), and uses the formation's remaining moves.
  Later, an Armoury district slot makes this cheaper and roads let a whole market pay (§8.1).
- The AI uses the same system: it creates its own designs from what it has researched
  (spear levies, javelineers, archers, swordsmen, riders) and splits its levies about 60/40
  between front line and ranged.

### 5.5 Merge and split

- Moving a formation onto a hex with another of your formations **merges** them. Cohorts keep
  their designs.
- A formation has a **command cap** in cohorts (start 10, raised later by tech and culture).
  Merging past the cap is refused; split first.
- **Split** any selected cohorts into a new formation on the same hex.
- A formation moves at the pace of its **slowest** cohort (horse archers with heavy infantry are
  slow horse archers).

### 5.6 Experience, casualties and healing

- Cohorts lose **strength** (0–100 people) in combat. A cohort cut below 20 is lost.
- Each battle survived gives a cohort experience: up to +30% punch and a steadier formation.
- Wounded cohorts heal in your territory, taking the missing people from the nearest city (troops
  are population). Field medics heal faster and also outside your territory.

## 6. Combat

One attack per formation per turn (it uses all moves), an expected-result preview before you
commit, the result applied at once with a battle report.

### 6.1 Resolution

1. **Volleys.** Ranged cohorts on both sides shoot. Archers behind a front line are harder to hit.
   Forest and jungle give the defender cover.
2. **Charge.** Attacking cavalry charges, unless the defender is on rough ground or behind walls.
   Spears in the defender's front blunt the charge and wound the riders. A formation with no front
   line takes a heavier charge.
3. **Melee, up to 3 rounds.** Infantry and cavalry form the **front**. While a front stands, enemy
   blows rarely reach the ranged cohorts behind it, and those **keep shooting every round
   (screened fire)**. Ranged cohorts with no front are caught and fight hand to hand badly.
   A side with cavalry against a side without it **flanks** (+30%) on open ground.
4. **Morale** after every phase: a formation breaks once its losses pass its morale (30% base,
   more with war banners, bronze helmets, sandals and veterans). The side that breaks first
   loses: a broken defender falls back one hex (or is destroyed if surrounded), and the attacker
   moves in. Otherwise the battle is indecisive.

Damage of each type is reduced by the target's protection against that type, so armour that
shrugs off arrows can still fold under axes. Defenders gain from hills (25%), cover, fortifying
(20%) and city walls (35%). Formations that only shoot (all ranged) exchange volleys and never
close.

### 6.2 Cities, war and peace

- A city with no army in it is defended by its **guard** of townsfolk with spears (more in bigger
  cities). Assaults wear the guard down; it recovers 10% a turn. Breaking it with melee troops
  **captures the city** (it loses a quarter of its people).
- A people with no cities and no settlers is eliminated.
- Attacking a people you are at peace with asks you to **declare war** first. Peace can be
  offered after 6 turns of war; the AI refuses while it feels much stronger.
- The AI declares war when it is much stronger than a neighbour it has met.

### 6.3 Why there is no single best build

The player *can* find an overwhelming combination; we only make sure it has a natural limit:

- **Damage-type triangle.** Plate beats cut and missile, loses to crush and later to firearms
  (pierce). Each armour has a weak point.
- **Goods scarcity.** Plate needs iron + coal; if you hold no iron hexes, you are trading for it
  or doing without.
- **Upkeep and population.** Big, heavy formations eat food and people.
- **Terrain.** Heavy horse is king on plains and useless in jungle.
- **Tech moves on.** Your unbeatable plate knights meet someone else's arquebus.

Numbers are data, not code (§12), so tuning is a spreadsheet job.

### 6.4 Naval

Same model: a **fleet** is a formation of **ships**, and ships have slots too (Hull, Propulsion,
Armament, Fit-out). Ships carry embarked land formations (capacity in cohorts). Kept for
Milestone 4; early game uses simple embark-on-coast rules.

## 7. Cities, districts and buildings

### 7.1 Cities

- Founded by a **Settlers** formation (5 cohorts of civilians; sending them out costs a city 1,000 people with families). The city centre
  occupies one hex and claims the ring around it; borders grow with culture.
- A city has **population** (in units of 1,000 people for display), **food**, **housing**, and
  **labour** (people available to work slots).
- Every hex inside the city's work radius (2, later 3) can hold **one district**.

### 7.2 Districts: the 3×3 grid

- A **district** is placed on a hex and has **9 slots** in a 3×3 grid.
- The player **designs** it: picks a slot type for each of the 9 cells, names it, and it gets
  built slot by slot (each slot has its own build cost and time).
- **Slot types** are unlocked by research and culture, e.g.:

| Group | Slot types (examples) |
|---|---|
| Farming | grain field, rice paddy, orchard, vineyard, pig pen, cattle pasture, sheep run, horse stud |
| Forestry | woodlot, lumber mill, charcoal kiln |
| Extraction | quarry, clay pit, copper mine, iron mine, coal mine, saltpeter works, oil well |
| Craft & industry | smithy, armoury, tannery, weaver, foundry, factory, shipyard (coastal) |
| Services | infirmary, school, temple, barracks, granary, warehouse |
| Commerce & finance | market, guild hall, bank, stock exchange, trading house |
| Residential | huts, houses, tenements, apartments (housing capacity) |

The player's examples are just designs:

- **"Farm"**: 5 × Pig pen (meat), 2 × Cattle pasture (meat + leather), 1 × Grain field (cereal),
  1 × Woodlot (wood).
- **"Northern Mine"**: 4 × Coal mine, 4 × Iron mine, 1 × Infirmary (boosts adjacent mines).
- **"Financial District"**: 6 × Bank, 3 × Stock exchange.

### 7.3 Rules that make design interesting (as built)

1. **Reach.** A slot can use anything on its district's hex and the six hexes around it: forest
   for woodlots, flat open land for grain fields, hills for sheep, a coast or lake for fishing
   docks, a deposit for mines. So a "Farm" on grassland next to a forest can hold pigs, cattle,
   grain and a woodlot.
2. **Capacity.** Deposit slots run at full rate for richness × 2 slots of that type in the
   district, then at half rate. Land slots run at full rate for two slots per matching hex in
   reach. A deposit feeds **one** district: the one standing on it, otherwise the older one.
   Deposits also boost their farm: wheat or rice under grain fields, cattle under pastures,
   fish under docks.
3. **Adjacency inside the grid** (up, down, left, right). An infirmary in the centre touches
   4 mines (+15% each), in a corner 2. Pig pens next to a grain field +1 food; a granary +1 food
   per neighbouring grain field; markets +1 gold per neighbouring market, bank or houses; banks
   +1 per neighbouring bank and +2 next to a stock exchange; schools +1 science next to houses;
   workshops +1 production next to woodlots or quarries.
4. **Workers.** Half of a city's people can work. Each slot needs workers (mine 200, farm 100,
   bank 50, houses none). Slots are staffed in order (city centre first); the rest stand idle.
5. **Housing.** The town hall houses 3,000 and each Houses slot 1,000 more. A full city stops
   growing. Growth also needs more food the bigger the city is.
6. **Construction.** Each slot costs production and usually goods (wood, stone). The city puts
   its production into planned slots in order; a slot whose goods the market cannot pay is
   skipped until it can. Unbuilt land next to the city still feeds a few people and gives a
   little wood, so a new city is never stuck.
7. **Inputs.** Workshops burn 1 wood a turn for 3 production. Armouries make equipping near
   the city 20% cheaper and drop the +50% distance cost. Barracks give new levies one battle of
   experience.
8. **District-level tags** (later): a district with ≥ 5 slots of one group gets a tag that culture
   nodes and techs can reward.

About 25 slot types exist now across farming, forestry, extraction, craft, services, commerce
and residential, with banks, stock exchanges, iron and coal mines and infirmaries behind research.

### 7.4 Blueprints and editing

- Save any district layout as a **blueprint** ("Farm", "Northern Mine") and apply it to a new
  or existing district. Slots that do not fit the new hex are kept but flagged with the reason
  and never built until they fit.
- **Edit a built district** at any time: a replaced slot is demolished (a quarter of its goods
  back) and the new one is queued. The rest keep working.
- The city centre is a district of its own with the town hall fixed in the middle.

## 8. Economy and goods

- **Yields:** Food, Production, Gold, Science, Culture, plus **goods**.
- **Goods** are stored **per city** (see §8.1). Tiers: raw (iron ore, coal, wood, hides, grain, ivory) → processed (iron bars, leather, lumber,
  flour) → finished (tools, weapons, armour, luxury goods).
- **Equipment is made of goods.** Equipping cohorts pulls goods from the local market (§5.3, §8.1).
  This is the main sink tying the map to the army.
- **Trade:** trade routes between your cities and to other civs move goods and earn gold;
  diplomacy can include goods-for-goods deals ("20 iron per turn for 5 ivory").
- **Happiness/stability:** luxuries, culture alignment and war weariness. Feeds unrest and is
  one of the triggers of upheaval (§9.4).

### 8.1 Cities, roads and markets (as built)

- Every city has its **own store**. What its districts produce goes there.
- **Roads**: any formation can lay a road on the hex it stands on (it uses the rest of its
  moves). City hexes always count as road. Moving from one road hex to the next costs half a
  move, whatever the ground.
- **Markets**: cities of the same people joined by an unbroken chain of road, river or city
  hexes form one **market**, and pay for everything from the **pooled store** of all its
  cities (the city's own goods first). Isolated cities are markets of one.
- **Cutting a market**: an enemy army you are at war with standing on a road or river hex
  breaks the link at once; the cities pay from their own stores again until the link is back.
- Equipping troops, building slots and workshop inputs all draw from the market.
- Later: caravans between separate markets, pillaging, *Paved Roads*, *Canals*, *Railways*,
  sea routes between friendly ports.

## 9. Culture: the culture web

Inspired by the age- and identity-shaping ideas of games like *Millennia*, pushed further:
culture is not a side tree, it is the civilization's identity.

### 9.1 Structure

- The web is split into **domains**: Cosmology (calendars, astronomy, cosmogony), Politics,
  Religion, Society, Economy, War, Seafaring, Knowledge, Arts.
- Nodes are bought with **Culture points**. A node can require nodes from **other domains**
  (that is what makes it a web, not a set of trees). Example: *Celestial Navigation* (Seafaring)
  needs *Solar Calendar* (Cosmology) **or** *Lunar Tides Lore* (Cosmology, lunar path), and
  gives a different bonus depending on which.
- Each node grants **tags** (e.g. `solar`, `lunar`, `maritime`, `absolutist`, `rationalist`,
  `zealot`, `mercantile`, `martial`, `tolerant`). Later nodes require or are boosted by tags.

### 9.2 Forks that close doors

- Many nodes come in **exclusive forks**. Taking one **locks** the others.
- Example, Cosmology fork in the ancient era:
  - **Solar Calendar** → agriculture timing, monumental astronomy, sun cults, later
    *Rational Astronomy* (science) and *Divine Kingship* (politics).
  - **Lunar Calendar** → tides and fishing, night navigation, moon cults, later
    *Celestial Navigation* (seafaring) and *Mystic Orders* (religion).
  - Both lead to rich later content, but different content. About a third of later Cosmology,
    Seafaring and Religion nodes depend on this one choice.
- Example, Politics path:
  - **Chiefdom → Council of Elders** (consensus path) or **Chiefdom → Warlord** (autocracy path).
  - The autocracy path continues: *Divine Right → Court Bureaucracy → Absolutism → Enlightened
    Despotism*. Each step gives strong bonuses (production, levy size, command cap) and raises
    **Rigidity** in the Politics domain.

### 9.3 Identity emerges from tags

- The **culture summary** shows the civ's top tags and the bonuses they currently give,
  e.g. "Maritime 7 · Rationalist 5 · Mercantile 4".
- Tag thresholds give **identity bonuses** that grow with commitment. A civ with Maritime 7 gets
  naval combat +, exploration vision +, coastal district slots cheaper; Rationalist 5 gives
  science + and unlocks secular nodes.
- The player's two examples are just two places on the web:
  - *Sea-faring scholars:* Lunar Calendar → tides → Celestial Navigation → Free Ports →
    Academies; tags `maritime`, `rationalist`, `mercantile`.
  - *Zealous expansionist warriors:* Solar Calendar → Sun Cult → State Religion → Holy War →
    Militant Orders; tags `zealot`, `martial`, `intolerant`, `expansionist`.

### 9.4 Upheavals: changing course

Every domain has a **tension meter** (Rigidity in Politics, Orthodoxy in Religion, Tradition in
Society, etc.) that rises as you go deep into a path and with certain events (lost wars, famine,
contact with very different cultures, low stability).

- When it crosses a threshold, an **upheaval** can trigger (or the player can provoke one):
  *Revolution* (Politics), *Reformation / Schism* (Religion), *Social Upheaval* (Society),
  *Scientific Revolution* (Knowledge).
- During the upheaval (5–10 turns): unrest, lower yields, possible rebel formations, a chance
  that some cities flip.
- When it resolves, the domain's **locks are lifted**: the player can buy nodes on other forks of
  that domain. Some old nodes become **legacy** (keep half their bonus, lose their tags) and the
  player chooses which to keep.
- Example: absolutist civ → Revolution → can now take *Republic*, *Constitutional Monarchy* or
  *People's Commune* branches, keeping *Court Bureaucracy* as legacy.

### 9.5 Culture and other civs

- Shared tags make civs friendlier; opposed tags (`tolerant` vs `intolerant`, `zealot` vs
  `rationalist`) create diplomatic friction.
- Strong cultures push their tags across borders (pressure on your tension meters), so a
  neighbour's culture can push you toward an upheaval.

## 10. Research (tech tree)

- Classic era-based tree (Ancient → Classical → Medieval → Renaissance → Industrial → Modern),
  paid with Science.
- Techs unlock **components only**: equipment items, slot types, ship parts, deposit reveals,
  caps (levy size, command cap, work radius), and rule changes (roads, embarking, ocean travel).
- A tech can have **culture-dependent bonuses**: *Astronomy* is cheaper for `solar` civs, gives
  +sight to ships for `lunar` civs. This ties the two trees together without merging them.
- Example chain: *Woodworking → Archery* (Bow) → *Composite Bows* (Composite Bow, needs Horn +
  Wood) → *Mechanics* (Crossbow); *Bronze Working* (Bronze scale, Spear) → *Iron Working* (Iron
  mine slot reveals iron, Sword, Chain) → *Metallurgy* (Plate, Foundry slot) → *Gunpowder*
  (needs saltpeter + sulfur; Arquebus).

## 11. Civilizations and AI

- **8–10 civs per game, all identical at start**: same starting units (1 Settlers, 1 levy of
  5 cohorts, 1 Scout), same tech, empty culture web. Only name, colour and leader portrait differ.
  Players may pick a name/colour/banner.
- Start positions are balanced by the map generator (comparable food, at least one strategic
  deposit within 6 hexes).
- **AI personalities** are not built in. Each AI gets a few **leanings** (e.g. "likes the sea",
  "likes order") that only weight its early culture picks, then its own tags drive the rest.
- **AI design of troops and districts:** the AI picks from a library of sensible loadout
  templates and district blueprints, scores them against what it has (goods, deposits) and what
  it has seen the player field, and adopts new templates when it meets something that beats it.
  This is what makes "someone creates something better" happen.

## 12. Victory and game length

- Turn limit (default 400), with a score at the end.
- **Conquest:** hold every other civ's original capital.
- **Cultural ascendancy:** your tags dominate X% of the world's population (cultural pressure).
- **Science:** complete the last-era project (kept simple).
- Victory types can be toggled in game setup.

## 13. Core screens and flows

1. **Map view.** Hex map, unit counters (show cohort count and main loadout icon), city
   banners, district icons, deposit icons, fog of war. Click formation → move with path preview.
2. **Formation panel.** Cohort list grouped by loadout; select N cohorts → "Assign loadout" or
   "Split"; stats summary; templates dropdown.
3. **Loadout designer.** Pick items per slot, see stats, cost and upkeep, save as template.
4. **City panel.** Population, labour, food, housing, districts list, levy button.
5. **District designer.** 3×3 grid, palette of unlocked slot types, valid/invalid highlighting
   for the target hex, adjacency arrows, totals (output, labour, cost), save as blueprint.
6. **Research screen.** Tech tree.
7. **Culture web screen.** Zoomable graph by domain; locked nodes greyed with "locked by: Solar
   Calendar"; tension meters; upheaval status; tag summary.
8. **Diplomacy & trade.** Civs, relations with tag-based reasons, goods deals.
9. **End turn / notifications.**

## 14. Technical plan

### 14.1 Stack

Keep what the repo already uses: **TypeScript + React + Vite**, browser-first, no server.

- Map rendering: **Canvas 2D** (or PixiJS if Canvas becomes a bottleneck at Huge size).
- Engine is pure TypeScript with no React imports, so it can run headless for tests and AI
  simulations (as the current `scripts/sim.ts` does).
- All game content (equipment, slot types, techs, culture nodes, deposits) in **JSON/TS data
  files** under `src/data/`, validated at startup. Balancing is a data change.
- Saves: browser storage with a schema version and migrations.
- Deterministic, seeded RNG for map generation and combat so games can be replayed.

### 14.2 Core data model (sketch)

```ts
type HexId = string;            // "q,r"
type GoodId = string;           // "iron", "wood", "ivory", ...
type ItemId = string;           // "bow", "plate", "horse", ...

interface Hex { id: HexId; terrain: Terrain; feature?: Feature; deposit?: { kind: string; richness: 1|2|3; hidden: boolean }; ownerCityId?: string; districtId?: string; }

interface Loadout { weapon: ItemId; armour: ItemId; mount: ItemId; kit?: ItemId; }
interface Cohort { id: string; strength: number /* 0-100 */; xp: number; loadout: Loadout; }
interface Formation { id: string; civId: string; hex: HexId; cohorts: Cohort[]; movesLeft: number; }

interface SlotType { id: string; group: string; requires: { tech?: string; culture?: string; deposit?: string; terrain?: string[] }; labour: number; inputs: Record<GoodId, number>; outputs: Record<GoodId|Yield, number>; adjacency?: { target: string; bonusPct: number }[]; }
interface DistrictDesign { name: string; slots: (string | null)[] /* length 9, row-major */; }
interface District { id: string; hex: HexId; design: DistrictDesign; built: boolean[]; }

interface CultureNode { id: string; domain: Domain; cost: number; requiresAll: string[]; requiresAny: string[]; excludes: string[]; tags: string[]; effects: Effect[]; }
interface CultureState { taken: Set<string>; locked: Set<string>; legacy: Set<string>; tension: Record<Domain, number>; upheaval?: { domain: Domain; turnsLeft: number }; }

interface City { id: string; civId: string; hex: HexId; population: number; stockpile: Record<GoodId, number>; districtIds: string[]; }
interface Market { id: string; cityIds: string[]; } // recomputed when roads change; pooled view = sum of member stockpiles

interface Civ { id: string; name: string; techs: Set<string>; culture: CultureState; templates: Record<string, Loadout>; blueprints: Record<string, DistrictDesign>; }
```

### 14.3 What happens to the current code

The current repository is a zero-player history simulator. Very little carries over directly.
It was removed on this branch (it stays in `main`'s history) and a clean `src/` started, keeping
only the tooling (Vite, TS config, Prettier, the headless check-script pattern). The Earth map and
its builder are dropped: maps are procedural only.

## 15. Milestones

Progress: **M0–M4 done.** Unit designs (§5.4) replaced the earlier per-cohort loadout picking.
Settlers, war and peace, and city capture came with M3. M4 brought districts, workers, housing,
construction, blueprints, roads and markets. A starter tech list (about 8 techs) still stands in
for the full tree. Next: **M5, the research tree.**

| # | Milestone | Done when |
|---|---|---|
| M0 | Clean slate | Old code archived, new skeleton builds, empty hex map renders |
| M1 | Map & movement | Procedural hex map (several map types, seeded) with terrain/rivers/deposits, fog of war, a formation moves with movement points, merge on move, split |
| M2 | Cohorts & loadouts | Levy from a city, equipment items from data, assign loadouts to N cohorts, templates, per-city stockpiles pay for it |
| M3 | Combat | Ranged/charge/melee/morale resolution, odds preview, terrain modifiers, casualties, a dumb AI that attacks |
| M4 | Cities & districts | Found cities, 3×3 district designer, hex requirements, adjacency, labour, production of goods, blueprints, roads and markets |
| M5 | Tech tree | ~60 techs across 4 eras unlocking items and slot types |
| M6 | Culture web | ~120 nodes, forks and locks, tags, tension meters, one upheaval type (Revolution), then the rest |
| M7 | AI civs | 8–10 AI civs that expand, design troops/districts, pick culture, fight and make peace |
| M8 | Diplomacy, trade, victory | Relations, goods deals, victory conditions, end-of-game score |
| M9 | Naval & late eras | Fleets with ship slots, embarking, industrial/modern items |

**Vertical slice target (end of M4):** one civ vs one AI on a small map, ancient era only,
~10 equipment items, ~20 slot types, combat working, no culture yet.

## 16. Open questions

None right now.

## 17. Decisions log

| # | Question | Decision |
|---|---|---|
| 1 | What does "replace" on troops mean? | Re-equipping: swap weapons, armour, shields, mounts, tools and kit on any number of cohorts (§5.5). |
| 2 | National or per-city goods? | Per city. Roads (and later rivers, rail, sea routes) connect cities into a **market** with one shared pool; cutting the link splits it (§8.1). |
| 3 | Do soldiers cost population? | Yes (§5.2). |
| 4 | Maps? | Procedural only, many map types, every game different; no Earth map. Art from the owner's asset packs added later through a sprite registry (§4). |
| 5 | Multiplayer? | No. Single player against AI peoples. |
| 6 | First playable content? | About 10 equipment items and 20 district slot types. |
| 8 | How are troops customised? | Through named **unit designs** with a full kit (weapon, shield, helmet, armour, footwear, ride, kit). Cohorts are assigned to designs; the mix of designs in a formation is what makes it strong. |
| 7 | Art? | Reuse the Age of Sail art set (parchment, terrain symbols, unit, city and goods sprites) for now. |
