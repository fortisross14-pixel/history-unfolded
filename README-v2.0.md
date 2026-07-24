# History Unfolded v2.0 — Final History Pass

This release adds the final major presentation and simulation systems requested:

- Event cadence rebalanced: mild events average roughly once per 120 realm-years, large events once per 300, and historical events once per 600. Active events prevent impossible stacking.
- Evolution now has eight comparison slots: the four most populous realms are automatic and four are player-selectable.
- Evolution lines support hover highlighting, direct labels, clickable realm navigation, and a choice between balanced power scaling and ordinary linear scaling.
- A fifth main section, Hall of Fame, records distinct eras of dominance for realms and cities plus exceptional people, rulers, and battles.
- Every land province has a real, fictional, or mixed name according to world setup. Battles and religion follower lists use those names.
- Province populations are the source of realm population: conquest transfers the province and its inhabitants, and province totals are reconciled exactly to realm population every year.
- Religions can use founder-derived names, real historical religion names, or fictional faith names depending on naming mode. Great people remain historical in all modes.
- Every continent has a persistent character trait that modifies population, GDP, technology, army capacity, or cultural strength. The continent screen explains its bonuses.
- Realm colors use a high-contrast curated palette to make charts and political maps easier to read.

## Hall of Fame criteria

- **Realms:** admitted when the leading historical score is at least 12% higher than second place. Repeated centuries in the same dominance era are merged.
- **Cities:** admitted when the largest city is at least 12% larger than the second-largest city. Repeated dominance is merged into one era entry.
- **Great People:** relevance of at least 60, retaining the strongest historical record.
- **Rulers:** relevance of at least 45.
- **Battles:** ranked using significance plus casualties, with each battle admitted only once.

## Run

```bash
npm install
npm run build
npm run dev
```

The save key changed to `history-unfolded-saves-v20`; start a fresh chronicle.
