import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, formatDate, ACTIVE_STATUSES, TERMINAL_STATUSES } from './format';

describe('format helpers', () => {
  it('formats durations', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(-1)).toBe('—');
    expect(formatDuration(5_000)).toBe('5s');
    expect(formatDuration(125_000)).toBe('2m 5s');
    expect(formatDuration(3_725_000)).toBe('1h 2m 5s');
  });
  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
  it('handles invalid dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('nope')).toBe('—');
    expect(formatDate('2026-01-01T00:00:00Z')).not.toBe('—');
  });
  it('keeps active and terminal statuses disjoint', () => {
    expect(ACTIVE_STATUSES.filter((s) => TERMINAL_STATUSES.includes(s))).toEqual([]);
  });
});
