import { constants, openSync, closeSync, fstatSync, lstatSync, realpathSync, opendirSync, createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { join, basename } from 'node:path';
import type { RunManager } from './runs.js';
import type { Threads } from './threads.js';
import { ApiError } from './types.js';

export const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
function parts(path: string) {
  if (path.length > 4096 || path.includes('\\') || /[\x00-\x1f\x7f]/.test(path) || path.startsWith('/')) throw new ApiError(400, 'invalid_input', 'Use a relative workspace path');
  const result = path ? path.split('/') : [];
  if (result.length > 32 || result.some(p => !p || p.startsWith('.') || p.length > 255)) throw new ApiError(400, 'invalid_input', 'Hidden files and traversal paths are not available');
  return result;
}
function fileError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  throw new ApiError(404, 'not_found', 'File or directory is unavailable');
}
export class WorkspaceFiles {
  constructor(private manager: RunManager, private threads: Threads) {}
  private root(id: string, owner: string) {
    const thread = this.threads.get(id, owner);
    if (!thread.session_id) return null;
    const busy = this.manager.store.db.prepare("SELECT 1 FROM runs WHERE session_id=? AND json_extract(data,'$.status') NOT IN ('completed','failed','cancelled') LIMIT 1").get(thread.session_id);
    if (busy) throw new ApiError(409, 'invalid_input', 'Files are available after the active run finishes or is cancelled', 'workspace_busy');
    try { return this.manager.store.checkWorkspace(this.manager.getSession(thread.session_id, owner)); } catch { throw new ApiError(409, 'invalid_input', 'The workspace is missing or failed path validation', 'workspace_invalid'); }
  }
  /** Linux walks relative to held directory descriptors, never following links.
   * On macOS, each component is checked with O_NOFOLLOW and its canonical path.
   * This is a trusted-operator service, not a hostile local-user OS sandbox.
   */
  private directory(root: string, names: string[]) {
    const handles: number[] = [];
    let path = root;
    try {
      handles.push(openSync(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW));
      for (const name of names) {
        path = join(path, name);
        const source = process.platform === 'linux' ? `/proc/self/fd/${handles.at(-1)}/${name}` : path;
        const fd = openSync(source, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        handles.push(fd);
        if (!fstatSync(fd).isDirectory() || (process.platform !== 'linux' && realpathSync(path) !== path)) throw new Error('Invalid directory');
      }
      const fd = handles.at(-1)!;
      return { path: process.platform === 'linux' ? `/proc/self/fd/${fd}` : path, close: () => { for (const handle of handles.reverse()) closeSync(handle); } };
    } catch (error) { for (const fd of handles.reverse()) closeSync(fd); return fileError(error); }
  }
  list(id: string, owner: string, path = '') {
    const root = this.root(id, owner), names = parts(path);
    if (!root) { if (path) throw new ApiError(404, 'not_found', 'Directory not found'); return { path: '', items: [], truncated: false }; }
    const directory = this.directory(root, names);
    const items: { name: string; path: string; type: string; size: number | null; modified_at: string; downloadable: boolean; download_url?: string }[] = [];
    let truncated = false;
    try {
      const entries = opendirSync(directory.path); let inspected = 0;
      try {
        let entry;
        while ((entry = entries.readSync())) {
          if (++inspected > 2000 || items.length >= 500) { truncated = true; break; }
          if (entry.name.startsWith('.') || /[\\\x00-\x1f\x7f]/.test(entry.name)) continue;
          try {
            const stat = lstatSync(join(directory.path, entry.name));
            if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()) || (stat.isFile() && stat.nlink !== 1)) continue;
            const relative = [...names, entry.name].join('/'), downloadable = stat.isFile() && stat.size <= MAX_DOWNLOAD_BYTES;
            items.push({ name: entry.name, path: relative, type: stat.isDirectory() ? 'directory' : 'file', size: stat.isFile() ? stat.size : null, modified_at: stat.mtime.toISOString(), downloadable,
              ...(downloadable ? { download_url: `/api/v1/threads/${id}/files/download?path=${encodeURIComponent(relative)}` } : {}) });
          } catch { /* A file may disappear between directory listing and stat. */ }
        }
      } finally { entries.closeSync(); }
      items.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1);
      return { path, items, truncated };
    } catch (error) { return fileError(error); } finally { directory.close(); }
  }
  download(id: string, owner: string, path: string) {
    const root = this.root(id, owner), names = parts(path);
    if (!names.length) throw new ApiError(400, 'invalid_input', 'A file path is required');
    if (!root) throw new ApiError(404, 'not_found', 'File not found');
    const directory = this.directory(root, names.slice(0, -1));
    let fd: number | undefined;
    try {
      const filePath = join(directory.path, names.at(-1)!);
      fd = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const stat = fstatSync(fd);
      if (!stat.isFile() || stat.nlink !== 1) throw new Error('Not a regular unlinked file');
      if (process.platform !== 'linux' && realpathSync(filePath) !== join(root, ...names)) throw new Error('Invalid canonical path');
      if (stat.size > MAX_DOWNLOAD_BYTES) throw new ApiError(413, 'invalid_input', 'Downloads are limited to 25 MiB per file', 'file_too_large');
      const name = basename(path);
      const disposition = `attachment; filename="${name.replace(/[^a-zA-Z0-9._-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16)}`)}`;
      // Read only the original byte range. The fd pins the checked file inode.
      const stream = stat.size ? createReadStream('', { fd, autoClose: true, start: 0, end: stat.size - 1 }) : Readable.from([]);
      if (!stat.size) closeSync(fd);
      fd = undefined;
      return { stream, size: stat.size, disposition };
    } catch (error) { if (fd !== undefined) closeSync(fd); return fileError(error); } finally { directory.close(); }
  }
}
