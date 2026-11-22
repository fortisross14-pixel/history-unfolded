import { useEffect, useState } from 'react';
import { ITEMS } from '../data/items.ts';
import { RELIEF, TERRAIN, VEGETATION } from '../data/terrain.ts';
import { canFoundCity, formationsAt, supplyingCity } from '../engine/game.ts';
import type { Formation, GameState } from '../engine/types.ts';
import {
  capOf,
  cohortStats,
  formationMoves,
  formationSprite,
  formationStats,
  groupCohorts,
  people,
} from '../engine/units.ts';
import { UnitPortrait } from './bits.tsx';

interface Props {
  game: GameState;
  f: Formation;
  mine: boolean;
  onEquip: (cohortIds: number[]) => void;
  onSplit: (cohortIds: number[]) => void;
  onMerge: (otherId: number) => void;
  onSelect: (fid: number) => void;
  onFound: () => void;
  onFortify: () => void;
  onRename: (name: string) => void;
  onClearOrders: () => void;
}

export function FormationPanel({
  game,
  f,
  mine,
  onEquip,
  onSplit,
  onMerge,
  onSelect,
  onFound,
  onFortify,
  onRename,
  onClearOrders,
}: Props) {
  const groups = groupCohorts(f);
  const [pick, setPick] = useState<Record<string, number>>(() =>
    Object.fromEntries(groups.map(g => [g.key, g.cohorts.length])),
  );
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(f.name);
  // everything starts selected: the usual order is "equip them all" or "split some off"
  const allPicked = () => Object.fromEntries(groups.map(g => [g.key, g.cohorts.length]));
  useEffect(() => {
    setPick(allPicked());
    setName(f.name);
    setEditing(false);
  }, [f.id, f.cohorts.length]);

  const selected = groups.flatMap(g => g.cohorts.slice(0, pick[g.key] ?? 0).map(c => c.id));
  const stats = formationStats(f);
  const civ = game.civs[f.civId];
  const others = formationsAt(game, f.hex).filter(o => o.id !== f.id && o.civId === f.civId);
  const supply = supplyingCity(game, f.civId, f.hex);
  const m = game.map;
  const foundWhy = f.kind === 'settlers' ? canFoundCity(game, f) : null;
  const setAll = (n: 'all' | 'none') =>
    setPick(Object.fromEntries(groups.map(g => [g.key, n === 'all' ? g.cohorts.length : 0])));

  return (
    <div className="panel formation">
      <div className="panel-head">
        <UnitPortrait sprite={formationSprite(f)} color={civ.color} />
        <div>
          {editing ? (
            <form
              onSubmit={e => {
                e.preventDefault();
                onRename(name);
                setEditing(false);
              }}
            >
              <input
                autoFocus
                value={name}
                maxLength={32}
                onChange={e => setName(e.target.value)}
                onBlur={() => {
                  onRename(name);
                  setEditing(false);
                }}
              />
            </form>
          ) : (
            <h2 onClick={() => mine && setEditing(true)} title={mine ? 'Click to rename' : ''}>
              {f.name}
            </h2>
          )}
          <div className="muted">
            {civ.name} · {f.kind === 'settlers' ? 'Settlers' : 'Troops'} ·{' '}
            {people(f).toLocaleString()} people · {f.cohorts.length}/{capOf(f)} cohorts
          </div>
          <div className="muted">
            Moves {f.moves}/{formationMoves(f)} · {TERRAIN[m.terrain[f.hex]].name}
            {m.relief[f.hex] !== 'flat' ? `, ${RELIEF[m.relief[f.hex]].name}` : ''}
            {m.vegetation[f.hex] !== 'none' ? `, ${VEGETATION[m.vegetation[f.hex]].name}` : ''}
            {f.fortified ? ' · Fortified' : ''}
            {f.path.length ? ` · En route (${f.path.length} hexes)` : ''}
          </div>
        </div>
      </div>

      {f.kind === 'army' && (
        <div className="stat-row">
          <span title="Total melee strength">⚔ {stats.melee}</span>
          <span title="Total ranged strength">🏹 {stats.ranged}</span>
          <span title="Total charge">🐎 {stats.charge}</span>
          <span title="Average protection">🛡 {stats.protection}</span>
          <span title="Gold per turn">⛁ {stats.upkeep}/turn</span>
        </div>
      )}

      <div className="groups">
        <div className="groups-head">
          <span>Cohorts by equipment</span>
          {mine && f.cohorts.length > 1 && (
            <span className="links">
              <button className="link" onClick={() => setAll('all')}>
                all
              </button>
              <button className="link" onClick={() => setAll('none')}>
                none
              </button>
            </span>
          )}
        </div>
        {groups.map(g => {
          const st = cohortStats(g.loadout);
          const k = pick[g.key] ?? 0;
          const str = g.cohorts.reduce((s, c) => s + c.strength, 0);
          return (
            <div key={g.key} className={`group ${k ? 'picked' : ''}`}>
              <div className="group-main">
                <b>{g.cohorts.length} ×</b>{' '}
                {f.kind === 'settlers'
                  ? 'Civilians'
                  : [g.loadout.weapon, g.loadout.armour, g.loadout.mount, g.loadout.kit]
                      .filter(
                        id =>
                          !['no-armour', 'no-kit', 'foot'].includes(id) || id === g.loadout.weapon,
                      )
                      .map(id => ITEMS[id].name)
                      .join(' · ')}
                <div className="muted small">
                  {str} people · melee {st.melee}
                  {st.ranged ? ` · ranged ${st.ranged}` : ''} · moves {st.moves}
                </div>
              </div>
              {mine && (
                <div className="stepper" title="How many of these cohorts to select">
                  <button disabled={k <= 0} onClick={() => setPick({ ...pick, [g.key]: k - 1 })}>
                    −
                  </button>
                  <span>{k}</span>
                  <button
                    disabled={k >= g.cohorts.length}
                    onClick={() => setPick({ ...pick, [g.key]: k + 1 })}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {mine && (
        <div className="actions">
          {f.kind === 'army' && (
            <button
              className="primary"
              disabled={!selected.length || !supply}
              title={!supply ? 'Re-equip inside your territory' : ''}
              onClick={() => onEquip(selected)}
            >
              Equip {selected.length ? `${selected.length * 100} people` : 'selected'}…
            </button>
          )}
          <button
            disabled={!selected.length || selected.length === f.cohorts.length}
            onClick={() => onSplit(selected)}
          >
            Split off {selected.length || ''}
          </button>
          {f.kind === 'settlers' && (
            <button
              className="primary"
              disabled={!!foundWhy}
              title={foundWhy ?? 'Found a city here (B)'}
              onClick={onFound}
            >
              Found city
            </button>
          )}
          <button onClick={onFortify} title="F">
            {f.fortified ? 'Wake' : 'Fortify'}
          </button>
          {f.path.length > 0 && <button onClick={onClearOrders}>Cancel orders</button>}
          {!supply && f.kind === 'army' && (
            <p className="muted small">Outside your territory: cannot re-equip here.</p>
          )}
          {foundWhy && f.kind === 'settlers' && <p className="muted small">{foundWhy}</p>}
        </div>
      )}

      {others.length > 0 && (
        <div className="others">
          <div className="muted small">Also on this hex:</div>
          {others.map(o => (
            <div key={o.id} className="other">
              <button className="link" onClick={() => onSelect(o.id)}>
                {o.name} ({o.cohorts.length})
              </button>
              {mine && o.kind === f.kind && (
                <button
                  disabled={o.cohorts.length + f.cohorts.length > capOf(o)}
                  onClick={() => onMerge(o.id)}
                >
                  Merge
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {mine && (
        <p className="hint">
          Right-click (or click a hex) to move. Moving onto your own troops merges them.
        </p>
      )}
    </div>
  );
}
