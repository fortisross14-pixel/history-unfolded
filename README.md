# History Unfolded

A turn-based hex strategy game in the civilization-builder mould where every people starts the
same and the player builds everything: troops from equipment, districts from building slots, and
a culture from a web of choices. Design: [`docs/DESIGN.md`](docs/DESIGN.md).

## Run

```bash
npm install
npm run dev        # play in the browser
npm run build      # type-check and build
```

## Checks

```bash
npm test                     # data, maps, rules, culture and research, diplomacy, ships
node --no-warnings scripts/battles.ts   # matchup table of army compositions (balance)
node --no-warnings scripts/aidiag.ts    # AI-only game: how each people does over time
node --no-warnings scripts/citydiag.ts  # one AI city's districts and economy over time
node --no-warnings scripts/pace.ts      # research, culture and upheaval pace of AI peoples
node --no-warnings scripts/archdiag.ts  # AI on an archipelago: fleets, crossings, speed per turn
npm run check:ai             # AI wars: fighting, captures, campaigns that commit, sea landings
npm run test:ui -- <outDir>  # drives the built game in headless Chromium and saves screenshots
npm run test:mobile -- <outDir>  # the same on an emulated phone (touch, bottom sheet, menu)
npm run check:perf           # map frame times with the CPU slowed 4x
                             # (the browser checks need `npx vite preview --port 4173` running)
```

## What works now

- **Random maps every game**: Continents, Pangaea, Archipelago, Inland Sea, Highlands or Random,
  with size, sea level, climate, rainfall, resources and mountains settings and a shareable seed.
  Rivers run downhill to the sea, dead ends become lakes, deposits follow terrain, starts are
  balanced (food, wood, a metal and horses nearby).
- **Formations of cohorts**: a cohort is 100 people. Cities raise levies of 5 cohorts (500
  people taken from the city). Moving onto your own troops merges them (command limit 10
  cohorts); split any number off.
- **Unit designs**: name a unit type (Hoplites, Foot Falcons…) and give it a weapon, shield,
  helmet, body armour, footwear, ride and kit. Then pick any number of cohorts in a formation
  and equip them as that design, paid in goods from the nearby city. 500 people can be
  200 Foot Falcons and 300 Hornets. A formation moves at the pace of its slowest cohort.
- **Battles where the mix matters**: volleys, cavalry charges, three melee rounds and morale.
  A front line screens archers who keep shooting; cavalry flanks enemies without horse; spears
  stop charges; armour is strong or weak against each damage type. Preview before attacking,
  report after.
- **Towns, cities, one metropolis**: every settlement is one hex, at least a hex apart, and you
  grow by founding many towns. A town holds 2 districts and may farm, cut wood and mine its land;
  with 6,000 people it can become a city (4 districts, bonuses to every building, most of all
  research and industry) at the cost of its farms and mines; one city can become the people's
  metropolis (6 districts). Ranks need a culture choice (City Charter, Seat of Empire) and 6 or
  8 housing cells. Towns in a market feed its cities.
- **Districts**: 3×3 grids of buildings you design and name. Each needs 2 housing cells; producers
  make things and boosters raise them: a library adds ½ to each university, a research lab
  doubles them (three universities: 4½ → 6 → 12 science). The same +½ / ×2 runs through food,
  mining, wood, culture, gold and industry, with the multipliers late. Buildings need workers and something on
  the settlement's land (forest, flat land, a deposit), boost their neighbours, and are built by
  its production. Save layouts as blueprints. Houses give room to grow.
- **Dynasties**: one ruling house at first, up to five as the ages turn. Houses are born with
  traits and grow levels (0–10) by governing settlements of a line and through trinkets from
  building, great buildings, conquest and battle. A house that outweighs the throne may rise:
  the realm splits, you pick a side, and after 10 turns the bigger army takes the throne (or a
  stalemate leaves two realms). Under Democracy houses become parties.
- **Building lines**: base buildings, a support (+½ to each base), one modern multiplier per
  district (×2) and one great building per realm (+200%): Royal Granaries, King's Mine,
  Cathedral, Academy of Sciences, Stock exchange, Ironworks, Royal Forest.
- **Working the land**: farms, pastures, woodcutters and mines give half a unit anywhere; pigs,
  wheat, fish and forest add more, cattle bring leather and sheep wool. Special goods (coal,
  iron, gold, sugar, spices, furs, whales, pearls…) need three of the working building in one
  district, then add up: eight mines by coal dig eight coal a turn.
- **Five ages, about 28 goods**: coal and saltpeter in the Medieval age, steel in the
  Renaissance, oil and electricity in the Industrial age. Railways burn coal, power plants oil or
  coal, factories and labs electricity, firearms powder.
- **Goods by the turn**: settlements consume luxuries as comforts, cities burn coal or wood,
  smithies, tanneries, weavers, mints and foundries work goods up; what runs out lowers yields.
  The Goods screen (G) shows made, used, traded and net per good and sells a surplus by the turn
  to other peoples.
- **Roads and markets**: roads are built, not given: any army early, workers from the Medieval
  age, engineers from the Industrial (half a move per hex along them). Cities
  joined by road or river share one store; an enemy on the road cuts it.
- **Events**: a story to decide every 5 to 15 turns, varied, with costs shown up front.
- **Renaming**: rename any settlement from its panel (✎).
- **War and peace, cities falling**: declare war, capture cities by breaking their guard,
  eliminate peoples. Send settlers to found new cities.
- **Research tree**: 57 techs over four eras (Ancient to Renaissance) unlocking gear (up to
  plate, pikes, crossbows, muskets and field guns), buildings and bigger limits. Set a far goal
  and research follows the path. Techs your culture leans towards are cheaper.
- **Culture web**: 108 choices across nine domains (cosmology, politics, religion, society,
  economy, war, seafaring, knowledge, arts). Forks close doors (Solar or Lunar Calendar, Warlord
  or Council of Elders, Many Gods or One God…), choices cross domains, and tags add up to an
  identity with its own bonuses. Going deep builds tension until an upheaval (a revolution, a
  reformation) lets the people keep two choices and take a new path. Every people starts the
  same and ends up different.
- **Ships**: design hulls, rigs, armament and fit-out; launch from a shipyard; carry troops and
  settlers, land them, fight at sea, bombard the shore. Ports trade by sea.
- **Diplomacy**: opinion with reasons and memories, deals (gold, goods, per-turn trade), pacts,
  alliances that drag allies into wars, AI offers and tribute demands.
- **Victory**: conquest, or the best score at the turn limit.
- WASD or the arrow keys move the map; `?` lists all keys.
- Fog of war, path preview with turn markers, go-to orders across turns, saved games with
  autosaves.
- Rival peoples expand (by sea too), design and equip troops and ships, gather armies for
  sieges, send home battered troops, invade across the sea, make deals and go to war.
- **Feel**: units slide between hexes, battles flash and shake and float their losses, a
  "Turn N" banner follows the AI's moves, and small synthesized sounds play (🔊 to mute). Motion
  follows the system's reduced-motion setting. `?` lists the keys.
- **Phones and tablets**: tap to select, tap a target once to preview and again to act, pinch
  to zoom; the panel is a bottom sheet and the top bar folds into a menu.
- **Art**: the game draws its own fallback symbols and uses generated art wherever it exists.
  `art/PROMPTS.md` holds the image prompts and `tools/cut_sprites.py` cuts the sheets.

## Code

- `src/data/`: terrain, goods and deposits, equipment, techs. Balance lives here.
- `src/engine/`: pure TypeScript rules (no React): map generation, hex math, pathfinding,
  game actions and turns. Runs headless in the check scripts.
- `src/render/`: the canvas map renderer and the sprite registry (art in `public/sprites`,
  from the Age of Sail art set; any art pack with the same keys can replace it).
- `src/ui/`: React screens and panels.
