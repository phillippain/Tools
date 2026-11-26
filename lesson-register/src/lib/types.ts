// Data model for Lesson Register.
//
// Reference data (syllabuses) ships with the site as JSON. Programs are
// faculty documents stored as JSON. Everything a teacher records (classes,
// lessons, adjustments, reviews) lives in the database, keyed by IDs from the
// program and syllabus. Students are stored only as codes; names stay on the
// teacher's own device (see roster.ts).

// ---------- Syllabus library ----------

export interface Syllabus {
  id: string; // e.g. "eco09"
  subject: string; // "Economics"
  title: string; // "Economics Stage 6 Syllabus (2009)"
  shortTitle: string; // "Economics (2009)"
  officialUrl: string;
  note?: string;
  courses: SyllabusCourse[];
}

export interface SyllabusCourse {
  id: string; // "eco09.hsc"
  title: string; // "HSC course (Year 12)"
  outcomes: Outcome[];
  areas: SyllabusArea[]; // topics or focus areas
}

export interface Outcome {
  id: string; // "eco09.hsc.H1"
  code: string; // "H1"
  label: string; // short label, not the official wording
}

export interface SyllabusArea {
  id: string; // "eco09.hsc.t3"
  code: string; // "Topic 3"
  title: string; // "Economic Issues"
  groups: ContentGroup[];
}

export interface ContentGroup {
  id: string; // "eco09.hsc.t3.growth"
  title: string;
  points: ContentPoint[];
}

export interface ContentPoint {
  id: string; // "eco09.hsc.t3.growth.1"
  label: string;
  skill?: boolean; // a "learn to" point
}

// ---------- Programs ----------

export type ProgramStructure = 'lessons' | 'blocks' | 'mixed';

export interface Program {
  id: string;
  title: string;
  subject: string;
  syllabusId: string;
  courseId: string;
  year: number;
  version: number;
  structure: ProgramStructure;
  summary?: string;
  source?: { title: string; url?: string };
  differentiation?: Strategy[];
  resources?: Resource[]; // used across the whole program
  units: Unit[];
}

export type UnitKind = 'teaching' | 'assessment' | 'revision';

export interface Unit {
  id: string;
  code: string; // "Block 1", "Program 01"
  title: string;
  kind: UnitKind;
  timing?: string; // "Term 2, Weeks 1–3"
  summary?: string;
  routines?: Activity[]; // run in every lesson of the unit
  resources?: Resource[];
  differentiation?: Strategy[];
  items: Item[];
}

// 'lesson' = one lesson, recorded as done in one go.
// 'part'   = a chunk of a block that runs over several lessons.
export type ItemKind = 'lesson' | 'part' | 'checkpoint' | 'assessment';

export interface Item {
  id: string;
  code?: string; // "L12", "Issue"
  title: string;
  kind: ItemKind;
  share?: string; // "about 40% of block time"
  detail?: string;
  intention?: string;
  activities: Activity[];
  resources: Resource[];
  syllabus: string[]; // content point ids
  outcomes: string[]; // outcome ids
  differentiation?: Strategy[];
}

export interface Activity {
  id: string;
  text: string;
}

export type ResourceType =
  | 'web'
  | 'video'
  | 'slides'
  | 'worksheet'
  | 'document'
  | 'textbook'
  | 'quiz'
  | 'classroom'
  | 'data'
  | 'other';

export const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: 'web', label: 'Web page or link' },
  { value: 'video', label: 'Video' },
  { value: 'slides', label: 'Slides' },
  { value: 'worksheet', label: 'Worksheet' },
  { value: 'document', label: 'Document or reading' },
  { value: 'textbook', label: 'Textbook' },
  { value: 'quiz', label: 'Quiz or test' },
  { value: 'classroom', label: 'Google Classroom' },
  { value: 'data', label: 'Data or statistics' },
  { value: 'other', label: 'Other' },
];

export interface Resource {
  id: string;
  title: string;
  url?: string;
  note?: string;
  type?: ResourceType;
}

export interface Strategy {
  id: string;
  text: string;
  who?: string;
}

// ---------- People and classes ----------

export type Role = 'teacher' | 'head_teacher' | 'admin';

export interface Member {
  userId: string;
  facultyId: string;
  displayName: string;
  role: Role;
  email?: string;
}

export interface Faculty {
  id: string;
  name: string;
  school: string;
  joinCode?: string;
  calendar?: SchoolCalendar;
}

// ---------- School calendar and timetables ----------

export interface Term {
  id: string;
  name: string; // "Term 1 2027"
  start: string; // first day of term for staff; sets Week 1
  studentsStart: string; // first day students attend
  end: string; // last day for students
  firstWeek: 'A' | 'B'; // which timetable week Week 1 is
}

export interface NonTeachingDay {
  date: string;
  label: string; // "Good Friday"
}

export interface SchoolCalendar {
  cycle: 'weekly' | 'fortnightly'; // fortnightly = Week A / Week B
  terms: Term[];
  days: NonTeachingDay[];
  source?: string;
}

export type Weekday = 1 | 2 | 3 | 4 | 5; // Monday = 1

export interface TimetableSlot {
  id: string;
  week: 'A' | 'B' | 'every';
  day: Weekday;
  period: string; // "P3"
  start: string; // "11:05"
  end: string; // "12:18"
  room: string;
}

export interface Timetable {
  slots: TimetableSlot[];
  from?: string; // first date the timetable applies
}

/** One timetabled lesson, generated from the calendar and the class timetable. */
export interface LessonSlot {
  key: string; // "2027-02-03|slotId"
  slotId: string;
  date: string;
  start: string;
  end: string;
  period: string;
  room: string;
  term: string;
  week: number;
  ab?: 'A' | 'B';
}

export interface ClassGroup {
  id: string;
  facultyId: string;
  name: string; // "12ECO6"
  year: number;
  programId: string;
  teacherId: string;
  createdAt?: string;
  timetable?: Timetable;
}

export const NCCD_LEVELS = ['', 'QDTP', 'Supplementary', 'Substantial', 'Extensive'] as const;
export type NccdLevel = (typeof NCCD_LEVELS)[number];

export interface StudentEntry {
  id: string;
  classId: string;
  code: string; // e.g. "S07" — never a name
  planned: string[]; // planned adjustments, plain words
  level: NccdLevel;
  active: boolean;
}

// ---------- What happened ----------

export type ActivityState = 'done' | 'adapted' | 'skipped';
export type Rating = 'good' | 'ok' | 'poor' | 'unused';

export interface LessonRecord {
  id: string;
  classId: string;
  date: string; // YYYY-MM-DD
  held: boolean;
  notHeldReason?: string;
  items: { itemId: string; finished: boolean }[];
  activities: Record<string, { state: ActivityState; note?: string }>;
  added: { id: string; text: string }[];
  resources: Record<string, { rating: Rating; note?: string }>;
  addedResources: AddedResource[];
  syllabus: string[];
  outcomes: string[];
  adjustments: { asPlanned: boolean; exceptions: { code: string; text: string }[] };
  note?: string;
  slot?: { key: string; start: string; end: string; period?: string };
  room?: string;
  updatedAt?: string;
}

export interface AddedResource {
  id: string;
  title: string;
  type?: ResourceType;
  url?: string;
  note?: string;
  rating?: Rating;
}

export interface UnitReview {
  id: string;
  classId: string;
  unitId: string;
  worked: string;
  change: string;
  updatedAt?: string;
}

export interface ProgramMeta {
  id: string;
  title: string;
  subject: string;
  year: number;
  version: number;
}
