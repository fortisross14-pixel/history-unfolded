# History Unfolded v1.9 — Realm Events & Divergence

## New realm event system

Realms can experience persistent events with a severity, duration, annual effects, and historical record.

Negative events:
- Famine
- Volcanic Eruption
- Flooding
- Pandemic

Positive events:
- Baby Boom
- National Sentiment
- Cultural Golden Age
- Commercial Renaissance
- Scientific Awakening

Severity levels:
- Mild
- Large
- Historical

Historical events are added to World Chronicles. Every event is also shown in the realm's new **Events** subtab with its dates, duration, exact annual effects, status, and any destroyed buildings.

## More divergent world development

Population growth now responds more strongly to province fertility and demographic infrastructure such as Granaries, Aqueducts, and Hospitals.

GDP responds more strongly to merchants, trade routes, commercial building rarity, city prosperity, ruler administration, and commercial events.

Technology growth now responds more strongly to scientists, engineers, scientific buildings, critical discoveries, and Scientific Awakening events. Late-game realms should show meaningful leaders and laggards rather than parallel lines.

## Validation

Strict TypeScript compilation passed for the simulation engine and data model. TSX syntax transpilation passed for App.tsx and main.tsx.

Three full 5,000-year small-map runs and one medium-map run were completed. In the medium reference run at 2000 CE, surviving realms ranged roughly from technology 541 to 931 rather than moving in parallel. A staged test produced technology percentiles around 341/370/431 at 0 CE and 566/664/829 at 2000 CE.
