import { faithById } from '../engine/faith.ts';
import { useState } from 'react';
import { DISTRICT_CAP, TIER_NAME } from '../engine/economy.ts';
import type { GameState } from '../engine/types.ts';

type Tab = 'cities' | 'armies' | 'find';

const KIND: Record<string, string> = {
  army: 'Army',
  settlers: 'Settlers',
  fleet: 'Fleet',
  workers: 'Workers',
  engineers: 'Engineers',
};

/**
 * The empire at a glance: every settlement and every army in one list, and a search across them
 * and the foreign settlements the player knows. Clicking a row looks there and selects it.
 */
export function EmpireDialog({
  game,
  civId,
  onCity,
  onFormation,
  onClose,
}: {
  game: GameState;
  civId: number;
  onCity: (id: number) => void;
  onFormation: (id: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('cities');
  const [q, setQ] = useState('');
  const known = game.civs[civId].explored;
  const mine = game.cities.filter(c => c.civId === civId).sort((a, b) => b.pop - a.pop);
  const troops = game.formations
    .filter(f => f.civId === civId)
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
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
        aria-label="Empire overview"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            Empire{' '}
            <small>
              {mine.length} settlements · {troops.length} formations
            </small>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="stats-tabs" role="tablist">
          {(
            [
              ['cities', 'Settlements'],
              ['armies', 'Armies & crews'],
              ['find', 'Find'],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              className={tab === k ? 'on' : ''}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'cities' && (
          <div className="stats-table-wrap">
            <table className="stats-table empire-table">
              <thead>
                <tr>
                  <th>Settlement</th>
                  <th>Size</th>
                  <th>People</th>
                  <th>Districts</th>
                  <th>Faith</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {mine.map(c => (
                  <tr key={c.id} className="go" onClick={() => onCity(c.id)}>
                    <td>
                      <b>{c.name}</b>
                    </td>
                    <td>{TIER_NAME[c.tier]}</td>
                    <td>{c.pop.toLocaleString()}</td>
                    <td>
                      {districts(c.id)}/{DISTRICT_CAP[c.tier]}
                    </td>
                    <td>
                      <small>{faithById(game, c.faith)?.name ?? '—'}</small>
                    </td>
                    <td>
                      {c.siege ? <b className="war-pill">besieged</b> : null}
                      {c.auto ? <span className="muted"> governor</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'armies' && (
          <div className="stats-table-wrap">
            <table className="stats-table empire-table">
              <thead>
                <tr>
                  <th>Formation</th>
                  <th>Kind</th>
                  <th>Cohorts</th>
                  <th>Orders</th>
                </tr>
              </thead>
              <tbody>
                {troops.map(f => (
                  <tr key={f.id} className="go" onClick={() => onFormation(f.id)}>
                    <td>
                      <b>{f.name}</b> <small className="muted">{near(f.hex)}</small>
                    </td>
                    <td>{KIND[f.kind]}</td>
                    <td>{f.cohorts.length}</td>
                    <td>
                      {f.auto === 'crew' ? (
                        'Automated'
                      ) : f.auto === 'explore' ? (
                        'Exploring'
                      ) : f.path.length ? (
                        `Moving (${f.path.length} hexes)`
                      ) : f.fortified ? (
                        'Fortified'
                      ) : f.moves > 0 ? (
                        <b>Waiting</b>
                      ) : (
                        'Done'
                      )}
                    </td>
                  </tr>
                ))}
                {!troops.length && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No formations.
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
              placeholder="A settlement or army, yours or a known one…"
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
              {needle && !found.length && <li className="muted">Nothing by that name.</li>}
              {!needle && <li className="muted">Type a name. Enter goes to the first match.</li>}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
