import fs from 'node:fs';
import path from 'node:path';

export function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Resolves segments below root; throws if the result escapes root. */
export function resolveInside(root: string, ...segments: string[]): string {
  const resolved = path.resolve(root, ...segments);
  if (!isInside(root, resolved)) throw new Error('Path escapes the permitted root');
  return resolved;
}

/** Like resolveInside but also follows symlinks on disk. */
export function realpathInside(root: string, candidate: string): string {
  const realRoot = fs.realpathSync(root);
  const real = fs.realpathSync(candidate);
  if (!isInside(realRoot, real)) throw new Error('Path escapes the permitted root');
  return real;
}

/** Validates a user-supplied relative path (artifact download) without touching disk. */
export function sanitizeRelativePath(input: string): string {
  if (!input || input.length > 1024 || input.includes('\0') || input.includes('\\') || input.startsWith('/')) {
    throw new Error('Invalid relative path');
  }
  const parts = input.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..')) throw new Error('Invalid relative path');
  return parts.join('/');
}

export interface PathMapping {
  label: string;
  /** Directory as seen by the backend container. */
  backend: string;
  /** The same directory as seen by the Headless Bob container. */
  bob: string;
}

/**
 * Translates backend paths into the paths Headless Bob sees. The Bob container
 * never shares the backend filesystem implicitly: only directories listed here
 * (shared volumes) are considered reachable from Bob.
 */
export class PathMapper {
  constructor(private readonly mappings: PathMapping[]) {}

  list(): readonly PathMapping[] {
    return this.mappings;
  }

  toBob(backendPath: string): string | null {
    const resolved = path.resolve(backendPath);
    let best: PathMapping | undefined;
    for (const mapping of this.mappings) {
      if (isInside(path.resolve(mapping.backend), resolved)) {
        if (!best || mapping.backend.length > best.backend.length) best = mapping;
      }
    }
    if (!best) return null;
    const rel = path.relative(path.resolve(best.backend), resolved);
    return rel ? path.posix.join(best.bob, ...rel.split(path.sep)) : best.bob;
  }
}
