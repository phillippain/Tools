import { useState, type FormEvent } from 'react';
import { useApp, useAsync } from '../app/context';
import { go, href, useQuery } from '../app/router';
import { ErrorBox, Loading } from '../components/ui';
import { newId } from '../lib/util';

export function Classes() {
  const { store, member, session } = useApp();
  const q = useQuery();
  const [adding, setAdding] = useState(q.get('add') === '1');
  const { data, error, loading } = useAsync(
    async () => {
      const [classes, programs] = await Promise.all([store.listClasses(member!.facultyId, 'mine'), store.listPrograms(member!.facultyId)]);
      return { classes, programs };
    },
    [store, member?.facultyId],
  );

  const [name, setName] = useState('');
  const [year, setYear] = useState(new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear());
  const [programId, setProgramId] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaveError(undefined);
    try {
      const id = newId();
      await store.saveClass({ id, facultyId: member!.facultyId, name: name.trim(), year, programId, teacherId: session!.userId });
      go(`/class/${id}/students`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <>
      <div className="pagehead row between">
        <div>
          <h1>Your classes</h1>
          <p>Each class follows one program.</p>
        </div>
        {!adding && (
          <button type="button" className="primary" onClick={() => setAdding(true)}>
            Add class
          </button>
        )}
      </div>
      <ErrorBox error={error} />
      {loading && !data && <Loading />}
      {adding && data && (
        <form className="card" onSubmit={add} aria-labelledby="add-class">
          <h2 id="add-class">Add a class</h2>
          <ErrorBox error={saveError} />
          {data.programs.length === 0 ? (
            <p>
              Your faculty has no programs yet. <a href={href('/programs')}>Add a program</a> first.
            </p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="cname">Class name</label>
                <input id="cname" name="cname" type="text" required placeholder="e.g. 12ECO6" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="cyear">Year</label>
                <input id="cyear" name="cyear" type="number" inputMode="numeric" min={2024} max={2040} required value={year} onChange={(e) => setYear(Number(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="cprog">Program</label>
                <select id="cprog" name="cprog" required value={programId} onChange={(e) => setProgramId(e.target.value)}>
                  <option value="">Choose a program</option>
                  {data.programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row">
                <button type="submit" className="primary" disabled={busy}>
                  Add class
                </button>
                <button type="button" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </form>
      )}
      {data?.classes.map((c) => {
        const prog = data.programs.find((p) => p.id === c.programId);
        return (
          <a key={c.id} className="card tight" href={href(`/class/${c.id}`)} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <div className="row between">
              <strong>{c.name}</strong>
              <span className="badge">{c.year}</span>
            </div>
            <div className="small muted">{prog?.title ?? 'Program'}</div>
          </a>
        );
      })}
      {data && data.classes.length === 0 && !adding && <p className="muted">No classes yet.</p>}
    </>
  );
}
