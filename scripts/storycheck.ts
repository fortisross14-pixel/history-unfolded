/** Headless checks of stories: chapters chain across the ages and remember the choices made. */
import { aiTurn } from '../src/engine/ai.ts';
import { availableTechs, endTurn, newGame, player } from '../src/engine/game.ts';
import { pendingRealmEvent, REALM_EVENTS, resolveRealmEvent } from '../src/engine/realmEvents.ts';
import { STORIES, STORY_EVENTS } from '../src/engine/storyEvents.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

check(STORIES.length >= 8, `${STORIES.length} stories`);
check(
  STORY_EVENTS.every(e => REALM_EVENTS[e.id]),
  'every chapter is a registered event',
);
for (const name of STORIES) {
  const ch = STORY_EVENTS.filter(e => e.story?.name === name);
  check(
    ch.length === 3 && ch.filter(e => !e.followUp).length === 1,
    `${name}: three chapters, only the first drawn at random`,
  );
}

// play long games, the player answering each event with a different choice in turn
let chapters = 0,
  finished = 0,
  branched = 0;
for (const seed of [3, 17, 29]) {
  const s = newGame({
    map: {
      type: 'continents',
      size: 'standard',
      seaLevel: 'normal',
      climate: 'normal',
      rainfall: 'normal',
      resources: 'normal',
      mountains: 'normal',
      seed,
    },
    civCount: 6,
    playerName: 'Test',
  });
  const me = player(s);
  let k = 0;
  const seen: string[] = [];
  for (let t = 0; t < 320; t++) {
    me.isPlayer = false;
    aiTurn(s, me);
    me.isPlayer = true;
    // the AI chooses research for itself only: choose for the player as a player would
    if (!me.researching) me.researching = availableTechs(me)[0]?.id ?? null;
    const ev = pendingRealmEvent(s, me);
    if (ev) {
      const open = ev.choices.map((c, i) => (c.blocked ? -1 : i)).filter(i => i >= 0);
      if (open.length) resolveRealmEvent(s, me, open[k++ % open.length]);
      if (ev.story) seen.push(`${ev.story.id}:${ev.story.chapter}`);
    }
    endTurn(s);
  }
  const story = s.realmEvents?.story ?? {};
  const done = STORIES.filter((_, i) => seen.includes(`${STORY_EVENTS[i * 3].story!.id}:3`));
  chapters += seen.length;
  finished += done.length;
  branched += Object.values(story).filter(v => v.includes('-') || v.length > 0).length;
  console.log(
    `     seed ${seed}: ${seen.length} chapters (${seen.join(', ')}); finished ${done.length}; ` +
      `chronicle story lines ${(s.chronicle ?? []).filter(e => e.kind === 'story').length}`,
  );
}
check(chapters >= 12, `stories are told (${chapters} chapters over 3 games)`);
check(finished >= 2, `stories reach their last chapter (${finished})`);
check(branched >= 6, 'choices are remembered');

if (failures) {
  console.log(`${failures} story check(s) failed`);
  process.exit(1);
}
console.log('all story checks OK');
