import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';
import type { RigConfig } from '../src/config.js';

function config(runsDir: string): RigConfig {
  return { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
}

function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

const line = (job: string, status: string) =>
  JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job, status, owner: 'rook' });

describe('digest routes', () => {
  it('returns 200 for a night and the same jobs in the same order as JSON', async () => {
    const runsDir = tempRuns({
      '2026-10-28.jsonl': `${line('zeta', 'ok')}\n${line('alpha', 'fail')}\n`,
    });
    const app = createApp(config(runsDir));
    const page = await app.request('/digest/2026-10-28');
    const api = await app.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    const html = await page.text();
    const body = (await api.json()) as NightDigest;
    expect(body.rows.map((row) => row.job)).toEqual(['alpha', 'zeta']);
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zeta'));
    expect(html).toContain('class="warn"');
  });

  it('returns 404 when the night file is missing', async () => {
    const runsDir = tempRuns({});
    const app = createApp(config(runsDir));
    expect((await app.request('/digest/2026-10-28')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-28')).status).toBe(404);
  });

  it('renders nothing ran for an empty night', async () => {
    const runsDir = tempRuns({ '2026-10-28.jsonl': '' });
    const app = createApp(config(runsDir));
    const page = await app.request('/digest/2026-10-28');
    const api = await app.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(await api.json()).toMatchObject({ rows: [], badLines: 0 });
  });

  it('renders a night that contains a bad line', async () => {
    const runsDir = tempRuns({
      '2026-10-28.jsonl': `${line('lane/sync', 'ok')}\n{"at":"2026-10-28T02:00:00+01:00","job":"lane/sy\n`,
    });
    const app = createApp(config(runsDir));
    const page = await app.request('/digest/2026-10-28');
    const api = await app.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('lane/sync');
    expect(html).toContain('1 unreadable');
    const body = (await api.json()) as NightDigest;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((row) => row.job)).toEqual(['lane/sync']);
  });

  it('links both fixture nights to a digest that renders', async () => {
    const app = createApp(config('runs'));
    const board = await app.request('/');
    const html = await board.text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('10 ok / 4 retry / 1 fail');
    expect(html).toContain('7 ok / 0 retry / 0 fail');
    expect((await app.request('/digest/2026-10-28')).status).toBe(200);
    expect((await app.request('/digest/2026-10-27')).status).toBe(200);
  });

  it('keeps 2026-10-28 page and JSON jobs in the same order', async () => {
    const app = createApp(config('runs'));
    const page = await app.request('/digest/2026-10-28');
    const api = await app.request('/api/digest/2026-10-28');
    const html = await page.text();
    const body = (await api.json()) as NightDigest;
    const jobs = body.rows.map((row) => row.job);
    expect(jobs).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    let from = 0;
    for (const job of jobs) {
      const at = html.indexOf(job, from);
      expect(at).toBeGreaterThanOrEqual(0);
      from = at + job.length;
    }
  });
});
