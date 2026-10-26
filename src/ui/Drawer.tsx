import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { displayYear, TECHNOLOGIES } from '../engine/index.ts';
import type {
  Culture,
  Battle,
  War,
  Wonder,
  Civilization,
  RenameKind,
  WorldState,
} from '../types.ts';
import { CharacterPage } from './CharacterPage.tsx';
import { RealmCourt } from './RealmCourt.tsx';
import { RenameTitle } from './RenameTitle.tsx';
import {
  type Sel,
  fmt,
  pct,
  realmEventEffect,
  CulturalSlider,
  Metrics,
  Section,
  List,
} from './shared.tsx';

/** Entities the player can rename from their page. */
const RENAMEABLE: Partial<Record<NonNullable<Sel>['type'], RenameKind>> = {
  realm: 'realm',
  city: 'city',
  character: 'character',
  dynasty: 'dynasty',
  continent: 'continent',
  war: 'war',
};

export function Drawer({
  world,
  sel,
  close,
  open,
  rename,
}: {
  world: WorldState;
  sel: NonNullable<Sel>;
  close: () => void;
  open: (s: Sel) => void;
  rename: (kind: RenameKind, id: number, name: string) => void;
}) {
  const [tab, setTab] = useState('summary');
  useEffect(() => setTab('summary'), [sel.type, sel.id]);
  let title = '',
    body: any = null,
    tabs: string[] = [];
  if (sel.type === 'realm') {
    const c = world.civilizations.find(x => x.id === sel.id)!;
    title = c.name;
    tabs = [
      'summary',
      'history',
      'cities',
      'court',
      'military',
      'culture',
      'religion',
      'economy',
      'events',
      'exploration',
    ];
    body = <RealmDetail c={c} world={world} tab={tab} open={open} />;
  } else if (sel.type === 'city') {
    const c = world.cities.find(x => x.id === sel.id)!;
    title = c.name;
    body = (
      <>
        <Metrics
          vals={[
            ['Population', fmt(c.population)],
            ['Prosperity', fmt(c.prosperity)],
            ['Buildings', fmt(c.buildings.length)],
            ['Wonders', fmt(c.wonderIds.length)],
          ]}
        />
        <Section title="History">
          <p>
            Founded {displayYear(c.foundedYear)} by{' '}
            {world.civilizations.find(x => x.id === c.founderRealmId)?.name}. Controlled by{' '}
            {world.civilizations.find(x => x.id === c.currentRealmId)?.name}.
          </p>
        </Section>
        <Section title="Buildings">
          <List
            items={c.buildings.map(b => ({
              name: b.name,
              sub: `${b.rarity} · Impact ${b.impact} · Built ${displayYear(b.builtYear)} · last upgraded ${displayYear(b.lastUpgradedYear)} · GDP +${(b.gdpBonus * 100).toFixed(1)}% · Army +${(b.armyBonus * 100).toFixed(1)}%`,
            }))}
          />
        </Section>
        <Section title="Wonders">
          <List
            items={c.wonderIds.map(id => {
              const w = world.wonders.find(x => x.id === id)!;
              return { name: w.name, sub: w.effect, onClick: () => open({ type: 'wonder', id }) };
            })}
          />
        </Section>
      </>
    );
  } else if (sel.type === 'continent') {
    const c = world.continents.find(x => x.id === sel.id)!;
    title = c.name;
    const native = world.civilizations.filter(r =>
      r.provinces.some(id => world.provinces[id].continentId === c.id),
    );
    body = (
      <>
        <Metrics
          vals={[
            ['Hexagons', fmt(c.provinceIds.length)],
            [
              'Population',
              fmt(c.provinceIds.reduce((n, id) => n + world.provinces[id].population, 0)),
            ],
            ['Realms', fmt(native.length)],
            ['Cities', fmt(world.cities.filter(x => x.continentId === c.id).length)],
          ]}
        />
        <Section title="Continental character">
          <p>
            <b>{c.traitName}</b> — {c.traitDescription}
          </p>
          <p>
            Population +{Math.round(c.populationBonus * 100)}% · GDP +{Math.round(c.gdpBonus * 100)}
            % · Technology +{Math.round(c.technologyBonus * 100)}% · Army +
            {Math.round(c.armyBonus * 100)}% · Culture +{Math.round(c.cultureBonus * 100)}%
          </p>
        </Section>
        <Section title="First contact">
          <p>
            {c.discoveredYear
              ? `First reached by ${world.civilizations.find(x => x.id === c.discoveredByRealmId)?.name} in ${displayYear(c.discoveredYear)}.`
              : 'No foreign realm has reached this continent.'}
          </p>
        </Section>
        <Section title="Native realms">
          <List
            items={native.map(r => ({
              name: r.name,
              sub: `${r.rank} · ${fmt(r.population)} people`,
              onClick: () => open({ type: 'realm', id: r.id }),
            }))}
          />
        </Section>
      </>
    );
  } else {
    const data = detailFor(sel, world, open);
    title = data.title;
    body = data.body;
  }
  return (
    <aside className="drawer">
      <button className="close" onClick={close}>
        <X />
      </button>
      <div className="drawerhero">
        <span className="eyebrow">{sel.type}</span>
        {RENAMEABLE[sel.type] ? (
          <RenameTitle
            title={title}
            onRename={name => rename(RENAMEABLE[sel.type]!, sel.id, name)}
          />
        ) : (
          <h1>{title}</h1>
        )}
      </div>
      {tabs.length > 0 && (
        <div className="subtabs drawer-tabs">
          {tabs.map(t => (
            <button className={tab === t ? 'active' : ''} onClick={() => setTab(t)} key={t}>
              {t}
            </button>
          ))}
        </div>
      )}
      {body}
    </aside>
  );
}

export function RealmDetail({
  c,
  world,
  tab,
  open,
}: {
  c: Civilization;
  world: WorldState;
  tab: string;
  open: (s: Sel) => void;
}) {
  const ruler = world.characters.find(r => r.id === c.rulerId),
    culture = world.cultures.find(x => x.id === c.cultureId),
    religion = world.religions.find(x => x.id === c.faithId);
  if (tab === 'summary')
    return (
      <>
        <Metrics
          vals={[
            [
              'Continent',
              world.continents.find(ct => ct.id === world.provinces[c.provinces[0]]?.continentId)
                ?.name ?? 'Unknown',
            ],
            ['Population', fmt(c.population)],
            ['Urban', fmt(c.urbanPopulation ?? 0)],
            ['Rural', fmt(c.ruralPopulation ?? c.population)],
            ['GDP', fmt(c.gdp, 1)],
            ['Army', `${fmt(c.armySize)} / ${fmt(c.armyCapacity ?? c.armySize)}`],
            ['Technology', `${fmt(c.technology)}/1000`],
          ]}
        />
        <Section title="Civilization">
          <p>
            {c.rank} founded {displayYear(c.founded)} · {c.government} · stability{' '}
            {fmt(c.stability)}
          </p>
          <p>
            Historical score: <b>{c.historicalScore}</b>. Current ruler: {ruler?.name ?? 'Unknown'}{' '}
            of {world.dynasties.find(d => d.id === c.dynastyId)?.name ?? 'no dynasty'}.
          </p>
        </Section>
        <Section title="Critical technologies">
          <div className="chips">
            {TECHNOLOGIES.map(t => (
              <span
                className={c.knownTechnologies.some(k => k.technologyId === t.id) ? 'known' : ''}
                key={t.id}
              >
                {t.name}
              </span>
            ))}
          </div>
        </Section>
      </>
    );
  if (tab === 'history')
    return (
      <>
        <Section title="Political identities">
          <List
            items={c.nameHistory.map(n => ({
              name: n.name,
              sub: `${n.rank} from ${displayYear(n.from)} · ${n.reason}`,
            }))}
          />
        </Section>
        <Section title="Governments">
          <List
            items={c.governmentHistory.map(g => ({
              name: g.government,
              sub: `${displayYear(g.from)}–${g.to ? displayYear(g.to) : 'present'} · ${g.reason}`,
            }))}
          />
        </Section>
        <Section title="Rulers">
          <List
            items={world.reigns
              .filter(r => r.realmId === c.id)
              .reverse()
              .map(r => ({
                name: r.name,
                sub: `${world.dynasties.find(d => d.id === r.dynastyId)?.name ?? 'No dynasty'} · ${displayYear(r.start)}–${r.end !== undefined ? displayYear(r.end) : 'present'} · territory ${r.startProvinces} → ${r.endProvinces ?? c.provinces.length} · wealth ${pct(r.startGDP, r.endGDP ?? c.gdp)}`,
                onClick: () => open({ type: 'character', id: r.characterId }),
              }))}
          />
        </Section>
      </>
    );
  if (tab === 'cities')
    return (
      <Section title="Cities">
        <List
          items={c.cityIds.map(id => {
            const x = world.cities.find(y => y.id === id)!;
            return {
              name: x.name,
              sub: `${fmt(x.population)} people · ${x.buildings.length} buildings · ${x.wonderIds.length} wonders`,
              onClick: () => open({ type: 'city', id }),
            };
          })}
        />
      </Section>
    );
  if (tab === 'military')
    return (
      <>
        <Section title="Wars">
          <List
            items={c.warIds.map(id => {
              const w = world.wars.find(x => x.id === id)!;
              const result = w.active
                ? 'ACTIVE'
                : w.winnerIds.includes(c.id)
                  ? 'VICTORY'
                  : w.loserIds.includes(c.id)
                    ? 'DEFEAT'
                    : 'STALEMATE';
              return {
                name: `${result} · ${w.name}`,
                sub: `${w.type} · ${displayYear(w.startYear)}${w.endYear ? `–${displayYear(w.endYear)}` : ''} · ${w.battles} battles · ${fmt(w.attackerLosses + w.defenderLosses)} casualties`,
                onClick: () => open({ type: 'war', id }),
              };
            })}
          />
        </Section>
        <Section title="Rivalries">
          <List
            items={c.rivalryIds.map(id => {
              const r = world.rivalries.find(x => x.id === id)!;
              const other = r.realmIds.find(x => x !== c.id)!;
              return {
                name: world.civilizations.find(x => x.id === other)?.name ?? 'Unknown',
                sub: `Intensity ${r.intensity} · ${r.warIds.length} wars · ${r.cause}`,
              };
            })}
          />
        </Section>
      </>
    );
  if (tab === 'court') return <RealmCourt c={c} world={world} open={open} />;
  if (tab === 'culture')
    return (
      <>
        <div className="culture-sliders">
          <CulturalSlider
            label="Peaceful ↔ Violent"
            value={culture?.peacefulViolent ?? 0}
            left="Peaceful"
            right="Violent"
          />
          <CulturalSlider
            label="Economic ↔ Creative"
            value={culture?.economicCreative ?? 0}
            left="Economic"
            right="Creative"
          />
          <CulturalSlider
            label="Unstable ↔ Stable"
            value={culture?.unstableStable ?? 0}
            left="Unstable"
            right="Stable"
          />
        </div>
        <Metrics
          vals={[
            ['Strength', String(culture?.strength ?? 0)],
            ['Population', fmt(culture?.population ?? 0)],
            ['Provinces', fmt(culture?.provinces ?? 0)],
            ['Heritage', fmt(culture?.heritage.length ?? 0)],
          ]}
        />
        <Section title="Cultural influence">
          <p>
            Strength represents the ability of this culture's institutions, art, religion and
            government model to shape nearby societies. A large advantage over a neighboring culture
            can reduce that realm's stability when its government or religion differs.
          </p>
        </Section>
        <Section title="Heritage">
          <List items={(culture?.heritage ?? []).map(name => ({ name, sub: 'Cultural work' }))} />
        </Section>
      </>
    );
  if (tab === 'religion')
    return (
      <>
        <Section title="Main religion">
          <p>
            {religion
              ? `${religion.name}, founded ${displayYear(religion.founded)}. ${religion.followers.toLocaleString()} followers and ${religion.holyProvinceIds.length} holy sites.`
              : 'No organized majority religion.'}
          </p>
        </Section>
      </>
    );
  if (tab === 'economy')
    return (
      <>
        <Metrics
          vals={[
            ['GDP', fmt(c.gdp, 1)],
            [
              'Trade routes',
              fmt(
                world.tradeRoutes.filter(
                  t =>
                    c.cityIds.includes(t.originCityId) || c.cityIds.includes(t.destinationCityId),
                ).length,
              ),
            ],
            [
              'Commercial buildings',
              fmt(
                c.cityIds
                  .flatMap(id => world.cities.find(x => x.id === id)?.buildings ?? [])
                  .filter(b =>
                    ['Market', 'Harbor', 'Merchant Guild', 'Bank', 'Stock Exchange'].includes(
                      b.type,
                    ),
                  ).length,
              ),
            ],
            [
              'Merchants',
              fmt(
                world.characters.filter(
                  p => p.died === undefined && p.realmId === c.id && p.role === 'Merchant',
                ).length,
              ),
            ],
          ]}
        />
      </>
    );
  if (tab === 'events') {
    const events = (world.realmEvents ?? [])
      .filter(e => e.realmId === c.id)
      .sort((a, b) => b.startYear - a.startYear);
    return (
      <>
        <Metrics
          vals={[
            ['Recorded events', fmt(events.length)],
            ['Active now', fmt(events.filter(e => e.active).length)],
            ['Historical events', fmt(events.filter(e => e.severity === 'Historical').length)],
            ['Latest', events[0] ? displayYear(events[0].startYear) : '—'],
          ]}
        />
        <Section title="Realm events">
          <div className="realm-event-list">
            {events.length ? (
              events.map(e => (
                <article className={`realm-event ${e.severity.toLowerCase()}`} key={e.id}>
                  <div>
                    <span className="event-severity">{e.severity}</span>
                    <strong>{e.type}</strong>
                    <em>
                      {e.active
                        ? 'Active'
                        : `${displayYear(e.startYear)}–${displayYear(e.endYear)}`}
                    </em>
                  </div>
                  <p>{e.description}</p>
                  <small>
                    {realmEventEffect(e)} · Duration {e.duration} years
                  </small>
                  {e.destroyedBuildings.length > 0 && (
                    <small className="loss">Destroyed: {e.destroyedBuildings.join(', ')}</small>
                  )}
                </article>
              ))
            ) : (
              <p className="empty">No major realm events recorded yet.</p>
            )}
          </div>
        </Section>
      </>
    );
  }
  return (
    <>
      <Section title="Known continents">
        <List
          items={c.knownContinentIds.map(id => ({
            name: world.continents.find(x => x.id === id)?.name ?? 'Unknown',
            sub: 'Known to this realm',
            onClick: () => open({ type: 'continent', id }),
          }))}
        />
      </Section>
    </>
  );
}

export function detailFor(
  sel: Exclude<NonNullable<Sel>, { type: 'realm' } | { type: 'city' } | { type: 'continent' }>,
  world: WorldState,
  open: (s: Sel) => void,
) {
  if (sel.type === 'character') {
    const ch = world.characters.find(x => x.id === sel.id);
    if (!ch)
      return {
        title: 'Forgotten',
        body: <p className="empty">This person has faded from memory.</p>,
      };
    return {
      title: `${ch.name}${ch.nickname ? ` ${ch.nickname}` : ''}`,
      body: <CharacterPage ch={ch} world={world} open={open} />,
    };
  }
  if (sel.type === 'religion') {
    const r = world.religions.find(x => x.id === sel.id)!;
    return { title: r.name, body: <ReligionDetail religion={r} world={world} open={open} /> };
  }
  if (sel.type === 'culture') {
    const c = world.cultures.find(x => x.id === sel.id)!;
    return {
      title: c.name,
      body: (
        <>
          <div className="culture-sliders">
            <CulturalSlider
              label="Peaceful ↔ Violent"
              value={c.peacefulViolent}
              left="Peaceful"
              right="Violent"
            />
            <CulturalSlider
              label="Economic ↔ Creative"
              value={c.economicCreative}
              left="Economic"
              right="Creative"
            />
            <CulturalSlider
              label="Unstable ↔ Stable"
              value={c.unstableStable}
              left="Unstable"
              right="Stable"
            />
          </div>
          <Metrics
            vals={[
              ['Population', fmt(c.population)],
              ['Strength', fmt(c.strength)],
              ['Provinces', fmt(c.provinces)],
              ['Heritage', fmt(c.heritage.length)],
            ]}
          />
        </>
      ),
    };
  }
  if (sel.type === 'dynasty') {
    const d = world.dynasties.find(x => x.id === sel.id)!;
    const rulers = world.reigns.filter(r => r.dynastyId === d.id);
    const realms = d.realmIds
      .map(id => world.civilizations.find(c => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c);
    return {
      title: d.name,
      body: (
        <>
          <Metrics
            vals={[
              ['Years in power', fmt(d.totalYearsInPower)],
              ['Rulers', fmt(rulers.length)],
              ['Peak provinces', fmt(d.peakTerritory)],
              ['Peak population', fmt(d.peakPopulation ?? 0)],
              ['Peak GDP', fmt(d.peakGDP, 1)],
              ['Relevance', fmt(d.historicalRelevance)],
            ]}
          />
          <Section title="Realms governed">
            <List
              items={realms.map(c => ({
                name: c.name,
                sub: `${c.rank} · founded ${displayYear(c.founded)}`,
                onClick: () => open({ type: 'realm', id: c.id }),
              }))}
            />
          </Section>
          <Section title="Rulers of the dynasty">
            <List
              items={rulers.map(r => ({
                name: r.name,
                sub: `${world.civilizations.find(c => c.id === r.realmId)?.name ?? 'Unknown realm'} · ${displayYear(r.start)}–${r.end !== undefined ? displayYear(r.end) : 'present'} · ${r.government} · reign score ${r.score}`,
                onClick: () => open({ type: 'character', id: r.characterId }),
              }))}
            />
          </Section>
          <Section title="Legacy">
            <p>
              Founded {displayYear(d.foundedYear)}. Status: {d.status}. Sponsored{' '}
              {d.wonderIds.length} Wonders and won {d.warsWon} wars.
            </p>
          </Section>
        </>
      ),
    };
  }
  if (sel.type === 'war') {
    const w = world.wars.find(x => x.id === sel.id)!;
    const result = w.active
      ? 'WAR IN PROGRESS'
      : w.winnerIds.length
        ? `${w.winnerIds.map(id => world.civilizations.find(c => c.id === id)?.name).join(', ')} WON`
        : 'STALEMATE';
    return {
      title: w.name,
      body: (
        <>
          <div className={`outcome-banner ${w.winnerIds.length ? 'decisive' : 'stalemate'}`}>
            <strong>{result}</strong>
            <span>{w.endYear ? displayYear(w.endYear) : displayYear(world.year)}</span>
          </div>
          <Metrics
            vals={[
              ['Type', w.type],
              ['Duration', `${(w.endYear ?? world.year) - w.startYear} years`],
              ['Battles', fmt(w.battles)],
              ['Losses', fmt(w.attackerLosses + w.defenderLosses)],
            ]}
          />
          <Section title="Cause and objective">
            <p>
              <b>Rationale:</b> {w.rationale}
            </p>
            <p>
              <b>War goal:</b> {w.goal}
            </p>
          </Section>
          {w.outcome && (
            <Section title="Outcome">
              <p>{w.outcome}</p>
              <p>
                {w.winnerIds.length
                  ? w.decisiveVictory
                    ? 'Decisive victory'
                    : 'Limited victory'
                  : 'No victor'}{' '}
                · Territories transferred: {w.territoriesChanged} · GDP transferred:{' '}
                {fmt(w.gdpTransferred, 1)}
                {w.religionChanged ? ' · Defender changed religion' : ''}.
              </p>
            </Section>
          )}
          <Section title="Battles">
            <List
              items={w.battleIds.map(id => {
                const b = world.battles.find(x => x.id === id)!;
                return {
                  name: b.name,
                  sub: `${displayYear(b.year)} · ${fmt(b.attacker.casualties + b.defender.casualties)} casualties`,
                  onClick: () => open({ type: 'battle', id }),
                };
              })}
            />
          </Section>
        </>
      ),
    };
  }
  if (sel.type === 'battle') {
    const b = world.battles.find(x => x.id === sel.id)!;
    const attackerNames = b.attacker.realmIds
        .map(id => world.civilizations.find(c => c.id === id)?.name)
        .join(', '),
      defenderNames = b.defender.realmIds
        .map(id => world.civilizations.find(c => c.id === id)?.name)
        .join(', '),
      winner = b.winner === 'attacker' ? attackerNames : defenderNames;
    const Side = ({
      label,
      data,
      won,
    }: {
      label: string;
      data: Battle['attacker'];
      won: boolean;
    }) => (
      <div className={`battle-side ${won ? 'winner' : 'loser'}`}>
        <div>
          <small>{label}</small>
          <strong>
            {data.realmIds.map(id => world.civilizations.find(c => c.id === id)?.name).join(', ')}
          </strong>
          {won && <b>VICTORY</b>}
        </div>
        <p>
          <span>{fmt(data.combatants)} deployed</span>
          <span>{fmt(data.casualties)} casualties</span>
          <span>{((data.casualties / Math.max(1, data.combatants)) * 100).toFixed(1)}% lost</span>
        </p>
        <em>
          Commander: {world.characters.find(p => p.id === data.generalId)?.name ?? 'None'} · Battle
          power {fmt(data.power, 1)}
        </em>
      </div>
    );
    return {
      title: b.name,
      body: (
        <>
          <div className="outcome-banner decisive">
            <strong>{winner} WON</strong>
            <span>{displayYear(b.year)}</span>
          </div>
          <Metrics
            vals={[
              ['Combatants', fmt(b.attacker.combatants + b.defender.combatants)],
              ['Casualties', fmt(b.attacker.casualties + b.defender.casualties)],
              ['Significance', `${b.significance}/100`],
              ['War', world.wars.find(w => w.id === b.warId)?.name ?? '—'],
            ]}
          />
          <div className="battle-comparison">
            <Side label="Attacker" data={b.attacker} won={b.winner === 'attacker'} />
            <Side label="Defender" data={b.defender} won={b.winner === 'defender'} />
          </div>
        </>
      ),
    };
  }
  if (sel.type === 'artwork') {
    const a = world.artworks.find(x => x.id === sel.id)!;
    return {
      title: a.name,
      body: (
        <>
          <Metrics
            vals={[
              ['Type', a.type],
              ['Rarity', a.rarity],
              ['Rating', `${a.rating}/100`],
              ['Created', displayYear(a.year)],
            ]}
          />
          <Section title="Creator">
            <p>
              {world.characters.find(p => p.id === a.patronId)?.name} commissioned this work in{' '}
              {world.cities.find(c => c.id === a.cityId)?.name} for{' '}
              {world.civilizations.find(c => c.id === a.realmId)?.name}.
            </p>
          </Section>
        </>
      ),
    };
  }
  if (sel.type === 'wonder') {
    const w = world.wonders.find(x => x.id === sel.id)!;
    return {
      title: w.name,
      body: (
        <>
          <Metrics
            vals={[
              ['Category', w.category],
              ['Completed', displayYear(w.completedYear)],
              ['Status', w.status],
              ['Relevance', `${w.historicalRelevance}/100`],
            ]}
          />
          <Section title="Legacy">
            <p>
              {w.effect}. Built by {world.characters.find(p => p.id === w.builderId)?.name} in{' '}
              {world.cities.find(c => c.id === w.cityId)?.name}.
            </p>
          </Section>
        </>
      ),
    };
  }
  const n = world.naturalWonders.find(x => x.id === sel.id)!;
  return {
    title: n.name,
    body: (
      <>
        <Metrics
          vals={[
            ['GDP bonus', `${(n.gdpBonus * 100).toFixed(0)}%`],
            ['Army bonus', `${(n.armyBonus * 100).toFixed(0)}%`],
            ['Culture bonus', `${(n.cultureBonus * 100).toFixed(0)}%`],
            ['Prestige bonus', `${(n.prestigeBonus * 100).toFixed(0)}%`],
          ]}
        />
        <Section title="Natural Wonder">
          <p>
            {n.effect}. Located on{' '}
            {world.continents[world.provinces[n.provinceId].continentId!]?.name}.
          </p>
        </Section>
      </>
    ),
  };
}

export function ReligionDetail({
  religion,
  world,
  open,
}: {
  religion: WorldState['religions'][number];
  world: WorldState;
  open: (s: Sel) => void;
}) {
  const [tab, setTab] = useState<'summary' | 'history' | 'followers'>('summary');
  const provinces = world.provinces
    .filter(p => p.religionId === religion.id)
    .sort((a, b) => b.population - a.population);
  return (
    <>
      <div className="subtabs drawer-tabs">
        <button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>
          Summary
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          History
        </button>
        <button className={tab === 'followers' ? 'active' : ''} onClick={() => setTab('followers')}>
          Followers
        </button>
      </div>
      {tab === 'summary' && (
        <>
          <Metrics
            vals={[
              ['Followers', fmt(religion.followers)],
              ['Provinces', fmt(religion.provinces)],
              ['Expansion', fmt(religion.expansion)],
              ['Loyalty', fmt(religion.loyalty)],
            ]}
          />
          <Section title="Foundation">
            <p>
              Founded {displayYear(religion.founded)} by{' '}
              {world.characters.find(p => p.id === religion.founderId)?.name ??
                'an unknown founder'}
              . Doctrine: {religion.doctrine}. Holy sites: {religion.holyProvinceIds.length}.
            </p>
          </Section>
        </>
      )}
      {tab === 'history' && (
        <Section title="Religious history">
          <List
            items={world.events
              .filter(e => e.religionIds.includes(religion.id))
              .map(e => ({ name: e.title, sub: `${displayYear(e.year)} · ${e.description}` }))}
          />
        </Section>
      )}
      {tab === 'followers' && (
        <Section title="Provinces and followers">
          <List
            items={provinces.map(p => ({
              name: world.cities.find(c => c.provinceId === p.id)?.name ?? p.name,
              sub: `${fmt(p.population)} followers · ${world.civilizations.find(c => c.id === p.ownerId)?.name ?? 'Unclaimed'}`,
              onClick: p.ownerId ? () => open({ type: 'realm', id: p.ownerId! }) : undefined,
            }))}
          />
        </Section>
      )}
    </>
  );
}
