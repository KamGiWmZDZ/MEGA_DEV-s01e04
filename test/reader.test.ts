import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

describe('readNight', () => {
  it('reads 2026-10-28 as 5 jobs and 1 bad line', () => {
    const digest = readNight('runs', '2026-10-28');
    expect(digest).not.toBeNull();
    expect(digest!.badLines).toBe(1);
    expect(digest!.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(digest!.counts).toEqual({ ok: 10, retry: 4, fail: 1 });

    const render = digest!.rows[0]!;
    expect(render.owner).toBeNull();
    expect(render.runs).toBe(1);
    expect(render.lastStatus).toBe('ok');
    expect(render.first).toBe('2026-10-29T05:41:09+01:00');
    expect(render.last).toBe('2026-10-29T05:41:09+01:00');

    const refresh = digest!.rows[1]!;
    expect(refresh.runs).toBe(4);
    expect(refresh.retries).toBe(3);
    expect(refresh.lastStatus).toBe('ok');
    expect(refresh.lastError).toBeNull();
    expect(refresh.first).toBe('2026-10-29T01:30:00+01:00');
    expect(refresh.last).toBe('2026-10-29T01:37:00+01:00');

    const sync = digest!.rows[2]!;
    expect(sync.runs).toBe(8);
    expect(sync.retries).toBe(1);
    expect(sync.lastStatus).toBe('ok');

    const backup = digest!.rows[3]!;
    expect(backup.owner).toBe('lane-07');
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
    expect(backup.first).toBe('2026-10-29T04:00:01+01:00');
  });

  it('returns null when the night file is missing', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });
});
