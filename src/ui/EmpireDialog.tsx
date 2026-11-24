import { WONDERS } from '../data/wonders.ts';
import { faithById } from '../engine/faith.ts';
import { useState } from 'react';
import { formationStrength, militaryPower, strengthText } from '../engine/game.ts';
import {
  formationArtKey,
  formationMoves,
  formationSprite,
  groupCohorts,
  groupName,
  isCivilian,
} from '../engine/units.ts';
import { cityEconomy, DISTRICT_CAP, TIER_NAME } from '../engine/economy.ts';
import type { GameState } from '../engine/types.ts';
import { Chip, Delta, Ico, UnitPortrait } from './bits.tsx';
import './declutter-city.css';
import './r4-nav.css';

export type EmpireTab = 'cities' | 'land' | 'sea' | 'find';
type Tab = EmpireTab;

const TITLE: Record<Tab, string> = {
  cities: 'Cities',
  land: 'Military',
  sea: 'Military',
  find: 'Find',
};

const KIND: Record<string, string> = {
  army: 'Army',
  settlers: 'Settlers',
  fleet: 'Fleet',
  workers: 'Workers',
  engineers: 'Engineers',
};

/**
 * The realm's lists: settlements (the Cities screen), land formations and fleets (the Military
 * screen), and a search across them and the foreign settlements the player knows. The hub's tabs
 * sit in the header (drawn by Game). Clicking a row looks there and selects it.
 */
export function EmpireDialog({
  game,
  civId,
  onCity,
  onFormation,
  onClose,
  tab: startTab,
}: {
  game: GameState;
  civId: number;
  tab?: Tab;
  onCity: (id: number) => void;
  onFormation: (id: number) => void;
  onClose: () => void;
}) {
  const tab: Tab = startTab ?? 'cities';
  const [q, setQ] = useState('');
  const known = game.civs[civId].explored;
  const mine = game.cities.filter(c => c.civId === civId).sort((a, b) => b.pop - a.pop);
  const troops = game.formations
    .filter(f => f.civId === civId)
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  const land = troops.filter(f => f.kind !== 'fleet');
  // armies first, then crews and settlers
  land.sort((a, b) => Number(isCivilian(a)) - Number(isCivilian(b)));
  const sea = troops.filter(f => f.kind === 'fleet');
  const shown = tab === 'sea' ? sea : land;
  const civ = game.civs[civId];
  /** cohorts by design: "3 Spearmen · 1 Riders" */
  const mix = (f: (typeof troops)[number]) => {
    if (isCivilian(f)) return `${f.cohorts.length} × ${KIND[f.kind]}`;
    const n = new Map<string, number>();
    for (const g of groupCohorts(f)) {
      const k = groupName(civ, g, f.kind);
      n.set(k, (n.get(k) ?? 0) + g.cohorts.length);
    }
    return [...n].map(([k, c]) => `${c} ${k}`).join(' · ');
  };
  const districts = (id: number) => game.districts.filter(d => d.cityId === id).length;
  const where = (hex: number) => game.cities.find(c => c.hex === hex)?.name;
  const near = (hex: number) => {
    const at = where(hex);
    if (at) return `in ${at}`;
    return '';
  };
  const needle = q.trim().toLowerCase();
  const found = needle
    ? [
        ...game.cities
          .filter(c => (c.civId === civId || known[c.hex]) && c.name.toLowerCase().includes(needle))
          .map(c => ({
            key: `c${c.id}`,
            label: c.name,
            sub: `${TIER_NAME[c.tier]} of the ${game.civs[c.civId].name}`,
            color: game.civs[c.civId].color,
            go: () => onCity(c.id),
          })),
        ...troops
          .filter(
            f =>
              f.name.toLowerCase().includes(needle) || KIND[f.kind].toLowerCase().includes(needle),
          )
          .map(f => ({
            key: `f${f.id}`,
            label: f.name,
            sub: `${KIND[f.kind]} · ${f.cohorts.length} cohorts ${near(f.hex)}`,
            color: game.civs[civId].color,
            go: () => onFormation(f.id),
          })),
      ].slice(0, 40)
    : [];

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal empire"
        role="dialog"
        aria-modal="true"
        aria-label={TITLE[tab]}
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            {TITLE[tab]}{' '}
            <small className="chips">
              {tab === 'cities' ? (
                <Chip icon="cities" n={mine.length} title="Settlements" />
              ) : tab === 'find' ? null : (
                <>
                  <Chip icon="sword" n={militaryPower(game, civId)} title="Military strength" />
                  <Chip icon="army" n={land.length} title="Land formations" />
                </>
              )}
            </small>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {tab === 'cities' && (
          <div className="stats-table-wrap">
            <table className="stats-table empire-table">
              <thead>
                <tr>
                  <th>Settlement</th>
                  {(
                    [
                      ['people', 'People'],
                      ['district', 'Districts'],
                      ['food', 'Food left over a turn'],
                      ['production', 'Production a turn'],
                      ['science', 'Science a turn'],
                      ['gold', 'Gold a turn'],
                      ['culture', 'Culture a turn'],
                      ['sun', 'Faith'],
                    ] as const
                  ).map(([k, t]) => (
                    <th key={k} title={t} aria-label={t}>
                      <Ico name={k} fallback={t[0]} size={18} />
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {mine.map(c => (
                  <tr key={c.id} className="go" onClick={() => onCity(c.id)}>
                    <td>
                      <b>{c.name}</b> <small className="muted">{TIER_NAME[c.tier]}</small>
                    </td>
                    <td>{c.pop.toLocaleString()}</td>
                    <td>
                      {districts(c.id)}/{DISTRICT_CAP[c.tier]}
                    </td>
                    {(() => {
                      const e = cityEconomy(game, c);
                      const n = (v: number) => Math.round(v * 10) / 10;
                      return (
                        <>
                          <td>
                            <Delta n={e.surplus} />
                          </td>
                          <td>{n(e.total.prod)}</td>
                          <td>{n(e.total.science)}</td>
                          <td>{n(e.total.gold)}</td>
                          <td>{n(e.total.culture)}</td>
                        </>
                      );
                    })()}
                    <td>
                      <small>{faithById(game, c.faith)?.name ?? '—'}</small>
                    </td>
                    <td className="dc-state">
                      {c.siege ? (
                        <span title="Besieged" className="bad">
                          <Ico name="war" fallback="⚔" size={16} />
                        </span>
                      ) : null}
                      {c.auto ? (
                        <span title="Governor plans" className="muted">
                          {' '}
                          <Ico name="crown" fallback="♔" size={16} />
                        </span>
                      ) : null}
                      {c.wonder ? (
                        <span title={`Building the ${WONDERS[c.wonder.id].name}`} className="muted">
                          {' '}
                          <Ico name="laurel" fallback="✦" size={16} />
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(tab === 'land' || tab === 'sea') && (
          <div className="stats-table-wrap">
            <table className="stats-table empire-table troop-table">
              <thead>
                <tr>
                  <th>{tab === 'sea' ? 'Fleet' : 'Formation'}</th>
                  <th title="Strength" aria-label="Strength">
                    <Ico name="sword" fallback="⚔" size={18} />
                  </th>
                  <th>{tab === 'sea' ? 'Ships' : 'Cohorts'}</th>
                  <th title="Moves" aria-label="Moves">
                    <Ico name="moves" fallback="→" size={18} />
                  </th>
                  <th>Orders</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(f => (
                  <tr key={f.id} className="go" onClick={() => onFormation(f.id)}>
                    <td className="troop-name">
                      <UnitPortrait
                        sprite={formationSprite(f)}
                        art={formationArtKey(f)}
                        color={game.civs[civId].color}
                        small
                      />
                      <span>
                        <b>{f.name}</b>
                        <small className="muted">
                          {' '}
                          {f.kind === 'army' || f.kind === 'fleet' || f.name === KIND[f.kind]
                            ? ''
                            : KIND[f.kind]}{' '}
                          {near(f.hex)}
                        </small>
                      </span>
                    </td>
                    <td>
                      <b>{isCivilian(f) ? '—' : strengthText(formationStrength(game, f))}</b>
                    </td>
                    <td className="troop-mix">{mix(f)}</td>
                    <td>
                      {f.moves}/{formationMoves(f)}
                    </td>
                    <td>
                      {f.auto === 'crew' ? (
                        'Automated'
                      ) : f.auto === 'explore' ? (
                        'Exploring'
                      ) : f.auto === 'settle' ? (
                        'Settling'
                      ) : f.aboard !== undefined ? (
                        'Aboard'
                      ) : f.path.length ? (
                        <span title={`Moving: ${f.path.length} hexes`}>→ {f.path.length}</span>
                      ) : f.fortified ? (
                        'Fortified'
                      ) : f.sentry ? (
                        'Sentry'
                      ) : f.moves > 0 ? (
                        <b>Waiting</b>
                      ) : (
                        'Done'
                      )}
                    </td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr>
                    <td colSpan={5} className="muted">
                      {tab === 'sea' ? 'No fleets.' : 'No formations.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'find' && (
          <>
            <input
              className="empire-search"
              autoFocus
              placeholder="Name…"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter' && found[0]) found[0].go();
              }}
              aria-label="Find a settlement or army"
            />
            <ul className="empire-found">
              {found.map(r => (
                <li key={r.key}>
                  <button className="link" onClick={r.go}>
                    <span className="swatch" style={{ background: r.color }} /> <b>{r.label}</b>{' '}
                    <small className="muted">{r.sub}</small>
                  </button>
                </li>
              ))}
              {needle && !found.length && <li className="muted">None.</li>}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
