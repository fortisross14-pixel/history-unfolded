import { useState } from 'react';
import { cityValue, evaluateOffer } from '../engine/diplomacy.ts';
import type { GameState, Offer } from '../engine/types.ts';

type Mode = 'white' | 'they-pay' | 'we-pay' | 'they-cede' | 'we-cede';
const TRIBUTE_TURNS = 20;

/**
 * Peace on terms: a white peace, tribute either way, or a settlement either way. Their answer
 * is shown before the offer is made.
 */
export function PeaceTerms({
  game,
  me,
  them,
  onOffer,
}: {
  game: GameState;
  me: number;
  them: number;
  onOffer: (o: Offer) => void;
}) {
  const [mode, setMode] = useState<Mode>('white');
  const [gold, setGold] = useState(5);
  const theirs = game.cities.filter(c => c.civId === them);
  const ours = game.cities.filter(c => c.civId === me);
  const [cityId, setCityId] = useState<number>(-1);
  const pool = mode === 'they-cede' ? theirs : mode === 'we-cede' ? ours : [];
  const picked = pool.find(c => c.id === cityId) ?? pool[0];
  const offer: Offer =
    mode === 'they-pay'
      ? { give: {}, get: { goldPerTurn: gold }, peace: true, turns: TRIBUTE_TURNS }
      : mode === 'we-pay'
        ? { give: { goldPerTurn: gold }, get: {}, peace: true, turns: TRIBUTE_TURNS }
        : mode === 'they-cede' && picked
          ? { give: {}, get: { cities: [picked.id] }, peace: true }
          : mode === 'we-cede' && picked
            ? { give: { cities: [picked.id] }, get: {}, peace: true }
            : { give: {}, get: {}, peace: true };
  const ev = evaluateOffer(game, me, them, offer);
  return (
    <div className="peace-terms">
      <label className="field">
        <span>Peace</span>
        <select value={mode} onChange={e => setMode(e.target.value as Mode)}>
          <option value="white">White peace</option>
          <option value="they-pay">They pay tribute</option>
          <option value="we-pay">You pay tribute</option>
          <option value="they-cede" disabled={theirs.length < 2}>
            They cede a city
          </option>
          <option value="we-cede" disabled={ours.length < 2}>
            You cede a city
          </option>
        </select>
      </label>
      {(mode === 'they-pay' || mode === 'we-pay') && (
        <label className="field">
          <span title={`Gold a turn, for ${TRIBUTE_TURNS} turns`}>Gold/turn ×{TRIBUTE_TURNS}</span>
          <select value={gold} onChange={e => setGold(Number(e.target.value))}>
            {[3, 5, 10, 20].map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      {pool.length > 0 && (
        <label className="field">
          <span>City</span>
          <select value={picked?.id} onChange={e => setCityId(Number(e.target.value))}>
            {pool.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.pop.toLocaleString()} · value {cityValue(game, c.id)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="row">
        <button onClick={() => onOffer(offer)} disabled={!ev.accept}>
          Offer peace
        </button>
        <span className={`small ${ev.accept ? 'good' : 'muted'}`}>{ev.reason}</span>
      </div>
    </div>
  );
}
