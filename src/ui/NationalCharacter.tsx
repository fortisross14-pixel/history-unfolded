import type { Civilization, WorldState } from '../types.ts';
import { AXES, describeNation } from '../engine/axes.ts';
import { other } from '../engine/diplomacy.ts';
import { displayYear } from '../engine/index.ts';
import { type Sel, Section, List } from './shared.tsx';

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 78;

/** Point for axis i at value v (0–100) on the pentagon. */
function point(i: number, v: number) {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
  const r = (v / 100) * RADIUS;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

/** Five-axis radar: the right-hand word of each axis sits at the tip. */
export function Radar({ c }: { c: Civilization }) {
  const shape = AXES.map((a, i) => point(i, c.axes[a.key]).join(',')).join(' ');
  return (
    <svg
      className="radar"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="National character"
    >
      {[25, 50, 75, 100].map(ring => (
        <polygon
          key={ring}
          className="radar-ring"
          points={AXES.map((_, i) => point(i, ring).join(',')).join(' ')}
        />
      ))}
      {AXES.map((a, i) => {
        const [x, y] = point(i, 100);
        const [lx, ly] = point(i, 128);
        return (
          <g key={a.key}>
            <line className="radar-spoke" x1={CENTER} y1={CENTER} x2={x} y2={y} />
            <text className="radar-label" x={lx} y={ly} textAnchor="middle">
              {a.high}
            </text>
          </g>
        );
      })}
      <polygon className="radar-shape" points={shape} style={{ fill: c.color, stroke: c.color }} />
    </svg>
  );
}

export function NationalCharacter({ c }: { c: Civilization }) {
  return (
    <Section title="National character">
      <p className="nation-sentence">{describeNation(c)}</p>
      <div className="nation-grid">
        <Radar c={c} />
        <div className="axis-bars">
          {AXES.map(a => (
            <div className="axis-bar" key={a.key}>
              <div>
                <span>{a.low}</span>
                <strong>{a.label}</strong>
                <span>{a.high}</span>
              </div>
              <div className="axis-track">
                <i style={{ left: `${c.axes[a.key]}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

const RELATION_TEXT = {
  Alliance: 'Ally',
  Marriage: 'Royal marriage',
  Vassal: 'Vassal',
  Rival: 'Rival',
  Truce: 'Truce',
} as const;

export function Diplomacy({
  c,
  world,
  open,
}: {
  c: Civilization;
  world: WorldState;
  open: (s: Sel) => void;
}) {
  const relations = world.relations.filter(rel => rel.a === c.id || rel.b === c.id);
  const label = (rel: (typeof relations)[number]) => {
    if (rel.type !== 'Vassal') return RELATION_TEXT[rel.type];
    const kind = rel.union ? 'personal union' : 'vassal';
    return rel.a === c.id ? `Overlord of (${kind})` : `Subject of (${kind})`;
  };
  return (
    <Section title="Diplomacy">
      <List
        items={relations.map(rel => {
          const partner = world.civilizations.find(x => x.id === other(rel, c.id));
          return {
            name: `${label(rel)} · ${partner?.name ?? 'a lost realm'}`,
            sub: `Since ${displayYear(rel.since)}${rel.until ? ` until ${displayYear(rel.until)}` : ''} · ${rel.reason}${rel.wars ? ` · ${rel.wars} wars` : ''}`,
            onClick: partner ? () => open({ type: 'realm', id: partner.id }) : undefined,
          };
        })}
      />
    </Section>
  );
}
