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
  formationStrength,
  strengthText,
  refitPreview,
  supplyingCity,
  territoryRadius,
} from '../engine/game.ts';
import type { Formation, GameState } from '../engine/types.ts';
import type { RefitPreview } from '../engine/game.ts';
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
import './r4-nav.css';

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
  // a new selection or a new cohort count resets the picks to "everyone"
  useEffect(() => {
    setPick(allPicked());
    setName(f.name);
    setEditing(false);
  }, [f.id, f.cohorts.length, groups.length]);

  const selected = groups.flatMap(g => g.cohorts.slice(0, pick[g.key] ?? 0).map(c => c.id));
  const stats = formationStats(f);
  const others = formationsAt(game, f.hex).filter(o => o.id !== f.id && o.civId === f.civId);
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
            {!isCivilian(f) && (
              <span
                className="fp-strength"
                title="Strength: gear, people, experience. A 250 most likely beats a 137."
              >
                <Chip icon="sword" n={strengthText(formationStrength(game, f))} title="Strength" />
              </span>
            )}
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
        <AssignMix game={game} f={f} onAssign={p.onAssign} onDesigns={p.onDesigns} />
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

/**
 * Split a formation's cohorts (100 people each) among designs: one stepper per design, the rest
 * stays as it is. Only the cohorts that change are paid for, line by line.
 */
function AssignMix({
  game,
  f,
  onAssign,
  onDesigns,
}: {
  game: GameState;
  f: Formation;
  onAssign: (cohortIds: number[], designId: number) => void;
  onDesigns: (open?: number | 'new') => void;
}) {
  const civ = game.civs[f.civId];
  const designs = civ.designs.filter(d => !!d.naval === (f.kind === 'fleet'));
  // what each design has now; cohorts of no design (levies, custom gear) by their group
  const now = (): Record<string, number> => {
    const t: Record<string, number> = {};
    for (const d of designs) t[`d${d.id}`] = 0;
    for (const c of f.cohorts) {
      const k =
        c.designId !== null && designs.some(d => d.id === c.designId) ? `d${c.designId}` : 'rest';
      t[k] = (t[k] ?? 0) + 1;
    }
    return t;
  };
  const shape = f.cohorts.map(c => `${c.id}:${c.designId}`).join(',');
  const [want, setWant] = useState(now);
  useEffect(() => setWant(now()), [f.id, shape, designs.length]);
  const total = f.cohorts.length;
  const stale = groupCohorts(f).filter(
    g => g.designId !== null && designs.some(d => d.id === g.designId) && outdated(civ, g),
  );
  const rest = want.rest ?? 0;
  const used = Object.values(want).reduce((a, n) => a + n, 0);
  const free = total - used;
  const restNow = now().rest ?? 0;
  const restName = (() => {
    const names = new Set(
      groupCohorts(f)
        .filter(g => !designs.some(d => d.id === g.designId))
        .map(g => groupName(civ, g, f.kind)),
    );
    return [...names].join(', ') || 'Levy';
  })();
  const step = (k: string, by: 1 | -1) => {
    const w = { ...want };
    if (by > 0) {
      // a free place first, else one from those of no design
      if (free <= 0) {
        if ((w.rest ?? 0) <= 0) return;
        w.rest--;
      }
      w[k] = (w[k] ?? 0) + 1;
    } else {
      if ((w[k] ?? 0) <= 0) return;
      w[k]--;
    }
    setWant(w);
  };
  // which cohorts change: each design keeps its own up to its count, the others are re-equipped
  const plan = useMemo(() => {
    const keep = new Set<number>();
    const kept: Record<string, number> = {};
    for (const c of f.cohorts) {
      const k =
        c.designId !== null && designs.some(d => d.id === c.designId) ? `d${c.designId}` : 'rest';
      if ((kept[k] ?? 0) < (want[k] ?? 0)) {
        kept[k] = (kept[k] ?? 0) + 1;
        keep.add(c.id);
      }
    }
    // donors: those of no design first, then the ones a design gives up
    const donors = f.cohorts
      .filter(c => !keep.has(c.id))
      .sort((a, b) => Number(a.designId !== null) - Number(b.designId !== null));
    const lines: { design: (typeof designs)[number]; ids: number[] }[] = [];
    for (const d of designs) {
      const need = (want[`d${d.id}`] ?? 0) - (kept[`d${d.id}`] ?? 0);
      if (need > 0) lines.push({ design: d, ids: donors.splice(0, need).map(c => c.id) });
    }
    return lines
      .filter(l => l.ids.length)
      .map(l => ({
        ...l,
        preview: refitPreview(game, f.id, l.ids, l.design.loadout),
      }));
  }, [want, shape, game.turn, f.hex, designs.length]);
  const sum: Record<string, number> = {};
  for (const l of plan)
    if (l.preview.problem === null)
      for (const [k, n] of Object.entries(l.preview.cost)) sum[k] = (sum[k] ?? 0) + n;
  const first = plan
    .map(l => l.preview)
    .find((x): x is Extract<RefitPreview, { problem: null }> => x.problem === null);
  const blocked = plan.some(l => l.preview.problem !== null || l.preview.missing.length > 0);
  const changed = plan.reduce((a, l) => a + l.ids.length, 0);
  const row = (k: string, label: string, n: number, canAdd: boolean, tip: string) => (
    <div key={k} className={`mix-row ${n ? 'on' : ''}`} title={tip}>
      <span className="mix-name">{label}</span>
      <span className="mix-people muted small">{(n * 100).toLocaleString()}</span>
      <div className="stepper">
        <button
          aria-label={`One cohort less ${label}`}
          disabled={n <= 0}
          onClick={() => step(k, -1)}
        >
          −
        </button>
        <span>{n}</span>
        <button
          aria-label={`One cohort more ${label}`}
          disabled={!canAdd}
          onClick={() => step(k, 1)}
        >
          +
        </button>
      </div>
    </div>
  );
  return (
    <div className="assign mix">
      <div className="groups-head">
        <span title="Each cohort is 100 people">
          <Chip icon="equip" n={`${total} × 100`} title="Cohorts of 100 to equip" />
        </span>
        <button className="link" onClick={() => onDesigns('new')} title="Design a new unit type">
          New design…
        </button>
      </div>
      {designs.map(d =>
        row(
          `d${d.id}`,
          d.name,
          want[`d${d.id}`] ?? 0,
          free > 0 || rest > 0,
          `${d.name}: cohorts of 100`,
        ),
      )}
      {(restNow > 0 || rest > 0 || free > 0) && (
        <div className="mix-row rest muted">
          <span className="mix-name">{restNow > 0 ? restName : 'Unchanged'}</span>
          <span className="mix-people small">{((rest + free) * 100).toLocaleString()}</span>
          <span className="stepper">
            <span>{rest + free}</span>
          </span>
        </div>
      )}
      {!designs.length && <p className="muted small">No designs yet.</p>}
      {plan.length > 0 && (
        <ul className="mix-cost small">
          {plan.map(l => (
            <li key={l.design.id}>
              <b>
                {l.ids.length} × {l.design.name}:
              </b>{' '}
              {l.preview.problem !== null ? (
                <span className="bad">{l.preview.problem}</span>
              ) : (
                <>
                  <Goods
                    goods={l.preview.cost}
                    empty="Free"
                    missing={new Set(l.preview.missing.map(x => x.good))}
                  />
                  {Object.values(l.preview.refund).some(n => n > 0) && (
                    <span className="muted" title="Refund">
                      {' '}
                      ↩ <Goods goods={l.preview.refund} />
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
          {plan.length > 1 && first && (
            <li className="mix-total">
              <b>Total:</b> <Goods goods={sum} empty="Free" />
            </li>
          )}
          {first && (
            <li className="muted">
              {first.city.name}
              {first.far && (
                <span className="fp-tag bad" title="Away from the city: +50% cost">
                  +50%
                </span>
              )}
            </li>
          )}
        </ul>
      )}
      <button
        className="primary"
        disabled={!changed || blocked}
        onClick={() => {
          for (const l of plan) onAssign(l.ids, l.design.id);
        }}
      >
        <Icon name="equip" /> Equip {changed ? `${changed} × 100` : ''}
      </button>
      {stale.map(g => (
        <button
          key={g.key}
          onClick={() =>
            onAssign(
              g.cohorts.map(c => c.id),
              g.designId!,
            )
          }
          title="The design changed since these were equipped"
        >
          Upgrade {g.cohorts.length} × {groupName(civ, g, f.kind)}
        </button>
      ))}
      {!supplyingCity(game, f.civId, f.hex) && (
        <p className="muted small">Equip only near your cities.</p>
      )}
    </div>
  );
}
