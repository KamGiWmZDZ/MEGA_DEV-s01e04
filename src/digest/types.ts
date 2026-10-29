import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  first: string;
  last: string;
};

export type StatusCounts = {
  ok: number;
  retry: number;
  fail: number;
};

export type NightDigest = {
  rows: DigestRow[];
  badLines: number;
  counts: StatusCounts;
};

type RunEvent = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

export function readNight(runsDir: string, night: string): NightDigest | null {
  if (!NIGHT.test(night)) return null;
  const path = join(runsDir, `${night}.jsonl`);
  if (!existsSync(path)) return null;

  const text = readFileSync(path, 'utf8');
  if (text.length === 0) {
    return { rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } };
  }

  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();

  const byJob = new Map<string, RunEvent[]>();
  let badLines = 0;
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };

  for (const line of lines) {
    const event = parseLine(line);
    if (!event) {
      badLines += 1;
      continue;
    }
    counts[event.status] += 1;
    const group = byJob.get(event.job);
    if (group) group.push(event);
    else byJob.set(event.job, [event]);
  }

  const rows = [...byJob.values()].map(toRow).sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines, counts };
}

function toRow(events: RunEvent[]): DigestRow {
  const ordered = [...events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const last = ordered.at(-1)!;
  return {
    job: last.job,
    owner: last.owner,
    runs: ordered.length,
    retries: ordered.filter((event) => event.status === 'retry').length,
    lastStatus: last.status,
    lastError: last.error,
    first: ordered[0]!.at,
    last: last.at,
  };
}

function parseLine(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.at !== 'string' || typeof row.job !== 'string' || !isStatus(row.status)) return null;
  if (!('owner' in row) || (row.owner !== null && typeof row.owner !== 'string')) return null;
  if ('error' in row && row.error !== undefined && row.error !== null && typeof row.error !== 'string') return null;
  return {
    at: row.at,
    job: row.job,
    status: row.status,
    owner: row.owner,
    error: typeof row.error === 'string' ? row.error : null,
  };
}

function isStatus(value: unknown): value is RunStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}
