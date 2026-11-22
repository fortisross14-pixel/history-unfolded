import { artUrl } from '../render/art.ts';
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

/** Interface names whose generated art (icon/<key>) is drawn under another key. */
const ART_ALIAS: Record<string, string> = {
  research: 'science',
  goods: 'ledger',
  report: 'load',
  flag: 'levy',
  split: 'split',
};
/** The generated icon for an interface name, if the art set has one. */
export const iconArt = (name: string) => artUrl(`icon/${ART_ALIAS[name] ?? name}`);
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

/**
 * An interface icon: the generated icon art where it exists, else a line icon in the current text
 * colour. `line` keeps the line icon (white on teal, where coloured art would not read).
 */
export function Icon({
  name,
  size,
  className = '',
  title,
  line = false,
}: {
  name: string;
  size?: number;
  className?: string;
  title?: string;
  line?: boolean;
}) {
  const art = line ? undefined : iconArt(name);
  if (art)
    return (
      <img
        className={`icon icon-art ${className}`}
        src={art}
        alt={title ?? ''}
        title={title}
        style={size ? { height: size, width: 'auto' } : undefined}
        draggable={false}
      />
    );
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
