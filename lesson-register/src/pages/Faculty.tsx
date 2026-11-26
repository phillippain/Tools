import { useMemo, useState } from 'react';
import { useApp, useAsync, canLead } from '../app/context';
import { courseMatrix } from '../lib/matrix';
import { MatrixKey, MatrixView } from '../components/MatrixView';
import type { ClassBundle } from '../app/data';
import type { Member } from '../lib/types';
import { loadClassBundle } from '../app/data';
import { href } from '../app/router';
import { Bar, ErrorBox, Loading, download } from '../components/ui';
import { matrixDoc } from '../lib/matrix-model';
import { renderModel, type Format } from '../lib/export';
import { coverage, coveragePercent } from '../lib/progress';
import type { Role } from '../lib/types';
import { plural, shortDate, todayISO } from '../lib/util';

const ROLE_LABEL: Record<Role, string> = { teacher: 'Teacher', head_teacher: 'Head Teacher', admin: 'Admin' };

export function FacultyPage() {
  const { store, member, faculty, session } = useApp();
  const { data, error, loading, reload } = useAsync(async () => {
    const [classes, members] = await Promise.all([store.listClasses(member!.facultyId, 'all'), store.listMembers(member!.facultyId)]);
    const bundles = await Promise.all(classes.map((c) => loadClassBundle(store, c.id)));
    return { bundles, members };
  }, [store, member?.facultyId]);

  if (!canLead(member)) return <p>Only Head Teachers and admins can see the faculty view.</p>;
  const isAdmin = member?.role === 'admin';

  return (
    <>
      <div className="pagehead">
        <h1>Faculty</h1>
        <p>Every class’s progress, read only.</p>
      </div>
      <ErrorBox error={error} />
      {loading && !data && <Loading />}
      {data?.bundles.map(({ cls, program, lessons }) => {
        const teacher = data.members.find((m) => m.userId === cls.teacherId)?.displayName ?? 'Teacher';
        const held = lessons.filter((l) => l.held);
        const last = held.map((l) => l.date).sort().at(-1);
        const pct = coveragePercent(coverage(program, lessons));
        return (
          <a key={cls.id} className="card tight" href={href(`/class/${cls.id}`)} style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
            <div className="row between">
              <strong>
                {cls.name} <span className="muted">{cls.year}</span>
              </strong>
              <span className="small muted">{teacher}</span>
            </div>
            <div className="small muted">{program.title}</div>
            <div className="row between small muted" style={{ marginTop: '0.4rem' }}>
              <span>
                {plural(held.length, 'lesson')}
                {last ? ` · last ${shortDate(last)}` : ''}
              </span>
              <span>{pct}% taught</span>
            </div>
            <Bar value={pct} label={`${pct}% of planned content taught`} />
          </a>
        );
      })}
      {data && data.bundles.length === 0 && <p className="muted">No classes yet.</p>}
      {data && data.bundles.length > 0 && <CourseCoverage bundles={data.bundles} members={data.members} />}

      {faculty && (
        <section className="card">
          <h2>Invite colleagues</h2>
          <p className="small">
            Colleagues create an account, then join with this code. They start as teachers and see only their own classes.
          </p>
          <p style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '0.08em' }}>{faculty.joinCode}</p>
        </section>
      )}

      {data && (
        <section className="card">
          <h2>People</h2>
          <table className="simple">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.userId}>
                  <td>
                    {m.displayName}
                    {m.email && <div className="small muted">{m.email}</div>}
                  </td>
                  <td>
                    {isAdmin && m.userId !== session?.userId ? (
                      <select
                        aria-label={`Role for ${m.displayName}`}
                        value={m.role}
                        onChange={async (e) => {
                          await store.setRole(m.facultyId, m.userId, e.target.value as Role);
                          reload();
                        }}
                      >
                        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ROLE_LABEL[m.role]
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isAdmin && <p className="small muted">Only admins can change roles.</p>}
        </section>
      )}
    </>
  );
}

function CourseCoverage({ bundles, members }: { bundles: ClassBundle[]; members: Member[] }) {
  const programs = useMemo(() => {
    const m = new Map<string, ClassBundle[]>();
    for (const b of bundles) m.set(b.program.id, [...(m.get(b.program.id) ?? []), b]);
    return [...m.values()];
  }, [bundles]);
  const [pick, setPick] = useState(programs[0]?.[0].program.id ?? '');
  const group = programs.find((g) => g[0].program.id === pick) ?? programs[0];
  const matrix = useMemo(
    () =>
      group
        ? courseMatrix(
            group[0].program,
            group.map((b) => ({ cls: b.cls, lessons: b.lessons, teacher: members.find((m) => m.userId === b.cls.teacherId)?.displayName })),
          )
        : null,
    [group, members],
  );
  if (!group || !matrix) return null;
  return (
    <section className="card" aria-labelledby="course-cov">
      <h2 id="course-cov">Course coverage</h2>
      <p className="small muted">Every class following the same program, side by side.</p>
      {programs.length > 1 && (
        <div className="field">
          <label htmlFor="cc-prog">Program</label>
          <select id="cc-prog" value={pick} onChange={(e) => setPick(e.target.value)}>
            {programs.map((g) => (
              <option key={g[0].program.id} value={g[0].program.id}>
                {g[0].program.title} ({g.length} classes)
              </option>
            ))}
          </select>
        </div>
      )}
      <MatrixView m={matrix} />
      <MatrixKey />
      <CourseMatrixDownload matrix={matrix} />
    </section>
  );
}

function CourseMatrixDownload({ matrix }: { matrix: ReturnType<typeof courseMatrix> }) {
  const { member } = useApp();
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string>();
  async function get(format: Format) {
    setBusy(format);
    setError(undefined);
    try {
      const blob = await renderModel(matrixDoc(matrix, member?.displayName ?? 'Head Teacher'), format);
      const name = matrix.title.replace(/&/g, 'and').replace(/[^\w\- ]+/g, '').replace(/\s+/g, ' ').trim();
      await download(blob, `${name} ${todayISO()}.${format}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <ErrorBox error={error} />
      <div className="row">
        <button type="button" disabled={!!busy} onClick={() => get('pdf')}>
          {busy === 'pdf' ? 'Preparing…' : 'Download PDF'}
        </button>
        <button type="button" disabled={!!busy} onClick={() => get('docx')}>
          {busy === 'docx' ? 'Preparing…' : 'Download Word'}
        </button>
      </div>
    </>
  );
}
