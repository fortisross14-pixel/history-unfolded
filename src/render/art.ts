/**
 * The art manifest written by tools/cut_sprites.py: which generated sprites exist. Anything
 * missing falls back to the built-in art, so the game works with any part of the art set.
 */
const BASE = `${import.meta.env.BASE_URL}sprites/`;

export interface ArtEntry {
  path: string;
  w: number;
  h: number;
}

let manifest: Record<string, ArtEntry> = {};

export async function loadArtManifest(): Promise<Record<string, ArtEntry>> {
  try {
    const r = await fetch(`${BASE}art-manifest.json`, { cache: 'no-cache' });
    if (r.ok) manifest = await r.json();
  } catch {
    manifest = {};
  }
  return manifest;
}

export const hasArt = (key: string) => key in manifest;
/** URL of a generated sprite, e.g. artUrl('tech/archery'), or undefined if it has not been made. */
export const artUrl = (key: string): string | undefined =>
  manifest[key] ? BASE + manifest[key].path : undefined;
export const artKeys = () => Object.keys(manifest);
