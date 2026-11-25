# Game Design Document — working title "History Unfolded: Forge"

Status: draft 0.2 (decisions from review applied, see §17) · Scope: a turn-based, hex-map 4X in the classic civilization-builder mould, where
**armies, buildings and cultures are all assembled by the player** instead of picked from fixed lists.

---

## 1. One-line pitch

Every civilization starts the same. What you research gives you _parts_, not finished things:
you build your own troops from equipment, your own districts from building slots, and your own
culture from a branching web of choices that close other doors. By the late game, no two
civilizations look, fight or think alike, and each got that way through its own choices.

## 2. Design pillars

1. **Familiar chassis.** Hex map, fog of war, cities, units that move and fight, resources on the
   map, a tech tree, turns. If you have played a civ-style game you know how to play in 5 minutes.
   We do not reinvent any of this.
2. **Parts, not products.** Research unlocks _components_ (a bow, plate armour, a cattle pen, a
   bank). The player combines them. There is no "Musketman" or "Bank building" in the game data.
3. **Real people, real goods.** Soldiers are population. Equipment is made of goods that come
   from real places on the map. A strong army costs you citizens and resources.
4. **Choices that close doors.** Culture choices lock other options. Changing course is possible,
   but only through upheaval (revolution, reformation, schism) and it costs something.
5. **Emergent dominance, temporary.** Finding a combination that crushes your neighbours is a
   feature, not a bug. The counter-play is that others can research and design their way past it.

## 3. What we keep, cut and add

| Keep (standard 4X)                                     | Cut                                                  | Add / change                                                     |
| ------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------- |
| Hex map, terrain, rivers, coasts, fog of war           | Fixed unit types and unit upgrade lines              | Units built from cohorts of 100 people with editable loadouts    |
| Cities that grow and claim territory                   | Fixed building lists per city                        | Districts: a 3×3 slot grid the player designs and names          |
| Map resources (bonus, strategic, luxury)               | Unique civ abilities, unique units, unique buildings | All civs start identical; identity comes from the culture web    |
| Movement points, zones of control, combat odds preview | "One unit per tile" stacking rule                    | Moving a formation onto a friendly one merges them               |
| Tech tree with eras                                    | Tech that unlocks finished units/buildings           | Tech unlocks equipment, slot types and caps                      |
| Diplomacy, war, peace, borders                         | Civics/policy cards swapped freely                   | Culture web with exclusive branches and upheaval events          |
| Turn-based, single player vs AI                        | Global/national resource pool                        | Goods stored per city; roads join cities into shared **markets** |

## 4. The map

- **Always procedural.** Every game generates a new map from a seed; there is no Earth or fixed
  map. Map _types_ make games feel different, not just reshuffled:
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
  - _Food & animals:_ wild game, pigs, cattle, sheep, horses, fish, whales, wheat, rice, maize.
  - _Raw materials:_ wood (forests), stone, clay, copper, tin, iron, coal, saltpeter, sulfur, oil.
  - _Luxuries:_ ivory, furs, silk, spices, dyes, gold, silver, gems, wine, incense.
  - Each deposit has a **richness** (1–3) that scales what slots built on it produce.
- **Revealing deposits.** Iron, coal, saltpeter and oil are invisible until the right tech
  ("Prospecting", "Mineralogy", "Chemistry", "Geology") is known, as in the genre standard.
- **Goods on the map.** Deposits are what you can _extract_. Districts turn them into goods
  (§7). Trade routes and roads move goods between your cities.

## 5. Units: designs, cohorts and formations

### 5.1 The model

- A **unit design** is a named unit type the player creates: a name ("Hoplites", "Foot Falcons",
  "Iron Wall") plus one item in every equipment slot. Designs belong to the civilization, not to a
  city or a formation, and there is no limit on how many you keep.
- A **cohort** is **100 people**. Each cohort is assigned to one design and carries that design's
  gear.
- A **formation** is what you see on the map: one counter on one hex, made of cohorts.
- **The combination is what is powerful.** A levy of 500 can become 200 _Foot Falcons_
  (spear and shield) and 300 _Hornets_ (javelins). The formation's strength comes from how its
  designs work together in battle (§6), not from any single design.
- The formation panel groups cohorts by design, e.g.
  `"Northern Host" — 10 cohorts (1,000 people): 6 × Hoplites, 4 × Longbows`.

### 5.2 Raising troops

- A city **levies** a new formation of **5 cohorts (500 people)**. These come out of the city's
  population and only return when the troops heal at home or are disbanded there.
- A fresh levy carries no gear (improvised weapons). It shows as _Levy_ until assigned a design.
- Later techs raise levy size (Conscription → 8 cohorts) and the formation cap (§5.5).

### 5.3 Equipment slots

| Slot            | Examples (by era)                                                     | What it mostly affects                                           |
| --------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Weapon**      | club, sling, javelins, spear, bow, axe, sword, crossbow, pike, musket | attack, ranged or melee, damage type, anti-charge                |
| **Shield**      | wicker, hide, bronze, kite, pavise                                    | protection, mostly against missiles; not with two-handed weapons |
| **Helmet**      | leather cap, bronze helmet, great helm                                | protection against crushing blows, morale                        |
| **Body armour** | padded, leather, bronze scale, ivory lamellar, chain, plate           | protection by damage type, weight                                |
| **Footwear**    | sandals, marching boots                                               | morale, crossing rough ground faster                             |
| **Ride**        | on foot, horse, camel, elephant, later wagons and trucks              | movement, charge, flanking, upkeep                               |
| **Kit**         | scouting gear, war banner, field medics, siege tools                  | special effects for the cohort or the whole formation            |

Very few combinations are forbidden; the only hard rule so far is no shield with a two-handed
weapon (bow, axe). Everything else is "allowed, but here is the trade-off": weight slows foot
troops, horses are poor in forest and marsh, heavy gear costs scarce metals.

Each item has a tech requirement (if any), a goods cost per cohort, gold upkeep per turn, weight,
and its combat numbers: attack and damage type (_cut, pierce, crush, missile_), protection per
damage type, charge, anti-charge, morale, movement, sight.

### 5.4 Designing and assigning

- **Unit designs screen:** name the design, pick an item per slot, see the per-cohort numbers
  (role, melee, ranged, charge, anti-charge, protection by type, morale, moves, upkeep, gear
  cost). Save, save as new, or retire it.
- **Assigning:** in a formation, choose how many cohorts of each group to select (e.g. 2 of the
  5 levy cohorts), pick a design, see the goods it will cost from the nearest city, and equip.
  Only slots that change are paid for; gear taken off returns 50% to the city's store.
- **Editing a design** does not re-arm troops in the field. Their cohorts show as _outdated_
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

The player _can_ find an overwhelming combination; we only make sure it has a natural limit:

- **Damage-type triangle.** Plate beats cut and missile, loses to crush and later to firearms
  (pierce). Each armour has a weak point.
- **Goods scarcity.** Plate needs iron + coal; if you hold no iron hexes, you are trading for it
  or doing without.
- **Upkeep and population.** Big, heavy formations eat food and people.
- **Terrain.** Heavy horse is king on plains and useless in jungle.
- **Tech moves on.** Your unbeatable plate knights meet someone else's arquebus.

Numbers are data, not code (§12), so tuning is a spreadsheet job.

**Balance pass (as built).** `scripts/battles.ts` (and `--late`) fights every army against
every other. The early circle it aims for: spears beat riders (they blunt the charge and keep
hurting horsemen in melee in proportion to how much of the enemy front is mounted), riders beat
archers and two-handed axemen (charge 6), swords beat spears, and axes are the cheap way to crack
armour (attack 4, crush) rather than the best weapon outright. A set spear's answer to a charge
ignores 40% of armour. Late, knights stay strong but cost about twice a pike block; longbows hit
harder than crossbows (7) without needing iron, crossbows pierce more (40% against 20%). Mixed
armies at the same cost beat pure ones: 6 swords and 4 archers hold 10 swords for far less tin.

### 6.4 Naval (as built)

- **Ship designs** use the same designer as troops, with four slots: **Hull** (dugout, galley,
  longship, cog, carrack, galleon: protection, cargo space, and whether it can cross open
  ocean), **Rig** (oars, square sail, lateen sail, full rig: speed), **Armament** (unarmed, ram,
  boarding crew, deck archers, ballista, deck guns, broadside) and **Fit-out** (troop deck,
  marines, crow's nest). Each ship is one "cohort" of a fleet, crewed by 50 people from the city.
- A city needs a **Shipyard** slot (Sailing, by the water) to launch ships. Ships merge into
  fleets like troops merge into formations, and split the same way.
- **Fleets** move on coast and lakes; open ocean needs ocean-going hulls (Navigation and later).
  They can sail into your own coastal cities.
- **Carrying troops:** move troops or settlers onto your own fleet with room to **board**; the
  fleet carries them; click land next to it to **land** (it takes the turn's moves). Troops can
  also attack the shore straight from the ships at a heavy penalty. If a fleet sinks, everyone
  aboard is lost. A ship standing in a strait also works as a ferry.
- **Battles at sea** use the same engine: armed ships with rams and boarding crews form the
  front, ships with archers or guns shoot. Sea-power bonuses from culture and research
  (Maritime identity, Navigation, Compass, Admiralty…) now count. Ships with archers or guns can
  **bombard** the shore (armies and cities), but cannot take a city.
- **Sea trade:** cities with a Harbour or Shipyard join their markets over water (coast; open
  ocean once the Compass is known). Enemy fleets at war cut the sea lanes.
- **AI at sea:** designs Transports and Warships from the best parts it knows, builds shipyards
  in coastal cities, ships settlers to other islands when its land runs out, carries armies to
  enemy shores when no target is reachable by land, and keeps warships to hunt enemy fleets
  while at war. Island peoples research Sailing early.

## 7. Cities, districts and buildings

### 7.1 Settlements: towns, cities and the metropolis (as built)

You grow by founding many small towns, not by growing a few huge cities.

- **One hex each.** A settlement is founded by Settlers and occupies a single hex. It works its
  **land**: its own hex and the six around it. Settlements may not touch: at least one hex
  between them, so neighbouring towns share up to two land hexes; a shared hex belongs to the
  older settlement. Founding a town within 3 hexes of one of your own lays a track to it, so
  clusters of towns form one market from the start.
- **Ranks.** Districts are slots inside the settlement, each a 3×3 grid (§7.2):

| Rank       | Districts                             | Rural buildings                    | Bonus to buildings               | Needs                                                                                 |
| ---------- | ------------------------------------- | ---------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| Town       | 2 (the centre with the town hall + 1) | farms, woodlots, mines, docks      | —                                | founding                                                                              |
| City       | 4                                     | none: the towns around supply them | +15%, research and industry +35% | City Charter (culture), 6 housing cells, 6,000 people, 150 gold, 10 stone, 30 wood    |
| Metropolis | 6 (one per people)                    | none                               | +30%, research and industry +70% | Seat of Empire (culture), 8 housing cells, 15,000 people, 400 gold, 30 stone, 50 wood |

- **Becoming a city pulls down every rural building** (farming, forestry, extraction groups):
  those districts must be redesigned as quarters. A town's open land feeds a few people
  (subsistence); a city's does not.
- **Towns feed cities.** Settlements short of food draw on the surplus of the others in their
  market (joined by road, river or sea), shared out in proportion. A town that feeds a city grows
  more slowly.
- **Towns are needed**: only they hold farms, pastures, woodcutters, mines and the rest. A people
  can also go urban and buy its food and raw goods with the cloth, tools and leatherwork its
  cities make.
- **Ranks need a culture choice and the action**: City Charter (society, open from any first
  society choice) lets towns become cities; Seat of Empire lets one city become the metropolis.
  Then the player raises the settlement from its screen.
- **Rural districts, urban districts**: towns hold the extractive cells (farms, mines…). A people
  can go urban and trade its cities' made goods for food and raw goods from other peoples.

### 7.1b Inside a district: housing, producers, boosters (as built)

- **Housing**: every district needs at least **2 housing cells** (houses, tenements,
  aqueducts) built before anything else in it works; houses are built first where they are
  missing. A city needs 6 housing cells in all (of a town's 18 cells), a metropolis 8. Each
  housing cell beyond its districts' two makes growth 8% cheaper (to 60% at most), so more
  people for settlers and levies, at the price of cells that make nothing.
- Every building belongs to a **line** and has a **role**:
  - **base** (+1 of the line's yield; rural bases give ½ plus what the land holds);
  - **support** (+½ on every yield of each base of its line in the district), early to mid game;
  - **modern multiplier** (×2 the line in its district), late; **one per district**;
  - **great building** (+200%, ×3, the line in its district); **one in the whole realm**,
    unlocked in a given age.
    Supports stack; the multiplier and the great building multiply each other.

| Line              | Bases                                      | Support           | Multiplier      | Great building (age)              |
| ----------------- | ------------------------------------------ | ----------------- | --------------- | --------------------------------- |
| Food              | farm, pasture, plantation, boats, lodge    | granary, windmill | food packaging  | Royal Granaries (Classical)       |
| Wood              | woodcutter                                 | lumber mill       | steam sawmill   | Royal Forest (Classical)          |
| Mining            | mine                                       | infirmary         | pumping station | King's Mine (Medieval)            |
| Science           | school, university, observatory            | library           | research lab    | Academy of Sciences (Renaissance) |
| Religion and arts | shrine, monument, temple                   | amphitheatre      | printing house  | Cathedral (Theology)              |
| Money             | market, bank, mint, harbour                | guild hall        | counting house  | Stock exchange (Joint-Stock)      |
| Industry          | workshop, smithy, foundry, tannery, weaver | engineers' lodge  | factory         | Ironworks (Renaissance)           |

The market also puts ½ gold on each housing cell of its district. Example: three
universities make 3 science; a library makes it 4½; a research lab 9; the Academy 27.

- **Housing perks**: each housing cell beyond its districts' two makes growth 8% cheaper (to
  60%), sends settlers out for 10% fewer people (to 600), and every two add a cohort to the
  levies raised there (up to +3).
- The settlement's rank bonus and research percentages apply after the boosters.

- Old saves load with every settlement as a town that keeps its centre and oldest district.

### 7.2 Districts: the 3×3 grid

- A **district** sits inside a settlement and has **9 slots** in a 3×3 grid.
- The player **designs** it: picks a slot type for each of the 9 cells, names it, and it gets
  built slot by slot (each slot has its own build cost and time).
- **Slot types** are unlocked by research and culture, e.g.:

| Group              | Slot types (examples)                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Farming            | grain field, rice paddy, orchard, vineyard, pig pen, cattle pasture, sheep run, horse stud |
| Forestry           | woodlot, lumber mill, charcoal kiln                                                        |
| Extraction         | quarry, clay pit, copper mine, iron mine, coal mine, saltpeter works, oil well             |
| Craft & industry   | smithy, armoury, tannery, weaver, foundry, factory, shipyard (coastal)                     |
| Services           | infirmary, school, temple, barracks, granary, warehouse                                    |
| Commerce & finance | market, guild hall, bank, stock exchange, trading house                                    |
| Residential        | huts, houses, tenements, apartments (housing capacity)                                     |

The player's examples are just designs:

- **"Farm"**: 5 × Pig pen (meat), 2 × Cattle pasture (meat + leather), 1 × Grain field (cereal),
  1 × Woodlot (wood).
- **"Northern Mine"**: 4 × Coal mine, 4 × Iron mine, 1 × Infirmary (boosts adjacent mines).
- **"Financial District"**: 6 × Bank, 3 × Stock exchange.

### 7.3 Rules that make design interesting (as built)

1. **Reach.** A slot can use anything on its settlement's land (its hex and its six neighbours): forest
   for woodlots, flat open land for grain fields, hills for sheep, a coast or lake for fishing
   docks, a deposit for mines. So a "Farm" on grassland next to a forest can hold pigs, cattle,
   grain and a woodlot.
2. **Deposits** belong to the settlement whose land they lie on and work as in §8.0: special
   goods need three of the working building in one district, then each brings a unit.
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

### 7-0. Settlements on the map: six sizes, districts on hexes (as built)

A settlement's land is its centre hex and the six hexes around it. Every district stands on one
of them: the centre district (with the town hall) on the centre, the others on the neighbouring
hexes the player picks on the land map. Settlements keep two hexes between them (centres at
least 3 apart), so no two share land.

| Size       | Districts      | Bonus to every building / research and industry |
| ---------- | -------------- | ----------------------------------------------- |
| Settlement | 1 (the centre) | —                                               |
| Town       | 2              | —                                               |
| Large town | 3              | +5% / +10%                                      |
| City       | 4              | +15% / +35% (City Charter)                      |
| Large city | 5              | +22% / +50% (City Charter)                      |
| Metropolis | 7 (all)        | +30% / +70% (Seat of Empire; one per people)    |

Each step costs people, gold, wood and stone and a number of housing cells (town 2,500 people
and 25 gold; up to a metropolis at 15,000 and 400). **Where a district stands matters**: it
gathers the special resource on its own hex (ores, plantation crops, furs, whales…) and the plain
ones (animals, grain, fish) on the hexes next to it; docks, harbours and yards need water next to
the district's hex. The centre reaches the whole ring for plain land. A city and larger builds
over its centre (no fields there) but keeps fields in its outer districts, and burns fuel. Older
saves are migrated: their districts move onto the best free hexes around the centre. The AI
places each new district on the free hex whose plan scores best.

On the map a settlement grows like a place: each district's buildings take seeded spots that
look scattered and never move, from the middle outward, each on its own patch of ground (paving,
field, yard), with homes in the centre as its people grow; no 3×3 grid is shown.

### 7a. The settlement in low-poly 3D (as built)

Two views with two jobs: the world map shows each settlement as an organic little place
(§7-0); the city screen is the close-up where the player builds. Its 3D stage is large (over
half the screen), frames the district being edited so its 3×3 plots fill the view, and shows
each plot's real building in detail: houses with doors and windows, and on built plots
townsfolk, barrels, crates and lamp posts. Hovering a plot frames it; clicking it opens a picker
over the scene with what stands there (or its building progress) and every building that can
go on that plot, plus clear or demolish. The full palette beside it keeps costs, yields and the
reasons for what cannot be built.

The city screen opens on the settlement in low-poly 3D (three.js, loaded only when a city screen
opens). The centre district sits in the middle with its town hall; the other districts stand
around it on a hex-like ring, joined by roads; bare meadow plots with a marker show where
districts may still be laid out, up to the settlement's cap (2 for a town, 4 for a city, 6 for a
metropolis). Inside a district every slot is a tile: a low-poly building once built, scaffolding
while it is being built, a staked plot while empty. Clicking a tile picks that district and slot
in the editor below; dragging turns the view, the wheel zooms, "Whole settlement" shows all of
it. The camera frames the district being edited. Rendering is on demand (no animation loop).

Every building goes through one table (`BUILDERS` in `src/render/city3d.ts`, with `ALIAS` for
buildings that share a look and a generic hall in the building group's colour for the rest), so
a procedural model can be replaced by a real one later without touching anything else.

### 7b. The map in low-poly 3D (as built: the playing map)

The game is played on a low-poly 3D map (`src/render/world3d.ts`). It keeps the 2D renderer's
contract (camera in screen units, zoomAt, clamp, centerOn, hexAtScreen, draw with overlays), so
MapView drives either: all input (click, right-click, drag, pinch, wheel, WASD, the two-tap
move on touch) is unchanged. A tilted orthographic camera keeps north up, and hexes are picked
exactly under the pointer.

- **Land** in chunks of 10×10 hexes, each baked into one mesh with vertex colours and rebuilt only
  when what it shows changes (exploration, roads, deposits, a new settlement); a few chunks are
  built per frame, nearest the view first. Hexes are prisms raised by relief, with peaks, mounds,
  forests, jungle, marsh, sunk water and swell, ore heaps on revealed deposits, rivers bending
  through shared edges, roads and railways.
- **Settlements** are baked per settlement, on demand: every district on its own hex, with streets
  between its 3×3 plots and each plot showing its real building in miniature on its own ground
  (scaffolding while building); a young centre's empty plots fill with homes as its people grow,
  outer empty plots grow trees. The flag is the people's; a besieged settlement has a red ring.
- **Troops** as small squads in their people's colour (up to three bands a hex), fleets as boats,
  sliding between hexes; foreign ones only where seen.
- **Borders** in each people's colour; **fog of war** as a light mist over land known but unseen.
- **Overlays**: gold ring on the selection, hover outline, reachable hexes, the march in gold dots,
  a red ring on the attack target.
- **Labels** on a 2D canvas over the scene: settlement banners (name, people, ⚔ when besieged),
  cohort counts, battle flashes and floating numbers.
- A "2D map / 3D map" button switches renderer (remembered); devices without WebGL get the 2D map.

On software rendering a late large map (88×54, 94 settlements, 186 armies) draws a steady frame
in 7–21 ms; a new view builds over a few frames.

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

### 8.0 Working the land (as built)

Every rural building gives a little anywhere; what lies on the settlement's land adds more.

| Building              | Anywhere | With what lies on the land                                                                |
| --------------------- | -------- | ----------------------------------------------------------------------------------------- |
| Farm                  | ½ food   | wheat or rice: 1 food                                                                     |
| Pasture               | ½ food   | pigs: 1 food · cattle: +1 leather · sheep: +1 wool · horses (Animal Husbandry): +1 horses |
| Woodcutter            | ½ wood   | a forest or jungle: 1 wood                                                                |
| Mine                  | ½ stone  | stone, coal, iron, copper, tin, gold, silver, saltpeter: +1 of it (special)               |
| Plantation            | ½ food   | sugar, spices, silk, dyes, wine: +1 of it (special)                                       |
| Hunting lodge         | ½ food   | game: +½ food and ½ hides · furs, ivory: +1 (special)                                     |
| Fishing boats (coast) | ½ food   | fish: 1 food · whales: +1 whale oil, pearls: +1 pearls (special)                          |

- **Special goods need a dedicated district**: a town beside the deposit and at least **3** of
  the working building in one district. Then every one of them brings a unit, so goods add up:
  eight mines by coal dig 8 coal a turn. With fewer, the slot says what is missing ("Coal needs
  3 mines in this district (2 now)"). Animals, grain, fish and forest work for any number.
- With several deposits for one building on the land, the buildings take them in turn.
- A thousand people eat one food a turn (two farms' worth).

**Demand.** Goods are made to be used, and use grows with the people:

- **Comforts**: every settlement takes one luxury a turn per 4,000 people (sugar, spices, silk,
  dyes, wine, furs, ivory, gold, silver, pearls, whale oil, and the cloth and leatherwork cities
  make). Each kind it gets adds 5% gold and
  culture; each unit missing takes 5% away.
- **Fuel**: cities and the metropolis burn one fuel per 4,000 people: coal if the market has it
  (+5% production), else wood; with neither, everything they make drops 15%.
- **Workshops**: workshop (wood → production), smithy (copper and tin → tools), tannery
  (leather → leatherwork), weaver (wool → cloth), mint (gold → coin), foundry (coal and iron →
  production), factory (wears out tools). Short of its goods, a building runs at a third.
- **Stores are limited**: a people keeps at most 8 of a good for every working cell that makes
  it, plus 8 of anything per settlement. Three coal mines (which also dig stone) can hold 24 coal
  and 24 stone. The rest is lost each turn, so surpluses are for selling.
- Equipment and construction spend goods once (§5.3).

**Trade by the turn.** The Goods screen (G) shows per good what all settlements make, what they
use, what deals bring or take, the net and the store, with how many turns a shortfall leaves.
**Sell** offers a surplus per turn to a people at peace for gold per turn, for 20 turns, paid
from the capitals' markets. There are no set prices: the sell box asks every partner the most it
would pay and starts from the best bid. Peoples value goods by their own balance: what they run short of each
turn is dear, a steady surplus piling up is cheap. AI peoples offer to sell what you run short
of, or to buy what you have to spare. A seller who cannot deliver is remembered for it.

### 8.0b Goods through the ages (as built)

About 28 goods are in play, and they arrive over time:

| Age         | New goods                                                                                                                                     | Where from                                                | Spent on, every turn                                                                                                                                                     | Spent on, once                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Ancient     | wood, stone, hides, wool, salt, copper, tin, horses, gold, silver; luxuries (ivory, furs, spices, silk, dyes, wine, sugar, pearls, whale oil) | woodcutters, mines, pastures, plantations, lodges, boats  | workshops (wood), smithies (copper, tin), tanneries (hides), weavers (wool), mints (gold), comforts (luxuries, salt)                                                     | buildings, gear (bronze, horses)                       |
| Classical   | iron; paper                                                                                                                                   | mines (Iron Working); paper mills                         | libraries (paper)                                                                                                                                                        | iron gear                                              |
| Medieval    | coal, saltpeter; cloth, leatherwork, tools                                                                                                    | mines (Mineralogy, Alchemy); weavers, tanneries, smithies | city hearths (coal or wood), comforts (cloth, leatherwork)                                                                                                               | —                                                      |
| Renaissance | steel                                                                                                                                         | foundries (coal, iron)                                    | printing houses (paper), firearms (saltpeter as powder)                                                                                                                  | guns                                                   |
| Industrial  | oil, electricity                                                                                                                              | mines (Oil Drilling); power plants (oil, else coal)       | railway stations (coal), steam pumps and sawmills (coal), power plants (oil or coal), factories (tools, electricity), research labs (electricity), food packaging (salt) | rifles (steel), factories, plants and stations (steel) |

- **Powder**: arquebuses, muskets, field guns and rifles burn saltpeter each turn (a quarter of a
  unit per cohort, half for guns). A realm out of it fires its firearms at half strength.
- Short of what it burns, a building runs at a third; a city without fuel loses 15%.
- Uranium waits for a Modern age, not built yet.

### 8.1 Cities, roads and markets (as built)

- Every city has its **own store**. What its districts produce goes there.
- **Roads**: nothing is built for you. A builder lays a road on the hex it stands on (it uses
  the rest of its moves): any army in the Ancient and Classical ages; from the Medieval age
  **workers** (raised in a settlement: 200 people, 10 gold); from the Industrial age also
  **engineers** (200 people, 40 gold). Settlement hexes always count as road. The AI raises a
  crew per four settlements and links its nearest unlinked pair. Moving from one road hex to the next costs half a
  move, whatever the ground.
- **Markets**: cities of the same people joined by an unbroken chain of road, river or city
  hexes form one **market**, and pay for everything from the **pooled store** of all its
  cities (the city's own goods first). Isolated cities are markets of one.
- **Cutting a market**: an enemy army you are at war with standing on a road or river hex
  breaks the link at once; the cities pay from their own stores again until the link is back.
- Equipping troops, building slots and workshop inputs all draw from the market.
- Later: caravans between separate markets, pillaging, _Paved Roads_, _Canals_, _Railways_,
  sea routes between friendly ports.

## 9. Culture: the culture web

Inspired by the age- and identity-shaping ideas of games like _Millennia_, pushed further:
culture is not a side tree, it is the civilization's identity.

### 9.1 Structure

- The web is split into **domains**: Cosmology (calendars, astronomy, cosmogony), Politics,
  Religion, Society, Economy, War, Seafaring, Knowledge, Arts.
- Nodes are bought with **Culture points**. A node can require nodes from **other domains**
  (that is what makes it a web, not a set of trees). Example: _Celestial Navigation_ (Seafaring)
  needs _Solar Calendar_ (Cosmology) **or** _Lunar Tides Lore_ (Cosmology, lunar path), and
  gives a different bonus depending on which.
- Each node grants **tags** (e.g. `solar`, `lunar`, `maritime`, `absolutist`, `rationalist`,
  `zealot`, `mercantile`, `martial`, `tolerant`). Later nodes require or are boosted by tags.

### 9.2 Forks that close doors

- Many nodes come in **exclusive forks**. Taking one **locks** the others.
- Example, Cosmology fork in the ancient era:
  - **Solar Calendar** → agriculture timing, monumental astronomy, sun cults, later
    _Rational Astronomy_ (science) and _Divine Kingship_ (politics).
  - **Lunar Calendar** → tides and fishing, night navigation, moon cults, later
    _Celestial Navigation_ (seafaring) and _Mystic Orders_ (religion).
  - Both lead to rich later content, but different content. About a third of later Cosmology,
    Seafaring and Religion nodes depend on this one choice.
- Example, Politics path:
  - **Chiefdom → Council of Elders** (consensus path) or **Chiefdom → Warlord** (autocracy path).
  - The autocracy path continues: _Divine Right → Court Bureaucracy → Absolutism → Enlightened
    Despotism_. Each step gives strong bonuses (production, levy size, command cap) and raises
    **Rigidity** in the Politics domain.

### 9.3 Identity emerges from tags

- The **culture summary** shows the civ's top tags and the bonuses they currently give,
  e.g. "Maritime 7 · Rationalist 5 · Mercantile 4".
- Tag thresholds give **identity bonuses** that grow with commitment. A civ with Maritime 7 gets
  naval combat +, exploration vision +, coastal district slots cheaper; Rationalist 5 gives
  science + and unlocks secular nodes.
- The player's two examples are just two places on the web:
  - _Sea-faring scholars:_ Lunar Calendar → tides → Celestial Navigation → Free Ports →
    Academies; tags `maritime`, `rationalist`, `mercantile`.
  - _Zealous expansionist warriors:_ Solar Calendar → Sun Cult → State Religion → Holy War →
    Militant Orders; tags `zealot`, `martial`, `intolerant`, `expansionist`.

### 9.4 Upheavals: changing course

Every domain has a **tension meter** (Rigidity in Politics, Orthodoxy in Religion, Tradition in
Society, etc.) that rises as you go deep into a path and with certain events (lost wars, famine,
contact with very different cultures, low stability).

- When it crosses a threshold, an **upheaval** can trigger (or the player can provoke one):
  _Revolution_ (Politics), _Reformation / Schism_ (Religion), _Social Upheaval_ (Society),
  _Scientific Revolution_ (Knowledge).
- During the upheaval (5–10 turns): unrest, lower yields, possible rebel formations, a chance
  that some cities flip.
- When it resolves, the domain's **locks are lifted**: the player can buy nodes on other forks of
  that domain. Some old nodes become **legacy** (keep half their bonus, lose their tags) and the
  player chooses which to keep.
- Example: absolutist civ → Revolution → can now take _Republic_, _Constitutional Monarchy_ or
  _People's Commune_ branches, keeping _Court Bureaucracy_ as legacy.

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
- A tech can have **culture-dependent bonuses**: _Astronomy_ is cheaper for `solar` civs, gives
  +sight to ships for `lunar` civs. This ties the two trees together without merging them.
- Example chain: _Woodworking → Archery_ (Bow) → _Composite Bows_ (Composite Bow, needs Horn +
  Wood) → _Mechanics_ (Crossbow); _Bronze Working_ (Bronze scale, Spear) → _Iron Working_ (Iron
  mine slot reveals iron, Sword, Chain) → _Metallurgy_ (Plate, Foundry slot) → _Gunpowder_
  (needs saltpeter + sulfur; Arquebus).

### 9.6 As built

- **9 domains, 108 choices, 16 forks, 14 tags.** Domains: Cosmology, Politics, Religion,
  Society, Economy, War, Seafaring, Knowledge, Arts. Four tiers each (cost 30 / 70 / 140 / 240
  culture, +6% for every choice already adopted). Many choices need choices from **other
  domains** (Rational Astronomy needs a Knowledge choice; Court Bureaucracy needs Scribes or
  Record Keeping; Sea Raiders needs a warlike Politics, Society or War choice).
- **Forks** ("choose one") lock their alternatives and everything that grows only from them:
  Solar vs Lunar Calendar, Council of Elders vs Warlord, Many Gods vs One God, Clans vs
  Households, Wealth in Land vs Trade, Shock vs Skirmish warfare, Coast Huggers vs Open Sea,
  Scribes vs Bards, Grand Monuments vs Folk Arts, and late forks (Heliocentrism vs Celestial
  Spheres, Absolutism / Enlightened Despotism / Constitution, Theocracy vs Secular State,
  Caste System vs Social Mobility, Mercantilism vs Free Markets, Professional Army vs Citizen
  Militia, Empiricism vs Scholasticism).
- **Tags → identity.** Tags: Solar, Lunar, Maritime, Rationalist, Devout, Zealous, Tolerant,
  Absolutist, Republican, Martial, Mercantile, Agrarian, Artistic, Expansionist. At 3, 6 and 9
  choices carrying a tag the people gains that tag's tier bonuses (Maritime: coastal yields, sea
  power, sight, gold; Rationalist: science, cheaper research; Martial: melee, bigger formations,
  morale…). The top tags are shown as the people's identity everywhere.
- **Culture points** come from each city (1, plus 1 per 4,000 people) and from shrines,
  monuments, temples, amphitheatres, cathedrals and printing houses.
- **Tension** per domain rises with each choice (deep, rigid choices like Absolutism, Caste
  System or Empiricism add a lot), slowly every turn with how many choices the domain holds, and
  when a neighbour within 10 hexes holds the opposite idea (Zealous/Tolerant,
  Absolutist/Republican, Solar/Lunar, Rationalist/Devout).
- **Upheaval** (Revolution, Reformation, Calendar reform, Social upheaval, Economic crisis,
  Military reform, Turn from the sea, Scientific revolution, Renaissance): can be called at
  tension 100, comes on its own at 150. It lasts 8 turns (−25% production, science, gold and
  culture, −10% food, −5 morale, no new choices in that domain). Then the player **keeps up to 2**
  choices of the domain; the rest become **legacy** (half effect, no tags), the domain's forks
  open again and tension resets.
- **Kindred and clashing peoples.** Two peoples sharing two strong tags are slow to go to war
  with each other; clashing ideas make war more likely (the AI's threshold drops from 1.5× to
  1.2× your strength). The Peoples screen shows each people's identity and how it relates to yours.
- **AI:** each AI people has two random leanings that weight its choices; after that its tags
  shape it. In test games peoples come out clearly different (e.g. agrarian-artistic,
  devout-lunar, mercantile-absolutist-maritime).
- Sea-power bonuses (`navalPct`) are tracked and shown but only take effect once fleets exist.

### 10.1 As built

- **Five ages, one small tree each** (Ancient 13 techs, Classical 16, Medieval 15, Renaissance
  12, Industrial 7: Steam Power, Railways, Machine Tools, Food Preservation, Oil Drilling, Rifling,
  Electricity). Prerequisites only link techs of the same age, and most techs have none, so an age's techs
  can be taken in almost any order. Each age ends in a **gate tech** (Classical Age, Medieval
  Age, Renaissance Age) that opens once a people knows about two thirds of the age (9, 11, 10
  techs: any of them) and unlocks the next age. Skipped techs stay available later. The research
  screen shows only the ages reached, current age first; later ages stay hidden.
- Base costs scale by age (×1.3, ×1.6, ×2, ×4.5, ×3.5 on larger bases: science grows with population, so the last age
  must cost far more to last). In AI test games the leading people has about 47 techs by
  turn 200 and the whole tree around turn 320–330 of 400 (`scripts/pace.ts`). Science is stored
  even while nothing is being researched.
- Techs unlock **equipment** (iron swords, composite bows, longbows, crossbows, pikes, lances,
  arquebuses, muskets, field guns, kite shields, pavises, iron helmets, great helms, chain mail,
  plate, cuirasses, hobnailed boots, heavy and barded horses, siege ladders, bayonets),
  **buildings** (shrines, monuments, walls, temples, amphitheatres, cathedrals, castles,
  libraries, universities, printing houses, observatories, aqueducts, tenements, harbours,
  guild halls, lumber mills, windmills, saltpeter works, foundries, mines, banks…),
  **reveal** iron, coal and saltpeter, and raise **limits**: cohorts per formation (Drill +2,
  Professional Officers +3), cohorts per levy (Feudalism +1, Conscription +3), territory and
  district reach (Administration +1), road speed (The Wheel, Engineering), city defence (Castles,
  Star Forts).
- New combat mechanics came with the gear: **armour-piercing** (crossbows ignore 40% of
  protection, guns 50–60%), **lances** add to a mounted charge, **bayonets** give musketeers
  melee and anti-charge, **pavises** stand on the ground so crossbowmen can use them, **walls**
  cut assault damage (25%, castles 45%) and add guard cohorts, **siege** gear (ladders, guns)
  ignores part of the walls.
- **Culture-dependent costs:** a tech is 20% cheaper for a people holding 2+ choices of its
  favoured tag (Sailing, Navigation, Compass, Cartography for Maritime; Writing, Philosophy,
  Education for Rationalist; Astronomy for Solar…).
- **Research goals:** click a tech you cannot take yet, or the next age's gate, to aim for it;
  research then takes the cheapest steps there.

### 10.2 Diplomacy (as built)

- **Opinion** of each people for each other, with the reasons shown: shared or clashing ideas,
  war, pacts, alliances, trade, a common enemy, crowded borders, and **memories** that fade over
  time (declared war on us, broke a sworn pact, took our cities, made peace, generous dealings,
  refused our demand, failed to pay…). Attitudes: Hostile, Cold, Wary, Warm, Friendly.
- **Deals:** gold and goods now or per turn (20 turns), a non-aggression pact (30 turns) or an
  alliance. Goods are paid from each capital's market. The AI values goods by how scarce they
  are for it, wants a margin from rivals and forgives a little from friends; the deal screen
  shows its answer live as you edit.
- **Pacts and alliances:** declaring war on a pact partner breaks it and every people remembers
  the treachery; when a people is attacked its allies declare war on the aggressor.
- **The AI** proposes trades, pacts and alliances to the player, demands tribute when much
  stronger and hostile, sues for peace when losing or tired, and makes pacts and alliances with
  other AI peoples. It goes to war against peoples it dislikes and is clearly stronger than.
- **AI campaigns:** it picks the softest enemy city it can reach, gathers its field armies at
  its nearest city and merges them, marches once strong enough (or after waiting), assaults,
  regroups if bled, and turns back to defend threatened cities first.
- **Victory:** last people standing (conquest), or the best **score** (people, cities, techs,
  culture) at the game's turn limit (200–600, chosen at start; you can play on after it).

## 11. Civilizations and AI

- **8–10 civs per game, all identical at start**: same starting units (1 Settlers, 1 levy of
  5 cohorts, 1 Scout), same tech, empty culture web. Only name, colour and leader portrait differ.
  Players may pick a name/colour/banner.
- Start positions are balanced by the map generator: every start gets wood, a food deposit and
  copper or stone plus horses nearby; starts keep at least 0.6 of an even spread apart; and any
  start below 85% of the median value (food within 2 hexes, deposits, open land within 3) is
  lifted by softening poor land, greening plains and adding food. `scripts/mapcheck.ts` checks
  the poorest start against the median over 120 maps (worst about 0.63, mostly peninsulas that
  have the sea instead).
- **AI personalities** are not built in. Each AI gets a few **leanings** (e.g. "likes the sea",
  "likes order") that only weight its early culture picks, then its own tags drive the rest.
- **AI design of troops and districts:** the AI picks from a library of sensible loadout
  templates and district blueprints, scores them against what it has (goods, deposits) and what
  it has seen the player field, and adopts new templates when it meets something that beats it.
  This is what makes "someone creates something better" happen.

## 11b. Dynasties (as built)

The great houses are the thread through the game.

- **One house rules from the start.** Once the realm has 3 settlements, two more rise in the
  Classical age, a fourth in the Medieval, a fifth in the Renaissance (at most 5).
- **Traits and levels.** Each house is born with 2 points in one area and 1 in another. Areas are
  the building lines (food, wood, mining, science, religion and arts, money, industry) and war.
  A house's **level** in an area runs 0 to 10: its traits, plus **experience** from governing
  (a settlement fully given to a line teaches 1 a turn; 40 make a level), plus its **trinkets**.
  A level-2 research house put in a military town, given war trophies, slowly becomes a war house.
- **Governors.** Every settlement is governed by a house (the throne by default), from the Houses
  screen (Y) or the settlement panel. Each level adds +10% to its line where the house governs;
  the ruling house lends half of its levels to the whole realm. War levels season the levies
  raised there (+1 battle per 3 levels) and muster more guards.
- **Trinkets** come from building (12% per finished building of a line), from **great
  buildings** (always two of their line), from **captured settlements** (a treasure of what the
  place was known for) and from **broken armies** (a war trophy, 25% when the enemy loses 300+).
  The **War College** (Medieval, one per realm) seasons every levy of the realm and teaches its
  governing house war three times as fast.
- **Power and unrest.** Power is the people a house governs, plus 300 per level. A house that
  outweighs the throne grows restless (at most 12 a turn); one close to it grumbles; the rest calm
  down. Taking a settlement from a house offends it (+10). Honours (15 gold per settlement) calm a
  house by 35; a trinket given calms it by 10.
- **Civil war** at 100 unrest. **The realm splits.** The player chooses a side: that side keeps
  its settlements, the other houses with theirs, and the alliances. The other house's settlements,
  with the armies and ships nearest them and a levy raised in each of them, become a realm of
  their own, at war; no treaty ends it.
  - Take all their settlements and the war is won at once.
  - After **10 turns** the side with the bigger army takes the throne and the realm is one again.
    The losing house gives up half its trinkets and half its learning.
  - Armies **within 90–110%** of each other: **stalemate**. Two realms remain, at peace.
  - The throne can yield at any time. A choice left open defaults to the throne; AI thrones stand
    with themselves.
- **Democracy** (politics, after Constitution): the houses become parties. Assignment is free,
  the party governing the most people leads, unrest grows at a quarter of the rate, and levels
  count for 40%.
- AI peoples keep about half the realm under the throne, give the rest to the house strongest in
  each settlement's line, honour restless houses, and yield a civil war when outgunned two to one.

## 11c. Building on the map (as built)

Roads by age: any army until the Medieval age, then workers; engineers join in the Industrial
age (§8.1). **Railways**: with the Railways tech, engineers standing on a road lay a railway over
it (10 gold, the rest of their moves; the R key or "Lay railway"). Moving from rail to rail costs
a fifth of a move. A settlement on a railway that reaches another of its realm's settlements
makes 15% more production. Rails carry trade like roads. AI peoples raise a crew of engineers
once they know Railways and lay rails between settlements 6 hexes apart or less, once the roads
are done. Rails are drawn as a dark iron line with light sleepers.

## 11d. Events (as built)

A story every 5 to 15 turns (the first after turn 8, never closer than 3 turns), each asking for
a choice whose cost and effect are shown before it is made; a choice the realm cannot pay for is
greyed with the reason. 18 events across land, people, court, trade, war, faith and knowledge
(harvests, blight, prospectors, plague and its aftermath, fire, house feuds, heirs, scholars,
caravans, bandits, festivals, refugees, floods, envoys, inventors, a relic and a comet).
Against repetition: cooldowns per event, once-a-game events, a lower weight for the same kind as
the last one and for events already seen. Some queue a follow-up a few turns later. Costs scale
with the age. Left undecided, the first open choice is taken when the turn ends.

## 11e. Difficulty (as built)

Three presets chosen on the New game screen, their modifiers listed under the choice. Difficulty
changes how able and forgiving the rivals are, never which mechanics exist. All knobs live in one
profile (`src/engine/difficulty.ts`); saves without a difficulty play as Standard.

|                                           | Discovery (casual)        | Standard (normal) | Veteran (hard) |
| ----------------------------------------- | ------------------------- | ----------------- | -------------- |
| Rival gold, science, culture              | ×0.85                     | ×1                | ×1.15          |
| First war anywhere / on the player        | turn 40 / 60              | 30 / 30           | 25 / 25        |
| War chance per turn, strength edge wanted | 4%, ×1.4                  | 6%, ×1            | 8%, ×0.85      |
| Player start                              | +50 gold, +2 levy cohorts | even              | even           |
| Harmful realm events                      | ×0.5                      | ×1                | ×1.3           |
| Player houses' unrest growth              | ×0.8                      | ×1                | ×1.15          |

`scripts/difficultycheck.ts` checks that one seed gives the same world on all three and that
rivals end weaker on Discovery than on Veteran. A 3-seed, 180-turn sweep gave rival scores
285 / 296 / 309 and 17 / 36 / 48 wars. Planned next: early-war warnings on Discovery, smarter
combined arms and deal reading on Veteran.

## 12. Victory and game length (as built)

Victories open by age, per people (each people's own age, never the first to arrive). A
dominance goal must be held 10 turns; everyone is warned when someone starts holding one, and the
Victory screen (V) shows each goal's progress for you and the leading rival.

| Victory               | Opens                    | Goal                                                                                                                     |
| --------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Conquest              | Ancient (always)         | Be the last great people standing (free peoples do not count)                                                            |
| Cultural domination   | Renaissance              | 40% of the world's culture each turn, held 10 turns                                                                      |
| Economic dominance    | Renaissance              | 50% of world GDP each turn, held 10 turns                                                                                |
| Diplomatic federation | Industrial               | A league of you and your allies with over half the world's people, you its largest member, held 10 turns                 |
| Scientific            | Industrial               | Every Industrial tech, then three national projects: Great Observatory, Transcontinental Telegraph, First Powered Flight |
| Score                 | turn limit (default 400) | Best score: people, settlements, techs, culture                                                                          |

GDP per turn = gold + production + goods made (food ×0.5, raw ×1, luxury ×2, made ×3) + a
quarter of the food surplus. The world economy counts free peoples; culture shares count great
peoples only. In three 400-turn AI test games the endings were Cultural (turn 236), Scientific
(turn 389) and Score. Planned: victory toggles at setup.

## 12b. Dynamic ages: national directions (as built, first slice)

Every age shows an "Entering the age" card: the age's new system, the victories it opens, and a
direction to choose when one is due. On entering the Classical age and the Renaissance a people
chooses a **national direction**: a lasting legacy (its bonuses stay all game, half again as
strong when the people holds its culture tag) and an **edict** with a cooldown. The Nation
screen (O) lists them.

| Age         | Direction                                      | Legacy                                          | Edict                                                      |
| ----------- | ---------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| Classical   | Merchant Republic (republican)                 | +12% gold, +5% culture, +10% upkeep             | Convene the Senate: houses −20 unrest                      |
| Classical   | Centralized Monarchy (absolutist)              | +1 levy cohort, +1 guard, −10% upkeep, −5% gold | Royal Levy                                                 |
| Classical   | Imperial Bureaucracy (rationalist)             | +10% science, +5% gold, faster roads            | Census and Tax: 5 gold per 1,000 people, houses +10 unrest |
| Renaissance | Chartered Companies (maritime)                 | +15% coastal yields, +10% naval, +5% gold       | Charter a Company: 25 gold per port                        |
| Renaissance | Colonial Administration (expansionist)         | +15% growth, +10% housing                       | Colonial Charter: free settlers                            |
| Renaissance | Religious Reform (devout)                      | +15% culture, −10% culture costs                | Reformation Sermons: +25 culture, houses −10 unrest        |
| Renaissance | Commercial Renaissance (alternate, mercantile) | +20% gold, +10% production                      | Great Fair: +60 gold, +10 culture                          |
| Renaissance | Age of Conquest (alternate, martial)           | +10% attack, +15% siege, +1 morale              | Muster the Hosts: two levies                               |

Alternate developments are offered only to a people whose history fits: a quarter of world GDP
for the Commercial Renaissance, a settlement taken in war for the Age of Conquest. AI peoples
choose by culture and their own seeded taste, and issue edicts when they pay. Next: one new
system per age (tribal settlement, feudal obligations, labour and unrest) and crises driven by
the realm's state.

## 12c. Crises (as built)

Hard times that grow out of a realm's own state, change play for a while, and always leave more
than one way out. A crisis can strike only while its cause is real (pressure 100% or more),
never before turn 40, at most one at a time, at least 35 turns apart, and the same crisis at most
once in 60 turns. The chance is 12% a turn while the cause holds (×0.5 on Discovery, ×1.3 on
Veteran for the player). The Nation screen (O) shows the pressures building before anything
happens; the crisis card explains why it struck. Each crisis can be answered once; some end early
when their cause is fixed. AI peoples answer at once.

| Crisis      | Ages                 | Cause                                              | While it lasts                                     | Ways out                                                                                                                               |
| ----------- | -------------------- | -------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Famine      | Ancient–Medieval     | a third of settlements short of food               | growth −40%, houses +2 unrest/turn                 | buy grain abroad (ends); send the hungry as settlers (eases); ration (eases, +5 unrest); feeding the realm ends it                     |
| Debt Crisis | Classical+           | troop upkeep near income, treasury under 40        | gold −15%, morale −1                               | borrow from the houses (ends, +10 unrest); debase the coinage (gold, eases); send the veterans home (ends); a healthy treasury ends it |
| Plague      | Classical+           | crowded settlements in a realm of 15,000+          | growth −60%, gold −15%, two largest lose 3% a turn | physicians (2 turns, eased); quarantine (no deaths, half as long); prayer (eases, −10 unrest)                                          |
| Schism      | Medieval–Renaissance | religious tension 60+ with houses of worship       | culture −25%, houses +3 unrest/turn                | council (ends, tension −50); suppress (ends, −20 culture); let the faith divide (religious upheaval); tension under 30 ends it         |
| Strikes     | Industrial           | factories, worse with crowding or too few comforts | production −30%, gold −10%                         | concede wages (ends); labour laws (−30 culture, ends); break the strike (ends, +15 unrest); better conditions end it                   |

In 320-turn AI games each realm met one or two crises, from mid-game on, mostly plague and
schism: AI realms keep food and gold in hand, so famine and debt are the player's own risks.
Next: world crises that touch several peoples at once (a continental plague).

## 12d. Age policies (as built)

Every age brings one question the realm keeps answering, as a lever with three positions on the
Nation screen (O): two sides that each give and cost, and a balanced middle with no effect. A
lever can be moved again 10 turns after it was last moved. Earlier levers stay in force, so a
late realm pulls five; the new one is shown on the age card. Kept deliberately small: no new
screens, no new resources, every effect stated in one line.

| Age         | Policy         | Left                                                                     | Right                                                                |
| ----------- | -------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Ancient     | Way of Life    | Migratory: settlers −25% people, +1 sight, growth −10%                   | Settled: growth +10%, food +5%, settlers +25% people                 |
| Classical   | Revenue        | Light Taxes: growth +10%, culture +5%, gold −10%                         | Heavy Taxes: gold +15%, houses +1 unrest/turn, debt less likely      |
| Medieval    | Feudal Balance | Noble Autonomy: houses −1 unrest/turn, levies −1 cohort                  | Royal Authority: levies +1 cohort, +1 guard, houses +1.5 unrest/turn |
| Renaissance | Trade Policy   | Mercantilism: production +10%, gold +5%, culture −5%, plague less likely | Free Trade: gold +10%, science +10%, plague more likely              |
| Industrial  | Labour         | Laissez-faire: production +15%, strikes far more likely                  | Welfare: growth +10%, gold −10%, strikes half as likely              |

AI peoples review their levers every 5 turns from their own situation (few settlements →
migratory; restless houses → autonomy; crowding → mercantilism; many factories → welfare).
Policies are the per-age system of the Dynamic Ages plan in its simplest form; the plague events
of the event pools were retired so plague exists once, as the crisis.

## 12e. Coalitions (as built)

From turn 100, when one great people runs away with the game (it holds a victory goal, or its
score is 1.5 times the next people's), the others band together against it, and say why.
Everything is out in the open: no hidden bonus for anyone.

- Members think worse of the leader (−20, fading) and better of each other (+10).
- Members end their trade treaties with the leader (an embargo).
- A held victory goal is news everywhere: every great people can join, and learns of the leader.
- Every 5 turns, when the AI members' combined strength reaches 90% of the leader's, those not
  at war and not bound by a pact declare war together. The player is never dragged in.
- AI members also look for war on the leader twice as often, at any distance they can reach.
- It breaks up when the leader no longer holds a goal and its score falls under 1.25 times the
  next.
  The Victory screen names the coalition and its reason. In 400-turn AI games coalitions formed
  against peoples holding the Cultural goal and fought four wars in one game; the leader still won
  there, so a coalition is counterplay, not a guaranteed stop.

## 12f. Peace terms and sieges (as built)

**Peace terms.** Offering peace (Peoples screen) now has terms: a plain peace, tribute either way
(3, 5, 10 or 20 gold a turn for 20 turns), or a settlement either way. Their answer shows before
the offer is sent. Settlements change hands only in a peace treaty, and never a people's last
one. A side losing badly wants out: its dead and the settlements it has lost make it readier to
pay or cede. A ceded settlement keeps its districts; the old owner's troops withdraw to their
nearest settlement. An AI winning a war against the player offers peace on terms every 6 turns:
the player's nearest small settlement, or a quarter of the player's income as tribute.

**Sieges.** Three or more enemy cohorts standing next to a settlement besiege it: it stops
growing, its guard stops recovering and, from the second turn, falls 10% a turn (to 20% at
least); after 5 turns its walls are breached and stop counting in battle. Driving the troops
off lifts the siege. A besieged settlement has a dashed red ring on the map (solid once
breached) and says so in its panel. Supply lines and war weariness were left out on purpose.

## 12g. Less micromanagement (as built)

- **Automate** a crew of workers or engineers: it builds the roads between your settlements, and
  railways once it can, on its own (the AI's own crew orders).
- **Explore** with a small band (one or two cohorts): it heads for the nearest unknown land and
  hands itself back when nothing is left nearby.
- **Governor plans this settlement** (settlement panel): the governor lays out districts and
  chooses buildings each turn, as the AI does. When two or more settlements have nothing to
  build, one to-do item hands them all to their governors.
- Automated units and settlements leave the to-do list; any direct order takes a unit back.

## 12h. Chronicle and statistics (as built)

Every turn each great people's numbers are recorded: population, settlements, techs, culture
and wealth (GDP) per turn, military power and score (free peoples are left out). The
**Chronicle & statistics** screen (top bar, or L) has three tabs:

- **Rankings**: the peoples the player has met, side by side with their age and each number's
  rank; sort by any column. Peoples not met yet are counted but not shown.
- **Over time**: a line chart per number, a line per known people (the player's thicker).
- **Chronicle**: the moments kept for good: ages entered, wars and peace, captures and cessions,
  settlements founded and grown, crises, national directions, dynasty turns, victory goals; all
  peoples known, or the player's own.
  The end screen shows the score over the game and the player's chronicle. Saves stay small: the
  last 40 turns are kept turn by turn, older ones every fourth turn, and the chronicle keeps its
  last 800 moments (a 220-turn save is about 340 KB in all).

## 12i. Finding your way (as built)

- **Minimap** under the left trackers (M hides it; hidden on phones and short screens): the
  explored world, cropped to what is known, each people's land in its colour, settlements as
  dots and the part on screen framed. Click or drag on it to look there.
- **Strategic zoom**: zoomed out below the banner level, the 3D map writes small settlement names
  in their people's colour, the biggest first and none over another.
- **Empire** (E, or Find by the minimap): every settlement (size, people, districts used,
  besieged or governed) and every formation (kind, cohorts, orders: waiting, moving, fortified,
  automated, exploring), plus a Find box across them and the foreign settlements the player has
  seen. A row looks there and selects it; Enter in Find goes to the first match.

## 12j. Faith (as built)

Kept light: nothing to move or manage. Faith screen (I); also from the Nation screen.

- **Founding is a race.** With Mysticism and a shrine built, a people can found a faith (a name and
  a founding belief). The world has room for one faith per two great peoples (two at least). AI
  peoples found none before turn 40 / 30 / 20 (Discovery / Standard / Veteran), then by chance
  each turn, so a player who goes for it can win a place.
- **It spreads by itself.** Each settlement within 6 hexes of another pulls it toward that one's
  faith: 1 + shrines + 2×temples + 4×cathedral + 5 for the holy city, divided by distance; ×1.5
  when both are on roads, ×1.5 within one realm, ×1.25 between trading partners. A settlement's
  own faith resists at twice its strength (×1.5 more for a zealous people). A faith that stays the
  stronger for 5 turns is taken up. On founding, the holy city and the realm's settlements nearby
  with no faith take it up at once.
- **Three tenets.** A founding belief rewards the founder (Tithes: +½ gold per follower settlement;
  Pilgrimage: +1 culture per foreign follower settlement; Missionaries: spreads 1.5× faster; Holy
  Warriors: +5 morale). A teaching (Priesthood) and a doctrine (Theology) help every people whose
  faith it is (growth, science and culture, slower tension, production; culture, home defence,
  science, faster spread and gold).
- **A people's faith** is the one most of its people keep, a third at least.
- **Opinion:** shared faith +10; another faith −5 (−15 for a zealous people, none for a tolerant
  one).
- **Schism tie-in:** a realm with over 35% of its people outside its own faith builds religious
  tension (+0.8 a turn, up to 80), which can bring on the schism crisis.
- Settlement panel and the Empire list show each settlement's faith and any faith gaining ground;
  the chronicle keeps foundings, tenets and peoples changing faith.

## 12k. World wonders (as built)

A race, with nothing to manage. Wonders screen (W), the settlement panel's "Build a wonder", or
the Nation screen.

- **10 wonders**, two per age, each opened by a tech: Great Pyramid, Hanging Gardens; Great
  Library, Great Wall; Dome of Heaven, Grand Bazaar; House of Printing, Grand Admiralty (coast);
  Crystal Palace, Grand Terminus.
- **One in the world each.** A town or bigger starts one by paying its goods from its market.
  Half its production goes to the wonder while other work is queued, all of it when nothing is.
  The first to finish takes it; everyone else building it gets half their work back as gold.
- **What a wonder gives:** a realm bonus (production, growth, research cost, defence, culture,
  gold, at sea…), +2 culture a turn and 5 score. It goes with its city when the city changes hands;
  a captured or ceded city's work in progress is lost.
- **The race is visible:** each wonder shows who is building it (peoples met by name, others as
  "someone") and how far along (just begun, well begun, past half, nearly done).
- **AI:** a people with no wonder under way starts one now and then (4% / 6% / 9% a turn by
  difficulty; two at once on Veteran) in its most productive town, preferring wonders that suit
  its culture and avoiding races nearly lost. In 250-turn AI games about 6 of 10 are built, the
  ancient ones around turns 85–110.
- **On the map** a wonder stands as a landmark by the settlement centre (pyramid, gardens, statue,
  tower, wall, hall, dome, glass hall), with scaffolding while one is being built.

## 12l. Stories across the ages (as built)

Events in chapters (engine/storyEvents.ts). An opening chapter is drawn like any event, once a
game, when its condition holds; every choice is remembered and decides what the next chapter is
about and what it offers. Later chapters wait some turns and often the next age; a story whose
settlement, house or people is gone simply ends. The event card shows "story · chapter n of 3";
each chapter goes into the chronicle.

| Story                  | Opens                                           | Thread                                                                                                   |
| ---------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| The Founder's Legend   | Ancient, the capital                            | who the founder was → the tomb (shrine, study, or the legend's own gift) → a scholar doubts it all       |
| The Lost Expedition    | Ancient–Classical, with Sailing, a coastal town | fund or not → a survivor (a far land revealed, or the crews honoured) → kin across the sea (Renaissance) |
| A Marriage of Houses   | two houses                                      | bless, dowry or forbid → an heir, or lovers fled → the heir grown, or the quarrel ended                  |
| The Merchant Guild     | Classical–Medieval, Currency                    | charter or free trade → a rich guild or smugglers → guild to company                                     |
| The Wandering Preacher | Classical–Renaissance, a realm with a faith     | pulpit or silence → followers or a martyr → a reformed faith or a split (religious tension)              |
| The River Town         | a river settlement                              | levees, move or trust → the great flood → a canal (Renaissance)                                          |
| The Old Grudge         | a people met                                    | forgive or swear vengeance → friendship or the oath → a hundred years on (opinion)                       |
| The Teacher            | Classical–Medieval, Writing                     | a schoolhouse or the temple → her students → a university                                                |

## 12m. Raiders (as built)

A threat of the early ages that belongs to no people (engine/raiders.ts).

- **Camps** appear in empty wild land 4–8 hexes from a settlement, from turn 35 / 25 / 18
  (Discovery / Standard / Veteran), up to one per three, two or one and a half great peoples. No
  new camps once a great people reaches the Medieval age; at the Renaissance the last scatter.
- **Bands** (3 cohorts on Standard, more in later ages; two per camp) ride for the nearest
  settlement within 10 hexes of their camp that is weakly held (troops inside plus half its ready
  townsfolk guard fewer than the band's cohorts) and not raided in the last 16 turns. Next to it
  they pillage: up to 12 gold per age plus 2 per cohort, and 250 people from a town over 1,500;
  then they carry the loot home. On the way they strike workers, settlers and smaller armies.
- **Burning a camp:** march any army into it; the burner takes its hoard (25 gold per age plus
  the loot its bands brought home). Bands of a burned camp wander and break up within 8 turns.
- Raiders are one hidden people: always hostile (attacking them needs no declaration of war),
  never met, never in a diplomatic war, never eliminated. AI peoples strike weaker bands next to
  their armies and send an army of 3+ cohorts to burn camps within 7 hexes of their towns.
- The player is told when a camp is seen near their lands, when a band rides for one of their
  towns, and when a town is pillaged. Camps show as tents on both maps; the hex panel explains.

## 12n. Readable AI (as built)

- **Leader personalities** (data/leaders.ts), fixed per game by the seed, shown in the Peoples
  screen with the ruling house: Conqueror (looks for war 1.8× as often, needs 15% less edge;
  thinks less of the weak), Builder (0.5×, needs 25% more; +5 to everyone), Merchant (0.7×;
  +10 to trading partners), Zealot (faith opinion doubled), Diplomat (0.7×; +10 to those it has a
  pact or alliance with), Opportunist (1.2×; −10 toward peoples already at war elsewhere).
- **Intent toward you**, for every people met, with its reasons, from the same test the AI uses
  to choose a war (ai.ts `warCheck`): distance, opinion, pacts, alliances, relative army, the
  difficulty's peace period, coalitions, personality. Levels: no threat for now; watch them (one
  thing holds them back); hostile (could attack any turn); massing troops; at war.
- **Warning before an attack:** an AI people that picks the player as its target first masses
  troops on the border and says so (war in 6 / 4 / 3 turns by difficulty, with its reasons). When
  the time is up it attacks only if the test still holds; otherwise it stands its troops down.
  The Peoples button shows "threat" while a rival is massing. Wars between AI peoples, and allies
  joining a war, come without the warning.

## 12o. Release 1 conveniences (as built)

- **Sentry (Z) and skip (X):** a unit on sentry waits out of the to-do list until an enemy (at
  war, or raiders) comes within 3 hexes, then wakes with a message; a skipped unit is left out
  of the to-do list for the rest of the turn. Any direct order takes a unit off sentry.
- **Victory toggles:** the New game screen turns cultural, economic, diplomatic and scientific
  victories on or off; conquest and the score at the last turn are always on.
- **Rematch:** the end screen starts a new game on the same map and settings.
- **News that goes somewhere:** each turn's lines are sorted as needs you now, to act on, or for
  your information (ui/news.ts) and linked to what they are about: one of your units or
  settlements (selected and centred), or the screen that deals with it (research, faith,
  wonders, crisis, goods, houses, nation, victory, culture, peoples). Urgent lines stay as
  notes until clicked; a turn with three or more lines shows a "Turn N in brief" card, grouped,
  every line clickable; the Last turn report is grouped the same way.
- **Clean install:** Playwright is a dev dependency; the README lists the steps.
- **Saves:** Save (top bar) opens Saves: save now, save under a name (five named saves kept per
  game), export the game to a file, and load any save of this game. The menu imports a save
  file. Autosaves keep the last three turns; a damaged save falls back to an older one. Each
  new game gets its own tag, so a rematch on the same map never overwrites the old game's saves.
- **Settings** (top bar and menu): interface size 90–150%, text size for panels and dialogs,
  animation speed, reduced motion, effects volume, autosave every 1, 2 or 5 turns or never.
  Kept per browser and applied at once. (Music is not in the game yet.)
- **"Why?" on the main numbers** (engine/breakdown.ts): hover or focus gold, the research
  progress or culture in the top bar for the lines behind them: each settlement (the biggest
  four named), troop upkeep, tithes, deals, free peoples' gifts, wonders, pilgrims. Opinion
  already lists its reasons in Peoples.
- **Codex** (H, or the ? button): searchable help. 22 basics written for players, plus entries
  made from the game's own data (techs, buildings, wonders, tenets, victories, crises, policies,
  directions, leader types, culture domains and tags, goods, terrain, difficulty), so it never
  says what the game does not do. The gold popover links into it.
- **Guided first game** (ui/guide.ts): ten steps (found, research, plan a building, explore,
  workers and a road, a second settlement, meet neighbours, a levy, a culture choice, the victory
  screen), each shown only when it is next and ticked by the game itself, with a Show me button.
  On for new games on Discovery and Standard, off on Veteran; Hide the guide turns it off.
  Shown under the minimap (not on phones yet).

## 12p. Navigation (as built, after the first playtest)

- **Top bar:** your people, the turn, gold with its gain a turn, the research in progress with
  science a turn, culture with its gain (each answers "why?" on hover), then Victory, Goods, last
  turn, map mode, Codex, sound, settings, Save and Menu.
- **Realm buttons** down the left, each a screen with tabs: **Military** (units; designs),
  **Cities** (every settlement with people and food, production, science, gold and culture a
  turn, a row opening its screen; wonders), **Nation** (nation; faith; dynasties; chronicle),
  **Diplomacy** (peoples; rankings, where peoples not met yet show as unknown). A pill shows what
  needs you there (idle units, a war or threat, a crisis or choice).
- **Keys:** W A S D or the arrows move the map; Enter ends the turn; Space goes to the next
  thing to do; Esc closes. Everything else is in the menus.
- **Settlement screen:** Overview and Districts tabs; buildings are placed in the 3D scene, and
  each shows what it would make on that plot. Founding asks for the settlement's name.
- **Standing orders** move when the turn ends. Troops are drawn three times life size; pointing
  at a hill or mountain picks that hex.

## 12q. Ruins (as built)

About one ruin per 55 hexes of open land away from the starting peoples (engine/ruins.ts),
drawn as broken columns once seen. The first unit to step onto one searches it (AI scouts and
exploring units head for ruins in sight). Finds, by weight: a buried hoard of gold; lost scrolls
(half the current research); a cache of rare goods sent to the capital (ivory and hides, copper
and tin, furs, wild horses); an ancient armoury that gives the finder's first two cohorts bronze
swords and bronze scale; an old map revealing far land; survivors who join as a cohort; a relic
for the houses. In AI-played games every ruin is found within about 80 turns.

## 12r. Towns and colonies (as built)

The realm grows as one piece (engine/colonies.ts). A new settlement is a **town** when it stands
within twice the territory radius of one of the people's towns (3–4 hexes with the usual radius
of 2: just outside the border or one hex further, so the two lands touch or overlap). The first
settlement is always a town. Founded further out, it is a **colony**:

- one district; only farms, pastures, fishing, woodlots, mines, houses, and the harbour or
  shipyard to ship from; it cannot grow past a settlement;
- its goods reach the realm only by road (the market), or by sea when it lies on the coast and
  the realm has a harbour (a coastal colony counts as its own port);
- once a town of the realm stands within reach of it, it can be **made a town** for 40 gold per
  age.
  From the Renaissance a colony may build anything and grow to four districts; from the Industrial
  age every new settlement is a town. The settlers' panel says before founding whether the spot
  makes a town or a colony; banners mark colonies. AI peoples avoid colonies unless a rich deposit
  pays for one, and make their colonies towns as soon as they can.

## 12s. Release 2: living ages (as built)

- **Balance matrix** (scripts/matrix.ts): each difficulty × seeds 11, 29, 47 × 200 and 400 turns,
  the player's people played by the AI. Found and fixed: difficulty made AI peoples fight and be
  raided more among themselves, so rivals were weaker on Veteran. Now the level sets how
  readily rivals turn on the player (war chance, edge wanted, first war), AI-vs-AI wars follow
  the standard rules, raider camps are as many on every level (the level sets how near the
  player they come and how strong those bands are), and rivals earn 20% less on Discovery and
  25% more on Veteran. 400-turn games end in scientific and cultural victories as well as score.
- **Pacing** (scripts/pacecheck.ts): events every 4–9 turns in the Ancient age, 5–15 later, and
  never 8 turns without one; no age goes 10 turns without a moment that matters.
- **What decided a battle:** numbers, weapons and training, armour, ground and walls, archers
  without a front, a charge on open ground or blocked, morale; in the battle window and the news.
- **Shortages:** factories, homes or the army first (Goods). **Rail & power lens** on the map.
- **Industrial techs** each change how something works or open something (Machine Tools:
  equipping a quarter cheaper, railways half the gold); the three scientific projects cost 900,
  1,100 and 1,300.
- **Shocks** (scripts/shockcheck.ts): iron lost, a road cut, a restless house: more than one way
  out each.
- **Empire priority** (Nation): balanced, growth, trade, expand, war, followed by governed
  settlements; settlers can settle on their own. **Routine news** folds into one line.
- **Three ways to play** (scripts/buildscheck.ts, kept out of `npm test` for its length): the
  player's settlements under governors with a war, growth or trade priority, 400 turns on seeds
  29 and 47. Each reaches the top two at least once (war 2nd, growth 1st, trade a cultural win).
  War first wore itself out: it levied armies in peace and built two industry quarters before
  any learning. Now it keeps a standing army the size of the realm in peace (two more at war)
  and its second quarter is for learning. The harnesses answer offers as a player would: they
  take peace and turn down the rest.

## 12t. Touch and tablets (as built)

- Phones and tablets (a coarse pointer up to 1180 px wide) keep the realm's numbers on one row
  of the top bar and fold the rest into a More menu, which closes when a screen opens and sits
  above the side panel while open.
- The map canvas fills its place in CSS pixels; its drawing buffer is in device pixels (before, on high-density screens the map drew at twice its size from the top-left and unit badges sat away from their units).
- In a settlement a tap on a building shows what it would make (outlined); a second tap builds.
- A long press on a number in the top bar shows where it comes from; the tap that ends the
  press does not also open the screen, and a tap elsewhere closes it.
- No hover card by touch; larger targets on the minimap bar.

## 12u. Fewer words (as built)

- Screens show icons and numbers, not sentences: yields and stocks as icon chips (`Chip`), changes
  as coloured signed numbers (`Delta`: +3 green, −7 red), names one hover away.
- Details that matter but are not needed to play sit behind a round (i) button (`InfoButton`).
- Choices (national direction, policies, tenets) show 3–4 effect chips each; picking one opens a
  detail card with everything and a Confirm button.
- No instructions on how to play ("click a hex to move", "found a city here"): the guide steps
  are a title and a few words, and the Codex keeps the long explanations.
- Kept: why a button is greyed out, in a few words.
- Growth modifiers now read one way everywhere: the engine's `growthPct` is food needed to grow,
  so less is better. Directions, policies, the Holy Feasts tenet and the famine and plague crises
  had it the wrong way round (a famine made growth cheaper); their signs are fixed.

## 12v. Saves in IndexedDB (as built)

- Saves are in IndexedDB (`src/ui/store.ts`), which holds far more than localStorage's few
  megabytes; the save code reads a copy in memory loaded once at start and each write goes on to
  IndexedDB in order. Saves an earlier version left in localStorage move across on the first start
  and are removed from it. The game asks the browser to keep its storage (persist). Without
  IndexedDB it falls back to localStorage. `scripts/save-smoke.ts` checks all of this.

## 12w. Rulers (as built)

- Every great people is led by a ruler with a **major strength** (in full) and a **minor** one
  (a lighter form): `src/data/rulers.ts`. Thirteen strengths: swift armies (+1 move), pathfinder
  (troops cross any land at one move a hex), warlord, drillmaster (upkeep), defender, admiral,
  scholar (science), sage (research handed over on entering each age), patron (culture),
  visionary (culture each age), merchant (gold), provider (food and growth), builder (production).
- **19 historical rulers**, four an age from the Ancient to the Renaissance and three in the
  Industrial: each with their nation's name, banner colour, twelve settlement names (capital
  first) and a way as a rival (personality). Rivals are drawn from them by the map seed; a game
  can ask for the invented peoples instead.
- **New game, second step:** after the map and game settings, lead a historical ruler or make
  one's own: name, people, one of 12 faces (art sheet M7), any major and minor strength (the same
  area or different), banner colour, and settlement names borrowed from a nation or invented.
  "Begin" on the first step starts at once with a ruler chosen by the seed.
- Diplomacy shows each rival's ruler, face and strengths; the Nation screen shows yours.
- **Badges:** each people's badge is a shield in its colour with its emblem (art sheet M8): each
  historical ruler's own (ankh, Roman eagle, fleur-de-lis…), and for a ruler of one's own any of
  the 32 (13 made for that: lion, wolf, stag, tower…). Shown on the top-bar crest, in Diplomacy,
  Rankings and offers, on the settlement card and at the front of every settlement's name tag on
  the map (`src/ui/Badge.tsx`, `src/ui/shield.ts`).
- **Balance** (`scripts/rulerbalance.ts`, summed by `rulerbalance-sum.ts`): 64 games of 250 turns,
  every people played by the AI, the player's ruler rotated through all 19. First run: Provider
  (food and growth) snowballed (Cleopatra won 14 of 20) and Sage lagged. Three rounds of tuning:
  Provider halved (+8% food, −8% food to grow), Sage +3 techs' worth an age and +12% science,
  Warlord +20% attack, Merchant +32% gold, Builder +15%, Patron's minor +16%, Defender's minor
  to +5% city defence and a guard cohort. Last run: majors between 0.91 and 1.15 of the game's
  average score, wins spread. Julius Caesar stays the lowest (a conqueror who fights a lot);
  Suleiman the highest.

## 12x. Troops on the map (as built)

- Figures are put together in code (`src/render/troops.ts`) from the formation's main design, in
  the same low-poly shapes as the rest of the map, and baked into one mesh per formation: body
  and tunic in the people's colour, armour by material (padded, leather, bronze scale, mail,
  plate…), helmet (cap, crested bronze, iron with nasal, great helm, brimmed hat in the gun ages),
  shield toward the viewer with its face in the people's colour, and the weapon (club, spear,
  pike, sword, axe, sling, javelins, bows, crossbow, gun with or without bayonet). Riders sit on
  horses (barded in the people's colour); field guns have wheels and a gunner; settlers an ox cart;
  workers carry picks. One to four figures by size (three riders, two guns). Every formation, ships too, stands on a round base: a dark outline, a ring in its people's colour and a paler middle. The first formation on an open hex stands in its middle on a base that fills almost the whole hex; a second or third, or any in a settlement, stand to the side on a small one.
- No hand-made models: every gear combination draws itself, nothing to download, one draw call a
  formation. `tools/preview/troops.html` (dev server) shows every look in a row.

## 12y. Owner feedback, round 4 (as built)

- **Building:** a city has 100 builders per size step (settlement 100 … metropolis 600), apart from
  the workers who staff buildings. A queue the player orders, pauses and cancels; active items share
  the crew evenly (300 on two items = 150 each), never more items than crews of 100; speed = builders
  ÷ 100 × production per 100 builders, so anything that raises production builds faster. Nothing
  queued is fine. Picking a building shows the city's yields before → after and turns to build.
- **Centre improvements** need no plot: market, railway station, palisade → walls → castle (drawn
  as a ring), monument, barracks, armoury.
- **Hubs:** each opens its own window with its tabs in the header (Military: Land, Sea, Designs;
  Cities: Cities, Wonders; Nation; Diplomacy). Minimap bottom left.
- **Designs by hundreds:** the unit card splits a formation's cohorts of 100 among designs with
  steppers and prices only the cohorts that change.
- **Strength:** one number per formation (`formationStrength`), on the map, in the unit card and the
  attack preview; military power is their sum.
- **Diplomacy from a city:** a foreign or free people's settlement shows their badge, ruler, opinion
  and actions.
- **World:** 2–3 ruins near every start with early loot (caches, a research step, guardians);
  wolf, bear and boar lairs scaled to a spear levy winning about 3 times in 4 (a scout loses);
  raider camps from turn 8; 3–5 deposits by every start, drawn as low-poly signs.
- **Controls:** bevelled buttons, gold-ringed round buttons, folder tabs, framed title bars.

## 12z. Culture Tomes (as built)

- **Each world age, each people opens one Tome**: one of the nine culture domains. The world age
  is the furthest age any great people has reached; when it rises, every open Tome closes and a
  new pick is due. The same domain cannot be opened twice in a row.
- **Missions:** a Tome offers 5 missions (6 from the Classical age). Buying one costs 30 culture in
  the Ancient age (40 / 55 / 70 / 90 later) and starts its mandate, checked each turn against the
  real game (57 mandate types: battles, beasts, army strength, techs, science per turn, goods,
  ports, districts, workshops, faith, wonders…). Done, its buff — one of the domain's existing
  culture choices — is kept forever.
- **15 mandates are about houses** (a house's level in a line, houses governing, trinkets,
  honours, calm houses, balance or concentration of power, coming through a civil war); every
  Tome has at least one in every age, Politics and Society two.
- **Major buff:** three missions done open it; it costs culture (80 / 160 / 240 / 320 / 400 by age)
  and lasts forever (Knowledge: +25% science and the first tech of each age 25% cheaper; War: +20%
  attack, +1 cohort per formation…). A Tome closed before it is bought loses its major for good;
  the missions done are kept.
- The old free-pick tree and upheavals are gone; old saves keep their choices as kept buffs.
- **City yields:** a Production tab lists every building's takes and makes per turn and why it
  idles; a goods table says which buildings make and use each good, its net and turns left; every
  yield and good answers why, by building.
- **Strength numbers** are small and proportional: a scout about 1, a spear levy about 7; packs
  are sized so a spear levy wins about 9 fights in 10.

## 12aa. Mission events (as built)

- A bought mission that stalls (no progress for 5 turns, or under half after 8) may bring an
  event aimed at it: 40% a turn, at most one every 7 turns per people, through the normal event
  queue (one pending at a time), pushing the next random event back. `src/engine/missionEvents.ts`.
- Each event has one choice that serves the mission (tagged "Mission") and one or two that are
  good on their own: raiders gather near a town (let them come: a band sized so your usual army
  wins about 9 in 10; or pay them off); a house asks for patrons (one level in its line for gold;
  or half a tech for less gold); a guild offers to finish a building; a map, new goods, migrants,
  a pact, a war, a treasure for a house, honours, a new house, a civil war, a ship; for yields per
  turn, a 10-turn boost or a lump sum now. Events exist for 53 of the 56 mandate types.
- A choice that starts a war or a civil war is never the default (turn end takes the first). The
  AI answers on its own turn, taking the mission choice when it is worth it; it never declares war
  on or signs a pact with the player through these events.

## 12ab. Health, commanders, battles, goods chains (as built)

- **Recovery** per cohort a turn (`HEAL` in game.ts, shared by the engine and the unit card):
  +34 in your lands (recruits from the nearest settlement, kept above 1,000), so near 0 is full
  in 3 turns; +18 outside, +4 more resting or +7 fortified (about 6 turns). Field medics +10,
  infirmary +10 and barracks +5 in or next to the settlement, the commanding house +2 per War
  level, the people's healing bonus. A health bar on the unit card, per cohort, in the Land list
  and under each formation on the map.
- **Commanding houses:** an army may be led by a house: +3% melee, ranged and charge and +1
  morale per War level (in its strength number), faster healing; each win gives the house 8 War
  xp. In a civil war armies follow their commander; unled ones follow the nearest settlement.
- **Battle history:** every battle the player is in, on any turn and by anyone, is kept (last 50)
  with its full report; Military › Battles lists them and opens each; battles the player didn't
  order get one line in the turn news.
- **Goods chains:** hides from hunting lodges (anywhere, more on game) and pastures; the Tannery
  makes Leather (id `leatherwork`), which leather caps, armour, boots, field medics and horse
  tack cost; the earliest hide gear stays on hides. One tannery puts a cohort in leather armour
  every 2 turns. Tools feed siege ladders and field guns; iron and silver deposits also on flat
  land. `src/data/chains.ts` derives every good's sources and users; the Codex is generated from
  it (goods, buildings, gear, techs, all linked), and chaincheck guards it.
- **Map:** a frame that throws rebuilds the renderer (2D after a second failure); a lost WebGL
  context is rebuilt. An event whose subject is gone is dropped instead of stopping the turn.

## 13. Core screens and flows

1. **Map view.** Hex map, unit counters (show cohort count and main loadout icon), city
   banners, district icons, deposit icons, fog of war. Click formation → move with path preview.
2. **Formation panel.** Cohort list grouped by loadout; select N cohorts → "Assign loadout" or
   "Split"; stats summary; templates dropdown.
3. **Loadout designer.** Pick items per slot, see stats, cost and upkeep, save as template.
   Only gear already researched is listed; a slot with nothing to choose yet is left out.
4. **City panel.** Population, labour, food, housing, districts list, levy button.
5. **District designer.** 3×3 grid, palette of researched slot types (others hidden), valid/invalid highlighting
   for the target hex, adjacency arrows, totals (output, labour, cost), save as blueprint.
6. **Research screen.** The current age's techs as cards, tabs for earlier ages with techs left,
   and the gate to the next age with a progress bar. The big web is the culture screen's.
7. **Culture web screen.** Zoomable graph by domain; locked nodes greyed with "locked by: Solar
   Calendar"; tension meters; upheaval status; tag summary.
8. **Diplomacy & trade.** Civs, relations with tag-based reasons, goods deals.
9. **What is shown.** Lists show only what can be used now: the culture web shows adopted
   choices and those open now, the district palette only what fits the cell, the designer only
   researched gear. "Show locked choices" / "Show all buildings" reveal the rest, each with the
   reason it is closed. Almost every building sits behind early research (farms, pastures,
   woodcutters and houses do not).
10. **End turn / to-do list.** Nothing opens by itself (founding a city opens neither research
    nor the city). The turn box's button walks through what is left: choose research, plan a
    city with nothing under construction, order idle units. Enter asks once while the list is
    not empty.

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
type HexId = string; // "q,r"
type GoodId = string; // "iron", "wood", "ivory", ...
type ItemId = string; // "bow", "plate", "horse", ...

interface Hex {
  id: HexId;
  terrain: Terrain;
  feature?: Feature;
  deposit?: { kind: string; richness: 1 | 2 | 3; hidden: boolean };
  ownerCityId?: string;
  districtId?: string;
}

interface Loadout {
  weapon: ItemId;
  armour: ItemId;
  mount: ItemId;
  kit?: ItemId;
}
interface Cohort {
  id: string;
  strength: number /* 0-100 */;
  xp: number;
  loadout: Loadout;
}
interface Formation {
  id: string;
  civId: string;
  hex: HexId;
  cohorts: Cohort[];
  movesLeft: number;
}

interface SlotType {
  id: string;
  group: string;
  requires: { tech?: string; culture?: string; deposit?: string; terrain?: string[] };
  labour: number;
  inputs: Record<GoodId, number>;
  outputs: Record<GoodId | Yield, number>;
  adjacency?: { target: string; bonusPct: number }[];
}
interface DistrictDesign {
  name: string;
  slots: (string | null)[] /* length 9, row-major */;
}
interface District {
  id: string;
  hex: HexId;
  design: DistrictDesign;
  built: boolean[];
}

interface CultureNode {
  id: string;
  domain: Domain;
  cost: number;
  requiresAll: string[];
  requiresAny: string[];
  excludes: string[];
  tags: string[];
  effects: Effect[];
}
interface CultureState {
  taken: Set<string>;
  locked: Set<string>;
  legacy: Set<string>;
  tension: Record<Domain, number>;
  upheaval?: { domain: Domain; turnsLeft: number };
}

interface City {
  id: string;
  civId: string;
  hex: HexId;
  population: number;
  stockpile: Record<GoodId, number>;
  districtIds: string[];
}
interface Market {
  id: string;
  cityIds: string[];
} // recomputed when roads change; pooled view = sum of member stockpiles

interface Civ {
  id: string;
  name: string;
  techs: Set<string>;
  culture: CultureState;
  templates: Record<string, Loadout>;
  blueprints: Record<string, DistrictDesign>;
}
```

### 14.3 What happens to the current code

The current repository is a zero-player history simulator. Very little carries over directly.
It was removed on this branch (it stays in `main`'s history) and a clean `src/` started, keeping
only the tooling (Vite, TS config, Prettier, the headless check-script pattern). The Earth map and
its builder are dropped: maps are procedural only.

## 15. Milestones

Progress: **M0–M9 done.** Unit designs (§5.4) replaced the earlier per-cohort loadout picking.
Settlers, war and peace, and city capture came with M3. M4 brought districts, workers, housing,
construction, blueprints, roads and markets. M5 the research tree (§10.1), M6 the culture web
(§9.6). M7 smarter AI and M8 diplomacy and victory (§10.2), M9 ships (§6.4). Next: balance passes,
more eras (industrial, modern), and naming/visual polish.

| #   | Milestone                 | Done when                                                                                                                                             |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0  | Clean slate               | Old code archived, new skeleton builds, empty hex map renders                                                                                         |
| M1  | Map & movement            | Procedural hex map (several map types, seeded) with terrain/rivers/deposits, fog of war, a formation moves with movement points, merge on move, split |
| M2  | Cohorts & loadouts        | Levy from a city, equipment items from data, assign loadouts to N cohorts, templates, per-city stockpiles pay for it                                  |
| M3  | Combat                    | Ranged/charge/melee/morale resolution, odds preview, terrain modifiers, casualties, a dumb AI that attacks                                            |
| M4  | Cities & districts        | Found cities, 3×3 district designer, hex requirements, adjacency, labour, production of goods, blueprints, roads and markets                          |
| M5  | Tech tree                 | ~60 techs across 4 eras unlocking items and slot types                                                                                                |
| M6  | Culture web               | ~120 nodes, forks and locks, tags, tension meters, one upheaval type (Revolution), then the rest                                                      |
| M7  | AI civs                   | 8–10 AI civs that expand, design troops/districts, pick culture, fight and make peace                                                                 |
| M8  | Diplomacy, trade, victory | Relations, goods deals, victory conditions, end-of-game score                                                                                         |
| M9  | Naval & late eras         | Fleets with ship slots, embarking, industrial/modern items                                                                                            |

**Vertical slice target (end of M4):** one civ vs one AI on a small map, ancient era only,
~10 equipment items, ~20 slot types, combat working, no culture yet.

## 16. Open questions

None right now.

## 17. Decisions log

| #   | Question                            | Decision                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What does "replace" on troops mean? | Re-equipping: swap weapons, armour, shields, mounts, tools and kit on any number of cohorts (§5.5).                                                                                                                                                                                      |
| 2   | National or per-city goods?         | Per city. Roads (and later rivers, rail, sea routes) connect cities into a **market** with one shared pool; cutting the link splits it (§8.1).                                                                                                                                           |
| 3   | Do soldiers cost population?        | Yes (§5.2).                                                                                                                                                                                                                                                                              |
| 4   | Maps?                               | Procedural only, many map types, every game different; no Earth map. Art from the owner's asset packs added later through a sprite registry (§4).                                                                                                                                        |
| 5   | Multiplayer?                        | No. Single player against AI peoples.                                                                                                                                                                                                                                                    |
| 6   | First playable content?             | About 10 equipment items and 20 district slot types.                                                                                                                                                                                                                                     |
| 8   | How are troops customised?          | Through named **unit designs** with a full kit (weapon, shield, helmet, armour, footwear, ride, kit). Cohorts are assigned to designs; the mix of designs in a formation is what makes it strong.                                                                                        |
| 7   | Art?                                | Reuse the Age of Sail art set (parchment, terrain symbols, unit, city and goods sprites) for now.                                                                                                                                                                                        |
| 9   | Clicking a city on the map?         | Your own city opens its city screen at once. With one of your formations selected, clicking your city moves the formation into it instead.                                                                                                                                               |
| 10  | How are deposits shown?             | The city screen's land map is the real hex ring around the city. Each deposit shows its state (worked, workable, not yet) and its info card names the building, count and techs it needs. Water specials (whales, pearls) work from a district on the shore next to them.                |
| 11  | Double taps on End turn?            | End turn locks while a turn resolves and for 600 ms after it (2.5 s fallback).                                                                                                                                                                                                           |
| 12  | Interface look?                     | Imperator-like chrome in CSS (`src/ui/r4-imperator.css`); optional painted sheets (`art/R5-UI-SHEETS.md`) replace pieces as they arrive.                                                                                                                                                 |
| 13  | Navigation on phones and tablets?   | Two bubbles replace the left rail and the top bar's buttons below 1320 px or on touch screens: bottom left opens the realm (Military, Cities, Nation, Diplomacy), top right the ledger (Victory, Goods, Chronicle, Statistics, Codex, last turn, map mode, sound, settings, save, menu). |
