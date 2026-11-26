import { useApp, useAsync } from '../app/context';
import { href } from '../app/router';
import { ErrorBox, Loading } from '../components/ui';
import { getSyllabus, outcomeCode, pointLabel } from '../lib/syllabus';

export function ProgramView({ programId }: { programId: string }) {
  const { store } = useApp();
  const { data: p, error, loading } = useAsync(() => store.getProgram(programId), [store, programId]);
  if (error) return <ErrorBox error={error} />;
  if (loading || !p) return <Loading />;
  const syl = getSyllabus(p.syllabusId);
  return (
    <>
      <a className="back" href={href('/programs')}>
        ← Programs
      </a>
      <div className="pagehead">
        <h1>{p.title}</h1>
        <p>
          {syl?.title ?? p.syllabusId} · version {p.version}
        </p>
      </div>
      {p.summary && (
        <section className="card">
          <p style={{ margin: 0 }}>{p.summary}</p>
          {p.source && (
            <p className="small muted" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
              Source:{' '}
              {p.source.url?.startsWith('https://') ? (
                <a href={p.source.url} target="_blank" rel="noreferrer">
                  {p.source.title}
                </a>
              ) : (
                p.source.title
              )}
            </p>
          )}
        </section>
      )}
      {p.differentiation && p.differentiation.length > 0 && (
        <section className="card">
          <h2>Planned differentiation</h2>
          <ul className="list">
            {p.differentiation.map((d) => (
              <li key={d.id}>
                <strong>{d.who ?? 'All students'}:</strong> {d.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      {p.units.map((u) => (
        <section key={u.id} className="card tight">
          <details>
            <summary style={{ borderTop: 0 }}>
              {u.code} · {u.title}
              {u.timing && <span className="small muted"> — {u.timing}</span>}
            </summary>
            {u.summary && <p className="small">{u.summary}</p>}
            {u.routines && u.routines.length > 0 && (
              <>
                <h3>Routines</h3>
                <ul className="small">
                  {u.routines.map((a) => (
                    <li key={a.id}>{a.text}</li>
                  ))}
                </ul>
              </>
            )}
            {u.items.map((it) => (
              <div key={it.id} style={{ borderTop: '1px solid var(--line-2)', paddingTop: '0.6rem', marginTop: '0.6rem' }}>
                <h3>
                  {it.code ? `${it.code}: ` : ''}
                  {it.title}
                  {it.share && <span className="small muted"> ({it.share})</span>}
                </h3>
                {it.detail && <p className="small muted">{it.detail}</p>}
                <ul className="small">
                  {it.activities.map((a) => (
                    <li key={a.id}>{a.text}</li>
                  ))}
                </ul>
                {it.resources.length > 0 && (
                  <p className="small">
                    <strong>Resources:</strong> {it.resources.map((r) => r.title).join('; ')}
                  </p>
                )}
                {it.syllabus.length > 0 && (
                  <p className="small">
                    <strong>Syllabus:</strong> {it.syllabus.map((s) => pointLabel(s)).join('; ')}
                  </p>
                )}
                {it.outcomes.length > 0 && (
                  <p className="small">
                    <strong>Outcomes:</strong> {it.outcomes.map(outcomeCode).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </details>
        </section>
      ))}
    </>
  );
}
