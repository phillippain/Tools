// The program record: the program as planned, annotated with what was taught,
// changed, not used and added, plus adjustments, a lesson log with times and
// rooms, syllabus coverage (list and matrix) and the evaluation. One layout for
// every subject, rendered to Word or PDF.

import type { ClassGroup, Faculty, Item, LessonRecord, Program, StudentEntry, UnitReview } from './types';
import { RESOURCE_TYPES } from './types';
import {
  activitySummary,
  coverage,
  itemProgress,
  lostLessons,
  resourceSummary,
  unitSummaries,
  RATING_LABEL,
  STATE_SYMBOL,
  type ActivityOutcome,
} from './progress';
import { findItem, itemLabel, resourceIndex } from './program';
import { getCourse, getSyllabus, outcomeCode, outcomeLabel, point } from './syllabus';
import { displayStudent, type Roster } from './roster';
import { classMatrix } from './matrix';
import { matrixBlocks } from './matrix-model';
import { slotTime } from './calendar';
import { dateSpan, longDate, plural, safeHref, shortDate, todayISO } from './util';
import { cell, headerCells, para, run, type Block, type Cell, type DocModel, type Para, type Tone } from './doc-model';

export interface RecordInput {
  program: Program;
  cls: ClassGroup;
  teacherName: string;
  faculty?: Faculty;
  lessons: LessonRecord[];
  students: StudentEntry[];
  reviews: UnitReview[];
  roster?: Roster; // only when the teacher chose to include names
  unitIds?: string[]; // limit the detailed sections to these units
}

const TONE: Record<ActivityOutcome, Tone> = {
  done: 'done',
  adapted: 'adapted',
  skipped: 'skipped',
  'not-recorded': 'muted',
  pending: 'muted',
};

const typeLabel = (t?: string) => RESOURCE_TYPES.find((x) => x.value === t)?.label ?? 'Resource';
const safeLink = safeHref;

export function buildRecordModel(input: RecordInput): DocModel {
  const { program, cls, lessons, students, reviews, roster } = input;
  const progress = itemProgress(program, lessons);
  const acts = activitySummary(program, lessons, progress);
  const resIdx = resourceIndex(program);
  const cov = coverage(program, lessons);
  const units = unitSummaries(program, lessons, progress);
  const held = lessons.filter((l) => l.held).sort((a, b) => a.date.localeCompare(b.date));
  const lost = lostLessons(lessons);
  const syllabus = getSyllabus(program.syllabusId);
  const course = getCourse(program.syllabusId, program.courseId);
  const named = !!roster && Object.keys(roster).length > 0;
  const who = (code: string) => (named ? displayStudent(code, roster!) : code);
  const wanted = input.unitIds ? new Set(input.unitIds) : null;
  const blocks: Block[] = [];

  // Added activities and notes belong to the first item recorded that lesson.
  const addedByItem = new Map<string, { date: string; text: string }[]>();
  const notesByUnit = new Map<string, { date: string; text: string }[]>();
  const unitOfItem = new Map<string, string>();
  for (const u of program.units) for (const it of u.items) unitOfItem.set(it.id, u.id);
  for (const l of held) {
    const first = l.items[0]?.itemId;
    if (!first) continue;
    for (const a of l.added) addedByItem.set(first, [...(addedByItem.get(first) ?? []), { date: l.date, text: a.text }]);
    const u = unitOfItem.get(first);
    if (l.note && u) notesByUnit.set(u, [...(notesByUnit.get(u) ?? []), { date: l.date, text: l.note }]);
  }

  // ---- Title and details ----
  blocks.push({ t: 'title', text: 'Teaching program record' }, { t: 'subtitle', text: program.title });
  const dates = held.map((l) => l.date);
  const details: [string, string][] = [
    ['Class', `${cls.name} (${cls.year})`],
    ['Teacher', input.teacherName],
    ...(input.faculty ? ([['Faculty', `${input.faculty.name}${input.faculty.school ? `, ${input.faculty.school}` : ''}`]] as [string, string][]) : []),
    ['Course', `${syllabus?.title ?? program.syllabusId}${course ? ` — ${course.title}` : ''}`],
    ['Program', `${program.title} (version ${program.version})`],
    ['Period recorded', dates.length ? `${longDate(dates[0])} to ${longDate(dates.at(-1)!)}` : 'No lessons recorded yet'],
    ['Lessons', `${plural(held.length, 'lesson')} recorded; ${plural(lost.length, 'lesson')} did not run`],
    ['Students', named ? 'Shown by name and code (names added on the teacher’s device)' : 'Shown by code only'],
    ['Produced', longDate(todayISO())],
  ];
  blocks.push({
    t: 'table',
    widths: [20, 80],
    rows: details.map(([k, v]) => [cell(para([run(k, { bold: true })], { size: 'small' })), cell(v)]),
  });
  blocks.push({
    t: 'p',
    para: para(
      [
        run('Key: ', { bold: true }),
        run('✓ used as planned   ', { tone: 'done' }),
        run('~ adapted   ', { tone: 'adapted' }),
        run('✗ not used   ', { tone: 'skipped' }),
        run('+ added   ', { tone: 'added' }),
        run('○ not recorded   · not yet taught', { tone: 'muted' }),
      ],
      { size: 'small', before: 8, after: 6 },
    ),
  });
  if (named)
    blocks.push({ t: 'p', para: para([run('This record names students and their adjustments. Store it with other confidential student records.', { italics: true })], { size: 'small' }) });

  // ---- Summary ----
  blocks.push({ t: 'h1', text: 'Summary' });
  const countFor = (ids: string[], o: ActivityOutcome) => ids.filter((id) => acts.get(id)?.outcome === o).length;
  blocks.push({
    t: 'table',
    widths: [24, 18, 16, 8, 11, 23],
    header: headerCells(['Unit', 'Planned', 'Taught', 'Lessons', 'Items finished', 'Activities']),
    rows: units.map((u) => {
      const ids = [...(u.unit.routines ?? []), ...u.unit.items.flatMap((i) => i.activities)].map((a) => a.id);
      const added = u.unit.items.reduce((n, i) => n + (addedByItem.get(i.id)?.length ?? 0), 0);
      return [
        cell(para([run(`${u.unit.code} — ${u.unit.title}`, { bold: true })], { size: 'small' })),
        cell(u.unit.timing ?? ''),
        cell(u.dates.length ? dateSpan(u.dates) : 'Not yet taught'),
        cell(String(u.lessons)),
        cell(`${u.finished} of ${u.total}`),
        cell(
          u.lessons
            ? para(
                [
                  run(`${countFor(ids, 'done')} ✓  `, { tone: 'done' }),
                  run(`${countFor(ids, 'adapted')} ~  `, { tone: 'adapted' }),
                  run(`${countFor(ids, 'skipped')} ✗  `, { tone: 'skipped' }),
                  run(`${added} +`, { tone: 'added' }),
                ],
                { size: 'small' },
              )
            : '',
        ),
      ];
    }),
  });

  // ---- Unit by unit ----
  const activityLine = (id: string, text: string): Para => {
    const s = acts.get(id);
    const o: ActivityOutcome = s?.outcome ?? 'pending';
    const notes = (s?.entries ?? []).filter((e) => e.note).map((e) => `${e.note} (${shortDate(e.date)})`);
    return para(
      [
        run(`${STATE_SYMBOL[o]} `, { bold: true, tone: TONE[o] }),
        run(text, { strike: o === 'skipped', tone: o === 'pending' || o === 'not-recorded' ? 'muted' : undefined }),
        ...(notes.length ? [run(` — ${notes.join('; ')}`, { italics: true, tone: TONE[o] })] : []),
      ],
      { size: 'small', after: 2 },
    );
  };

  const itemRow = (it: Item): Cell[] => {
    const prog = progress.get(it.id);
    const planned: Para[] = [para([run(`${it.code ? it.code + ': ' : ''}${it.title}`, { bold: true })], { size: 'small' })];
    if (it.share) planned.push(para([run(it.share, { italics: true, tone: 'muted' })], { size: 'small' }));
    if (it.detail) planned.push(para([run(it.detail, { tone: 'soft' })], { size: 'small' }));
    const actLines = it.activities.map((a) => activityLine(a.id, a.text));
    for (const a of addedByItem.get(it.id) ?? [])
      actLines.push(para([run('+ ', { bold: true, tone: 'added' }), run(`${a.text} (${shortDate(a.date)})`, { tone: 'added' })], { size: 'small', after: 2 }));
    const taught = prog?.dates.length
      ? [...prog.dates.map((d) => para(shortDate(d), { size: 'small' })), ...(prog.status === 'finished' ? [] : [para([run('In progress', { italics: true })], { size: 'small' })])]
      : [para([run('Not yet taught', { italics: true, tone: 'muted' })], { size: 'small' })];
    const syl: Para[] = it.syllabus.map((id) => {
      const ref = point(id);
      const t = (cov.points.get(id) ?? []).length > 0;
      return para([run(t ? '✓ ' : '· ', { bold: true, tone: t ? 'done' : 'muted' }), run(ref ? ref.point.label : id)], { size: 'tiny', after: 1 });
    });
    if (it.outcomes.length) syl.push(para([run(`Outcomes: ${it.outcomes.map(outcomeCode).join(', ')}`, { italics: true, tone: 'soft' })], { size: 'tiny' }));
    const itemRes = resourceSummary(held.filter((l) => l.items.some((x) => x.itemId === it.id)));
    const resLines: Para[] = it.resources.map((r) => {
      const s = itemRes.get(r.id);
      const notes = (s?.ratings ?? []).filter((x) => x.note).map((x) => x.note);
      return para(
        [
          run(r.title, { link: safeLink(r.url) }),
          run(` — ${s?.overall ? RATING_LABEL[s.overall] : 'not rated'}`, { italics: true, tone: s?.overall === 'poor' ? 'skipped' : 'soft' }),
          ...(notes.length ? [run(`: ${notes.join('; ')}`, { italics: true })] : []),
        ],
        { size: 'tiny', after: 1 },
      );
    });
    return [cell(planned), cell(actLines), cell(taught), cell(syl.length ? syl : [para('—', { size: 'small' })]), cell(resLines.length ? resLines : [para('—', { size: 'small' })])];
  };

  for (const u of units) {
    if (wanted && !wanted.has(u.unit.id)) continue;
    if (u.lessons === 0) continue;
    const unit = u.unit;
    blocks.push({ t: 'h1', text: `${unit.code} — ${unit.title}` });
    blocks.push({
      t: 'p',
      para: para(
        [
          run('Planned: ', { bold: true }),
          run(unit.timing ?? 'not set'),
          run('    Taught: ', { bold: true }),
          run(`${dateSpan(u.dates)} (${plural(u.lessons, 'lesson')})`),
          run('    Status: ', { bold: true }),
          run(`${u.finished} of ${u.total} items finished`),
        ],
        { after: 6 },
      ),
    });
    const rows: Cell[][] = [];
    if (unit.routines?.length)
      rows.push([
        cell([para([run('Routines', { bold: true })], { size: 'small' }), para([run('Every lesson', { italics: true })], { size: 'small' })]),
        cell(unit.routines.map((a) => activityLine(a.id, a.text))),
        cell('—'),
        cell(''),
        cell(''),
      ]);
    for (const it of unit.items) rows.push(itemRow(it));
    blocks.push({ t: 'table', widths: [17, 36, 10, 20, 17], header: headerCells(['Planned', 'Activities as taught', 'Taught', 'Syllabus content', 'Resources']), rows });

    const ids = [...(unit.routines ?? []), ...unit.items.flatMap((i) => i.activities)].map((a) => a.id);
    const addedN = unit.items.reduce((n, i) => n + (addedByItem.get(i.id)?.length ?? 0), 0);
    const unitItemIds = new Set(unit.items.map((i) => i.id));
    const unitRes = resourceSummary(held.filter((l) => l.items.some((x) => unitItemIds.has(x.itemId))));
    const poor = [...new Set(unit.items.flatMap((i) => i.resources.map((r) => r.id)))]
      .filter((id) => unitRes.get(id)?.overall === 'poor')
      .map((id) => resIdx.get(id)?.title ?? id);
    const rev = reviews.find((r) => r.unitId === unit.id);
    blocks.push({ t: 'h2', text: 'Evaluation' });
    blocks.push({
      t: 'p',
      para: para(
        `Activities: ${countFor(ids, 'done')} used as planned, ${countFor(ids, 'adapted')} adapted, ${countFor(ids, 'skipped')} not used, ${addedN} added` +
          (countFor(ids, 'not-recorded') ? `, ${countFor(ids, 'not-recorded')} not recorded` : '') +
          '.' +
          (poor.length ? ` Resources that didn’t work: ${poor.join(', ')}.` : ''),
      ),
    });
    if (rev?.worked) blocks.push({ t: 'p', para: para([run('What worked: ', { bold: true }), run(rev.worked)]) });
    if (rev?.change) blocks.push({ t: 'p', para: para([run('Change next time: ', { bold: true }), run(rev.change)]) });
    if (!rev?.worked && !rev?.change) blocks.push({ t: 'p', para: para([run('No end-of-unit reflection recorded yet.', { italics: true, tone: 'muted' })]) });
    const notes = notesByUnit.get(unit.id) ?? [];
    if (notes.length) {
      blocks.push({ t: 'p', para: para([run('Lesson notes', { bold: true })], { before: 6 }) });
      for (const n of notes) blocks.push({ t: 'p', para: para([run(`${shortDate(n.date)}: `, { bold: true }), run(n.text)], { indent: true }) });
    }
  }

  // ---- Resources added during teaching ----
  const extra = held.flatMap((l) => l.addedResources.map((r) => ({ ...r, date: l.date })));
  if (extra.length) {
    blocks.push({ t: 'h1', text: 'Resources added during teaching' });
    blocks.push({
      t: 'table',
      widths: [12, 16, 40, 14, 18],
      header: headerCells(['Date', 'Type', 'Resource', 'How it worked', 'Note']),
      rows: extra.map((r) => [
        cell(shortDate(r.date)),
        cell(typeLabel(r.type)),
        cell(
          para(
            [run(r.title, { link: safeLink(r.url) }), ...(r.url && safeLink(r.url) ? [run(`  ${r.url}`, { tone: 'muted' })] : [])],
            { size: 'small' },
          ),
        ),
        cell(r.rating ? RATING_LABEL[r.rating] : 'not rated'),
        cell(r.note ?? ''),
      ]),
    });
  }

  // ---- Adjustments ----
  const exceptions = held.flatMap((l) => l.adjustments.exceptions.map((e) => ({ ...e, date: l.date })));
  const withPlans = students.filter((s) => s.planned.length || exceptions.some((e) => e.code === s.code));
  blocks.push({ t: 'h1', text: 'Adjustments' });
  const asPlanned = held.filter((l) => l.adjustments.asPlanned).length;
  blocks.push({
    t: 'p',
    para: para(`Planned adjustments were recorded as provided in ${asPlanned} of ${plural(held.length, 'lesson')}. Exceptions below were noted on the day.`),
  });
  if (program.differentiation?.length) {
    blocks.push({ t: 'p', para: para([run('Planned differentiation in the program', { bold: true })], { before: 6 }) });
    for (const d of program.differentiation)
      blocks.push({ t: 'p', para: para([run(`${d.who ?? 'All students'}: `, { bold: true }), run(d.text)], { indent: true }) });
  }
  if (withPlans.length)
    blocks.push({
      t: 'table',
      widths: [20, 38, 12, 30],
      header: headerCells(['Student', 'Planned adjustments', 'Level', 'Exceptions recorded']),
      rows: withPlans.map((s) => {
        const ex = exceptions.filter((e) => e.code === s.code);
        return [
          cell(para([run(who(s.code), { bold: true })], { size: 'small' })),
          cell(s.planned.length ? s.planned.map((x) => para(x, { size: 'small' })) : '—'),
          cell(s.level || '—'),
          cell(ex.length ? ex.map((e) => para(`${shortDate(e.date)}: ${e.text}`, { size: 'small' })) : 'None'),
        ];
      }),
    });
  else blocks.push({ t: 'p', para: para([run('No individual adjustments recorded for this class.', { italics: true, tone: 'muted' })]) });

  // ---- Lesson log ----
  const log = [...lessons].sort((a, b) => (a.date + (a.slot?.start ?? '')).localeCompare(b.date + (b.slot?.start ?? '')));
  if (log.length) {
    blocks.push({ t: 'h1', text: 'Lesson log' });
    blocks.push({
      t: 'table',
      widths: [12, 14, 10, 44, 20],
      header: headerCells(['Date', 'Time', 'Room', 'Taught', 'Note']),
      rows: log.map((l) => [
        cell(shortDate(l.date)),
        cell(l.slot?.start ? slotTime(l.slot) : '—'),
        cell(l.room || '—'),
        cell(
          l.held
            ? l.items
                .map((x) => {
                  const r = findItem(program, x.itemId);
                  return r ? itemLabel(r) : x.itemId;
                })
                .join('; ') || '—'
            : para([run(`Didn’t run: ${l.notHeldReason || 'no reason given'}`, { italics: true, tone: 'muted' })], { size: 'small' }),
        ),
        cell(l.note ?? ''),
      ]),
    });
  }

  // ---- Syllabus coverage ----
  blocks.push({ t: 'h1', text: 'Syllabus coverage', newPage: true });
  const plannedSet = new Set(cov.planned);
  const taughtN = cov.planned.filter((p) => (cov.points.get(p)?.length ?? 0) > 0).length;
  blocks.push({
    t: 'p',
    para: para(`${taughtN} of ${cov.planned.length} content points planned in this program have been taught. The matrix shows where, by unit.`),
  });
  blocks.push(...matrixBlocks(classMatrix(program, cls, lessons, 'unit', input.faculty?.calendar)));

  const areas = (course?.areas ?? []).filter((a) => a.groups.some((g) => g.points.some((pt) => plannedSet.has(pt.id) || cov.points.has(pt.id))));
  const covRows: Cell[][] = [];
  for (const a of areas)
    for (const g of a.groups)
      for (const pt of g.points) {
        const d = cov.points.get(pt.id) ?? [];
        const status = d.length ? 'Taught' : plannedSet.has(pt.id) ? 'Not yet taught' : 'Not in this program';
        covRows.push([
          cell(`${a.code} · ${g.title}`),
          cell(pt.label),
          cell(d.length ? d.map(shortDate).join(', ') : '—'),
          cell(para([run(status, { bold: status !== 'Taught', tone: status === 'Taught' ? 'done' : status === 'Not in this program' ? 'skipped' : 'soft' })], { size: 'small' })),
        ]);
      }
  blocks.push({ t: 'h2', text: 'Content taught, with dates' });
  blocks.push({ t: 'table', widths: [22, 42, 20, 16], header: headerCells(['Area', 'Content', 'Taught', 'Status']), rows: covRows });
  if (course?.outcomes.length) {
    blocks.push({ t: 'h2', text: 'Outcomes addressed' });
    blocks.push({
      t: 'table',
      widths: [66, 14, 20],
      header: headerCells(['Outcome', 'Lessons', 'Most recent']),
      rows: course.outcomes.map((o) => {
        const d = (cov.outcomes.get(o.id) ?? []).slice().sort();
        return [cell(outcomeLabel(o.id)), cell(String(d.length)), cell(d.length ? shortDate(d.at(-1)!) : '—')];
      }),
    });
  }

  // ---- Lost lessons ----
  if (lost.length) {
    blocks.push({ t: 'h1', text: 'Lessons that did not run' });
    blocks.push({
      t: 'table',
      widths: [20, 80],
      header: headerCells(['Date', 'Reason']),
      rows: lost.map((l) => [cell(shortDate(l.date)), cell(l.notHeldReason || 'Not given')]),
    });
  }

  // ---- Registration ----
  blocks.push({ t: 'h1', text: 'Registration' });
  blocks.push({ t: 'p', para: para(`I certify that this program was delivered to ${cls.name} as recorded above.`) });
  blocks.push({ t: 'p', para: para(`Teacher: ${input.teacherName}          Signature: ______________________          Date: ____________`, { before: 14, after: 8 }) });
  blocks.push({ t: 'p', para: para('Head Teacher sighted: ______________________          Signature: ______________________          Date: ____________', { before: 14 }) });

  return { title: `${cls.name} — ${program.title} — record`, author: input.teacherName, footer: `${cls.name} · ${program.title}`, blocks };
}

export function fileBase(cls: ClassGroup, label: string): string {
  const safe = (s: string) =>
    s
      .replace(/&/g, 'and')
      .replace(/[—–]/g, '-')
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  return `${safe(cls.name)} ${cls.year} - ${safe(label)} ${todayISO()}`;
}
