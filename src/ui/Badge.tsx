import { emblemOf } from '../data/rulers.ts';
import type { Civ } from '../engine/types.ts';
import { artUrl } from '../render/art.ts';

import { SHIELD_PATH } from './shield.ts';

/**
 * A people's badge: a shield in its colour with its emblem on it, or its initial while the emblem
 * has no art. Peoples without a ruler (free peoples, older saves) show their initial.
 */
export function Badge({
  colour,
  emblem,
  name,
  size = 22,
  title,
}: {
  colour: string;
  emblem?: string;
  name: string;
  size?: number;
  title?: string;
}) {
  const url = emblem ? artUrl(emblem) : undefined;
  return (
    <span
      className="badge"
      style={{ width: size, height: size }}
      title={title ?? name}
      aria-label={title ?? name}
      role="img"
    >
      <svg viewBox="0 0 100 100" aria-hidden>
        <path d={SHIELD_PATH} fill={colour} stroke="#2a2016" strokeWidth={6} />
        <path
          d="M16 11 H84 V44 C84 66 68 80 50 88"
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={4}
        />
      </svg>
      {url ? (
        <img src={url} alt="" />
      ) : (
        <b style={{ fontSize: size * 0.45 }}>{name.slice(0, 1).toUpperCase()}</b>
      )}
    </span>
  );
}

/** The badge of a people as the game knows it. */
export function CivBadge({ civ, size }: { civ: Civ; size?: number }) {
  return <Badge colour={civ.color} emblem={emblemOf(civ.ruler)} name={civ.name} size={size} />;
}
