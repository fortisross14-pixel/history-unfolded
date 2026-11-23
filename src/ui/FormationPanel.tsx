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
  railGold,
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
import { Chip, Goods, InfoButton, UnitPortrait } from './bits.tsx';
import './declutter-map.css';

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
          <span className="chips fp-sub">
            <Chip icon="people" n={people(f).toLocaleString()} title={`${civ.name}: people`} />
            <Chip icon="army" n={`${f.cohorts.length}/${capOf(f, game)}`} title="Cohorts" />
            <Chip icon="moves" n={`${f.moves}/${formationMoves(f)}`} title="Moves" />
            {f.fortified && <span className="fp-tag">Fortified</span>}
            {f.path.length > 0 && (
              <Chip icon="go-to" n={f.path.length} title="En route: hexes left" />
            )}
          </span>
          <div className="muted small">
            {TERRAIN[m.terrain[f.hex]].name}
            {m.relief[f.hex] !== 'flat' ? `, ${RELIEF[m.relief[f.hex]].name}` : ''}
            {m.vegetation[f.hex] !== 'none' ? `, ${VEGETATION[m.vegetation[f.hex]].name}` : ''}
          </div>
        </div>
      </div>

      {f.kind === 'fleet' && (
        <div className="fleet-info small chips">
          <Chip
            icon="crate"
            n={`${cargoOf(game, f).reduce((a, o) => a + o.cohorts.length, 0)}/${fleetCapacity(f)}`}
            title="Cohorts aboard"
          />
          <span className="fp-tag">{oceanGoing(f) ? 'Ocean' : 'Coast only'}</span>
          {cargoOf(game, f).map(o => (
            <button key={o.id} className="link" onClick={() => p.onSelect(o.id)}>
              {o.name} ({o.cohorts.length})
            </button>
          ))}
        </div>
      )}
      {f.aboard !== undefined && (
        <p className="fleet-info small">
          Aboard {game.formations.find(x => x.id === f.aboard)?.name}{' '}
          <InfoButton label="About landing">
            Landing uses the turn's moves. Attacking from the ship: penalty.
          </InfoButton>
        </p>
      )}
      {!isCivilian(f) && (
        <div className="stat-row chips">
          <Chip icon="melee" n={stats.melee} title="Melee (total)" />
          <Chip icon="ranged" n={stats.ranged} title="Ranged (total)" />
          <Chip icon="charge" n={stats.charge} title="Charge (total)" />
          <Chip icon="protection" n={stats.protection} title="Protection (average)" />
          <Chip
            icon="morale"
            n={`${stats.morale}%`}
            title="Morale: losses it takes before breaking"
          />
          <Chip icon="upkeep" n={stats.upkeep} title="Upkeep: gold a turn" />
        </div>
      )}
      {f.kind === 'army' && f.cohorts.length > 1 && (
        <div className="combo muted small">
          {[...roles].map(r => ROLE_NAMES[r]).join(' + ')}
          {roles.has('ranged') && !roles.has('infantry') && !roles.has('cavalry') && (
            <span className="fp-tag bad" title="Archers will be caught in melee">
              No front line
            </span>
          )}
          {roles.has('ranged') && (roles.has('infantry') || roles.has('cavalry')) && (
            <span className="fp-tag good" title="The front line screens the archers">
              Screened
            </span>
          )}
        </div>
      )}

      <div className="groups">
        <div className="groups-head">
          <span>{f.kind === 'settlers' ? 'Families' : 'Cohorts'}</span>
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
                <span className="chips fp-group-stats small">
                  <Chip icon="people" n={str} title="People" />
                  {f.kind === 'army' && (
                    <>
                      <Chip icon="melee" n={st.melee} title={`${ROLE_NAMES[st.role]}: melee`} />
                      {st.ranged > 0 && <Chip icon="ranged" n={st.ranged} title="Ranged" />}
                      <Chip icon="moves" n={st.moves} title="Moves" />
                    </>
                  )}
                </span>
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
            <span className="assign-label" title="Refit the selected cohorts">
              <Chip icon="equip" n={selected.length * 100} title="People to refit" />
            </span>
            <select
              value={designId ?? ''}
              onChange={e => setDesignId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— design —</option>
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
            <p className="small fp-cost">
              <Goods goods={preview.cost} empty="Free" missing={missing} />
              <span className="muted">· {preview.city.name}</span>
              {preview.far && (
                <span className="fp-tag bad" title="Away from the city: +50% cost">
                  +50%
                </span>
              )}
              {Object.values(preview.refund).some(n => n > 0) && (
                <span title="Refund">
                  ↩ <Goods goods={preview.refund} />
                </span>
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
          {!supply && <p className="muted small">Equip only near your cities.</p>}
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
                foundWhy ?? (kind === 'colony' ? 'Colony: too far to join your lands' : 'Town')
              }
              onClick={p.onFound}
            >
              <Icon name="flag" /> {kind === 'colony' ? 'Found colony' : 'Found city'}
            </button>
          )}
          {f.kind === 'settlers' && !foundWhy && kind === 'colony' && (
            <InfoButton label="About colonies">
              <b>Colony</b>
              <span>1 district, gathering only (farms, woodlots, mines).</span>
              <span>Goods reach you by road, or by sea with a harbour.</span>
              <span>Town: within 4 hexes of a town.</span>
            </InfoButton>
          )}
          {f.kind === 'engineers' && game.roads[f.hex] === 1 && (
            <button
              onClick={p.onRoad}
              disabled={!!railWhy}
              title={railWhy ?? `Railway: ${railGold(game, f.civId)} gold, remaining moves`}
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
                  roadWhy ?? (game.roads[f.hex] ? 'Road already here' : 'Road: remaining moves')
                }
              >
                <Icon name="road" /> Build road
              </button>
            )}
          {p.onAuto && f.auto && (
            <button onClick={() => p.onAuto!(null)} title="Back to your orders">
              Stop {f.auto === 'crew' ? 'building' : f.auto === 'settle' ? 'settling' : 'exploring'}
            </button>
          )}
          {p.onAuto && !f.auto && f.kind === 'settlers' && (
            <button onClick={() => p.onAuto!('settle')} title="Best site that joins your lands">
              Settle automatically
            </button>
          )}
          {p.onAuto && !f.auto && !autoProblem(f, 'crew') && (
            <button onClick={() => p.onAuto!('crew')} title="Roads, then railways, on its own">
              Automate
            </button>
          )}
          {p.onAuto && !f.auto && !autoProblem(f, 'explore') && (
            <button onClick={() => p.onAuto!('explore')} title="Nearest unknown land">
              Explore
            </button>
          )}
          <button onClick={p.onFortify} title="">
            <Icon name="fortify" /> {f.fortified ? 'Wake' : 'Fortify'}
          </button>
          {p.onSentry && f.kind !== 'settlers' && (
            <button onClick={p.onSentry} title="Wait until enemies within 3 hexes">
              {f.sentry ? 'Off sentry' : 'Sentry'}
            </button>
          )}
          {p.onSkip && f.moves > 0 && f.skip !== game.turn && (
            <button onClick={p.onSkip} title="Nothing this turn">
              Skip turn
            </button>
          )}
          {f.path.length > 0 && <button onClick={p.onClearOrders}>Cancel orders</button>}
          {(() => {
            // touch screens show no tooltips: say why a button is greyed out
            const why = [
              f.kind === 'settlers' ? foundWhy : null,
              f.kind !== 'fleet' && !game.roads[f.hex] && f.moves <= 0 ? 'No moves left.' : null,
              f.kind !== 'fleet' && f.kind !== 'settlers' && !game.roads[f.hex] ? roadWhy : null,
              f.kind === 'engineers' && game.roads[f.hex] === 1 ? railWhy : null,
            ].filter(Boolean);
            return why.length ? <p className="muted small why">{why.join(' ')}</p> : null;
          })()}
        </div>
      )}

      {others.length > 0 && (
        <div className="others">
          <div className="muted small">Here too</div>
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
    </div>
  );
}
