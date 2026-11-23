import { useEffect, useState, type ReactNode } from 'react';
import { PRIORITIES, setPriority } from '../engine/game.ts';
import { wondersOf } from '../engine/wonders.ts';
import { faithById, foundProblem, tenetDue } from '../engine/faith.ts';
import { AGE_SYSTEMS, PATHS, type NationalPath } from '../data/paths.ts';
import { TAGS } from '../data/culture.ts';
import { ERAS } from '../data/techs.ts';
import { GOODS } from '../data/goods.ts';
import type { Mods } from '../data/mods.ts';
import {
  choosePath,
  edictProblem,
  lockedOptions,
  pathOptions,
  pathStrength,
  useEdict,
} from '../engine/paths.ts';
import type { Civ, GameState } from '../engine/types.ts';
import { VICTORIES, victoryOn } from '../engine/victory.ts';
import { activeCrisis, crisisRisks } from '../engine/crises.ts';
import {
  POLICY_COOLDOWN,
  POLICY_LIST,
  type Policy,
  type PolicySide,
} from '../data/policies.ts';
import { openPolicies, policyProblem, positionOf, setPolicy } from '../engine/policies.ts';
import { GoodIcon, Ico, InfoButton } from './bits.tsx';
import './declutter-nation.css';

// ------------------------------------------------------------------ effect chips (shared by the
// nation group: culture, faith, wonders, events)

/** One effect as an icon and a signed number; `down` means less is better. */
export interface Eff {
  icon?: string;
  good?: string;
  n: number;
  title: string;
  pct?: boolean;
  down?: boolean;
  /** shown as-is instead of a signed number (e.g. "×1.5") */
  text?: string;
}

const MOD_ICON: Record<Exclude<keyof Mods, 'groupPct'>, [string, string, boolean?]> = {
  goldPct: ['gold', 'gold'],
  sciencePct: ['science', 'science'],
  culturePct: ['culture', 'culture'],
  foodPct: ['food', 'food'],
  prodPct: ['production', 'production'],
  housingPct: ['housing', 'housing'],
  growthPct: ['people', 'growth'],
  workers: ['workers', 'workers'],
  coastalPct: ['drop', 'coastal city yields'],
  upkeepPct: ['upkeep', 'troop upkeep', true],
  levyCohorts: ['levy', 'cohorts per levy'],
  commandCap: ['army', 'cohorts per formation'],
  morale: ['morale', 'morale'],
  meleePct: ['melee', 'melee'],
  rangedPct: ['ranged', 'ranged'],
  chargePct: ['charge', 'charge'],
  defensePct: ['protection', 'less damage taken'],
  attackPct: ['war', 'attack'],
  homePct: ['fortify', 'fighting at home'],
  roughPct: ['moves', 'fighting on rough ground'],
  siegePct: ['city', 'assaulting cities'],
  cityDefensePct: ['fortify', 'city defence'],
  guard: ['protection', 'city guard cohorts'],
  sight: ['sight', 'sight'],
  heal: ['plus', 'healing a turn'],
  refitPct: ['equip', 'equipping cost', true],
  navalPct: ['compass', 'at sea'],
  territoryRadius: ['district', 'territory radius'],
  districtRadius: ['district', 'district radius'],
  roadCost: ['road', 'road move cost', true],
  researchPct: ['research', 'research cost', true],
  cultureCostPct: ['culture', 'culture cost', true],
  tensionPct: ['warning', 'tension build-up', true],
};

/** A people's bonuses as effects, in the order they are written. */
export function modEffs(m: Partial<Mods> | undefined, k = 1): Eff[] {
  const out: Eff[] = [];
  for (const [key, v] of Object.entries(m ?? {}) as [keyof Mods, unknown][]) {
    if (key === 'groupPct') {
      for (const [g, n] of Object.entries(v as Record<string, number>))
        if (n) out.push({ icon: 'production', n: n * k, pct: true, title: `${g} buildings` });
      continue;
    }
    const n = (v as number) * k;
    if (!n || !MOD_ICON[key]) continue;
    const [icon, title, down] = MOD_ICON[key];
    out.push({ icon, n, title, down, pct: key.endsWith('Pct') || key === 'workers' });
  }
  return out;
}

/** What a policy side does, beyond its mods: noble unrest, settler cost, crisis odds. */
export function sideEffs(s: PolicySide): Eff[] {
  const out = modEffs(s.mods);
  if (s.unrest) out.push({ icon: 'dynasties', n: s.unrest, down: true, title: 'noble unrest a turn' });
  if (s.settlerCost)
    out.push({ icon: 'settle', n: s.settlerCost * 100, pct: true, down: true, title: 'settler cost' });
  for (const [c, x] of Object.entries(s.pressure ?? {}))
    out.push({ icon: 'warning', n: (x - 1) * 100, pct: true, down: true, title: `${c} risk` });
  return out;
}

const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');
const fmtN = (n: number) => {
  const v = Math.round(Math.abs(n) * 10) / 10;
  return v === 0.5 ? '½' : String(v);
};

/** "+12% gold": the words an effect chip stands for. */
export const effText = (e: Eff) =>
  e.text ? `${e.text} ${e.title}` : `${sign(e.n)}${fmtN(e.n)}${e.pct ? '%' : ''} ${e.title}`;

export function EffChip({ e }: { e: Eff }) {
  const helps = e.down ? e.n < 0 : e.n > 0;
  const label = effText(e);
  return (
    <span className="chip" title={label} aria-label={label}>
      {e.good ? (
        <GoodIcon id={e.good} size={18} />
      ) : e.icon ? (
        <Ico name={e.icon} fallback="•" size={18} />
      ) : null}
      {e.text ? (
        <b>{e.text}</b>
      ) : (
        <span className={`delta ${e.n === 0 ? '' : helps ? 'good' : 'bad'}`}>
          {sign(e.n)}
          {fmtN(e.n)}
          {e.pct ? '%' : ''}
        </span>
      )}
    </span>
  );
}

/** A row of effect chips; `max` keeps the first few (the rest go in the detail view). */
export function EffChips({ effs, max }: { effs: Eff[]; max?: number }) {
  const shown = max ? effs.slice(0, max) : effs;
  if (!shown.length) return null;
  return (
    <span className="chips">
      {shown.map((e, i) => (
        <EffChip key={i} e={e} />
      ))}
      {max && effs.length > max ? <small className="muted">+{effs.length - max}</small> : null}
    </span>
  );
}

const WORD_ICON: Record<string, string> = {
  gold: 'gold',
  culture: 'culture',
  science: 'science',
  research: 'science',
  food: 'food',
  production: 'production',
  people: 'people',
  morale: 'morale',
  unrest: 'dynasties',
  housing: 'housing',
  growth: 'people',
  cohort: 'army',
  cohorts: 'army',
  sight: 'sight',
  opinion: 'peoples',
  tension: 'warning',
};
const GOOD_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(GOODS).map(([id, g]) => [g.name.toLowerCase(), id]),
);

/**
 * A line of effects as the engine writes them ("−25 gold, −250 people") turned into chips where
 * a part reads as "<sign><number> <thing>"; the other parts stay as short text.
 */
export function TextChips({ text }: { text: string }) {
  const parts = text
    .replace(/\.$/, '')
    .split(/[,;]\s*|\s+and\s+(?=[+−-]\d)/)
    .map(p => p.trim())
    .filter(Boolean);
  return (
    <span className="chips">
      {parts.map((p, i) => {
        const m = /^([+−-])\s?([\d.,½]+)(%?)\s+(.+)$/.exec(p);
        const word = m?.[4].split(/\s+/)[0].toLowerCase();
        const icon = word ? WORD_ICON[word] : undefined;
        const good = word ? (GOODS[word] ? word : GOOD_BY_NAME[word]) : undefined;
        if (!m || (!icon && !good))
          return (
            <small key={i} className="chip-text">
              {p}
            </small>
          );
        const n =
          (m[1] === '+' ? 1 : -1) * (m[2] === '½' ? 0.5 : Number(m[2].replace(/,/g, '')) || 0);
        return (
          <EffChip
            key={i}
            e={{ icon, good, n, pct: !!m[3], title: m[4], down: word === 'unrest' }}
          />
        );
      })}
    </span>
  );
}

/**
 * The detail window of a choice: the full effects and a Confirm button. Opened over the dialog;
 * a click outside, Back or Esc closes it.
 */
export function ChoiceDetail({
  title,
  sub,
  children,
  confirm = 'Confirm',
  disabled,
  onConfirm,
  onBack,
}: {
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  confirm?: string;
  disabled?: string | null;
  onConfirm: () => void;
  onBack: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onBack();
      }
    };
    document.addEventListener('keydown', esc, true);
    return () => document.removeEventListener('keydown', esc, true);
  }, [onBack]);
  return (
    <div
      className="modal-back nd-pop"
      onClick={e => {
        e.stopPropagation();
        onBack();
      }}
    >
      <div
        className="modal confirm nd-detail"
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {sub && <p className="muted small nd-sub">{sub}</p>}
        {children}
        <div className="nd-actions">
          <button onClick={onBack}>Back</button>
          <button
            className="primary"
            disabled={!!disabled}
            title={disabled ?? undefined}
            onClick={onConfirm}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the nation

const tagName = (t: string) => TAGS[t]?.name ?? t;
const edictEffs = (p: NationalPath): Eff[] => [
  ...(p.edict.gold ? [{ icon: 'gold', n: -p.edict.gold, title: 'gold to proclaim' }] : []),
  { icon: 'end-turn', n: 0, text: String(p.edict.cooldown), title: 'turns between uses' },
];

type Pick =
  | { kind: 'path'; p: NationalPath; locked?: boolean }
  | { kind: 'policy'; p: Policy; v: -1 | 0 | 1 };

/**
 * The nation: the directions taken, their edicts, and a direction still to choose. Opened as the
 * "Entering the age" card when the player reaches a new age.
 */
export function NationDialog({
  game,
  civ,
  age,
  report,
  onClose,
  onCrisis,
  onFaith,
  onWonders,
}: {
  game: GameState;
  civ: Civ;
  /** set when shown as the card for a newly entered age */
  age?: number;
  onCrisis: () => void;
  onFaith: () => void;
  onWonders: () => void;
  report: (r: { ok: boolean; msg?: string }) => void;
  onClose: () => void;
}) {
  const [pick, setPick] = useState<Pick | null>(null);
  const options = pathOptions(game, civ);
  const locked = lockedOptions(game, civ);
  const taken = (civ.paths ?? []).map(id => PATHS[id]).filter(Boolean);
  const sys = age ? AGE_SYSTEMS[age] : undefined;
  const opened = age ? VICTORIES.filter(v => v.opensAt === age && victoryOn(game, v.id)) : [];
  const crisis = activeCrisis(game, civ);
  const risks = crisisRisks(game, civ);
  const faith = faithById(game, civ.faith);
  const prio = civ.priority ?? 'balanced';
  // on an age card only the policy that age opens; otherwise every open lever
  const levers = age ? POLICY_LIST.filter(p => p.age === age) : openPolicies(civ);
  const back = () => setPick(null);

  const pathEffs = (p: NationalPath) => modEffs(p.mods, pathStrength(civ, p));
  const sideName = (p: Policy, v: -1 | 0 | 1) =>
    v === -1 ? p.left.name : v === 1 ? p.right.name : 'Balanced';
  const sideAt = (p: Policy, v: -1 | 0 | 1) => (v === -1 ? p.left : v === 1 ? p.right : null);

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal nation"
        role="dialog"
        aria-modal="true"
        aria-label={age ? `Entering the ${ERAS[age]} age` : 'Nation'}
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            {age ? `Entering the ${ERAS[age]} Age` : 'Nation'}{' '}
            {sys && (
              <small>
                {sys.system}{' '}
                <InfoButton label={`About the ${ERAS[age!]} age`}>{sys.text}</InfoButton>
              </small>
            )}
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {!age && (
          <div className="nd-status">
            <button className="link" onClick={onCrisis} title="Crises">
              <Ico name="warning" fallback="!" />{' '}
              {crisis ? (
                <b>
                  {crisis.def.name} · {crisis.left} turns
                  {crisis.state.response ? '' : ' · answer'}
                </b>
              ) : risks.length ? (
                `${risks[0].def.name} ${Math.round(risks[0].value * 100)}%`
              ) : (
                'No crisis'
              )}
            </button>
            <button className="link" onClick={onFaith} title="Faith">
              <Ico name="sun" fallback="☀" />{' '}
              {faith
                ? faith.name
                : !foundProblem(game, civ.id)
                  ? 'Found a faith'
                  : 'No faith'}
              {faith && tenetDue(game, civ.id) ? ' · choose a tenet' : ''}
            </button>
            <button className="link" onClick={onWonders} title="World wonders held">
              <Ico name="laurel" fallback="♜" /> {wondersOf(game, civ.id).length} wonders
            </button>
          </div>
        )}
        {opened.length > 0 && (
          <p className="small">
            <Ico name="laurel" fallback="★" /> Victories open: <b>{opened.map(v => v.name).join(', ')}</b>
          </p>
        )}

        {options.length > 0 && (
          <>
            <h3>
              National direction{' '}
              <InfoButton label="About directions">
                Lasts the whole game and brings an edict. ×1.5 when your culture leans its way.
              </InfoButton>
            </h3>
            <div className="path-choices">
              {options.map(p => (
                <PathCard
                  key={p.id}
                  p={p}
                  civ={civ}
                  effs={pathEffs(p)}
                  onOpen={() => setPick({ kind: 'path', p })}
                />
              ))}
              {locked.map(p => (
                <PathCard
                  key={p.id}
                  p={p}
                  civ={civ}
                  effs={pathEffs(p)}
                  locked
                  onOpen={() => setPick({ kind: 'path', p, locked: true })}
                />
              ))}
            </div>
          </>
        )}

        {!age && (
          <>
            <h3>
              Empire priority{' '}
              <InfoButton label="About empire priority">
                What governed settlements and automated settlers work toward.
                <br />
                <b>{PRIORITIES[prio].name}:</b> {PRIORITIES[prio].note}
              </InfoButton>
            </h3>
            <div className="setting-opts priority-opts">
              {(Object.keys(PRIORITIES) as (keyof typeof PRIORITIES)[]).map(k => (
                <button
                  key={k}
                  className={prio === k ? 'on' : ''}
                  title={PRIORITIES[k].note}
                  onClick={() => report(setPriority(game, civ.id, k))}
                >
                  {PRIORITIES[k].name}
                </button>
              ))}
            </div>
          </>
        )}
        {levers.length > 0 && (
          <>
            <h3>
              {age ? 'New policy' : 'Policies'}{' '}
              <InfoButton label="About policies">
                One lever per age; earlier ones stay in force. Balanced: no effect. Each side gives
                and costs. Movable again after {POLICY_COOLDOWN} turns.
              </InfoButton>
            </h3>
            <div className="policies">
              {levers.map(p => {
                const pos = positionOf(civ, p.id);
                const why = policyProblem(game, civ, p.id);
                return (
                  <section key={p.id} className="policy">
                    <div className="policy-head">
                      <b title={p.question}>{p.name}</b>
                      {why && pos !== 0 ? <small className="muted"> · {why}</small> : null}
                    </div>
                    <div className="policy-lever" role="radiogroup" aria-label={p.name}>
                      {([-1, 0, 1] as const).map(v => {
                        const side = sideAt(p, v);
                        return (
                          <button
                            key={v}
                            role="radio"
                            aria-checked={pos === v}
                            className={pos === v ? 'on' : ''}
                            disabled={pos !== v && !!why}
                            title={why ?? (side ? side.effects : 'No effect')}
                            onClick={() => pos !== v && setPick({ kind: 'policy', p, v })}
                          >
                            <span>{sideName(p, v)}</span>
                            {side && <EffChips effs={sideEffs(side)} max={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}

        {taken.length > 0 && (
          <>
            <h3>Your directions</h3>
            <div className="path-taken">
              {taken.map(p => {
                const why = edictProblem(game, civ, p.id);
                return (
                  <section key={p.id} className="path-card taken">
                    <b>
                      {p.name}
                      {pathStrength(civ, p) > 1 ? (
                        <small className="muted" title={`×1.5 with ${tagName(p.synergy)}`}>
                          {' '}
                          ×1.5
                        </small>
                      ) : null}
                    </b>
                    <EffChips effs={pathEffs(p)} />
                    <span className="nd-edict">
                      <button
                        className="secondary"
                        disabled={!!why}
                        title={why ?? p.edict.text}
                        onClick={() => report(useEdict(game, civ.id, p.id))}
                      >
                        {p.edict.name}
                      </button>
                      <EffChips effs={edictEffs(p)} />
                      <InfoButton label={`About ${p.edict.name}`} align="right">
                        {p.edict.text}
                      </InfoButton>
                    </span>
                    {why && <small className="muted">{why}</small>}
                  </section>
                );
              })}
            </div>
          </>
        )}
        {!options.length && !taken.length && (
          <p className="muted small">Directions: Classical and Renaissance ages.</p>
        )}
        {age && !options.length && (
          <button className="primary" onClick={onClose}>
            Onward
          </button>
        )}
      </div>

      {pick?.kind === 'path' && (
        <ChoiceDetail
          title={pick.p.name}
          sub={pick.p.pitch}
          confirm="Choose"
          disabled={pick.locked ? `Offered only ${pick.p.needsText}.` : null}
          onBack={back}
          onConfirm={() => {
            report(choosePath(game, civ.id, pick.p.id));
            setPick(null);
            onClose();
          }}
        >
          <EffChips effs={pathEffs(pick.p)} />
          <ul className="nd-list">
            {pick.p.effects.map(e => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <h3>
            Edict: {pick.p.edict.name} <EffChips effs={edictEffs(pick.p)} />
          </h3>
          <p className="small">{pick.p.edict.text}</p>
          <p className="small muted">
            {pick.locked
              ? `Offered only ${pick.p.needsText}.`
              : `×1.5 with ${tagName(pick.p.synergy)} culture${pathStrength(civ, pick.p) > 1 ? ' (yours)' : ''}.`}
          </p>
        </ChoiceDetail>
      )}
      {pick?.kind === 'policy' && (
        <ChoiceDetail
          title={`${pick.p.name}: ${sideName(pick.p, pick.v)}`}
          sub={pick.p.question}
          confirm="Confirm"
          disabled={policyProblem(game, civ, pick.p.id)}
          onBack={back}
          onConfirm={() => {
            report(setPolicy(game, civ.id, pick.p.id, pick.v));
            setPick(null);
          }}
        >
          {(side =>
            side ? (
              <>
                <EffChips effs={sideEffs(side)} />
                <p className="small">{side.effects}.</p>
              </>
            ) : (
              <p className="small">No effect.</p>
            ))(sideAt(pick.p, pick.v))}
          <p className="small muted">Locked for {POLICY_COOLDOWN} turns once moved.</p>
        </ChoiceDetail>
      )}
    </div>
  );
}

function PathCard({
  p,
  civ,
  effs,
  locked,
  onOpen,
}: {
  p: NationalPath;
  civ: Civ;
  effs: Eff[];
  locked?: boolean;
  onOpen: () => void;
}) {
  const strong = pathStrength(civ, p) > 1;
  return (
    <button
      className={`path-card ${locked ? 'locked' : ''}`}
      aria-disabled={locked || undefined}
      title={locked ? `Offered only ${p.needsText}.` : p.pitch}
      onClick={onOpen}
    >
      <b>
        {locked && <Ico name="lock" fallback="🔒" size={14} />} {p.name}
        {p.needs ? <span className="path-alt"> alt</span> : null}
      </b>
      <EffChips effs={effs} max={4} />
      <small className="muted nd-edict-line">
        <Ico name="scroll" fallback="✉" size={14} /> {p.edict.name}
        {strong ? ' · ×1.5' : ''}
      </small>
    </button>
  );
}
