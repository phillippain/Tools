import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { Packer } from 'docx';
import { seedDemo } from '../lib/store-local';
import { itemProgress, nextItem, activitySummary, coverage, coveragePercent, resourceSummary, unitSummaries } from '../lib/progress';
import { buildRecordModel } from '../lib/record-model';
import { renderDocx } from '../lib/render-docx';
import { classMatrix, courseMatrix } from '../lib/matrix';
import { generateSlots, isTeachingDay, NSW_PUBLIC_CALENDAR, termFor, weekOfTerm, abWeek, slotsWithRecords } from '../lib/calendar';
import { flatItems, validateProgram, plannedPoints } from '../lib/program';
import { point, outcome } from '../lib/syllabus';
import { ecoT34Program } from '../data/programs/eco-t34-2027';

describe('program data', () => {
  it('is structurally valid', () => {
    expect(validateProgram(ecoT34Program)).toEqual([]);
  });
  it('only references syllabus points and outcomes that exist', () => {
    for (const { item } of flatItems(ecoT34Program)) {
      for (const s of item.syllabus) expect(point(s), `${item.id} -> ${s}`).toBeTruthy();
      for (const o of item.outcomes) expect(outcome(o), `${item.id} -> ${o}`).toBeTruthy();
    }
  });
  it('plans most Topic 3 and 4 content', () => {
    expect(plannedPoints(ecoT34Program).length).toBeGreaterThan(40);
  });
});

describe('progress from the demo lessons', () => {
  const db = seedDemo(new Date(2026, 10, 26));
  const lessons = db.lessons.filter((l) => l.classId === 'demo-12eco6');
  const program = db.programs[0];
  const prog = itemProgress(program, lessons);

  it('tracks finished and in-progress items', () => {
    expect(prog.get('b0.issue')?.status).toBe('finished');
    expect(prog.get('b0.issue')?.dates.length).toBe(2);
    expect(prog.get('b1.issue')?.status).toBe('in-progress');
    expect(prog.get('b2.issue')?.status).toBe('not-started');
  });
  it('picks the next item to teach', () => {
    expect(nextItem(program, prog)?.item.id).toBe('b1.issue');
  });
  it('summarises activities', () => {
    const a = activitySummary(program, lessons, prog);
    expect(a.get('b0.issue.a3')?.outcome).toBe('adapted');
    expect(a.get('b0.policy.a4')?.outcome).toBe('skipped');
    expect(a.get('b1.issue.a3')?.outcome).toBe('pending');
  });
  it('rates resources cautiously', () => {
    const r = resourceSummary(lessons);
    expect(r.get('r.booklet')?.overall).toBe('ok'); // one good, one ok -> tie goes to ok
    expect(r.get('r.scorecard')?.overall).toBe('poor');
  });
  it('computes coverage', () => {
    const c = coverage(program, lessons);
    expect(c.points.get('eco09.hsc.t3.growth.1')?.length).toBe(2);
    expect(coveragePercent(c)).toBeGreaterThan(0);
    const units = unitSummaries(program, lessons, prog);
    expect(units[0].status).toBe('finished');
    expect(units[1].status).toBe('in-progress');
  });
  it('builds the Word record with the lesson log and matrix', async () => {
    const model = buildRecordModel({
      program,
      cls: db.classes[0],
      teacherName: 'Phillip (demo)',
      faculty: db.faculty,
      lessons,
      students: db.students,
      reviews: db.reviews,
      roster: { S03: 'Alex Example', S07: 'Sam Sample' },
    });
    const headings = model.blocks.filter((b) => b.t === 'h1').map((b) => (b as { text: string }).text);
    expect(headings).toContain('Lesson log');
    expect(headings).toContain('Syllabus coverage');
    const buf = await Packer.toBuffer(renderDocx(model));
    expect(buf.length).toBeGreaterThan(5000);
    if (process.env.WRITE_DOCX) writeFileSync(process.env.WRITE_DOCX, buf);
  });
});

describe('school calendar', () => {
  const cal = NSW_PUBLIC_CALENDAR;
  it('numbers weeks from the staff start of term', () => {
    const t1 = termFor(cal, '2027-02-03')!;
    expect(t1.name).toBe('Term 1 2027');
    expect(weekOfTerm(t1, '2027-02-03')).toBe(2);
    expect(weekOfTerm(t1, '2027-03-29')).toBe(10);
    expect(weekOfTerm(t1, '2027-04-09')).toBe(11);
    expect(abWeek(cal, t1, 2)).toBe('B');
  });
  it('skips holidays, development days and weekends', () => {
    expect(isTeachingDay(cal, '2027-02-02')).toBe(false); // development day
    expect(isTeachingDay(cal, '2027-02-03')).toBe(true);
    expect(isTeachingDay(cal, '2027-03-26')).toBe(false); // Good Friday
    expect(isTeachingDay(cal, '2027-06-14')).toBe(false); // King's Birthday
    expect(isTeachingDay(cal, '2027-04-14')).toBe(false); // school holidays
    expect(isTeachingDay(cal, '2027-02-06')).toBe(false); // Saturday
  });
  it('lists timetabled lessons from the timetable', () => {
    const db = seedDemo(new Date(2026, 10, 26));
    const tt = db.classes[0].timetable!;
    const slots = generateSlots(cal, tt, '2027-02-01', '2027-02-12');
    expect(slots.map((s) => `${s.date} ${s.period}`)).toEqual([
      '2027-02-04 P4', // Thursday, Week 2 (B)
      '2027-02-05 P1', // Friday, Week 2 (B)
      '2027-02-08 P3', // Monday, Week 3 (A)
      '2027-02-10 P1',
      '2027-02-11 P5',
    ]);
  });
  it('links sample lessons to timetable slots and leaves two to record', () => {
    const db = seedDemo(new Date(2026, 10, 26));
    const cls = db.classes[0];
    const { past } = slotsWithRecords(cal, cls.timetable, db.lessons.filter((l) => l.classId === cls.id), '2026-11-25');
    const recorded = past.filter((p) => p.lesson);
    expect(recorded.length).toBe(6);
    expect(past.filter((p) => !p.lesson).length).toBe(2);
    expect(past.length).toBe(8);
  });
});

describe('coverage matrices', () => {
  const db = seedDemo(new Date(2026, 10, 26));
  const program = db.programs[0];
  const mine = db.lessons.filter((l) => l.classId === 'demo-12eco6');
  it('counts lessons per unit and marks planned cells', () => {
    const m = classMatrix(program, db.classes[0], mine, 'unit', db.faculty.calendar);
    const row = m.rows.find((r) => r.kind === 'row' && r.id === 'eco09.hsc.t3.growth.1') as Extract<(typeof m.rows)[number], { kind: 'row' }>;
    const b0 = m.columns.findIndex((c) => c.id === 'b0');
    expect(row.cells[b0].count).toBe(2);
    expect(row.cells[b0].planned).toBe(true);
    expect(row.total).toBe(2);
    expect(m.footer?.values.length).toBe(m.columns.length);
  });
  it('groups by term with the calendar', () => {
    const m = classMatrix(program, db.classes[0], mine, 'term', db.faculty.calendar);
    expect(m.columns.map((c) => c.label)).toEqual(['Term 4 2026']);
  });
  it('compares classes side by side', () => {
    const m = courseMatrix(program, db.classes.map((cls) => ({ cls, lessons: db.lessons.filter((l) => l.classId === cls.id) })));
    const row = m.rows.find((r) => r.kind === 'row' && r.id === 'eco09.hsc.t3.growth.1') as Extract<(typeof m.rows)[number], { kind: 'row' }>;
    expect(row.cells.map((c) => c.count)).toEqual([2, 1]);
  });
});
