# History Unfolded

A narrative-first alternate history simulator built with Vite, React and TypeScript.

## Current prototype

- Procedural 22 × 13 hex world with terrain and 30 starting tribes
- Civilizations evolve through Tribe → Settlement → City-State → Duchy → Kingdom → Empire
- Advance history by 1, 5, 10 or 25 years, or use continuous play
- Population, economy, military, technology, stability and prestige simulation
- Expansion, conquest, extinction, alliances, rivalries and succession
- Procedural religions, prophets, rulers, famines, golden ages, trade booms and world disasters
- Political, population and technology map overlays
- Ranked world powers list
- Clickable country encyclopedia with ruler, statistics and historical record
- Decade-grouped world chronicle and almanac

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## GitHub Pages

The included workflow deploys the `main` branch automatically. In GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.

## Design direction

This is the foundation rather than the final 5,000-year simulation. The next major systems should be persistent wars and battles, dynasties and marriages, technology unlocks, named cities, cultural/religious schisms, save slots, and documentary-style century recaps.


## v0.2 — Civilizational identities

Civilizations now begin as named tribes and evolve through changing political identities. A single lineage can become a settlement, city-state, duchy, kingdom and empire while preserving its origin tribe and every former name. Allied realms may unite through dynastic compacts; conquered cultures survive within the victor; unstable empires can split into successor states that inherit and reinterpret the old imperial identity. The naming engine intentionally mixes procedural names with familiar civilization-style names such as Athens, Rome, Persia, Rus and regional historical names.
