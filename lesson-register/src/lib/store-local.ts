// Demo store: everything lives in this browser. Used for the preview and when
// no database has been set up. Nothing is sent anywhere.

import type {
  ClassGroup,
  Faculty,
  SchoolCalendar,
  Timetable,
  LessonRecord,
  Member,
  Program,
  ProgramMeta,
  Role,
  StudentEntry,
  UnitReview,
} from './types';
import type { Session, Store } from './store';
import { newId, safeStorage, schoolDaysBefore, toISO } from './util';
import { PROGRAM_LIBRARY } from './program';
import { generateSlots, NSW_PUBLIC_CALENDAR } from './calendar';

interface DemoDb {
  version: 2;
  faculty: Faculty;
  members: Member[];
  programs: Program[];
  classes: ClassGroup[];
  students: StudentEntry[];
  lessons: LessonRecord[];
  reviews: UnitReview[];
}

const KEY = 'lr.demo.v2';

/** A sample resource added during teaching, reused in two lessons so its ratings combine. */
const RBA_GROWTH = {
  id: 'x.rba-chart-pack-growth',
  title: 'RBA Chart Pack: Australian growth',
  type: 'data' as const,
  url: 'https://www.rba.gov.au/chart-pack/au-growth.html',
};
export const DEMO_USER = 'demo-user';
const COLLEAGUE = 'demo-colleague';

function blankLesson(classId: string, date: string): LessonRecord {
  return {
    id: newId(),
    classId,
    date,
    held: true,
    items: [],
    activities: {},
    added: [],
    resources: {},
    addedResources: [],
    syllabus: [],
    outcomes: [],
    adjustments: { asPlanned: true, exceptions: [] },
  };
}

export function seedDemo(today = new Date()): DemoDb {
  const facultyId = 'demo-faculty';
  const program = structuredClone(PROGRAM_LIBRARY[0]);
  const d = (n: number) => schoolDaysBefore(today, n);
  const calendar = structuredClone(NSW_PUBLIC_CALENDAR);
  const timetable: Timetable = {
    from: '2026-10-13',
    slots: [
      { id: 'a-mon-p3', week: 'A', day: 1, period: 'P3', start: '11:14', end: '12:16', room: 'H12' },
      { id: 'a-wed-p1', week: 'A', day: 3, period: 'P1', start: '08:50', end: '09:52', room: 'H12' },
      { id: 'a-thu-p5', week: 'A', day: 4, period: 'P5', start: '13:48', end: '14:50', room: 'H14' },
      { id: 'b-tue-p2', week: 'B', day: 2, period: 'P2', start: '09:52', end: '10:54', room: 'H12' },
      { id: 'b-thu-p4', week: 'B', day: 4, period: 'P4', start: '12:16', end: '13:18', room: 'Library' },
      { id: 'b-fri-p1', week: 'B', day: 5, period: 'P1', start: '08:50', end: '09:52', room: 'H12' },
    ],
  };
  const mine: ClassGroup = { id: 'demo-12eco6', facultyId, name: '12ECO6', year: 2027, programId: program.id, teacherId: DEMO_USER, timetable };
  const theirs: ClassGroup = { id: 'demo-12eco4', facultyId, name: '12ECO4', year: 2027, programId: program.id, teacherId: COLLEAGUE };

  const planned: Record<string, { planned: string[]; level: StudentEntry['level'] }> = {
    S03: { planned: ['Reader for extended texts', 'Extra time (25%) in tasks'], level: 'Supplementary' },
    S07: { planned: ['Version B worksheets (reduced text)', 'Instructions chunked and on the board'], level: 'Supplementary' },
    S11: { planned: ['Short movement breaks', 'Seat near the door'], level: 'QDTP' },
    S15: { planned: ['Text-to-speech on laptop', 'Scribe for in-class tasks'], level: 'Substantial' },
  };
  const students: StudentEntry[] = [];
  for (let i = 1; i <= 20; i++) {
    const code = `S${String(i).padStart(2, '0')}`;
    students.push({ id: newId(), classId: mine.id, code, planned: planned[code]?.planned ?? [], level: planned[code]?.level ?? '', active: true });
  }

  const L = (date: string, f: (l: LessonRecord) => void, classId = mine.id) => {
    const l = blankLesson(classId, date);
    f(l);
    return l;
  };
  const S = (k: string) => `eco09.hsc.${k}`;

  const lessons: LessonRecord[] = [
    L(d(13), (l) => {
      l.items = [{ itemId: 'b0.issue', finished: false }];
      l.activities = { 'b0.issue.a1': { state: 'done' }, 'b0.issue.a2': { state: 'done' }, 'b0.rt.a1': { state: 'done' } };
      l.resources = { 'r.booklet': { rating: 'good' }, 'r.site': { rating: 'ok' } };
      l.syllabus = [S('t3.growth.1')];
      l.outcomes = [S('H1')];
    }),
    L(d(12), (l) => {
      l.items = [{ itemId: 'b0.issue', finished: true }];
      l.activities = {
        'b0.issue.a3': { state: 'adapted', note: 'Used a worked example from a past HSC paper instead of the booklet set' },
        'b0.issue.a4': { state: 'done' },
        'b0.rt.a2': { state: 'done' },
      };
      l.added = [{ id: newId(), text: 'Five-question multiplier quiz on mini whiteboards' }];
      l.resources = { 'r.mdl': { rating: 'good' } };
      l.addedResources = [{ ...RBA_GROWTH, rating: 'good', note: 'GDP growth graph as the starter' }];
      l.syllabus = [S('t3.growth.1'), S('t3.growth.2')];
      l.outcomes = [S('H1'), S('H11')];
    }),
    L(d(9), (l) => {
      l.held = false;
      l.notHeldReason = 'Whole-school event';
    }),
    L(d(7), (l) => {
      l.items = [{ itemId: 'b0.policy', finished: true }];
      l.activities = {
        'b0.policy.a1': { state: 'done' },
        'b0.policy.a2': { state: 'done' },
        'b0.policy.a3': { state: 'done' },
        'b0.policy.a4': { state: 'skipped', note: 'Ran out of time; moved to Block 1' },
      };
      l.resources = { 'r.booklet': { rating: 'ok' } };
      l.syllabus = [S('t4.obj.1'), S('t4.obj.2'), S('t4.obj.3')];
      l.outcomes = [S('H1'), S('H5')];
      l.adjustments = { asPlanned: true, exceptions: [{ code: 'S07', text: 'Sorting cards with pictures as well as text' }] };
      l.note = 'Do the AD/AS sorting task as the Block 1 starter.';
    }),
    L(d(5), (l) => {
      l.items = [{ itemId: 'b0.check', finished: true }];
      l.activities = {
        'b0.check.a1': { state: 'done' },
        'b0.check.a2': { state: 'done' },
        'b0.check.a3': { state: 'adapted', note: 'Peer marking in pairs rather than groups' },
        'b0.check.a4': { state: 'done' },
      };
      l.resources = { 'r.calc': { rating: 'good' }, 'r.criteria': { rating: 'ok' } };
      l.syllabus = [S('t3.skills.1')];
      l.outcomes = [S('H11')];
      l.adjustments = { asPlanned: true, exceptions: [{ code: 'S03', text: 'Absent for the quiz; to sit it next lesson' }] };
    }),
    L(d(2), (l) => {
      l.items = [{ itemId: 'b1.issue', finished: false }];
      l.activities = { 'b1.issue.a1': { state: 'done' }, 'b1.issue.a2': { state: 'done' }, 'b1.rt.a1': { state: 'done' } };
      l.resources = { 'r.scorecard': { rating: 'poor', note: 'Figures out of date; refresh before the next lesson' }, 'r.site': { rating: 'good' } };
      l.addedResources = [
        { ...RBA_GROWTH, rating: 'good' },
        {
          id: 'x.abs-national-accounts',
          title: 'ABS National Accounts: latest release',
          type: 'data',
          url: 'https://www.abs.gov.au/statistics/economy/national-accounts/australian-national-accounts-national-income-expenditure-and-product/latest-release',
          rating: 'ok',
          note: 'Too much detail for a first look; use the key statistics only',
        },
      ];
      l.syllabus = [S('t3.growth.3'), S('t3.growth.4')];
      l.outcomes = [S('H1'), S('H7')];
    }),
    L(
      d(6),
      (l) => {
        l.items = [{ itemId: 'b0.issue', finished: true }];
        l.activities = { 'b0.issue.a1': { state: 'done' }, 'b0.issue.a2': { state: 'done' }, 'b0.issue.a3': { state: 'done' } };
        l.syllabus = [S('t3.growth.1')];
        l.outcomes = [S('H1')];
      },
      theirs.id,
    ),
  ];

  // Link the sample lessons to real timetabled lessons before today, leaving
  // two recent ones unrecorded so the "to record" list has something in it.
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const slots = generateSlots(calendar, timetable, timetable.from!, toISO(yesterday));
  const mineLessons = lessons.filter((l) => l.classId === mine.id);
  const picks = [-8, -7, -6, -4, -3, -2];
  if (slots.length >= 8) {
    mineLessons.forEach((l, i) => {
      const s = slots[slots.length + picks[i]];
      l.date = s.date;
      l.slot = { key: s.key, start: s.start, end: s.end, period: s.period };
      l.room = s.room;
    });
    // The demo starts recording from the first sample lesson, as a teacher would
    // when they begin using the register part-way through a term.
    timetable.from = slots[slots.length - 8].date;
  }

  const reviews: UnitReview[] = [
    {
      id: newId(),
      classId: mine.id,
      unitId: 'b0',
      worked: 'Teacher-led multiplier lessons landed well; the calculation quiz showed most students secure.',
      change: 'Give the AD/AS sorting task its own lesson.',
    },
  ];

  return {
    version: 2,
    faculty: { id: facultyId, name: 'HSIE', school: 'Demo High School', joinCode: 'DEMO-2027', calendar },
    members: [
      { userId: DEMO_USER, facultyId, displayName: 'You (demo)', role: 'admin' },
      { userId: COLLEAGUE, facultyId, displayName: 'A. Colleague', role: 'teacher' },
    ],
    programs: [program],
    classes: [mine, theirs],
    students,
    lessons,
    reviews,
  };
}

export class LocalStore implements Store {
  readonly mode = 'demo' as const;
  private db: DemoDb;
  private listeners = new Set<() => void>();

  constructor() {
    this.db = this.load();
  }

  private load(): DemoDb {
    const raw = safeStorage.get(KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DemoDb;
        if (parsed.version === 2) return parsed;
      } catch {
        /* reseed */
      }
    }
    const fresh = seedDemo();
    safeStorage.set(KEY, JSON.stringify(fresh));
    return fresh;
  }

  private commit() {
    safeStorage.set(KEY, JSON.stringify(this.db));
  }

  reset() {
    this.db = seedDemo();
    this.commit();
    this.listeners.forEach((f) => f());
  }

  async currentUser(): Promise<Session | null> {
    return { userId: DEMO_USER, email: 'demo@example.com' };
  }
  onAuthChange(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  async signInWithPassword() {}
  async signUp() {
    return 'signed-in' as const;
  }
  async sendCode() {}
  async verifyCode() {}
  async signOut() {}
  async changePassword() {}

  async myMembership() {
    return this.db.members.find((m) => m.userId === DEMO_USER) ?? null;
  }
  async createFaculty() {}
  async joinFaculty() {}
  async getFaculty() {
    return this.db.faculty;
  }
  async saveCalendar(_f: string, calendar: SchoolCalendar) {
    this.db.faculty = { ...this.db.faculty, calendar };
    this.commit();
  }
  async listMembers() {
    return this.db.members;
  }
  async setRole(_f: string, userId: string, role: Role) {
    const m = this.db.members.find((x) => x.userId === userId);
    if (m) m.role = role;
    this.commit();
  }
  async updateDisplayName(_f: string, name: string) {
    const m = this.db.members.find((x) => x.userId === DEMO_USER);
    if (m) m.displayName = name;
    this.commit();
  }

  async listPrograms(): Promise<ProgramMeta[]> {
    return this.db.programs.map(({ id, title, subject, year, version }) => ({ id, title, subject, year, version }));
  }
  async getProgram(id: string) {
    const p = this.db.programs.find((x) => x.id === id);
    if (!p) throw new Error('Program not found');
    return p;
  }
  async addProgram(_f: string, program: Program) {
    const copy = structuredClone(program);
    if (this.db.programs.some((p) => p.id === copy.id)) copy.id = `${copy.id}-${newId().slice(0, 6)}`;
    this.db.programs.push(copy);
    this.commit();
    return copy.id;
  }

  async listClasses(_f: string, scope: 'mine' | 'all') {
    return this.db.classes.filter((c) => scope === 'all' || c.teacherId === DEMO_USER);
  }
  async getClass(id: string) {
    const c = this.db.classes.find((x) => x.id === id);
    if (!c) throw new Error('Class not found');
    return c;
  }
  async saveClass(c: ClassGroup) {
    const i = this.db.classes.findIndex((x) => x.id === c.id);
    if (i >= 0) this.db.classes[i] = c;
    else this.db.classes.push(c);
    this.commit();
  }
  async deleteClass(id: string) {
    this.db.classes = this.db.classes.filter((c) => c.id !== id);
    this.db.lessons = this.db.lessons.filter((l) => l.classId !== id);
    this.db.students = this.db.students.filter((s) => s.classId !== id);
    this.db.reviews = this.db.reviews.filter((r) => r.classId !== id);
    this.commit();
  }

  async listStudents(classId: string) {
    return this.db.students.filter((s) => s.classId === classId).sort((a, b) => a.code.localeCompare(b.code));
  }
  async saveStudent(s: StudentEntry) {
    const i = this.db.students.findIndex((x) => x.id === s.id);
    if (i >= 0) this.db.students[i] = s;
    else this.db.students.push(s);
    this.commit();
  }
  async deleteStudent(id: string) {
    this.db.students = this.db.students.filter((s) => s.id !== id);
    this.commit();
  }

  async listLessons(classId: string) {
    return this.db.lessons.filter((l) => l.classId === classId).sort((a, b) => a.date.localeCompare(b.date));
  }
  async saveLesson(r: LessonRecord) {
    if (r.slot && this.db.lessons.some((x) => x.id !== r.id && x.classId === r.classId && x.slot?.key === r.slot?.key))
      throw new Error('This lesson time already has a record. Open it from the Lessons tab to change it.');
    const rec = { ...r, updatedAt: new Date().toISOString() };
    const i = this.db.lessons.findIndex((x) => x.id === r.id);
    if (i >= 0) this.db.lessons[i] = rec;
    else this.db.lessons.push(rec);
    this.commit();
  }
  async deleteLesson(id: string) {
    this.db.lessons = this.db.lessons.filter((l) => l.id !== id);
    this.commit();
  }

  async listReviews(classId: string) {
    return this.db.reviews.filter((r) => r.classId === classId);
  }
  async saveReview(r: UnitReview) {
    const i = this.db.reviews.findIndex((x) => x.classId === r.classId && x.unitId === r.unitId);
    const rec = { ...r, updatedAt: new Date().toISOString() };
    if (i >= 0) this.db.reviews[i] = { ...rec, id: this.db.reviews[i].id };
    else this.db.reviews.push(rec);
    this.commit();
  }
}
