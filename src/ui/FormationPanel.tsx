import { foundKind } from '../engine/colonies.ts';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.tsx';
import { ITEMS, SLOTS } from '../data/items.ts';
import { RELIEF, TERRAIN, VEGETATION } from '../data/terrain.ts';
import {
  canFoundCity,
  roadBuilderProblem,
  autoProblem,
  railProblem,
  RAIL_GOLD,
  cargoOf,
  formationsAt,
  refitPreview,
  supplyingCity,
  territoryRadius,
} from '../engine/game.ts';
import type { Formation, GameState } from '../engine/types.ts';
import {
  capOf,
  fleetCapacity,
  oceanGoing,
  cohortStats,
  formationMoves,
  formationSprite,
  formationArtKey,
  artKeyForLoadout,
  formationStats,
  groupCohorts,
  groupName,
  outdated,
  people,
  ROLE_NAMES,
  spriteForLoadout,
  isCivilian,
} from '../engine/units.ts';
import { Goods, Ico, UnitPortrait } from './bits.tsx';

interface Props {
  game: GameState;
  f: Formation;
  mine: boolean;
  onAssign: (cohortIds: number[], designId: number) => void;
  onDesigns: (open?: number | 'new') => void;
  onSplit: (cohortIds: number[]) => void;
  onMerge: (otherId: number) => void;
  onSelect: (fid: number) => void;
  onFound: () => void;
  onFortify: () => void;
  onRename: (name: string) => void;
  onClearOrders: () => void;
  onRoad: () => void;
  onAuto?: (mode: 'crew' | 'explore' | 'settle' | null) => void;
  onSkip?: () => void;
  onSentry?: () => void;
}

export function FormationPanel(p: Props) {
  const { game, f, mine } = p;
  const civ = game.civs[f.civId];
  const groups = groupCohorts(f);
  const allPicked = () => Object.fromEntries(groups.map(g => [g.key, g.cohorts.length]));
  const [pick, setPick] = useState<Record<string, number>>(allPicked);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(f.name);
  const [designId, setDesignId] = useState<number | null>(null);
  // a new selection or a new cohort count resets the picks to "everyone"
  useEffect(() => {
    setPick(allPicked());
    setName(f.name);
    setEditing(false);
  }, [f.id, f.cohorts.length, groups.length]);

  const selected = groups.flatMap(g => g.cohorts.slice(0, pick[g.key] ?? 0).map(c => c.id));
  const stats = formationStats(f);
  const others = formationsAt(game, f.hex).filter(o => o.id !== f.id && o.civId === f.civId);
  const supply = supplyingCity(game, f.civId, f.hex);
  const m = game.map;
  const foundWhy = f.kind === 'settlers' ? canFoundCity(game, f) : null;
  const kind =
    f.kind === 'settlers'
      ? foundKind(game, f.civId, f.hex, territoryRadius(game, f.civId))
      : 'town';
  const roadWhy = roadBuilderProblem(game, f);
  const railWhy = f.kind === 'engineers' ? railProblem(game, f) : null;
  const setAll = (n: 'all' | 'none') =>
    setPick(Object.fromEntries(groups.map(g => [g.key, n === 'all' ? g.cohorts.length : 0])));
  const design = civ.designs.find(d => d.id === designId) ?? null;
  const preview = useMemo(
    () => (design && selected.length ? refitPreview(game, f.id, selected, design.loadout) : null),
    [design, selected.join(','), game.turn, f.hex],
  );
  const missing = new Set(
    preview && preview.problem === null ? preview.missing.map(x => x.good) : [],
  );
  const roles = new Set(f.kind === 'fleet' ? [] : f.cohorts.map(c => cohortStats(c.loadout).role));

  return (
    <div className="panel formation">
      <div className="panel-head">
        <UnitPortrait sprite={formationSprite(f)} art={formationArtKey(f)} color={civ.color} />
        <div>
          {editing ? (
            <form
              onSubmit={e => {
                e.preventDefault();
                p.onRename(name);
                setEditing(false);
              }}
            >
              <input
                autoFocus
                value={name}
                maxLength={32}
                onChange={e => setName(e.target.value)}
                onBlur={() => {
                  p.onRename(name);
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
            {civ.name} · {people(f).toLocaleString()} people · {f.cohorts.length}/{capOf(f, game)}{' '}
            cohorts
          </div>
          <div className="muted small">
            Moves {f.moves}/{formationMoves(f)} · {TERRAIN[m.terrain[f.hex]].name}
            {m.relief[f.hex] !== 'flat' ? `, ${RELIEF[m.relief[f.hex]].name}` : ''}
            {m.vegetation[f.hex] !== 'none' ? `, ${VEGETATION[m.vegetation[f.hex]].name}` : ''}
            {f.fortified ? ' · Fortified' : ''}
            {f.path.length ? ` · En route (${f.path.length} hexes)` : ''}
          </div>
        </div>
      </div>

      {f.kind === 'fleet' && (
        <div className="fleet-info small">
          Carries {cargoOf(game, f).reduce((a, o) => a + o.cohorts.length, 0)}/{fleetCapacity(f)}{' '}
          cohorts · {oceanGoing(f) ? 'ocean-going' : 'coast only'}
          {cargoOf(game, f).map(o => (
            <button key={o.id} className="link" onClick={() => p.onSelect(o.id)}>
              {o.name} ({o.cohorts.length})
            </button>
          ))}
          {mine && (
            <div className="muted">
              Click a land hex next to the fleet with the troops selected to land them.
            </div>
          )}
        </div>
      )}
      {f.aboard !== undefined && (
        <p className="fleet-info small">
          Aboard {game.formations.find(x => x.id === f.aboard)?.name}. Click land next to the ship
          to go ashore (uses the turn's moves), or attack the shore straight from the ship (at a
          penalty).
        </p>
      )}
      {!isCivilian(f) && (
        <div className="stat-row">
          <span title="Total melee strength">
            <Ico name="melee" fallback="⚔" /> {stats.melee}
          </span>
          <span title="Total ranged strength">
            <Ico name="ranged" fallback="🏹" /> {stats.ranged}
          </span>
          <span title="Total charge">
            <Ico name="charge" fallback="🐎" /> {stats.charge}
          </span>
          <span title="Average protection">
            <Ico name="protection" fallback="🛡" /> {stats.protection}
          </span>
          <span title="Losses (%) it can take before breaking">
            <Ico name="morale" fallback="✊" /> {stats.morale}%
          </span>
          <span title="Gold per turn">
            <Ico name="upkeep" fallback="⛁" /> {stats.upkeep}
          </span>
        </div>
      )}
      {f.kind === 'army' && f.cohorts.length > 1 && (
        <div className="combo muted small">
          {[...roles].map(r => ROLE_NAMES[r]).join(' + ')}
          {roles.has('ranged') &&
            !roles.has('infantry') &&
            !roles.has('cavalry') &&
            ' · no front line: archers will be caught in melee'}
          {roles.has('ranged') &&
            (roles.has('infantry') || roles.has('cavalry')) &&
            ' · front line screens the archers'}
          {roles.has('cavalry') && ' · cavalry charges and flanks'}
        </div>
      )}

      <div className="groups">
        <div className="groups-head">
          <span>{f.kind === 'settlers' ? 'Families' : 'Cohorts by design'}</span>
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
          const old = outdated(civ, g);
          const gear = SLOTS.map(s => ITEMS[g.loadout[s]]).filter(it => !it.empty);
          return (
            <div key={g.key} className={`group ${k ? 'picked' : ''}`}>
              {f.kind === 'army' && (
                <UnitPortrait
                  sprite={spriteForLoadout(g.loadout)}
                  art={artKeyForLoadout(g.loadout)}
                  color={civ.color}
                  small
                />
              )}
              <div className="group-main">
                <b>
                  {g.cohorts.length} × {groupName(civ, g, f.kind)}
                </b>
                {old && (
                  <span className="badge" title="The design changed since these were equipped">
                    outdated
                  </span>
                )}
                <div className="muted small">
                  {f.kind === 'army'
                    ? gear.length
                      ? gear.map(it => it.name).join(', ')
                      : 'No gear'
                    : ''}
                </div>
                <div className="muted small">
                  {str} people
                  {f.kind === 'army'
                    ? ` · ${ROLE_NAMES[st.role].toLowerCase()} · melee ${st.melee}${st.ranged ? ` · ranged ${st.ranged}` : ''} · moves ${st.moves}`
                    : ''}
                </div>
              </div>
              {mine && f.cohorts.length > 1 && (
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

      {mine && !isCivilian(f) && f.aboard === undefined && (
        <div className="assign">
          <div className="row">
            <span className="assign-label">
              Make {selected.length ? `${selected.length * 100}` : 'the selected'} into
            </span>
            <select
              value={designId ?? ''}
              onChange={e => setDesignId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— pick a design —</option>
              {civ.designs
                .filter(d => !!d.naval === (f.kind === 'fleet'))
                .map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
            <button onClick={() => p.onDesigns('new')} title="Design a new unit type">
              New…
            </button>
          </div>
          {preview && preview.problem !== null && <p className="bad small">{preview.problem}</p>}
          {preview && preview.problem === null && (
            <p className="small">
              Pay <Goods goods={preview.cost} empty="nothing" missing={missing} /> from{' '}
              {preview.city.name}
              {preview.far ? ' (+50% away from the city)' : ''}
              {Object.values(preview.refund).some(n => n > 0) && (
                <>
                  {' '}
                  · get back <Goods goods={preview.refund} />
                </>
              )}
            </p>
          )}
          <button
            className="primary"
            disabled={
              !design ||
              !selected.length ||
              !preview ||
              preview.problem !== null ||
              preview.missing.length > 0
            }
            onClick={() => design && p.onAssign(selected, design.id)}
          >
            <Icon name="equip" /> Equip as {design?.name ?? '…'}
          </button>
          {!supply && (
            <p className="muted small">
              Outside your territory: troops can only be equipped near your cities.
            </p>
          )}
        </div>
      )}

      {mine && (
        <div className="actions">
          <button
            disabled={!selected.length || selected.length === f.cohorts.length}
            onClick={() => p.onSplit(selected)}
          >
            <Icon name="split" /> Split off {selected.length || ''}
          </button>
          {f.kind === 'settlers' && (
            <button
              className="primary"
              disabled={!!foundWhy}
              title={
                foundWhy ??
                (kind === 'colony'
                  ? 'Too far from your towns to join your lands: it becomes a colony (one district, gathering only; its goods reach you by road or by sea)'
                  : 'Found a town here: its land joins yours')
              }
              onClick={p.onFound}
            >
              <Icon name="flag" /> {kind === 'colony' ? 'Found colony' : 'Found city'}
            </button>
          )}
          {f.kind === 'settlers' && !foundWhy && kind === 'colony' && (
            <p className="small muted">
              Here it would be a <b>colony</b>: too far to join your lands. Colonies keep one
              district and only gather (farms, woodlots, mines); their goods reach you by road, or
              by sea with a harbour. Settle within 4 hexes of a town for a town.
            </p>
          )}
          {f.kind === 'engineers' && game.roads[f.hex] === 1 && (
            <button
              onClick={p.onRoad}
              disabled={!!railWhy}
              title={
                railWhy ?? `Lay a railway over this road: ${RAIL_GOLD} gold, the remaining moves.`
              }
            >
              <Icon name="road" /> Lay railway
            </button>
          )}
          {f.kind !== 'fleet' &&
            f.kind !== 'settlers' &&
            f.aboard === undefined &&
            !(f.kind === 'engineers' && game.roads[f.hex] === 1) && (
              <button
                onClick={p.onRoad}
                disabled={!!game.roads[f.hex] || f.moves <= 0 || !!roadWhy}
                title={
                  roadWhy ??
                  (game.roads[f.hex]
                    ? 'There is a road here'
                    : 'Lay a road on this hex. Uses the remaining moves.')
                }
              >
                <Icon name="road" /> Build road
              </button>
            )}
          {p.onAuto && f.auto && (
            <button onClick={() => p.onAuto!(null)} title="Take it back under your orders">
              Stop {f.auto === 'crew' ? 'building' : f.auto === 'settle' ? 'settling' : 'exploring'}
            </button>
          )}
          {p.onAuto && !f.auto && f.kind === 'settlers' && (
            <button
              onClick={() => p.onAuto!('settle')}
              title="They find the best site that joins your lands, walk there and found a town"
            >
              Settle automatically
            </button>
          )}
          {p.onAuto && !f.auto && !autoProblem(f, 'crew') && (
            <button
              onClick={() => p.onAuto!('crew')}
              title="Builds roads between your settlements, and railways once engineers can, on its own"
            >
              Automate
            </button>
          )}
          {p.onAuto && !f.auto && !autoProblem(f, 'explore') && (
            <button
              onClick={() => p.onAuto!('explore')}
              title="Explores the nearest unknown land on its own"
            >
              Explore
            </button>
          )}
          <button onClick={p.onFortify} title="">
            <Icon name="fortify" /> {f.fortified ? 'Wake' : 'Fortify'}
          </button>
          {p.onSentry && f.kind !== 'settlers' && (
            <button
              onClick={p.onSentry}
              title="wait here, out of the to-do list, until enemies come within 3 hexes"
            >
              {f.sentry ? 'Off sentry' : 'Sentry'}
            </button>
          )}
          {p.onSkip && f.moves > 0 && f.skip !== game.turn && (
            <button onClick={p.onSkip} title="nothing for it this turn">
              Skip turn
            </button>
          )}
          {f.path.length > 0 && <button onClick={p.onClearOrders}>Cancel orders</button>}
          {(() => {
            // touch screens show no tooltips: say why a button is greyed out
            const why = [
              f.kind === 'settlers' ? foundWhy : null,
              selected.length && selected.length === f.cohorts.length && f.cohorts.length > 1
                ? 'To split, leave at least one cohort behind.'
                : null,
              f.kind !== 'fleet' && !game.roads[f.hex] && f.moves <= 0
                ? 'No moves left this turn for a road.'
                : null,
              f.kind !== 'fleet' && f.kind !== 'settlers' && !game.roads[f.hex] ? roadWhy : null,
              f.kind === 'engineers' && game.roads[f.hex] === 1 ? railWhy : null,
            ].filter(Boolean);
            return why.length ? <p className="muted small why">{why.join(' ')}</p> : null;
          })()}
        </div>
      )}

      {others.length > 0 && (
        <div className="others">
          <div className="muted small">Also on this hex:</div>
          {others.map(o => (
            <div key={o.id} className="other">
              <button className="link" onClick={() => p.onSelect(o.id)}>
                {o.name} ({o.cohorts.length})
              </button>
              {mine && o.kind === f.kind && (
                <button
                  disabled={o.cohorts.length + f.cohorts.length > capOf(o, game)}
                  onClick={() => p.onMerge(o.id)}
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
          Click a hex to move, an adjacent enemy to attack. Moving onto your own troops merges them.
        </p>
      )}
    </div>
  );
}
