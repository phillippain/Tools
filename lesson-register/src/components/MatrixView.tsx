import { level, type Matrix } from '../lib/matrix';
import { plural } from '../lib/util';

/** A coverage matrix as a scrollable table: first column stays put while the rest scrolls sideways. */
export function MatrixView({ m }: { m: Matrix }) {
  const span = m.columns.length + 2;
  return (
    <div className="matrix-wrap" role="region" aria-label={m.title} tabIndex={0}>
      <table className="matrix">
        <caption>
          <strong>{m.title}</strong>
          <span className="small muted"> · {m.subtitle}</span>
        </caption>
        <thead>
          <tr>
            <th scope="col" className="rowhead">
              Outcome or content
            </th>
            {m.columns.map((c) => (
              <th key={c.id} scope="col" title={c.title}>
                {c.label}
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {m.rows.map((r) => {
            if (r.kind === 'section')
              return (
                <tr key={r.id} className="section">
                  <th scope="colgroup" colSpan={span} className="rowhead">
                    {r.label}
                  </th>
                </tr>
              );
            if (r.kind === 'group')
              return (
                <tr key={r.id} className="group">
                  <th scope="colgroup" colSpan={span} className="rowhead">
                    {r.label}
                  </th>
                </tr>
              );
            return (
              <tr key={r.id}>
                <th scope="row" className="rowhead">
                  {r.code && <strong>{r.code} </strong>}
                  {r.label}
                </th>
                {r.cells.map((c, i) => (
                  <td
                    key={m.columns[i].id}
                    className={c.count > 0 ? `m m${level(c.count)}` : c.planned ? 'm planned' : 'm'}
                    aria-label={c.count > 0 ? `${m.columns[i].label}: ${plural(c.count, 'lesson')}` : c.planned ? `${m.columns[i].label}: planned, not yet taught` : undefined}
                  >
                    {c.count > 0 ? c.count : c.planned ? '○' : ''}
                  </td>
                ))}
                <td className={`m total ${r.total === 0 && r.planned ? 'gap' : ''}`}>{r.total > 0 ? r.total : r.planned ? '—' : ''}</td>
              </tr>
            );
          })}
        </tbody>
        {m.footer && (
          <tfoot>
            <tr>
              <th scope="row" className="rowhead">
                {m.footer.label}
              </th>
              {m.footer.values.map((v, i) => (
                <td key={m.columns[i].id} className="m">
                  {v}
                </td>
              ))}
              <td className="m total">{m.footer.total}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function MatrixKey() {
  return (
    <p className="small muted matrix-key">
      Numbers are lessons that covered it. <span className="m m1 chipkey">1</span> <span className="m m2 chipkey">2</span>{' '}
      <span className="m m3 chipkey">3+</span> <span className="m planned chipkey">○</span> planned there, not yet taught. — planned in the program but not taught
      anywhere yet.
    </p>
  );
}
