import fs from 'node:fs';
import path from 'node:path';
import type { AppConfig } from '../../config/env.js';
import type { QseCandidate } from '../../models/types.js';
import { isInside } from '../../utils/paths.js';

export function isExecutableFile(p: string): boolean {
  try {
    const st = fs.statSync(p);
    if (!st.isFile()) return false;
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** True when the real path of `p` is inside one of the permitted installation directories. */
export function isAllowedLocation(p: string, allowedDirs: string[]): boolean {
  let real: string;
  try {
    real = fs.realpathSync(p);
  } catch {
    return false;
  }
  return allowedDirs.some((dir) => {
    try {
      return isInside(fs.realpathSync(dir), real);
    } catch {
      return false;
    }
  });
}

export function isAllowedName(p: string, names: string[]): boolean {
  return names.includes(path.basename(p));
}

/**
 * Safe executable discovery: only inspects the filesystem (no execution) and only
 * looks in configured locations, QSE_CLI_PATH and PATH.
 */
export function discoverCandidates(cfg: AppConfig['qse'], pathEnv = process.env.PATH ?? ''): QseCandidate[] {
  const seen = new Set<string>();
  const out: QseCandidate[] = [];
  const add = (p: string, source: QseCandidate['source']) => {
    if (!path.isAbsolute(p)) return;
    let real = p;
    try {
      real = fs.realpathSync(p);
    } catch {
      return;
    }
    if (seen.has(real)) return;
    seen.add(real);
    out.push({
      path: real,
      source,
      executable: isExecutableFile(real),
      allowed: isAllowedLocation(real, cfg.allowedDirs) && isAllowedName(real, cfg.executableNames)
    });
  };

  if (cfg.envPath) {
    const p = cfg.envPath;
    try {
      if (fs.statSync(p).isDirectory()) for (const name of cfg.executableNames) add(path.join(p, name), 'QSE_CLI_PATH');
      else add(p, 'QSE_CLI_PATH');
    } catch {
      /* missing */
    }
  }
  for (const dir of pathEnv.split(path.delimiter).filter(Boolean)) {
    for (const name of cfg.executableNames) add(path.join(dir, name), 'PATH');
  }
  for (const dir of cfg.searchDirs) {
    for (const name of cfg.executableNames) add(path.join(dir, name), 'search-dir');
  }
  return out;
}
