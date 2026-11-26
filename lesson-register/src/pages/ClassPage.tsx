import { useEffect, useMemo, useState } from 'react';
import { useApp, useAsync } from '../app/context';
import { useClassBundle, type ClassBundle } from '../app/data';
import { href, useQuery } from '../app/router';
import { Bar, ErrorBox, Loading, download, useToast } from '../components/ui';
import { buildRecordModel, fileBase } from '../lib/record-model';
import { matrixDoc } from '../lib/matrix-model';
import { renderModel, type Format } from '../lib/export';
import { findItem, itemLabel, resourceIndex } from '../lib/program';
import {
  activitySummary,
  RATING_LABEL,
  resourceSummary,
  coverage,
  coveragePercent,
  itemProgress,
  nextItem,
  unitSummaries,
  type ItemStatus,
} from '../lib/progress';
import { getRoster, parseRosterCsv, rosterFile, setRoster, type Roster } from '../lib/roster';
import { getCourse, outcomeLabel } from '../lib/syllabus';
import { classMatrix, type ClassMatrixMode } from '../lib/matrix';
import { MatrixKey, MatrixView } from '../components/MatrixView';
import { Segmented } from '../components/ui';
import { NCCD_LEVELS, RESOURCE_TYPES, type LessonRecord, type LessonSlot, type NccdLevel, type StudentEntry, type UnitReview } from '../lib/types';
import { dateSpan, newId, plural, safeHref, shortDate, todayISO } from '../lib/util';
import { slotsWithRecords, slotTime } from '../lib/calendar';

const TABS = [
  ['progress', 'Progress'],
  ['lessons', 'Lessons'],
  ['students', 'Students'],
  ['coverage', 'Syllabus'],
  ['export', 'Export'],
] as const;

export function ClassPage({ classId, tab }: { classId: string; tab: string }) {
  const { data, error, loading, reload } = useClassBundle(classId);
  const { session } = useApp();
  const q = useQuery();
  const [toast, say] = useToast();
  const saved = q.get('saved');
  useEffect(() => {
    if (saved === 'lesson') say('Lesson saved');
    if (saved === 'lost') say('Saved: lesson didn’t run');
    if (saved === 'timetable') say('Timetable saved');
  }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorBox error={error} />;
  if (loading && !data) return <Loading />;
  if (!data) return null;
  const mine = data.cls.teacherId === session?.userId;

  return (
    <>
      <a className="back" href={href(mine ? '/classes' : '/faculty')}>
        ← {mine ? 'Classes' : 'Faculty'}
      </a>
      <div className="pagehead row between">
        <div>
          <h1>
            {data.cls.name} <span className="muted" style={{ fontWeight: 500 }}>{data.cls.year}</span>
          </h1>
          <p>{data.program.title}</p>
        </div>
        {mine && (
          <a className="btn primary" href={href(`/class/${classId}/record`)}>
            Record lesson
          </a>
        )}
      </div>
      {!mine && <div className="notice">You’re viewing a colleague’s class. You can read it and download its record.</div>}
      <nav className="tabs" aria-label="Class sections">
        {TABS.map(([k, label]) => (
          <a key={k} href={href(`/class/${classId}/${k}`)} aria-current={tab === k ? 'page' : undefined}>
            {label}
          </a>
        ))}
      </nav>
      {tab === 'progress' && <ProgressTab b={data} mine={mine} onChange={reload} say={say} />}
      {tab === 'lessons' && <LessonsTab b={data} mine={mine} />}
      {tab === 'students' && <StudentsTab b={data} mine={mine} onChange={reload} say={say} />}
      {tab === 'coverage' && <CoverageTab b={data} />}
      {(tab === 'export' || tab === 'download') && <DownloadTab b={data} />}
      {toast}
    </>
  );
}

const ORDER = ['poor', 'ok', 'good', 'unused'];
const SYM: Record<ItemStatus, string> = { finished: '✓', 'in-progress': '~', 'not-started': '·' };
const STATUS_TEXT: Record<ItemStatus, string> = { finished: 'Finished', 'in-progress': 'In progress', 'not-started': 'Not started' };

function ProgressTab({ b, mine, onChange, say }: { b: ClassBundle; mine: boolean; onChange: () => void; say: (m: string) => void }) {
  const { program, lessons, reviews } = b;
  const prog = useMemo(() => itemProgress(program, lessons), [program, lessons]);
  const units = useMemo(() => unitSummaries(program, lessons, prog), [program, lessons, prog]);
  const acts = useMemo(() => activitySummary(program, lessons, prog), [program, lessons, prog]);
  const res = useMemo(() => resourceSummary(lessons), [lessons]);
  const resIdx = useMemo(() => resourceIndex(program), [program]);
  const rated = [...res.entries()]
    .map(([id, r]) => {
      const added = lessons.flatMap((l) => l.addedResources).find((x) => x.id === id);
      const base = resIdx.get(id) ?? added;
      return { id, title: base?.title ?? id, url: base?.url, type: base?.type, added: !!added && !resIdx.has(id), ...r };
    })
    .sort((a, b) => ORDER.indexOf(a.overall ?? 'unused') - ORDER.indexOf(b.overall ?? 'unused'));
  const addedCount = (unitIds: Set<string>) =>
    lessons.filter((l) => l.held && l.items[0] && unitIds.has(l.items[0].itemId)).reduce((n, l) => n + l.added.length, 0);
  const next = nextItem(program, prog);
  const pct = coveragePercent(coverage(program, lessons));
  const held = lessons.filter((l) => l.held).length;
  const lost = lessons.length - held;

  return (
    <>
      <section className="card">
        <div className="row between small muted">
          <span>
            {plural(held, 'lesson')} recorded{lost ? `, ${lost} didn’t run` : ''}
          </span>
          <span>{pct}% of planned content taught</span>
        </div>
        <Bar value={pct} label={`${pct}% of planned syllabus content taught`} />
        {next && (
          <p style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            <span className="eyebrow">Up next </span>
            <br />
            <strong>{itemLabel(next)}</strong>
          </p>
        )}
      </section>
      {units.map((u) => {
        const review = reviews.find((r) => r.unitId === u.unit.id);
        return (
          <section key={u.unit.id} className="card tight">
            <details open={u.status === 'in-progress'}>
              <summary style={{ borderTop: 0 }}>
                <span className="unit-head" style={{ display: 'inline-flex', width: 'calc(100% - 1.5rem)' }}>
                  <span>
                    {u.unit.code} · {u.unit.title}
                  </span>
                  <span className={`badge ${u.status === 'finished' ? 'done' : u.status === 'in-progress' ? 'progress' : ''}`}>
                    {u.finished}/{u.total}
                  </span>
                </span>
              </summary>
              <p className="small muted">
                Planned: {u.unit.timing ?? 'not set'}
                {u.dates.length ? ` · Taught: ${dateSpan(u.dates)} (${plural(u.lessons, 'lesson')})` : ''}
              </p>
              {u.lessons > 0 &&
                (() => {
                  const ids = u.unit.items.flatMap((i) => i.activities.map((a) => a.id));
                  const n = (o: string) => ids.filter((id) => acts.get(id)?.outcome === o).length;
                  return (
                    <p className="small">
                      <strong>Activities:</strong> {n('done')} used, {n('adapted')} adapted, {n('skipped')} not used,{' '}
                      {addedCount(new Set(u.unit.items.map((i) => i.id)))} added
                    </p>
                  );
                })()}
              <ul className="list">
                {u.unit.items.map((it) => {
                  const p = prog.get(it.id)!;
                  return (
                    <li key={it.id} className="item-line">
                      <span className={`sym ${p.status}`} aria-hidden="true">
                        {SYM[p.status]}
                      </span>
                      <span>
                        <strong>
                          {it.code ? `${it.code}: ` : ''}
                          {it.title}
                        </strong>
                        <br />
                        <span className="small muted">
                          {STATUS_TEXT[p.status]}
                          {p.dates.length ? ` · ${p.dates.map(shortDate).join(', ')}` : ''}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {(u.status !== 'not-started' || review) && (
                <ReviewForm b={b} unitId={u.unit.id} review={review} mine={mine} onSaved={() => (say('Reflection saved'), onChange())} />
              )}
            </details>
          </section>
        );
      })}
      {rated.length > 0 && (
        <section className="card">
          <h2>How the resources worked</h2>
          <ul className="list">
            {rated.map((r) => {
              const notes = r.ratings.filter((x) => x.note);
              return (
                <li key={r.id}>
                  <div className="row between">
                    <span>
                      {safeHref(r.url) ? (
                        <a href={safeHref(r.url)} target="_blank" rel="noreferrer">
                          <strong>{r.title}</strong>
                        </a>
                      ) : (
                        <strong>{r.title}</strong>
                      )}
                      {r.added && <span className="small muted"> · added · {RESOURCE_TYPES.find((t) => t.value === r.type)?.label ?? 'Resource'}</span>}
                    </span>
                    <span className={`badge ${r.overall === 'good' ? 'done' : r.overall === 'poor' ? 'poor' : ''}`}>
                      {RATING_LABEL[r.overall ?? 'unused']}
                    </span>
                  </div>
                  <div className="small muted">
                    {r.ratings.map((x) => `${shortDate(x.date)}: ${RATING_LABEL[x.rating]}`).join(' · ')}
                  </div>
                  {notes.map((x, i) => (
                    <div key={i} className="small">
                      “{x.note}”
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

function ReviewForm({ b, unitId, review, mine, onSaved }: { b: ClassBundle; unitId: string; review?: UnitReview; mine: boolean; onSaved: () => void }) {
  const { store } = useApp();
  const [worked, setWorked] = useState(review?.worked ?? '');
  const [change, setChange] = useState(review?.change ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!mine)
    return review ? (
      <div className="small">
        <p>
          <strong>What worked:</strong> {review.worked || '—'}
        </p>
        <p>
          <strong>Change next time:</strong> {review.change || '—'}
        </p>
      </div>
    ) : null;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
          await store.saveReview({ id: review?.id ?? newId(), classId: b.cls.id, unitId, worked, change });
          onSaved();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
      style={{ marginTop: '0.5rem' }}
    >
      <h3>End-of-unit reflection</h3>
      <ErrorBox error={error} />
      <div className="field">
        <label htmlFor={`w-${unitId}`}>What worked</label>
        <textarea id={`w-${unitId}`} value={worked} onChange={(e) => setWorked(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`c-${unitId}`}>Change next time</label>
        <textarea id={`c-${unitId}`} value={change} onChange={(e) => setChange(e.target.value)} />
      </div>
      <button type="submit" disabled={busy}>
        Save reflection
      </button>
    </form>
  );
}

function LessonsTab({ b, mine }: { b: ClassBundle; mine: boolean }) {
  const { faculty } = useApp();
  const { program, lessons, cls } = b;
  const cal = faculty?.calendar;
  const today = todayISO();
  const { past, next } = useMemo(() => slotsWithRecords(cal, cls.timetable, lessons, today, 3), [cal, cls.timetable, lessons, today]);
  const hasTt = past.length > 0 || next.length > 0;
  const linked = new Set(past.filter((p) => p.lesson).map((p) => p.lesson!.id));
  type Entry = { key: string; date: string; time: string; slot?: LessonSlot; lesson?: LessonRecord };
  const entries: Entry[] = [
    ...past.map((p) => ({ key: p.slot.key, date: p.slot.date, time: p.slot.start, slot: p.slot, lesson: p.lesson })),
    ...lessons.filter((l) => !linked.has(l.id)).map((l) => ({ key: l.id, date: l.date, time: l.slot?.start ?? '', lesson: l })),
  ].sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time));
  const toRecord = past.filter((p) => !p.lesson).length;

  const itemsText = (l: LessonRecord) =>
    l.items
      .map((x) => {
        const r = findItem(program, x.itemId);
        return r ? itemLabel(r) : x.itemId;
      })
      .join('; ');

  return (
    <>
      <section className="card tight">
        <div className="row between">
          <span>
            {hasTt ? (
              toRecord > 0 ? (
                <strong>{plural(toRecord, 'lesson')} to record</strong>
              ) : (
                <strong>All timetabled lessons recorded</strong>
              )
            ) : (
              <span className="small muted">Add this class’s timetable to list every lesson to record.</span>
            )}
          </span>
          <a className="btn" href={href(`/class/${cls.id}/timetable`)}>
            Timetable
          </a>
        </div>
      </section>
      {entries.length === 0 && next.length === 0 && <p className="muted">No lessons recorded yet.</p>}
      {entries.length > 0 && (
        <section className="card">
          <ul className="list">
            {entries.map((e) => {
              const l = e.lesson;
              const when = e.slot ? `${slotTime(e.slot)}` : l?.slot ? slotTime(l.slot) : '';
              const room = l?.room ?? e.slot?.room;
              const adapted = l ? Object.values(l.activities).filter((a) => a.state === 'adapted').length : 0;
              const skipped = l ? Object.values(l.activities).filter((a) => a.state === 'skipped').length : 0;
              const head = (
                <div className="row between">
                  <span>
                    <strong>{shortDate(e.date)}</strong>
                    <span className="small muted">
                      {when ? ` · ${when}` : ''}
                      {room ? ` · ${room}` : ''}
                    </span>
                  </span>
                  {!l ? (
                    <span className="badge poor">Not recorded</span>
                  ) : !l.held ? (
                    <span className="badge">Didn’t run</span>
                  ) : (
                    <span className="row" style={{ gap: '0.3rem' }}>
                      {adapted > 0 && <span className="badge progress">{adapted} adapted</span>}
                      {skipped > 0 && <span className="badge">{skipped} not used</span>}
                      {l.added.length > 0 && <span className="badge brand">{l.added.length} added</span>}
                      {adapted + skipped + l.added.length === 0 && <span className="badge done">Recorded</span>}
                    </span>
                  )}
                </div>
              );
              return (
                <li key={e.key}>
                  {l ? (
                    <a href={href(`/class/${cls.id}/lesson/${l.id}`)} style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
                      {head}
                      <div className="small muted">{l.held ? itemsText(l) : l.notHeldReason || 'No reason given'}</div>
                    </a>
                  ) : (
                    <>
                      {head}
                      {mine && (
                        <a className="btn" style={{ marginTop: '0.4rem' }} href={href(`/class/${cls.id}/record?slot=${encodeURIComponent(e.key)}`)}>
                          Record this lesson
                        </a>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {next.length > 0 && (
        <section className="card tight">
          <h3>Coming up</h3>
          <ul className="list">
            {next.map((s) => (
              <li key={s.key} className="row between small">
                <span>
                  <strong>{shortDate(s.date)}</strong> {slotTime(s)}
                </span>
                <span className="muted">{s.room}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!mine && <p className="small muted">Read only.</p>}
    </>
  );
}

function StudentsTab({ b, mine, onChange, say }: { b: ClassBundle; mine: boolean; onChange: () => void; say: (m: string) => void }) {
  const { store } = useApp();
  const { cls, students } = b;
  const [roster, setRosterState] = useState<Roster>(() => getRoster(cls.id));
  const [count, setCount] = useState(25);
  const [error, setError] = useState<string>();

  async function addCodes() {
    setError(undefined);
    try {
      const have = new Set(students.map((s) => s.code));
      for (let i = 1; i <= count; i++) {
        const code = `S${String(i).padStart(2, '0')}`;
        if (!have.has(code)) await store.saveStudent({ id: newId(), classId: cls.id, code, planned: [], level: '', active: true });
      }
      say('Student codes added');
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function saveName(code: string, name: string) {
    const next = { ...roster, [code]: name };
    setRoster(cls.id, next);
    setRosterState(getRoster(cls.id));
  }

  return (
    <>
      <section className="card">
        <h2>How students are stored</h2>
        <p className="small">
          The database only ever holds codes such as <strong>S07</strong>. Names you type here stay in this browser on this device and are added to a
          download only when you ask for them.
        </p>
        {mine && (
          <div className="row">
            <button
              type="button"
              onClick={() => download(rosterFile(roster), `${cls.name} names.csv`).catch((e: Error) => setError(e.message))}
              disabled={Object.keys(roster).length === 0}
            >
              Save names file
            </button>
            <label className="btn">
              Load names file
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const parsed = parseRosterCsv(await f.text());
                  setRoster(cls.id, { ...roster, ...parsed });
                  setRosterState(getRoster(cls.id));
                  say(`${Object.keys(parsed).length} names loaded on this device`);
                }}
              />
            </label>
          </div>
        )}
        <p className="small muted" style={{ marginTop: '0.5rem' }}>
          Keep the names file in your school drive to use the names on another device.
        </p>
      </section>
      <ErrorBox error={error} />
      {mine && students.length === 0 && (
        <section className="card">
          <h2>Add student codes</h2>
          <div className="field">
            <label htmlFor="count">How many students?</label>
            <input id="count" type="number" inputMode="numeric" min={1} max={40} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </div>
          <button type="button" className="primary" onClick={addCodes}>
            Add S01 to S{String(count).padStart(2, '0')}
          </button>
        </section>
      )}
      {students.map((s) => (
        <StudentCard key={s.id} s={s} name={roster[s.code] ?? ''} mine={mine} onName={(n) => saveName(s.code, n)} onSaved={onChange} say={say} />
      ))}
      {mine && students.length > 0 && (
        <button
          type="button"
          onClick={async () => {
            const nums = students.map((s) => Number(s.code.replace(/\D/g, ''))).filter((n) => !Number.isNaN(n));
            const code = `S${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0')}`;
            await store.saveStudent({ id: newId(), classId: cls.id, code, planned: [], level: '', active: true });
            onChange();
          }}
        >
          Add another student
        </button>
      )}
    </>
  );
}

function StudentCard({
  s,
  name,
  mine,
  onName,
  onSaved,
  say,
}: {
  s: StudentEntry;
  name: string;
  mine: boolean;
  onName: (n: string) => void;
  onSaved: () => void;
  say: (m: string) => void;
}) {
  const { store } = useApp();
  const [planned, setPlanned] = useState(s.planned.join('\n'));
  const [level, setLevel] = useState<NccdLevel>(s.level);
  const [nm, setNm] = useState(name);
  const dirty = planned !== s.planned.join('\n') || level !== s.level;
  return (
    <section className="card tight">
      <details>
        <summary style={{ borderTop: 0 }}>
          {s.code}
          {name ? ` · ${name}` : ''}
          {s.planned.length > 0 && <span className="badge brand" style={{ marginLeft: '0.5rem' }}>{plural(s.planned.length, 'adjustment')}</span>}
        </summary>
        {mine ? (
          <>
            <div className="field">
              <label htmlFor={`n-${s.id}`}>
                Name <span className="hint">(this device only)</span>
              </label>
              <input id={`n-${s.id}`} type="text" autoComplete="off" value={nm} onChange={(e) => setNm(e.target.value)} onBlur={() => onName(nm)} />
            </div>
            <div className="field">
              <label htmlFor={`p-${s.id}`}>
                Planned adjustments <span className="hint">(one per line; no names or diagnoses)</span>
              </label>
              <textarea id={`p-${s.id}`} value={planned} onChange={(e) => setPlanned(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`l-${s.id}`}>NCCD level of adjustment</label>
              <select id={`l-${s.id}`} value={level} onChange={(e) => setLevel(e.target.value as NccdLevel)}>
                {NCCD_LEVELS.map((x) => (
                  <option key={x} value={x}>
                    {x || 'Not set'}
                  </option>
                ))}
              </select>
            </div>
            <div className="row">
              <button
                type="button"
                className="primary"
                disabled={!dirty}
                onClick={async () => {
                  await store.saveStudent({
                    ...s,
                    planned: planned
                      .split('\n')
                      .map((x) => x.trim())
                      .filter(Boolean),
                    level,
                  });
                  say(`${s.code} saved`);
                  onSaved();
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="danger"
                onClick={async () => {
                  await store.deleteStudent(s.id);
                  onSaved();
                }}
              >
                Remove
              </button>
            </div>
          </>
        ) : (
          <p className="small">{s.planned.length ? s.planned.join('; ') : 'No planned adjustments.'}</p>
        )}
      </details>
    </section>
  );
}

function CoverageTab({ b }: { b: ClassBundle }) {
  const { faculty } = useApp();
  const { program, lessons, cls } = b;
  const cov = useMemo(() => coverage(program, lessons), [program, lessons]);
  const course = getCourse(program.syllabusId, program.courseId);
  const planned = new Set(cov.planned);
  const pct = coveragePercent(cov);
  const [view, setView] = useState<'matrix' | 'list'>('matrix');
  const [mode, setMode] = useState<ClassMatrixMode>('unit');
  const matrix = useMemo(() => classMatrix(program, cls, lessons, mode, faculty?.calendar), [program, cls, lessons, mode, faculty?.calendar]);
  if (!course) return <p className="muted">This program’s syllabus isn’t in the library yet.</p>;
  const areas = course.areas.filter((a) => a.groups.some((g) => g.points.some((p) => planned.has(p.id) || cov.points.has(p.id))));
  return (
    <>
      <section className="card">
        <div className="row between small muted">
          <span>Planned content taught</span>
          <span>{pct}%</span>
        </div>
        <Bar value={pct} label={`${pct}% of planned content taught`} />
        <p className="small muted" style={{ marginTop: '0.6rem' }}>
          Short labels for tracking. Check wording against the official syllabus.
        </p>
        <div className="grid-2">
          <Segmented
            legend="Show as"
            name="covview"
            value={view}
            options={[
              { value: 'matrix', label: 'Matrix' },
              { value: 'list', label: 'List' },
            ]}
            onChange={(v) => v && setView(v)}
          />
          {view === 'matrix' && (
            <Segmented
              legend="Columns"
              name="covmode"
              value={mode}
              options={[
                { value: 'unit', label: 'By unit' },
                { value: 'term', label: faculty?.calendar ? 'By term' : 'By month' },
              ]}
              onChange={(v) => v && setMode(v)}
            />
          )}
        </div>
      </section>
      {view === 'matrix' ? (
        <>
          <MatrixView m={matrix} />
          <MatrixKey />
          <p className="small">
            <a href={href(`/class/${cls.id}/export?doc=matrix`)}>Download this matrix as Word or PDF</a>
          </p>
        </>
      ) : (
        <CoverageList areas={areas} cov={cov} planned={planned} course={course} />
      )}
    </>
  );
}

function CoverageList({
  areas,
  cov,
  planned,
  course,
}: {
  areas: NonNullable<ReturnType<typeof getCourse>>['areas'];
  cov: ReturnType<typeof coverage>;
  planned: Set<string>;
  course: NonNullable<ReturnType<typeof getCourse>>;
}) {
  return (
    <>
      {areas.map((a) => (
        <section key={a.id} className="card">
          <h2>
            {a.code}: {a.title}
          </h2>
          {a.groups.map((g) => (
            <div key={g.id} style={{ marginTop: '0.6rem' }}>
              <h3>{g.title}</h3>
              <ul className="list">
                {g.points.map((p) => {
                  const dates = cov.points.get(p.id) ?? [];
                  const status = dates.length ? 'done' : planned.has(p.id) ? '' : 'skipped';
                  return (
                    <li key={p.id} className="item-line">
                      <span className={`sym ${status}`} aria-hidden="true">
                        {dates.length ? '✓' : planned.has(p.id) ? '·' : '!'}
                      </span>
                      <span>
                        {p.label}
                        <br />
                        <span className="small muted">
                          {dates.length
                            ? `Taught ${dates.map(shortDate).join(', ')}`
                            : planned.has(p.id)
                              ? 'Planned, not yet taught'
                              : 'Not in this program'}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
      <section className="card">
        <h2>Outcomes</h2>
        <table className="simple">
          <thead>
            <tr>
              <th scope="col">Outcome</th>
              <th scope="col">Lessons</th>
            </tr>
          </thead>
          <tbody>
            {course.outcomes.map((o) => (
              <tr key={o.id}>
                <td>{outcomeLabel(o.id)}</td>
                <td>{cov.outcomes.get(o.id)?.length ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function DownloadTab({ b }: { b: ClassBundle }) {
  const { store, faculty } = useApp();
  const q = useQuery();
  const { cls, program, lessons, students, reviews } = b;
  const roster = getRoster(cls.id);
  const hasNames = Object.keys(roster).length > 0;
  const [doc, setDoc] = useState<'record' | 'matrix'>(q.get('doc') === 'matrix' ? 'matrix' : 'record');
  const [format, setFormat] = useState<Format>('pdf');
  const [unit, setUnit] = useState('all');
  const [mode, setMode] = useState<ClassMatrixMode>('unit');
  const [names, setNames] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const members = useAsync(() => store.listMembers(cls.facultyId), [store, cls.facultyId]);
  const teacher = members.data?.find((m) => m.userId === cls.teacherId)?.displayName ?? 'Teacher';

  async function go() {
    setBusy(true);
    setError(undefined);
    try {
      const model =
        doc === 'record'
          ? buildRecordModel({
              program,
              cls,
              teacherName: teacher,
              faculty: faculty ?? undefined,
              lessons,
              students,
              reviews,
              roster: names ? roster : undefined,
              unitIds: unit === 'all' ? undefined : [unit],
            })
          : matrixDoc(classMatrix(program, cls, lessons, mode, faculty?.calendar), teacher, `Teacher: ${teacher}`);
      const blob = await renderModel(model, format);
      await download(blob, `${fileBase(cls, doc === 'record' ? `${program.title} record` : 'coverage matrix')}.${format}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function backup() {
    setError(undefined);
    const data = { exported: new Date().toISOString(), class: cls, program, lessons, students, reviews };
    try {
      await download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${cls.name} ${cls.year} backup.json`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <section className="card">
        <h2>Download</h2>
        <ErrorBox error={error} />
        <div className="grid-2">
          <Segmented
            legend="Document"
            name="doc"
            value={doc}
            options={[
              { value: 'record', label: 'Program record' },
              { value: 'matrix', label: 'Coverage matrix' },
            ]}
            onChange={(v) => v && setDoc(v)}
          />
          <Segmented
            legend="Format"
            name="format"
            value={format}
            options={[
              { value: 'pdf', label: 'PDF' },
              { value: 'docx', label: 'Word' },
            ]}
            onChange={(v) => v && setFormat(v)}
          />
        </div>
        <p className="small" style={{ marginTop: '0.75rem' }}>
          {doc === 'record'
            ? 'The program as planned, marked up with what was taught, adapted, not used and added; resources and how they worked; adjustments; a lesson log with times and rooms; syllabus coverage with the matrix; reflections; and a registration line.'
            : 'Outcomes and content points against the units (or terms), with the number of lessons that covered each one and what is planned but not yet taught.'}
        </p>
        {doc === 'record' ? (
          <>
            <div className="field">
              <label htmlFor="unit">Detail for</label>
              <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="all">Every unit taught so far</option>
                {program.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code}: {u.title}
                  </option>
                ))}
              </select>
            </div>
            <label className="check">
              <input type="checkbox" checked={names} disabled={!hasNames} onChange={(e) => setNames(e.target.checked)} />
              <span>
                Include student names from this device
                <span className="small muted" style={{ display: 'block', fontWeight: 400 }}>
                  {hasNames ? 'Names are added on this device; they are not uploaded.' : 'No names saved on this device, so codes are used.'}
                </span>
              </span>
            </label>
          </>
        ) : (
          <Segmented
            legend="Columns"
            name="mmode"
            value={mode}
            options={[
              { value: 'unit', label: 'By unit' },
              { value: 'term', label: faculty?.calendar ? 'By term' : 'By month' },
            ]}
            onChange={(v) => v && setMode(v)}
          />
        )}
        <button type="button" className="primary" onClick={go} disabled={busy} style={{ marginTop: '0.75rem' }}>
          {busy ? 'Preparing…' : `Download ${doc === 'record' ? 'record' : 'matrix'} (${format === 'pdf' ? 'PDF' : 'Word'})`}
        </button>
      </section>
      <section className="card">
        <h2>Backup</h2>
        <p className="small">A complete copy of this class’s records as a data file (codes only, no names).</p>
        <button type="button" onClick={backup}>
          Download backup
        </button>
      </section>
    </>
  );
}
