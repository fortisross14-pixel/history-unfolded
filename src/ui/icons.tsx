import { ICON_SYMBOLS } from './iconSymbols.ts';

/** Interface names (the keys art sheets use, icon/<name>) mapped to the built-in line icons. */
const ALIAS: Record<string, string> = {
  gold: 'coin',
  science: 'flask',
  research: 'flask',
  culture: 'lyre',
  people: 'people',
  peoples: 'people',
  army: 'swords',
  war: 'swords',
  cities: 'tower',
  city: 'tower',
  melee: 'sword',
  ranged: 'bow',
  charge: 'charge',
  protection: 'shield',
  morale: 'flag',
  upkeep: 'coin',
  food: 'wheat',
  production: 'hammer',
  housing: 'house',
  moves: 'boot',
  sight: 'eye',
  designs: 'helm',
  dynasties: 'crown',
  goods: 'crate',
  report: 'scroll',
  notices: 'bell',
  'end-turn': 'hourglass',
  fortify: 'palisade',
  road: 'road',
  equip: 'anvil',
  'go-to': 'target',
  peace: 'olive',
  gift: 'gift',
  settings: 'menu',
  quit: 'door',
};

export const iconName = (name: string) => ALIAS[name] ?? name;
export const hasIcon = (name: string) => iconName(name) in ICON_SYMBOLS;

/** Mount once: the sprite every <Icon> points into. */
export function IconSprite() {
  const defs = Object.entries(ICON_SYMBOLS)
    .map(([id, [vb, body]]) => `<symbol id="i-${id}" viewBox="${vb}">${body}</symbol>`)
    .join('');
  return (
    <svg
      aria-hidden
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      dangerouslySetInnerHTML={{ __html: `<defs>${defs}</defs>` }}
    />
  );
}

/** A line icon in the current text colour. */
export function Icon({
  name,
  size,
  className = '',
  title,
}: {
  name: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const id = iconName(name);
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <use href={`#i-${id}`} />
    </svg>
  );
}
