import type { DigestRow, NightDigest } from '../digest/types.js';

const MARK = '\u2014';

export function DigestPage({ night, digest }: { night: string; digest: NightDigest }) {
  const empty = digest.rows.length === 0 && digest.badLines === 0;
  return (
    <>
      <h1>digest · {night}</h1>
      {empty ? (
        <p>nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => (
              <tr class={marked(row) ? 'warn' : ''}>
                <td>{row.job}</td>
                <td>{row.owner ?? MARK}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError ?? MARK}</td>
                <td>{row.first}</td>
                <td>{row.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {digest.badLines > 0 ? <p class="mute">{digest.badLines} unreadable</p> : null}
    </>
  );
}

function marked(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}
