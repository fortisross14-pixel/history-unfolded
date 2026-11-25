import { useState } from 'react';
import {
  AREA_ICON,
  AREA_NAMES,
  AREAS,
  CIVIL_WAR_TURNS,
  LEVEL_PCT,
  MAX_LEVEL,
  REVOLT_AT,
  type Area,
} from '../data/dynasties.ts';
import { SLOT_TYPES } from '../data/slots.ts';
import {
  armyStrength,
  assignGovernor,
  chooseSide,
  splitArmies,
  giveTrinket,
  levelOf,
  xpProgress,
  governorOf,
  grantHonours,
  honoursCost,
  houseWord,
  isDemocracy,
  powerOf,
  rulerOf,
  trinketsOf,
  yieldThrone,
} from '../engine/dynasty.ts';
import { TIER_NAME } from '../engine/economy.ts';
import type { City, GameState } from '../engine/types.ts';
import { Ico, InfoButton } from './bits.tsx';

interface Props {
  game: GameState;
  civId: number;
  report: (r: { ok: boolean; msg?: string }) => void;
  onClose: () => void;
}

/** What a settlement works most, by its buildings' lines. */
function mainLine(game: GameState, c: City): Area | null {
  const n: Partial<Record<Area, number>> = {};
  for (const d of game.districts)
    if (d.cityId === c.id)
      for (const x of d.slots) {
        const l = x.type ? SLOT_TYPES[x.type]?.line : undefined;
        if (l) n[l] = (n[l] ?? 0) + 1;
      }
  const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  return (top?.[0] as Area) ?? null;
}

/**
 * The great houses: who rules, who governs where, the trinkets that make each strong, and how
 * close any of them is to rising against the throne.
 */
export function DynastiesDialog({ game, civId, report, onClose }: Props) {
  const [, setV] = useState(0);
  const act = (r: { ok: boolean; msg?: string }) => {
    report(r);
    setV(v => v + 1);
  };
  const civ = game.civs[civId];
  const demo = isDemocracy(civ);
  const word = houseWord(civ);
  const ruler = rulerOf(civ);
  const power = powerOf(game, civ);
  const mine = game.cities.filter(c => c.civId === civId).sort((a, b) => b.pop - a.pop);
  const [giveTo, setGiveTo] = useState<Record<number, number>>({});
  const war = civ.civilWar;
  const rebel = war ? civ.dynasties.find(d => d.id === war.rebel) : undefined;
  const rulerShare = power.get(ruler.id)?.share ?? 0;

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal dynasties"
        role="dialog"
        aria-modal="true"
        aria-label="Dynasties"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            {demo ? 'Parties' : 'Houses'} of the {civ.name}{' '}
            <InfoButton label={demo ? 'About parties' : 'About houses'}>
              {demo ? (
                <>
                  Houses are parties: give them settlements freely; the one governing the most
                  people leads. Rivalry rarely turns to war. Trinkets count {Math.round(0.4 * 100)}
                  %.
                </>
              ) : (
                <>
                  <span>
                    Level per area 0–{MAX_LEVEL} (born + governing + trinkets): +{LEVEL_PCT}% a
                    level to that line where the house governs. The ruler lends half its levels to
                    the realm.
                  </span>
                  <span>
                    Power = people governed + levels. Outweighing the throne breeds unrest; at{' '}
                    {REVOLT_AT}, civil war.
                  </span>
                  <span>
                    Taking a settlement from a house: +10 unrest. More{' '}
                    {word === 'house' ? 'houses' : 'parties'} rise in later ages, up to five.
                  </span>
                </>
              )}
            </InfoButton>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {war?.pending && rebel && (
          <div className="civil-war">
            <b>Civil war!</b> {rebel.name} rises against {ruler.name}. Choose a side.{' '}
            <InfoButton label="About civil war">
              Your side keeps the other houses and your alliances; the other becomes a realm of its
              own, at war with you for {CIVIL_WAR_TURNS} turns.
            </InfoButton>
            <button className="primary" onClick={() => act(chooseSide(game, civId, ruler.id))}>
              {ruler.name} (throne) <ArmiesLeave game={game} civId={civId} house={rebel.id} />
            </button>
            <button onClick={() => act(chooseSide(game, civId, rebel.id))}>
              {rebel.name} (rebels) <ArmiesLeave game={game} civId={civId} house={ruler.id} />
            </button>
          </div>
        )}
        {war && !war.pending && war.rival !== undefined && (
          <div className="civil-war">
            <b>Civil war</b> vs the {game.civs[war.rival].name}: turn{' '}
            {Math.min(CIVIL_WAR_TURNS, game.turn - war.since)}/{CIVIL_WAR_TURNS}{' '}
            <span className="chip" title="Army strength: yours vs theirs">
              <Ico name="army" fallback="⚔" size={18} />{' '}
              <b>
                {Math.round(armyStrength(game, civId))} :{' '}
                {Math.round(armyStrength(game, war.rival))}
              </b>
            </span>{' '}
            <InfoButton label="How the civil war ends">
              Take all their settlements to win outright. Otherwise the bigger army takes the
              throne; armies within 10% end in a stalemate (two realms).
            </InfoButton>
            <button onClick={() => act(yieldThrone(game, civId))}>Yield the throne</button>
          </div>
        )}

        <div className="house-list">
          {civ.dynasties.map(d => {
            const pw = power.get(d.id)!;
            const isRuler = d.id === ruler.id;
            const governs = mine.filter(c => governorOf(game, c)?.id === d.id);
            const areas = AREAS.filter(a => levelOf(d, a) > 0 || xpProgress(d, a) > 0);
            return (
              <div key={d.id} className={`house ${isRuler ? 'ruler' : ''}`}>
                <div className="house-head">
                  <span className="swatch" style={{ background: d.color }} />
                  <b>House {d.name}</b>
                  {isRuler && <span className="tier-pill">{demo ? 'leads' : 'rules'}</span>}
                  {rebel?.id === d.id && <span className="war-pill">in revolt</span>}
                </div>
                <div className="house-bar" title={`${Math.round(pw.share * 100)}% of the realm`}>
                  <span style={{ width: `${pw.share * 100}%`, background: d.color }} />
                  {!isRuler && <i style={{ left: `${rulerShare * 100}%` }} title="The throne" />}
                </div>
                <span className="chips small">
                  <span className="chip" title="Share of the realm's power">
                    <Ico name="dynasties" fallback="♛" size={16} />{' '}
                    <b>{Math.round(pw.share * 100)}%</b>
                  </span>
                  <span className="chip" title="People governed">
                    <Ico name="people" fallback="☺" size={16} /> <b>{pw.people.toLocaleString()}</b>
                  </span>
                  {!isRuler && pw.share > rulerShare ? (
                    <span className="bad" title="Outweighs the throne">
                      <Ico name="warning" fallback="!" size={16} /> &gt; throne
                    </span>
                  ) : null}
                </span>
                {!isRuler && (
                  <div className="unrest">
                    <small>Unrest</small>
                    <span className="age-meter">
                      <span
                        style={{
                          width: `${(d.unrest / REVOLT_AT) * 100}%`,
                          background: d.unrest >= 60 ? '#b3261e' : undefined,
                        }}
                      />
                    </span>
                    <small>{Math.round(d.unrest)}</small>
                    <button
                      className="small"
                      disabled={civ.gold < honoursCost(game, civ) || d.unrest <= 0}
                      onClick={() => act(grantHonours(game, civId, d.id))}
                      title={`Honours at court calm a restless house (${honoursCost(game, civ)} gold)`}
                    >
                      Honours <Ico name="gold" fallback="¤" size={14} /> {honoursCost(game, civ)}
                    </button>
                  </div>
                )}
                <div className="levels">
                  {areas.length ? (
                    areas.map(a => (
                      <div
                        key={a}
                        className="level-row"
                        title={`${d.traits?.[a] ?? 0} born · ${trinketsOf(d, a)} trinkets · experience ${Math.round(xpProgress(d, a) * 100)}% to the next`}
                      >
                        <span>
                          {AREA_ICON[a]} {AREA_NAMES[a]}
                        </span>
                        <span className="pips">
                          {Array.from({ length: MAX_LEVEL }, (_, k) => (
                            <i key={k} className={k < levelOf(d, a) ? 'on' : ''} />
                          ))}
                        </span>
                        <small>
                          {levelOf(d, a)} · +{levelOf(d, a) * LEVEL_PCT}%
                        </small>
                      </div>
                    ))
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </div>
                {d.trinkets.length > 0 && (
                  <p className="small muted" title="Trinkets">
                    <Ico name="gift" fallback="✦" size={14} />{' '}
                    {d.trinkets.map(t => t.name).join(', ')}
                  </p>
                )}
                <p className="small muted" title="Governs">
                  <Ico name="city" fallback="⌂" size={14} />{' '}
                  {governs.length ? governs.map(c => c.name).join(', ') : '—'}
                </p>
              </div>
            );
          })}
        </div>

        {civ.trinkets.length > 0 && (
          <>
            <h3>Trinkets to give</h3>
            <div className="trinket-pool">
              {civ.trinkets.map(t => (
                <div key={t.id} className="row">
                  <span className="trinket-chip">
                    {AREA_ICON[t.line]} {t.name}{' '}
                    <small className="muted">({AREA_NAMES[t.line]})</small>
                  </span>
                  <select
                    value={giveTo[t.id] ?? ruler.id}
                    onChange={e => setGiveTo({ ...giveTo, [t.id]: Number(e.target.value) })}
                  >
                    {civ.dynasties.map(d => (
                      <option key={d.id} value={d.id}>
                        House {d.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => act(giveTrinket(game, civId, t.id, giveTo[t.id] ?? ruler.id))}
                  >
                    Give
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <h3>Who governs where</h3>
        <table className="ledger">
          <thead>
            <tr>
              <th>Settlement</th>
              <th>People</th>
              <th>Works</th>
              <th>Governor</th>
            </tr>
          </thead>
          <tbody>
            {mine.map(c => {
              const ml = mainLine(game, c);
              return (
                <tr key={c.id}>
                  <td>
                    {c.name} <small className="muted">{TIER_NAME[c.tier]}</small>
                  </td>
                  <td>{c.pop.toLocaleString()}</td>
                  <td>{ml ? `${AREA_ICON[ml]} ${AREA_NAMES[ml]}` : '—'}</td>
                  <td>
                    <select
                      value={governorOf(game, c)?.id}
                      onChange={e => act(assignGovernor(game, civId, c.id, Number(e.target.value)))}
                    >
                      {civ.dynasties.map(d => (
                        <option key={d.id} value={d.id}>
                          House {d.name}
                          {ml && levelOf(d, ml)
                            ? ` (${AREA_NAMES[ml]} ${levelOf(d, ml)}: +${levelOf(d, ml) * LEVEL_PCT}%)`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Armies that would leave with the other side if the player picks this one. */
function ArmiesLeave({ game, civId, house }: { game: GameState; civId: number; house: number }) {
  const n = splitArmies(game, civId, house).going.filter(f => f.kind === 'army').length;
  return (
    <small
      className="muted"
      title="Armies that go with the other side: those its house leads, and unled ones nearest its settlements"
    >
      · {n} {n === 1 ? 'army leaves' : 'armies leave'}
    </small>
  );
}
