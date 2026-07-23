# History Unfolded v1.0

A Vite + React + TypeScript alternate-history simulation where civilizations, cities, people, religions, governments and institutions evolve without player micromanagement.

## Run

```bash
npm install
npm run dev
```

Production:

```bash
npm run build
npm run preview
```

## Save compatibility

This release uses the browser key `history-unfolded-saves-v10`. Older prototype saves are intentionally separated because the final model adds dynasties, governments, wars, battles, Wonders, Natural Wonders, rivalries and historical scores.

## Final feature set

- Three persistent save slots
- Small, medium, large and huge continuous hex maps
- Separate continents and islands
- Political, geography, culture and religion overlays
- Zoom, scroll and drag-to-pan map
- Persistent cities, buildings and ownership histories
- Trade routes created by merchants
- Ten critical technologies with discovery and diffusion
- Limited continental knowledge, expeditions and first contact
- Real-name great-person pool across seven roles
- Rare 1–5 star great people with contextual impact
- Religions, founders, traits and holy sites
- Evolving cultures with three behavioral axes
- Governments, rulers, dynasties and revolutions
- Persistent wars and distance-sensitive battles
- Artworks with type, rating and rarity
- Artificial Wonders and Natural Wonders
- Historical rivalries
- Realm historical and legacy score
- Filterable Events and World Chronicles
- Expanded, sortable Almanac
- Detailed realm, city, continent, person, religion, culture, dynasty, war, battle, artwork and Wonder panels

## Balance validation

The simulation engine was compiled independently with strict TypeScript settings and run through full 5,000-year automated simulations.

Reference seed `424242`, medium map, 36 tribes:

- Final year: 2000 CE
- World population: 484,396,842
- Highest technology: 861 / 1000
- Empires: 2
- Great people generated: 285, with 5 alive simultaneously
- Major religions: 5
- Wars: 41
- Battles: 154
- Artificial Wonders: 8
- Persistent cities: 68

Additional completed seeds produced approximately 459–556 million inhabitants, 1–2 empires, 5–6 major religions and 4–5 Wonders. These are deliberately broad alternate-world values rather than exact Earth population targets.

The dependency-backed Vite build must still be run locally after `npm install`; the execution environment used for generation could not download npm packages. The engine and application source were TypeScript-checked using local declarations, and the simulation engine was executed directly.
