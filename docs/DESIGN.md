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

## 5. Units: formations, cohorts and loadouts

### 5.1 The model

- A **formation** is what you see on the map: one counter on one hex.
- A formation contains **cohorts**. One cohort = **100 people**.
- Each cohort has a **loadout**: one item per equipment slot.
- A formation's stats come from its cohorts. The UI shows cohorts grouped by identical loadout,
  e.g. `Formation "Northern Host" — 10 cohorts (1,000 men): 2 × [Bow, Leather], 8 × [Spear, Plate, Shield]`.

### 5.2 Raising troops

- A city **levies** a new formation of **5 cohorts (500 people)**. These come out of the city's
  population: a levy costs the city one population unit (or the equivalent) and the people only
  return if the formation is disbanded at home.
- A fresh levy has the **default loadout**: `[Improvised weapon, No armour, On foot]`.
- Later techs raise levy size (Conscription → 8 cohorts) and the formation cap (§5.4).

### 5.3 Equipment slots

| Slot | Examples (by era) | What it mostly affects |
|---|---|---|
| **Weapon** | club, spear, sword, axe, bow, crossbow, pike, arquebus, musket, rifle | attack, range, damage type |
| **Armour** | leather, bronze scale, chain, plate, ivory lamellar, padded, cuirass | defence by damage type, weight |
| **Mount** | on foot, horse, camel, elephant, later wagons/trucks | movement, charge, upkeep |
| **Kit** (optional) | shield, banner, field medics, siege tools, rope & grapples | special modifiers |

The player's examples all work: `[Bow, Plate]`, `[Musket, Horse, Ivory armour]`. Some combos are
blocked by hard rules only when they are physically silly (e.g. a pike on a camel is allowed but
gets a heavy penalty; a two-handed weapon with a shield is not allowed). The aim is very few
"not allowed" rules and many "allowed, but here is the trade-off" rules.

Each item has:

- **Tech requirement** (e.g. Bow needs *Archery*).
- **Goods cost per cohort** to equip (Bow: 2 Wood; Plate: 3 Iron + 1 Coal; Horse: 1 Horses
  resource *and* ongoing food upkeep; Ivory armour: 2 Ivory).
- **Upkeep** per turn (mounts and gunpowder weapons cost more).
- **Weight**, which affects movement and fatigue.
- **Damage type** (weapons): *cut, pierce, crush, missile, fire*. **Protection** (armour) vs each type.

### 5.4 Merge and split

- Moving a formation onto a hex with another of your formations **merges** them (one-click
  confirm, or always-merge setting). Cohorts and their loadouts are kept as they were.
- A formation has a **command cap** in cohorts (start 10, raised by tech and by culture choices
  like *Professional Officer Corps*). Merging past the cap is refused, and the UI offers a split
  instead.
- **Split** at any time: drag cohorts into a new formation on the same hex, or "split by loadout".
- Movement of a formation = movement of its **slowest** cohort. This is what makes mixed
  formations a real trade-off (horse archers + plate infantry = slow horse archers).

### 5.5 Re-equipping ("refit")

- Open a formation and **assign loadouts to any number of cohorts**: pick 2, 8 or all 10 and
  give them bows → 200, 800 or 1,000 bowmen.
- **Replace anything:** weapons, armour, shields, mounts, tools and kit, on any subset of
  cohorts. Refitting needs the goods in the **market** the formation stands in (§8.1) and happens:
  - instantly-ish (1 turn) in or next to a city with an **Armoury** slot in one of its districts,
  - slowly (3 turns, +50% cost) anywhere in your own territory,
  - not at all in enemy territory (except swapping to items the formation already carries).
- Old equipment goes back to that market's stockpile at 50% value.
- **Loadout templates.** Save named templates ("Iron Wall": Pike + Plate + Shield) and apply
  them to cohorts in one click. Templates are per player and also become the vocabulary the AI
  uses when it designs its own troops.

### 5.6 Experience and casualties

- Cohorts lose **strength** (0–100 people) in combat. Damaged cohorts can be merged into each
  other ("consolidate") or reinforced in friendly territory, which takes population again.
- Experience is tracked per cohort, so a veteran cohort keeps its veterancy when moved between
  formations. Re-equipping keeps experience but costs a small temporary drill penalty.

## 6. Combat

Kept close to the genre standard so it stays readable: one attack per formation per turn,
combat odds preview before attacking, results applied at once.

### 6.1 Resolution (per engagement)

1. **Ranged phase.** Cohorts with ranged weapons on both sides fire first. Missile damage
   vs the target's missile protection.
2. **Charge phase.** Mounted cohorts with a charge value hit; pikes/spears in the defender get
   an anti-charge bonus.
3. **Melee phase.** Everyone left fights. Each cohort's damage is split by damage type and
   reduced by the defender's protection against that type.
4. **Morale check.** A side that loses more than its morale threshold retreats one hex (or is
   routed if it cannot retreat).

Each phase pairs cohorts by role (front line / ranged / mounted) so that a formation with only
two bow cohorts gets *some* ranged fire but not a full volley.

### 6.2 Modifiers

Terrain (forest helps defenders and hurts mounts; hills help ranged), river crossing, fortifications,
flanking (adjacent friendly formations), supply (out of supply = attrition), weight vs terrain
(plate in marshes or jungle is bad), weather/season (optional later), culture bonuses (§9).

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

- Founded by a **Settlers** formation (a special levy of civilians, 2 cohorts). The city centre
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

### 7.3 Rules that make design interesting

1. **Hex requirements.** Extraction slots need the matching deposit or terrain on the hex
   (iron mine needs iron; pasture needs grassland/plains; woodlot needs forest). Richness 1–3
   caps how many slots of that type produce at full rate (richness × 2 full-rate slots,
   the rest at 50%).
2. **Adjacency inside the grid.** Some slots buff orthogonally adjacent slots. An infirmary
   placed in the centre touches 4 mines (+15% each); placed in a corner it touches 2. Banks next
   to a stock exchange earn more. Pig pens next to a grain field eat the grain locally (cheaper
   feed). This small puzzle is where layouts become a skill.
3. **Labour.** Each slot needs workers (e.g. mine 200 people, bank 50). Unstaffed slots produce
   nothing. Residential slots and food decide how many workers a city has, so a city full of
   mines needs farms and housing somewhere.
4. **Inputs and outputs.** Most slots consume and produce goods per turn (smithy: iron + coal →
   tools; armoury: lets refits happen here and cuts equipment cost 20%).
5. **District-level tags.** A district with ≥ 5 slots of one group gets a tag (Agricultural,
   Industrial, Financial, Residential…) that some culture nodes and techs reward.

### 7.4 Blueprints and editing

- Save designs as **blueprints** ("Farm", "Northern Mine"). Placing a blueprint on a hex shows
  which slots are invalid there before you commit.
- **Edit a built district** at any time: changed slots are demolished (refund 25%) and rebuilt.
  The rest keep working.
- City-centre hex has its own fixed 3×3 grid with a palace/town-hall slot in the middle.

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

### 8.1 Cities, roads and markets

- Every city has its **own stockpile**. What its districts produce goes there; what its
  districts, levies and refits consume comes from there.
- **Roads** are built hex by hex (by worker formations, or automatically between cities once
  *Road Building* is known). When two cities are joined by an unbroken road (or river, or later
  railway / sea route through friendly ports), they become one **market**.
- A **market** is a group of connected cities that **share one pooled stockpile**. In the UI a
  market shows as a coloured network with a single goods list. Isolated cities are markets of
  one.
- **Breaking a connection splits the market.** An enemy formation standing on a road hex, a
  pillaged road or a blockaded port cuts the link; the pool is split back between the cities
  (by each city's share of recent production). This makes roads real military targets.
- **Moving goods between separate markets** (your own unconnected cities, or other civs) needs
  **trade routes/caravans**: slow, limited capacity per turn, and can be raided.
- **Formations draw from the market they are in.** A formation inside your territory uses the
  market of the nearest connected city; an army far from roads cannot refit and takes supply
  attrition. Armouries only help in cities of the same market.
- Later techs/culture extend reach: *Paved Roads* (faster), *Canals*, *Railways* (bigger
  movement and instant market joins), *Merchant Marine* (sea routes join coastal markets).

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
Proposal: archive it on a tag (`v3-archive`) and start a clean `src/` for the new game, keeping
only the tooling (Vite, TS config, Prettier, the headless-sim script pattern). The Earth map and
its builder are dropped: maps are procedural only.

## 15. Milestones

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

1. Multiplayer: out of scope for now, but turns and determinism are designed so hot-seat or
   async could come later. Wanted?
2. How many slot types and items for the first playable? Draft: 10 items, 20 slots.
3. Art: which formats/sizes are the existing asset packs (hex tiles, sprites, PNG/SVG)? The
   sprite registry will be shaped to match once they are added.

## 17. Decisions log

| # | Question | Decision |
|---|---|---|
| 1 | What does "replace" on troops mean? | Re-equipping: swap weapons, armour, shields, mounts, tools and kit on any number of cohorts (§5.5). |
| 2 | National or per-city goods? | Per city. Roads (and later rivers, rail, sea routes) connect cities into a **market** with one shared pool; cutting the link splits it (§8.1). |
| 3 | Do soldiers cost population? | Yes (§5.2). |
| 4 | Maps? | Procedural only, many map types, every game different; no Earth map. Art from the owner's asset packs added later through a sprite registry (§4). |
