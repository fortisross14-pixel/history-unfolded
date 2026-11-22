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
npm test                     # map generator over every map type and size + core rules
node --no-warnings scripts/battles.ts   # matchup table of army compositions (balance)
node --no-warnings scripts/aidiag.ts    # AI-only game: how each people does over time
node --no-warnings scripts/citydiag.ts  # one AI city's districts and economy over time
npm run test:ui -- <outDir>  # drives the built game in headless Chromium and saves screenshots
                             # (needs `npx vite preview --port 4173` running)
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
- **Districts**: every hex within 2 of a city can hold a district, a 3×3 grid of buildings you
  design and name: a "Farm" of pigs, cattle, grain and a woodlot, a "Northern Mine" of mines
  around an infirmary, a "Financial District" of banks. Buildings need workers and something in
  reach (forest, flat land, a deposit), boost their neighbours, and are built by the city's
  production. Save layouts as blueprints. Houses give room to grow.
- **Roads and markets**: lay roads with any formation (half a move per hex along them). Cities
  joined by road or river share one store; an enemy on the road cuts it.
- **War and peace, cities falling**: declare war, capture cities by breaking their guard,
  eliminate peoples. Send settlers to found new cities.
- **Starter research** (Tanning, Archery, Horseback Riding, Bronze Working, Iron Working) unlocks
  equipment and reveals deposits.
- Fog of war, path preview with turn markers, go-to orders across turns, autosave.
- Rival peoples expand, design and equip their own troops, garrison cities and go to war.

## Code

- `src/data/`: terrain, goods and deposits, equipment, techs. Balance lives here.
- `src/engine/`: pure TypeScript rules (no React): map generation, hex math, pathfinding,
  game actions and turns. Runs headless in the check scripts.
- `src/render/`: the canvas map renderer and the sprite registry (art in `public/sprites`,
  from the Age of Sail art set; any art pack with the same keys can replace it).
- `src/ui/`: React screens and panels.
