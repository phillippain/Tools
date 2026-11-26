import { useState } from 'react';
import { useApp, useAsync } from '../app/context';
import { href } from '../app/router';
import { ErrorBox, Loading, useToast } from '../components/ui';
import { PROGRAM_LIBRARY, validateProgram } from '../lib/program';
import { getSyllabus } from '../lib/syllabus';
import type { Program } from '../lib/types';

export function Programs() {
  const { store, member } = useApp();
  const [toast, say] = useToast();
  const [error, setError] = useState<string>();
  const { data, loading, error: loadError, reload } = useAsync(() => store.listPrograms(member!.facultyId), [store, member?.facultyId]);
  const have = new Set((data ?? []).map((p) => p.title));
  const available = PROGRAM_LIBRARY.filter((p) => !have.has(p.title));

  async function add(p: Program) {
    setError(undefined);
    try {
      await store.addProgram(member!.facultyId, p);
      say('Program added to your faculty');
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function importFile(f: File) {
    setError(undefined);
    try {
      const parsed = JSON.parse(await f.text()) as Program;
      const problems = validateProgram(parsed);
      if (!getSyllabus(parsed.syllabusId)) problems.push(`The syllabus “${parsed.syllabusId}” isn’t in the library yet.`);
      if (problems.length) throw new Error(`That file can’t be imported: ${problems.join(' ')}`);
      await add(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <div className="pagehead">
        <h1>Programs</h1>
        <p>Teaching programs your faculty’s classes follow.</p>
      </div>
      <ErrorBox error={loadError ?? error} />
      {loading && !data && <Loading />}
      {data?.map((p) => (
        <a key={p.id} className="card tight" href={href(`/program/${p.id}`)} style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
          <div className="row between">
            <strong>{p.title}</strong>
            <span className="badge">{p.year}</span>
          </div>
          <div className="small muted">
            {p.subject} · version {p.version}
          </div>
        </a>
      ))}
      {data && data.length === 0 && <p className="muted">No programs yet.</p>}

      {available.length > 0 && (
        <section className="card">
          <h2>Ready to add</h2>
          <ul className="list">
            {available.map((p) => (
              <li key={p.id} className="row between">
                <span>
                  <strong>{p.title}</strong>
                  <br />
                  <span className="small muted">{getSyllabus(p.syllabusId)?.title}</span>
                </span>
                <button type="button" onClick={() => add(p)}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Import a program file</h2>
        <p className="small">
          Programs written in Word or Google Docs are converted once into a program file, which lists each unit, lesson or block with its activities,
          resources and syllabus links.
        </p>
        <label className="btn">
          Choose a program file (.json)
          <input
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
            }}
          />
        </label>
      </section>
      {toast}
    </>
  );
}
