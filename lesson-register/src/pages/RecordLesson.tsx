import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../app/context';
import { blankLesson, useClassBundle, type ClassBundle } from '../app/data';
import { go, href, useQuery } from '../app/router';
import { Dialog, Disclosure, ErrorBox, Loading, Segmented } from '../components/ui';
import { findItem } from '../lib/program';
import { itemProgress, nextItem } from '../lib/progress';
import { displayStudent, getRoster } from '../lib/roster';
import { getCourse, outcomeLabel, pointLabel } from '../lib/syllabus';
import { RESOURCE_TYPES, type ActivityState, type AddedResource, type Item, type LessonRecord, type LessonSlot, type Rating, type Resource, type ResourceType } from '../lib/types';
import { newId, safeHref, shortDate, todayISO } from '../lib/util';
import { slotsWithRecords, slotTime, weekLabel } from '../lib/calendar';

const typeLabel = (t?: ResourceType) => RESOURCE_TYPES.find((x) => x.value === t)?.label ?? 'Resource';

/** Accept "www.example.com" as well as full addresses. */
function cleanUrl(u: string): string | undefined {
  const t = u.trim();
  if (!t) return undefined;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function applySlot(d: LessonRecord, s: LessonSlot) {
  d.date = s.date;
  d.slot = { key: s.key, start: s.start, end: s.end, period: s.period };
  d.room = s.room || d.room;
}

const STATE_OPTS: { value: ActivityState; label: string; tone: string }[] = [
  { value: 'done', label: '✓ Used', tone: 'done' },
  { value: 'adapted', label: '~ Adapted', tone: 'adapted' },
  { value: 'skipped', label: '✗ Not used', tone: 'skipped' },
];

const RATING_OPTS: { value: Rating; label: string; tone: string }[] = [
  { value: 'good', label: 'Good', tone: 'good' },
  { value: 'ok', label: 'Okay', tone: 'neutral' },
  { value: 'poor', label: 'Poor', tone: 'skipped' },
  { value: 'unused', label: 'Not used', tone: 'neutral' },
];

const NOT_HELD = ['Excursion or event', 'Assembly', 'Public holiday or staff development day', 'Exams or assessment block', 'Teacher absent', 'Other'];

export function RecordLesson({ classId, lessonId }: { classId: string; lessonId?: string }) {
  const { data, error, loading } = useClassBundle(classId);
  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;
  return <LessonForm bundle={data} lessonId={lessonId} />;
}

function LessonForm({ bundle, lessonId }: { bundle: ClassBundle; lessonId?: string }) {
  const { store, session, faculty } = useApp();
  const q = useQuery();
  const { cls, program, lessons, students } = bundle;
  const readOnly = cls.teacherId !== session?.userId;
  const roster = useMemo(() => getRoster(cls.id), [cls.id]);
  const others = useMemo(() => lessons.filter((l) => l.id !== lessonId), [lessons, lessonId]);
  const progress = useMemo(() => itemProgress(program, others), [program, others]);
  const existing = lessonId ? lessons.find((l) => l.id === lessonId) : undefined;
  const today = todayISO();
  const cal = faculty?.calendar;
  const hasTimetable = !!cal && (cls.timetable?.slots.length ?? 0) > 0;
  const slotInfo = useMemo(() => slotsWithRecords(cal, cls.timetable, others, today), [cal, cls.timetable, others, today]);
  const openSlots = slotInfo.past.filter((p) => !p.lesson).map((p) => p.slot);
  const slotByKey = new Map(slotInfo.past.map((p) => [p.slot.key, p.slot]));
  const todayOpen = openSlots.filter((s) => s.date === today);
  const earlierOpen = openSlots.filter((s) => s.date !== today).reverse().slice(0, 20);
  const rooms = [...new Set([...(cls.timetable?.slots ?? []).map((s) => s.room), ...others.map((l) => l.room ?? '')].filter(Boolean))];
  const usedBefore = useMemo(() => {
    const seen = new Map<string, AddedResource>();
    for (const l of [...others].reverse()) for (const r of l.addedResources) if (!seen.has(r.id)) seen.set(r.id, r);
    return [...seen.values()];
  }, [others]);

  const [rec, setRec] = useState<LessonRecord>(() => {
    if (existing) return structuredClone(existing);
    const l = blankLesson(cls.id);
    const wanted = q.get('slot');
    const pick = (wanted && slotByKey.get(wanted)) || todayOpen[0] || openSlots.at(-1);
    if (pick) applySlot(l, pick);
    const next = nextItem(program, progress);
    if (next) applyItem(l, next.item);
    return l;
  });
  const [nr, setNr] = useState<{ type: ResourceType; title: string; url: string; note: string }>({ type: 'web', title: '', url: '', note: '' });
  const [picker, setPicker] = useState(false);
  const [sylPicker, setSylPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [newAct, setNewAct] = useState('');
  const [exCode, setExCode] = useState('');
  const [exText, setExText] = useState('');

  useEffect(() => {
    if (lessonId && !existing) setSaveError('That lesson record could not be found.');
  }, [lessonId, existing]);

  const update = (f: (d: LessonRecord) => void) =>
    setRec((r) => {
      const d = structuredClone(r);
      f(d);
      return d;
    });

  const selected = rec.items.map((x) => ({ sel: x, ref: findItem(program, x.itemId) })).filter((x) => x.ref);
  const units = [...new Map(selected.map((s) => [s.ref!.unit.id, s.ref!.unit])).values()];
  const resources: Resource[] = [];
  const seenRes = new Set<string>();
  for (const s of selected)
    for (const r of [...s.ref!.item.resources, ...(s.ref!.unit.resources ?? [])])
      if (!seenRes.has(r.id)) {
        seenRes.add(r.id);
        resources.push(r);
      }
  const course = getCourse(program.syllabusId, program.courseId);
  const withPlans = students.filter((s) => s.planned.length > 0 && s.active);

  function toggleItem(item: Item) {
    update((d) => {
      if (d.items.some((x) => x.itemId === item.id)) removeItem(d, item, program);
      else applyItem(d, item);
    });
  }

  async function save() {
    setBusy(true);
    setSaveError(undefined);
    try {
      await store.saveLesson(rec);
      go(`/class/${cls.id}?saved=${rec.held ? 'lesson' : 'lost'}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await store.deleteLesson(rec.id);
      go(`/class/${cls.id}/lessons`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      aria-labelledby="rec-title"
    >
      <a className="back" href={href(`/class/${cls.id}`)}>
        ← {cls.name}
      </a>
      <div className="pagehead">
        <h1 id="rec-title">{existing ? 'Edit lesson' : 'Record a lesson'}</h1>
        <p>{program.title}</p>
      </div>
      {readOnly && <div className="notice">This is a colleague’s class, so you can read but not change it.</div>}
      <ErrorBox error={saveError} />

      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
        <section className="card" aria-labelledby="when">
          <h2 id="when">When and where</h2>
          {hasTimetable && (
            <div className="field">
              <label htmlFor="slot">Lesson</label>
              <select
                id="slot"
                value={rec.slot && !rec.slot.key.startsWith('extra:') ? rec.slot.key : 'other'}
                onChange={(e) => {
                  const v = e.target.value;
                  update((d) => {
                    if (v === 'other') {
                      if (d.slot && !d.slot.key.startsWith('extra:')) d.slot = undefined;
                    } else {
                      const s = slotByKey.get(v);
                      if (s) applySlot(d, s);
                    }
                  });
                }}
              >
                {todayOpen.length > 0 && (
                  <optgroup label="Today">
                    {todayOpen.map((s) => (
                      <option key={s.key} value={s.key}>
                        Today · {slotTime(s)}
                        {s.room ? ` · ${s.room}` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {earlierOpen.length > 0 && (
                  <optgroup label="Not recorded yet">
                    {earlierOpen.map((s) => (
                      <option key={s.key} value={s.key}>
                        {shortDate(s.date)} · {slotTime(s)}
                        {s.room ? ` · ${s.room}` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {rec.slot && !rec.slot.key.startsWith('extra:') && !openSlots.some((s) => s.key === rec.slot!.key) && (
                  <option value={rec.slot.key}>
                    {shortDate(rec.date)} · {slotTime(rec.slot)}
                  </option>
                )}
                <option value="other">Another time (not on the timetable)</option>
              </select>
              {rec.slot && !rec.slot.key.startsWith('extra:') && cal && <span className="hint">{weekLabel(cal, rec.date)}</span>}
            </div>
          )}
          {(!hasTimetable || !rec.slot || rec.slot.key.startsWith('extra:')) && (
            <div className="grid-2">
              <div className="field">
                <label htmlFor="date">Date</label>
                <input id="date" name="date" type="date" required value={rec.date} onChange={(e) => update((d) => void (d.date = e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="tstart">
                  Starts <span className="hint">(optional)</span>
                </label>
                <input
                  id="tstart"
                  type="time"
                  value={rec.slot?.start ?? ''}
                  onChange={(e) => update((d) => void (d.slot = { key: `extra:${d.id}`, start: e.target.value, end: d.slot?.end ?? '' }))}
                />
              </div>
              <div className="field">
                <label htmlFor="tend">
                  Ends <span className="hint">(optional)</span>
                </label>
                <input
                  id="tend"
                  type="time"
                  value={rec.slot?.end ?? ''}
                  onChange={(e) => update((d) => void (d.slot = { key: `extra:${d.id}`, start: d.slot?.start ?? '', end: e.target.value }))}
                />
              </div>
            </div>
          )}
          <div className="field">
            <label htmlFor="room">Room</label>
            <input id="room" name="room" type="text" list="rooms" autoComplete="off" value={rec.room ?? ''} onChange={(e) => update((d) => void (d.room = e.target.value))} />
            <datalist id="rooms">
              {rooms.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <label className="check">
            <input type="checkbox" name="notheld" checked={!rec.held} onChange={(e) => update((d) => void (d.held = !e.target.checked))} />
            <span>
              This lesson didn’t run
              <span className="small muted" style={{ display: 'block', fontWeight: 400 }}>
                Logged so lost time shows in the record.
              </span>
            </span>
          </label>
          {!rec.held && (
            <div className="field" style={{ marginTop: '0.5rem' }}>
              <label htmlFor="reason">Why not?</label>
              <select id="reason" name="reason" value={rec.notHeldReason ?? ''} onChange={(e) => update((d) => void (d.notHeldReason = e.target.value))}>
                <option value="">Choose a reason</option>
                {NOT_HELD.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          )}
        </section>

        {rec.held && (
          <>
            <section className="card" aria-labelledby="what">
              <div className="row between">
                <h2 id="what">What did you teach?</h2>
                <button type="button" className="quiet" onClick={() => setPicker(true)}>
                  {selected.length ? 'Change' : 'Choose'}
                </button>
              </div>
              <p className="small muted" style={{ marginBottom: 0 }}>
                {selected.length === 0
                  ? 'Choose the part of the program you taught.'
                  : selected.length === 1
                    ? existing
                      ? 'Tap Change to correct what was taught.'
                      : 'Filled in from where this class is up to. Change it if you taught something else.'
                    : `${selected.length} parts of the program selected.`}
              </p>
            </section>

            {selected.map(({ sel, ref }) => {
              const item = ref!.item;
              return (
                <section key={item.id} className="card" aria-labelledby={`it-${item.id}`}>
                  <div className="eyebrow">{ref!.unit.code}</div>
                  <h2 id={`it-${item.id}`}>
                    {item.code ? `${item.code}: ` : ''}
                    {item.title}
                  </h2>
                  {item.detail && (
                    <details>
                      <summary className="small">What the program plans</summary>
                      <p className="small muted">{item.detail}</p>
                      {item.share && <p className="small muted">Share of block time: {item.share}</p>}
                    </details>
                  )}
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    {item.kind === 'lesson'
                      ? 'Everything is marked as used. Change only what was different.'
                      : 'Mark what you covered today: used as planned, adapted, or not used. Leave the rest for a later lesson.'}
                  </p>
                  {item.activities.map((a) => (
                    <ActivityRow key={a.id} id={a.id} text={a.text} rec={rec} update={update} />
                  ))}
                  {item.kind !== 'lesson' && (
                    <label className="check" style={{ marginTop: '0.4rem' }}>
                      <input
                        type="checkbox"
                        checked={sel.finished}
                        onChange={(e) =>
                          update((d) => {
                            const x = d.items.find((i) => i.itemId === item.id);
                            if (x) x.finished = e.target.checked;
                          })
                        }
                      />
                      <span>Finished this part</span>
                    </label>
                  )}
                </section>
              );
            })}

            {units.some((u) => u.routines?.length) && (
              <section className="card" aria-labelledby="routines">
                <h2 id="routines">Routines</h2>
                <p className="small muted">Optional: tick the routines that ran.</p>
                {units.flatMap((u) => u.routines ?? []).map((a) => (
                  <label key={a.id} className="check">
                    <input
                      type="checkbox"
                      checked={!!rec.activities[a.id]}
                      onChange={(e) =>
                        update((d) => {
                          if (e.target.checked) d.activities[a.id] = { state: 'done' };
                          else delete d.activities[a.id];
                        })
                      }
                    />
                    <span>{a.text}</span>
                  </label>
                ))}
              </section>
            )}

            <section className="card" aria-labelledby="added">
              <h2 id="added">Anything you added?</h2>
              <p className="small muted">Activities you ran that aren’t in the program.</p>
              <ul className="list">
                {rec.added.map((a) => (
                  <li key={a.id} className="row between">
                    <span>
                      <span className="sym added" aria-hidden="true">
                        +
                      </span>{' '}
                      {a.text}
                    </span>
                    <button type="button" className="quiet" onClick={() => update((d) => void (d.added = d.added.filter((x) => x.id !== a.id)))}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="newact">Add an activity</label>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input id="newact" type="text" value={newAct} onChange={(e) => setNewAct(e.target.value)} enterKeyHint="done" />
                  <button
                    type="button"
                    disabled={!newAct.trim()}
                    onClick={() => {
                      update((d) => void d.added.push({ id: newId(), text: newAct.trim() }));
                      setNewAct('');
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </section>

            {resources.length > 0 && (
              <section className="card" aria-labelledby="res">
                <h2 id="res">How did the resources work?</h2>
                <p className="small muted">Optional. Good, okay or poor for each one you used.</p>
                {resources.map((r) => {
                  const v = rec.resources[r.id];
                  return (
                    <div key={r.id} className="activity">
                      <Segmented
                        legend={r.title}
                        name={`res-${r.id}`}
                        value={v?.rating}
                        options={RATING_OPTS}
                        allowClear
                        onChange={(val) =>
                          update((d) => {
                            if (!val) delete d.resources[r.id];
                            else d.resources[r.id] = { ...d.resources[r.id], rating: val };
                          })
                        }
                      />
                      {safeHref(r.url) && (
                        <a className="small" href={safeHref(r.url)} target="_blank" rel="noreferrer">
                          Open {typeLabel(r.type).toLowerCase()}
                        </a>
                      )}
                      {(v?.rating === 'poor' || v?.note) && (
                        <input
                          type="text"
                          aria-label={`What didn’t work with ${r.title}?`}
                          placeholder="What didn’t work?"
                          value={v?.note ?? ''}
                          onChange={(e) => update((d) => void (d.resources[r.id] = { ...d.resources[r.id], note: e.target.value }))}
                        />
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            <section className="card" aria-labelledby="newres-h">
              <h2 id="newres-h">Resources not in the program</h2>
              <p className="small muted">Links, videos, worksheets or anything else you used. They’re kept with this class so you can pick them again.</p>
              {rec.addedResources.map((r) => (
                <div key={r.id} className="activity">
                  <div className="row between" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                    <span>
                      <span className="badge brand">{typeLabel(r.type)}</span>{' '}
                      {safeHref(r.url) ? (
                        <a href={safeHref(r.url)} target="_blank" rel="noreferrer">
                          {r.title}
                        </a>
                      ) : (
                        <strong>{r.title}</strong>
                      )}
                      {r.note && <span className="small muted"> · {r.note}</span>}
                    </span>
                    <button type="button" className="quiet" onClick={() => update((d) => void (d.addedResources = d.addedResources.filter((x) => x.id !== r.id)))}>
                      Remove
                    </button>
                  </div>
                  <Segmented
                    legend={`How did ${r.title} work?`}
                    hideLegend
                    name={`ares-${r.id}`}
                    value={r.rating}
                    options={RATING_OPTS.filter((o) => o.value !== 'unused')}
                    allowClear
                    onChange={(val) =>
                      update((d) => {
                        const x = d.addedResources.find((y) => y.id === r.id);
                        if (x) x.rating = val;
                      })
                    }
                  />
                </div>
              ))}
              {usedBefore.filter((u) => !rec.addedResources.some((r) => r.id === u.id)).length > 0 && (
                <>
                  <h3 style={{ marginTop: '0.75rem' }}>Used before with this class</h3>
                  <div className="chips">
                    {usedBefore
                      .filter((u) => !rec.addedResources.some((r) => r.id === u.id))
                      .slice(0, 12)
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="chip"
                          onClick={() => update((d) => void d.addedResources.push({ id: u.id, title: u.title, type: u.type, url: u.url, note: u.note }))}
                        >
                          + {u.title}
                        </button>
                      ))}
                  </div>
                </>
              )}
              <details style={{ marginTop: '0.75rem' }}>
                <summary>Add a new resource</summary>
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="nr-type">Type</label>
                    <select id="nr-type" value={nr.type} onChange={(e) => setNr({ ...nr, type: e.target.value as ResourceType })}>
                      {RESOURCE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="nr-title">Title</label>
                    <input id="nr-title" type="text" value={nr.title} onChange={(e) => setNr({ ...nr, title: e.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="nr-url">
                    Web address <span className="hint">(optional)</span>
                  </label>
                  <input
                    id="nr-url"
                    type="url"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="https://"
                    value={nr.url}
                    onChange={(e) => setNr({ ...nr, url: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="nr-note">
                    Note <span className="hint">(optional, e.g. pages 12–15 or minutes 3–9)</span>
                  </label>
                  <input id="nr-note" type="text" value={nr.note} onChange={(e) => setNr({ ...nr, note: e.target.value })} />
                </div>
                <button
                  type="button"
                  disabled={!nr.title.trim() && !nr.url.trim()}
                  onClick={() => {
                    const url = cleanUrl(nr.url);
                    const title = nr.title.trim() || (url ? url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : 'Resource');
                    update((d) => void d.addedResources.push({ id: newId(), type: nr.type, title, url, note: nr.note.trim() || undefined }));
                    setNr({ type: nr.type, title: '', url: '', note: '' });
                  }}
                >
                  Add resource
                </button>
              </details>
            </section>

            <section className="card" aria-labelledby="adj">
              <h2 id="adj">Adjustments</h2>
              <label className="check">
                <input
                  type="checkbox"
                  checked={rec.adjustments.asPlanned}
                  onChange={(e) => update((d) => void (d.adjustments.asPlanned = e.target.checked))}
                />
                <span>
                  Planned adjustments provided
                  <span className="small muted" style={{ display: 'block', fontWeight: 400 }}>
                    {withPlans.length
                      ? `${withPlans.length} students have planned adjustments in this class.`
                      : 'No individual adjustments set up yet. Add them under Students.'}
                  </span>
                </span>
              </label>
              {rec.adjustments.exceptions.length > 0 && (
                <ul className="list">
                  {rec.adjustments.exceptions.map((x, i) => (
                    <li key={i} className="row between">
                      <span>
                        <strong>{displayStudent(x.code, roster)}</strong>: {x.text}
                      </span>
                      <button type="button" className="quiet" onClick={() => update((d) => void d.adjustments.exceptions.splice(i, 1))}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <details>
                <summary>Note something different for a student</summary>
                <div className="field">
                  <label htmlFor="excode">Student</label>
                  <select id="excode" value={exCode} onChange={(e) => setExCode(e.target.value)}>
                    <option value="">Choose a student</option>
                    {students
                      .filter((s) => s.active)
                      .map((s) => (
                        <option key={s.id} value={s.code}>
                          {displayStudent(s.code, roster)}
                          {s.planned.length ? ` — ${s.planned.join('; ')}` : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="extext">
                    What was different? <span className="hint">(no names or diagnoses)</span>
                  </label>
                  <input id="extext" type="text" placeholder="e.g. Absent; or extra time given for the quiz" value={exText} onChange={(e) => setExText(e.target.value)} />
                </div>
                <button
                  type="button"
                  disabled={!exCode || !exText.trim()}
                  onClick={() => {
                    update((d) => void d.adjustments.exceptions.push({ code: exCode, text: exText.trim() }));
                    setExText('');
                  }}
                >
                  Add note
                </button>
              </details>
            </section>

            <section className="card" aria-labelledby="syl">
              <div className="row between">
                <h2 id="syl">Syllabus covered</h2>
                <button type="button" className="quiet" onClick={() => setSylPicker(true)}>
                  Add content
                </button>
              </div>
              <p className="small muted">Filled in from the program. Untick anything you didn’t reach.</p>
              <div className="chips">
                {rec.syllabus.map((id) => (
                  <label key={id} className="chip">
                    <input type="checkbox" checked onChange={() => update((d) => void (d.syllabus = d.syllabus.filter((x) => x !== id)))} />
                    {pointLabel(id)}
                  </label>
                ))}
              </div>
              {rec.outcomes.length > 0 && (
                <>
                  <h3 style={{ marginTop: '0.9rem' }}>Outcomes</h3>
                  <div className="chips">
                    {rec.outcomes.map((id) => (
                      <label key={id} className="chip">
                        <input type="checkbox" checked onChange={() => update((d) => void (d.outcomes = d.outcomes.filter((x) => x !== id)))} />
                        {outcomeLabel(id)}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        )}

        <section className="card">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="note">
              Note for next time <span className="hint">(optional; use student codes, not names)</span>
            </label>
            <textarea id="note" name="note" value={rec.note ?? ''} onChange={(e) => update((d) => void (d.note = e.target.value))} />
          </div>
        </section>
      </fieldset>

      {!readOnly && (
        <div className="sticky-save">
          <button type="submit" className="primary" disabled={busy || (rec.held && rec.items.length === 0)}>
            {busy ? 'Saving…' : 'Save lesson'}
          </button>
          {existing && (
            <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
        </div>
      )}

      <Dialog open={picker} title="What did you teach?" onClose={() => setPicker(false)}>
        {program.units.map((u) => (
          <fieldset key={u.id} style={{ border: 0, padding: 0, margin: '0 0 0.8rem' }}>
            <legend className="eyebrow">
              {u.code} · {u.title}
              {u.timing ? ` (${u.timing})` : ''}
            </legend>
            {u.items.map((it) => {
              const st = progress.get(it.id)?.status;
              return (
                <label key={it.id} className="check">
                  <input type="checkbox" checked={rec.items.some((x) => x.itemId === it.id)} onChange={() => toggleItem(it)} />
                  <span>
                    {it.code ? `${it.code}: ` : ''}
                    {it.title}{' '}
                    {st === 'finished' && <span className="badge done">Done</span>}
                    {st === 'in-progress' && <span className="badge progress">Started</span>}
                  </span>
                </label>
              );
            })}
          </fieldset>
        ))}
        <button type="button" className="primary block" onClick={() => setPicker(false)}>
          Done
        </button>
      </Dialog>

      <Dialog open={sylPicker} title="Add syllabus content" onClose={() => setSylPicker(false)}>
        {course?.areas
          .filter((a) => a.groups.length)
          .map((a) => (
            <Disclosure key={a.id} startOpen={a.groups.some((g) => g.points.some((p) => rec.syllabus.includes(p.id)))}>
              <summary>
                {a.code}: {a.title}
              </summary>
              {a.groups.map((g) => (
                <fieldset key={g.id} style={{ border: 0, padding: 0, margin: '0 0 0.6rem' }}>
                  <legend className="eyebrow">{g.title}</legend>
                  {g.points.map((p) => (
                    <label key={p.id} className="check">
                      <input
                        type="checkbox"
                        checked={rec.syllabus.includes(p.id)}
                        onChange={(e) =>
                          update((d) => {
                            d.syllabus = e.target.checked ? [...d.syllabus, p.id] : d.syllabus.filter((x) => x !== p.id);
                          })
                        }
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </Disclosure>
          ))}
        {course && course.outcomes.length > 0 && (
          <details>
            <summary>Outcomes</summary>
            {course.outcomes.map((o) => (
              <label key={o.id} className="check">
                <input
                  type="checkbox"
                  checked={rec.outcomes.includes(o.id)}
                  onChange={(e) =>
                    update((d) => {
                      d.outcomes = e.target.checked ? [...d.outcomes, o.id] : d.outcomes.filter((x) => x !== o.id);
                    })
                  }
                />
                <span>
                  {o.code} {o.label}
                </span>
              </label>
            ))}
          </details>
        )}
        <button type="button" className="primary block" style={{ marginTop: '0.75rem' }} onClick={() => setSylPicker(false)}>
          Done
        </button>
      </Dialog>

      <Dialog open={confirmDelete} title="Delete this lesson record?" onClose={() => setConfirmDelete(false)}>
        <p>
          The record for {shortDate(rec.date)} will be removed. This can’t be undone.
        </p>
        <div className="row">
          <button type="button" autoFocus onClick={() => setConfirmDelete(false)}>
            Keep it
          </button>
          <button type="button" className="danger" onClick={() => void remove()}>
            Delete
          </button>
        </div>
      </Dialog>
    </form>
  );
}

function ActivityRow({
  id,
  text,
  rec,
  update,
}: {
  id: string;
  text: string;
  rec: LessonRecord;
  update: (f: (d: LessonRecord) => void) => void;
}) {
  const v = rec.activities[id];
  return (
    <div className="activity">
      <Segmented
        legend={text}
        name={`act-${id}`}
        value={v?.state}
        options={STATE_OPTS}
        allowClear
        onChange={(state) =>
          update((d) => {
            if (!state) delete d.activities[id];
            else d.activities[id] = { ...d.activities[id], state };
          })
        }
      />
      {(v?.state === 'adapted' || v?.state === 'skipped') && (
        <input
          type="text"
          aria-label={v.state === 'adapted' ? `What changed: ${text}` : `Why not used: ${text}`}
          placeholder={v.state === 'adapted' ? 'What changed?' : 'Why not? (optional)'}
          value={v.note ?? ''}
          onChange={(e) => update((d) => void (d.activities[id] = { ...d.activities[id], note: e.target.value }))}
        />
      )}
    </div>
  );
}

/** Add an item to a lesson with its defaults. */
function applyItem(d: LessonRecord, item: Item) {
  if (d.items.some((x) => x.itemId === item.id)) return;
  d.items.push({ itemId: item.id, finished: item.kind === 'lesson' || item.kind === 'checkpoint' || item.kind === 'assessment' });
  if (item.kind === 'lesson') for (const a of item.activities) d.activities[a.id] ??= { state: 'done' };
  for (const s of item.syllabus) if (!d.syllabus.includes(s)) d.syllabus.push(s);
  for (const o of item.outcomes) if (!d.outcomes.includes(o)) d.outcomes.push(o);
}

/** Take an item back out, along with anything only it brought in. */
function removeItem(d: LessonRecord, item: Item, program: ClassBundle['program']) {
  d.items = d.items.filter((x) => x.itemId !== item.id);
  for (const a of item.activities) delete d.activities[a.id];
  const others = d.items.map((x) => findItem(program, x.itemId)?.item).filter(Boolean) as Item[];
  const keepS = new Set(others.flatMap((i) => i.syllabus));
  const keepO = new Set(others.flatMap((i) => i.outcomes));
  d.syllabus = d.syllabus.filter((s) => !item.syllabus.includes(s) || keepS.has(s));
  d.outcomes = d.outcomes.filter((o) => !item.outcomes.includes(o) || keepO.has(o));
}
