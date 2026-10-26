# History Unfolded

A zero-player history sandbox: 5,000 years of realms, rulers and great people,
played out like a sports universe. Most events resolve quickly in the
background; only the biggest moments (Great Wars, Great Discoveries, World
Revolutions) play out live.

## Run

```bash
npm install
npm run dev        # play in the browser
npm run build      # type-check and build
```

## Checks

```bash
npm run sim                                   # 5,000-year run, key metrics, time budget
npm run sim -- --seeds 4                      # summary over several seeds
npm run sim -- --map earth --start 1444       # Earth map from 1444 (or -3000, 1)
npm run test:ui                               # renders every page against a simulated world
npm run test:save -- <saves.json> [years]     # loads an old save, migrates it, keeps simulating
```

## How the world works

- **Characters first.** Rulers, heirs, consorts and notables (generals,
  admirals, explorers, merchants, scholars, prophets, statesmen) share one
  model: rarity from Common to Generational (at most three Generational alive),
  two or three traits, a life ambition, deeds, fame, an earned nickname and
  named legacies ("Reforms of Alaric").
- **National personality.** Five axes (Ambition, Horizon, Economy, Faith,
  Order) decide what a realm does, and drift with geography, history and its
  rulers.
- **Every number explains itself.** Province development feeds city wealth,
  manpower and influence; realm totals list each source and modifier.
- **World Moments.** Great Wars run season by season on a momentum bar with
  key battles and a peace conference. Breakthroughs spread as waves.
  Ideological waves press on every connected country.
- **Seasons and records.** Each century ends with a recap and awards; the
  record book keeps the all-time bests.

## Maps

- **Earth**: about 600 named regions with terrain, coasts and rivers, built
  from [Natural Earth](https://www.naturalearthdata.com/) public-domain data by
  `scripts/build-earth.ts` into `src/data/earth.json`. Start in 3000 BCE, 1 CE
  or 1444 with real realms, cultures and faiths; rulers are invented.
- **Fantasy world**: procedural continents, a new world every time.

## Saves

Three browser save slots under one key. Each world carries a schema version;
`src/engine/save.ts` migrates older saves forward.

## Code

- `src/engine/`: the simulation, one module per system (`simulate.ts` runs a year).
- `src/ui/`: React pages for the five sections (Map, Realm, Characters,
  Chronicle, Records) and the detail panels.
- `scripts/`: the headless sim, the Earth map builder and test scripts.
