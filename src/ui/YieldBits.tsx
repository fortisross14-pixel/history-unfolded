import { GOODS } from '../data/goods.ts';
import { GROUPS, SLOT_TYPES } from '../data/slots.ts';
import {
  cityBuildings,
  cityGoodFlows,
  whyCityGood,
  whyCityYield,
  YIELD_KEYS,
  YIELD_NAME,
  type BuildingRow,
  type GoodFlow,
  type YieldKey,
} from '../engine/breakdown.ts';
import { cityEconomy, powderNeed, type CityEconomy } from '../engine/economy.ts';
import type { City, GameState } from '../engine/types.ts';
import { Art, Delta, GoodIcon, Ico } from './bits.tsx';
import { WhyPop } from './WhyPop.tsx';
import './r4-yields.css';

const ICON: Record<YieldKey, string> = {
  food: 'food',
  prod: 'production',
  science: 'science',
  gold: 'gold',
  culture: 'culture',
};
const r1 = (n: number) => Math.round(n * 10) / 10;

/** One good's net a turn in a settlement, as a chip that answers "why?". */
export function GoodNet({
  game,
  c,
  f,
  e,
}: {
  game: GameState;
  c: City;
  f: GoodFlow;
  e?: CityEconomy;
}) {
  const name = GOODS[f.good]?.name ?? f.good;
  return (
    <WhyPop
      className="yl-net"
      title={`${name} a turn`}
      unit=""
      why={() => whyCityGood(game, c, f.good, e)}
    >
      <span className="chip" tabIndex={0} aria-label={`${name} ${r1(f.net)} a turn`}>
        <GoodIcon id={f.good} size={18} />
        <Delta n={f.net} />
      </span>
    </WhyPop>
  );
}

/** Every good the settlement makes or uses, signed, each with its breakdown. */
export function GoodNets({ game, c, e }: { game: GameState; c: City; e?: CityEconomy }) {
  const flows = cityGoodFlows(game, c, e).filter(f => Math.abs(f.net) >= 0.05);
  if (!flows.length) return <span className="muted">—</span>;
  return (
    <span className="yl-nets">
      {flows.map(f => (
        <GoodNet key={f.good} game={game} c={c} f={f} e={e} />
      ))}
    </span>
  );
}

/** A yield a turn that answers "why?" with its sources by building. */
export function YieldWhy({
  game,
  c,
  k,
  e,
}: {
  game: GameState;
  c: City;
  k: YieldKey;
  e: CityEconomy;
}) {
  const v = k === 'food' ? e.surplus : e.total[k];
  return (
    <WhyPop
      className="yl-y"
      title={`${YIELD_NAME[k]} a turn`}
      unit=""
      why={() => whyCityYield(game, c, k, e)}
    >
      <span className="chip" tabIndex={0} aria-label={`${YIELD_NAME[k]} a turn`}>
        <Ico name={ICON[k]} fallback="•" size={20} />
        {k === 'food' ? <Delta n={v} /> : <b>{r1(v)}</b>}
      </span>
    </WhyPop>
  );
}

/** A building's makings: yields then goods, green; and what it takes, red. */
function Makes({
  m,
}: {
  m: BuildingRow['makes'] | (Record<YieldKey, number> & { goods: Record<string, number> });
}) {
  const ys = YIELD_KEYS.filter(k => r1(m[k]));
  const gs = Object.entries(m.goods).filter(([, n]) => r1(n));
  if (!ys.length && !gs.length) return <span className="muted">—</span>;
  return (
    <>
      {ys.map(k => (
        <span key={k} className="yl-c" title={YIELD_NAME[k]}>
          <Ico name={ICON[k]} fallback="•" size={16} />
          <Delta n={m[k]} />
        </span>
      ))}
      {gs.map(([g, n]) => (
        <span key={g} className="yl-c" title={GOODS[g]?.name ?? g}>
          <GoodIcon id={g} size={16} />
          <Delta n={n} />
        </span>
      ))}
    </>
  );
}
function Takes({ goods }: { goods: Record<string, number> }) {
  const gs = Object.entries(goods).filter(([, n]) => r1(n));
  if (!gs.length) return <span className="muted">—</span>;
  return (
    <>
      {gs.map(([g, n]) => (
        <span key={g} className="yl-c" title={GOODS[g]?.name ?? g}>
          <GoodIcon id={g} size={16} />
          <Delta n={-n} />
        </span>
      ))}
    </>
  );
}

function BuildingPic({ type }: { type: string }) {
  const t = SLOT_TYPES[type];
  return (
    <Art
      k={`building/${type}`}
      size={26}
      fallback={
        <span className="cell-glyph" style={{ background: GROUPS[t.group].color }}>
          {t.glyph}
        </span>
      }
    />
  );
}

const rateNote = (b: BuildingRow) =>
  b.staffed && b.rate < 1 && !b.idle ? (b.rate <= 0.34 ? '⅓' : '½') : '';

/**
 * The settlement's production at a glance: every building with what it takes and makes, why it
 * idles, the settlement-wide changes and the totals; then each good, who makes and who uses it.
 */
export function ProductionView({ game, c }: { game: GameState; c: City }) {
  const e = cityEconomy(game, c);
  const rows = cityBuildings(game, c, e);
  const flows = cityGoodFlows(game, c, e);
  const districts = [...new Set(rows.map(r => r.districtId))];
  const nothing = { food: 0, prod: 0, science: 0, gold: 0, culture: 0, goods: {} };
  // hearths, homes, the army and the open land, as rows beside the buildings
  const extra: {
    key: string;
    label: string;
    icon: string;
    takes: Record<string, number>;
    makes: BuildingRow['makes'];
  }[] = [];
  const sub = e.subsistence;
  if (YIELD_KEYS.some(k => r1(sub[k])) || Object.keys(sub.goods).length)
    extra.push({
      key: 'land',
      label: 'Open land',
      icon: 'food',
      takes: {},
      makes: {
        food: sub.food,
        prod: sub.prod,
        science: sub.science,
        gold: sub.gold,
        culture: sub.culture,
        goods: sub.goods,
      },
    });
  if (e.fuel.need && e.fuel.good)
    extra.push({
      key: 'fuel',
      label: 'Hearths',
      icon: 'housing',
      takes: { [e.fuel.good]: e.fuel.need },
      makes: nothing,
    });
  if (Object.keys(e.comfort.got).length)
    extra.push({
      key: 'homes',
      label: 'Homes (comforts)',
      icon: 'gift',
      takes: e.comfort.got,
      makes: nothing,
    });
  const army =
    game.cities.find(x => x.civId === c.civId)?.id === c.id ? powderNeed(game, c.civId) : 0;
  if (army)
    extra.push({
      key: 'army',
      label: 'Army (powder)',
      icon: 'melee',
      takes: { saltpeter: army },
      makes: nothing,
    });
  const used: Record<string, number> = {};
  for (const f of flows) {
    const u = -f.used.reduce((a, l) => a + l.value, 0);
    if (u) used[f.good] = u;
  }
  const steps = e.steps.filter(s => s.label !== 'Rounding');
  return (
    <div className="yl">
      <div className="chips dc-yields yl-yields">
        {YIELD_KEYS.map(k => (
          <YieldWhy key={k} game={game} c={c} k={k} e={e} />
        ))}
        <span className="chip muted" title="Workers busy">
          <Ico name="workers" fallback="•" size={18} />
          <b>
            {e.workersUsed.toLocaleString()}/{e.workers.toLocaleString()}
          </b>
        </span>
      </div>
      <div className="yl-table" role="table" aria-label="Buildings">
        <div className="yl-row yl-head" role="row">
          <span />
          <span>Building</span>
          <span title="Workers" aria-label="Workers">
            <Ico name="workers" fallback="•" size={16} />
          </span>
          <span>Takes</span>
          <span>Makes</span>
          <span />
        </div>
        {districts.map(id => {
          const ds = rows.filter(r => r.districtId === id);
          return (
            <div key={id} className="yl-group" role="rowgroup">
              <div className="yl-dist">
                {ds[0].district}
                {ds[0].centre ? <small className="muted"> · centre</small> : null}
              </div>
              {ds.map(b => (
                <div
                  key={b.slot}
                  className={`yl-row ${b.idle ? (b.staffed ? 'slow' : 'idle') : ''}`}
                  role="row"
                  data-type={b.type}
                >
                  <BuildingPic type={b.type} />
                  <span className="yl-name">{b.name}</span>
                  <span className="yl-w" title="Workers">
                    {b.labour ? `${b.workers}/${b.labour}` : ''}
                  </span>
                  <span className="yl-takes">
                    <Takes goods={b.takes} />
                  </span>
                  <span className="yl-makes">
                    <Makes m={b.makes} />
                  </span>
                  <span className="yl-why">
                    {b.idle ? (
                      <span className="bad">
                        {b.idle}
                        {b.staffed ? ' · ⅓' : ''}
                      </span>
                    ) : rateNote(b) ? (
                      <span className="muted" title={b.note}>
                        {rateNote(b)}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
        {extra.length > 0 && (
          <div className="yl-group" role="rowgroup">
            <div className="yl-dist">Settlement</div>
            {extra.map(x => (
              <div key={x.key} className="yl-row" role="row">
                <Ico name={x.icon} fallback="•" size={22} />
                <span className="yl-name">{x.label}</span>
                <span className="yl-w" />
                <span className="yl-takes">
                  <Takes goods={x.takes} />
                </span>
                <span className="yl-makes">
                  <Makes m={x.makes} />
                </span>
                <span />
              </div>
            ))}
          </div>
        )}
        {steps.length > 0 && (
          <div className="yl-group" role="rowgroup">
            {steps.map(st => (
              <div key={st.label} className="yl-row yl-step" role="row">
                <span />
                <span className="yl-name">{st.label}</span>
                <span className="yl-w" />
                <span className="yl-takes" />
                <span className="yl-makes">
                  <Makes m={st.d} />
                </span>
                <span />
              </div>
            ))}
          </div>
        )}
        <div className="yl-row yl-total" role="row">
          <span />
          <span className="yl-name">Total</span>
          <span className="yl-w">{e.workersUsed || ''}</span>
          <span className="yl-takes">
            <Takes goods={used} />
          </span>
          <span className="yl-makes">
            <Makes m={e.total} />
          </span>
          <span />
        </div>
      </div>

      <h3 className="dc-h">Goods</h3>
      {flows.length ? (
        <table className="yl-goods ledger">
          <thead>
            <tr>
              <th>Good</th>
              <th>Made by</th>
              <th>Used by</th>
              <th title="Net a turn">Net</th>
              <th title="In store" aria-label="In store">
                <Ico name="goods" fallback="▣" size={16} />
              </th>
              <th title="Turns until it runs out" aria-label="Turns until it runs out">
                <Ico name="hourglass" fallback="⌛" size={16} />
              </th>
            </tr>
          </thead>
          <tbody>
            {flows.map(f => (
              <tr key={f.good} className={f.marketNet < 0 ? 'short' : ''}>
                <td>
                  <GoodIcon id={f.good} /> <span className="yl-gname">{GOODS[f.good]?.name}</span>
                </td>
                <td className="yl-by">
                  {f.made.map(l => (
                    <span key={l.label}>
                      {l.label} <Delta n={l.value} />
                    </span>
                  ))}
                </td>
                <td className="yl-by">
                  {f.used.map(l => (
                    <span key={l.label}>
                      {l.label} <Delta n={l.value} />
                    </span>
                  ))}
                  {f.traded ? (
                    <span>
                      Trade <Delta n={f.traded} />
                    </span>
                  ) : null}
                </td>
                <td>
                  <GoodNet game={game} c={c} f={f} e={e} />
                </td>
                <td>{Math.floor(f.store)}</td>
                <td className={f.turnsLeft !== null && f.turnsLeft < 10 ? 'bad' : 'muted'}>
                  {f.turnsLeft === null ? '' : f.turnsLeft ? `${f.turnsLeft}t` : 'out'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">—</p>
      )}
    </div>
  );
}
