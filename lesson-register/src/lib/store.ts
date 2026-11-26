import type {
  ClassGroup,
  Faculty,
  SchoolCalendar,
  LessonRecord,
  Member,
  Program,
  ProgramMeta,
  Role,
  StudentEntry,
  UnitReview,
} from './types';

export interface Session {
  userId: string;
  email?: string;
}

export interface Store {
  readonly mode: 'demo' | 'cloud';

  // Sign-in
  currentUser(): Promise<Session | null>;
  onAuthChange(cb: () => void): () => void;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<'confirm-email' | 'signed-in'>;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  changePassword(password: string): Promise<void>;

  // Faculty membership
  myMembership(): Promise<Member | null>;
  createFaculty(name: string, school: string, displayName: string): Promise<void>;
  joinFaculty(code: string, displayName: string): Promise<void>;
  getFaculty(id: string): Promise<Faculty>;
  saveCalendar(facultyId: string, calendar: SchoolCalendar): Promise<void>;
  listMembers(facultyId: string): Promise<Member[]>;
  setRole(facultyId: string, userId: string, role: Role): Promise<void>;
  updateDisplayName(facultyId: string, name: string): Promise<void>;

  // Programs
  listPrograms(facultyId: string): Promise<ProgramMeta[]>;
  getProgram(id: string): Promise<Program>;
  /** Saves a copy of the program for the faculty and returns its id. */
  addProgram(facultyId: string, program: Program): Promise<string>;

  // Classes
  listClasses(facultyId: string, scope: 'mine' | 'all'): Promise<ClassGroup[]>;
  getClass(id: string): Promise<ClassGroup>;
  saveClass(c: ClassGroup): Promise<void>;
  deleteClass(id: string): Promise<void>;

  // Students (codes only)
  listStudents(classId: string): Promise<StudentEntry[]>;
  saveStudent(s: StudentEntry): Promise<void>;
  deleteStudent(id: string): Promise<void>;

  // Lessons
  listLessons(classId: string): Promise<LessonRecord[]>;
  saveLesson(r: LessonRecord): Promise<void>;
  deleteLesson(id: string): Promise<void>;

  // End-of-unit reviews
  listReviews(classId: string): Promise<UnitReview[]>;
  saveReview(r: UnitReview): Promise<void>;
}
