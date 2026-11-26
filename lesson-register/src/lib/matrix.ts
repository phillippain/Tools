// Coverage matrices: outcomes and syllabus content (rows) against units, terms
// or classes (columns). Each cell counts the lessons that covered the row there,
// and marks where the program planned it but it hasn't been taught yet.

import type { ClassGroup, LessonRecord, Program, SchoolCalendar } from './types';
import { getCourse } from './syllabus';
import { termFor } from './calendar';
import { fromISO } from './util';

export interface MatrixColumn {
  id: string;
  label: string;
  title?: string;
}

export interface MatrixCell {
  count: number;
  planned: boolean;
}

export type MatrixRow =
  | { kind: 'section'; id: string; label: string }
  | { kind: 'group'; id: string; label: string }
  | { kind: 'row'; id: string; code?: string; label: string; cells: MatrixCell[]; total: number; planned: boolean };

export interface Matrix {
  title: string;
  subtitle: string;
  columns: MatrixColumn[];
  rows: MatrixRow[];
  footer?: { label: string; values: string[]; total: string };
}

export type ClassMatrixMode = 'unit' | 'term';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function unitOfItem(program: Program): Map<string, string> {
  const m = new Map<string, string>();
  for (const u of program.units) for (const i of u.items) m.set(i.id, u.id);
  return m;
}

/** Which outcomes and content points each unit plans to cover. */
function plannedByUnit(program: Program): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const u of program.units) {
    const s = new Set<string>();
    for (const i of u.items) {
      i.syllabus.forEach((x) => s.add(x));
      i.outcomes.forEach((x) => s.add(x));
    }
    m.set(u.id, s);
  }
  return m;
}

function plannedAll(program: Program): Set<string> {
  const s = new Set<string>();
  for (const u of program.units)
    for (const i of u.items) {
      i.syllabus.forEach((x) => s.add(x));
      i.outcomes.forEach((x) => s.add(x));
    }
  return s;
}

/** Row skeleton: outcomes, then each topic's groups and content points that the program or the lessons touch. */
function rowSkeleton(program: Program, lessons: LessonRecord[]) {
  const course = getCourse(program.syllabusId, program.courseId);
  const planned = plannedAll(program);
  const covered = new Set(lessons.filter((l) => l.held).flatMap((l) => [...l.syllabus, ...l.outcomes]));
  const out: ({ kind: 'section' | 'group'; id: string; label: string } | { kind: 'row'; id: string; code?: string; label: string })[] = [];
  if (!course) return { out, planned };
  out.push({ kind: 'section', id: 'outcomes', label: 'Outcomes' });
  for (const o of course.outcomes) out.push({ kind: 'row', id: o.id, code: o.code, label: o.label });
  for (const a of course.areas) {
    const groups = a.groups.filter((g) => g.points.some((p) => planned.has(p.id) || covered.has(p.id)));
    if (!groups.length) continue;
    out.push({ kind: 'section', id: a.id, label: `${a.code}: ${a.title}` });
    for (const g of groups) {
      out.push({ kind: 'group', id: g.id, label: g.title });
      for (const p of g.points) out.push({ kind: 'row', id: p.id, label: p.label });
    }
  }
  return { out, planned };
}

function build(
  title: string,
  subtitle: string,
  program: Program,
  allLessons: LessonRecord[],
  columns: MatrixColumn[],
  columnsOf: (l: LessonRecord) => string[],
  plannedIn: (rowId: string, colId: string) => boolean,
): Matrix {
  const held = allLessons.filter((l) => l.held);
  const { out, planned } = rowSkeleton(program, held);
  const colIndex = new Map(columns.map((c, i) => [c.id, i]));
  const rows: MatrixRow[] = out.map((r) => {
    if (r.kind !== 'row') return r;
    const cells: MatrixCell[] = columns.map((c) => ({ count: 0, planned: plannedIn(r.id, c.id) }));
    let total = 0;
    for (const l of held) {
      if (!l.syllabus.includes(r.id) && !l.outcomes.includes(r.id)) continue;
      total++;
      for (const cid of new Set(columnsOf(l))) {
        const i = colIndex.get(cid);
        if (i !== undefined) cells[i].count++;
      }
    }
    return { ...r, cells, total, planned: planned.has(r.id) };
  });
  return { title, subtitle, columns, rows };
}

/** One class: rows against the program's units, or against terms. */
export function classMatrix(
  program: Program,
  cls: ClassGroup,
  lessons: LessonRecord[],
  mode: ClassMatrixMode,
  calendar?: SchoolCalendar,
): Matrix {
  const title = `${cls.name} ${cls.year}: syllabus coverage`;
  if (mode === 'unit') {
    const unitOf = unitOfItem(program);
    const byUnit = plannedByUnit(program);
    const columns = program.units.map((u) => ({ id: u.id, label: u.code, title: u.title }));
    const m = build(
      title,
      `${program.title} · lessons by unit`,
      program,
      lessons,
      columns,
      (l) => l.items.map((x) => unitOf.get(x.itemId)).filter((x): x is string => !!x),
      (rowId, colId) => byUnit.get(colId)?.has(rowId) ?? false,
    );
    m.footer = footerByColumn(m);
    return m;
  }
  // By term (or by month when there is no calendar).
  const held = lessons.filter((l) => l.held);
  const keyOf = (date: string) => {
    const t = calendar ? termFor(calendar, date) : undefined;
    if (t) return t.id;
    const d = fromISO(date);
    return `m-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const labelOf = (key: string) => {
    const t = calendar?.terms.find((x) => x.id === key);
    if (t) return t.name;
    const [, y, mo] = key.split('-');
    return `${MON[Number(mo) - 1]} ${y}`;
  };
  const keys = [...new Set(held.map((l) => keyOf(l.date)))].sort((a, b) => {
    const da = held.find((l) => keyOf(l.date) === a)!.date;
    const db = held.find((l) => keyOf(l.date) === b)!.date;
    return da.localeCompare(db);
  });
  const columns = keys.map((k) => ({ id: k, label: labelOf(k) }));
  const m = build(title, `${program.title} · lessons by ${calendar ? 'term' : 'month'}`, program, lessons, columns, (l) => [keyOf(l.date)], () => false);
  m.footer = footerByColumn(m);
  return m;
}

/** Several classes following the same program, side by side. */
export function courseMatrix(program: Program, classes: { cls: ClassGroup; lessons: LessonRecord[]; teacher?: string }[]): Matrix {
  const columns = classes.map((c) => ({ id: c.cls.id, label: c.cls.name, title: c.teacher }));
  const all = classes.flatMap((c) => c.lessons);
  const planned = plannedAll(program);
  const m = build(
    `${program.title}: coverage by class`,
    `${classes.length} classes`,
    program,
    all,
    columns,
    (l) => [l.classId],
    (rowId) => planned.has(rowId),
  );
  // Percentage of planned content each class has taught.
  const points = m.rows.filter((r): r is Extract<MatrixRow, { kind: 'row' }> => r.kind === 'row' && r.planned && !r.code);
  m.footer = {
    label: 'Planned content taught',
    values: columns.map((_, i) => `${points.length ? Math.round((points.filter((r) => r.cells[i].count > 0).length / points.length) * 100) : 0}%`),
    total: '',
  };
  return m;
}

function footerByColumn(m: Matrix): Matrix['footer'] {
  const points = m.rows.filter((r): r is Extract<MatrixRow, { kind: 'row' }> => r.kind === 'row' && !r.code);
  const planned = points.filter((r) => r.planned);
  const taught = planned.filter((r) => r.total > 0).length;
  return {
    label: 'Content points taught',
    values: m.columns.map((_, i) => String(points.filter((r) => r.cells[i].count > 0).length)),
    total: `${taught} of ${planned.length}`,
  };
}

/** Shade steps for a lesson count: 0 none, 1, 2, 3+. */
export function level(count: number): 0 | 1 | 2 | 3 {
  return count <= 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3;
}
