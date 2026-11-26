import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

type Row = Record<string, unknown>;

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const toMember = (r: Row): Member => ({
  userId: r.user_id as string,
  facultyId: r.faculty_id as string,
  displayName: (r.display_name as string) || (r.email as string) || 'Teacher',
  role: r.role as Role,
  email: (r.email as string) ?? undefined,
});

const toClass = (r: Row): ClassGroup => ({
  id: r.id as string,
  facultyId: r.faculty_id as string,
  name: r.name as string,
  year: r.year as number,
  programId: r.program_id as string,
  teacherId: r.teacher_id as string,
  createdAt: r.created_at as string,
  timetable: (r.timetable as Timetable) ?? { slots: [] },
});

const toStudent = (r: Row): StudentEntry => ({
  id: r.id as string,
  classId: r.class_id as string,
  code: r.code as string,
  planned: (r.planned as string[]) ?? [],
  level: (r.level as StudentEntry['level']) ?? '',
  active: r.active as boolean,
});

const toLesson = (r: Row): LessonRecord => ({
  id: r.id as string,
  classId: r.class_id as string,
  date: r.taught_on as string,
  held: r.held as boolean,
  notHeldReason: (r.not_held_reason as string) ?? undefined,
  items: (r.items as LessonRecord['items']) ?? [],
  activities: (r.activities as LessonRecord['activities']) ?? {},
  added: (r.added as LessonRecord['added']) ?? [],
  resources: (r.resources as LessonRecord['resources']) ?? {},
  addedResources: (r.added_resources as LessonRecord['addedResources']) ?? [],
  syllabus: (r.syllabus as string[]) ?? [],
  outcomes: (r.outcomes as string[]) ?? [],
  adjustments: (r.adjustments as LessonRecord['adjustments']) ?? { asPlanned: true, exceptions: [] },
  note: (r.note as string) ?? undefined,
  slot: (r.slot as LessonRecord['slot']) ?? undefined,
  room: (r.room as string) ?? undefined,
  updatedAt: r.updated_at as string,
});

const fromLesson = (l: LessonRecord): Row => ({
  id: l.id,
  class_id: l.classId,
  taught_on: l.date,
  held: l.held,
  not_held_reason: l.held ? null : (l.notHeldReason ?? null),
  items: l.items,
  activities: l.activities,
  added: l.added,
  resources: l.resources,
  added_resources: l.addedResources,
  syllabus: l.syllabus,
  outcomes: l.outcomes,
  adjustments: l.adjustments,
  note: l.note ?? null,
  slot: l.slot ?? null,
  room: l.room ?? null,
});

export class SupabaseStore implements Store {
  readonly mode = 'cloud' as const;
  private sb: SupabaseClient;

  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }

  private redirect() {
    return window.location.origin + window.location.pathname;
  }

  async currentUser(): Promise<Session | null> {
    const { data } = await this.sb.auth.getSession();
    const u = data.session?.user;
    return u ? { userId: u.id, email: u.email ?? undefined } : null;
  }
  onAuthChange(cb: () => void) {
    const { data } = this.sb.auth.onAuthStateChange(() => cb());
    return () => data.subscription.unsubscribe();
  }
  async signInWithPassword(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }
  async signUp(email: string, password: string) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: this.redirect() } });
    if (error) throw new Error(error.message);
    return data.session ? ('signed-in' as const) : ('confirm-email' as const);
  }
  async sendCode(email: string) {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: this.redirect() } });
    if (error) throw new Error(error.message);
  }
  async verifyCode(email: string, code: string) {
    const { error } = await this.sb.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    if (error) throw new Error(error.message);
  }
  async signOut() {
    await this.sb.auth.signOut();
  }
  async changePassword(password: string) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }

  async myMembership(): Promise<Member | null> {
    const s = await this.currentUser();
    if (!s) return null;
    const rows = check(await this.sb.from('members').select('*').eq('user_id', s.userId).limit(1));
    return rows && rows.length ? toMember(rows[0] as Row) : null;
  }
  async createFaculty(name: string, school: string, displayName: string) {
    check(await this.sb.rpc('create_faculty', { p_name: name, p_school: school, p_display_name: displayName }));
  }
  async joinFaculty(code: string, displayName: string) {
    check(await this.sb.rpc('join_faculty', { p_code: code, p_display_name: displayName }));
  }
  async getFaculty(id: string): Promise<Faculty> {
    const r = check(await this.sb.from('faculties').select('*').eq('id', id).single()) as Row;
    const cal = r.calendar as SchoolCalendar | null;
    return {
      id: r.id as string,
      name: r.name as string,
      school: r.school as string,
      joinCode: r.join_code as string,
      calendar: cal && Array.isArray(cal.terms) ? cal : undefined,
    };
  }
  async saveCalendar(facultyId: string, calendar: SchoolCalendar) {
    check(await this.sb.from('faculties').update({ calendar }).eq('id', facultyId));
  }
  async listMembers(facultyId: string) {
    const rows = check(await this.sb.from('members').select('*').eq('faculty_id', facultyId).order('display_name'));
    return (rows as Row[]).map(toMember);
  }
  async setRole(facultyId: string, userId: string, role: Role) {
    check(await this.sb.from('members').update({ role }).eq('faculty_id', facultyId).eq('user_id', userId));
  }
  async updateDisplayName(facultyId: string, name: string) {
    check(await this.sb.rpc('update_display_name', { p_faculty: facultyId, p_name: name }));
  }

  async listPrograms(facultyId: string): Promise<ProgramMeta[]> {
    const rows = check(
      await this.sb.from('programs').select('id,title,subject,year,version').eq('faculty_id', facultyId).eq('archived', false).order('title'),
    );
    return (rows as Row[]).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      subject: r.subject as string,
      year: r.year as number,
      version: r.version as number,
    }));
  }
  async getProgram(id: string): Promise<Program> {
    const r = check(await this.sb.from('programs').select('id,content').eq('id', id).single()) as Row;
    return { ...(r.content as Program), id: r.id as string };
  }
  async addProgram(facultyId: string, program: Program) {
    const r = check(
      await this.sb
        .from('programs')
        .insert({ faculty_id: facultyId, title: program.title, subject: program.subject, year: program.year, version: program.version, content: program })
        .select('id')
        .single(),
    ) as Row;
    return r.id as string;
  }

  async listClasses(facultyId: string, scope: 'mine' | 'all') {
    let q = this.sb.from('classes').select('*').eq('faculty_id', facultyId).order('year', { ascending: false }).order('name');
    if (scope === 'mine') {
      const s = await this.currentUser();
      if (s) q = q.eq('teacher_id', s.userId);
    }
    return (check(await q) as Row[]).map(toClass);
  }
  async getClass(id: string) {
    return toClass(check(await this.sb.from('classes').select('*').eq('id', id).single()) as Row);
  }
  async saveClass(c: ClassGroup) {
    check(
      await this.sb.from('classes').upsert({
        id: c.id,
        faculty_id: c.facultyId,
        name: c.name,
        year: c.year,
        program_id: c.programId,
        teacher_id: c.teacherId,
        timetable: c.timetable ?? { slots: [] },
      }),
    );
  }
  async deleteClass(id: string) {
    check(await this.sb.from('classes').delete().eq('id', id));
  }

  async listStudents(classId: string) {
    const rows = check(await this.sb.from('students').select('*').eq('class_id', classId).order('code'));
    return (rows as Row[]).map(toStudent);
  }
  async saveStudent(s: StudentEntry) {
    check(await this.sb.from('students').upsert({ id: s.id, class_id: s.classId, code: s.code, planned: s.planned, level: s.level, active: s.active }));
  }
  async deleteStudent(id: string) {
    check(await this.sb.from('students').delete().eq('id', id));
  }

  async listLessons(classId: string) {
    const rows = check(await this.sb.from('lessons').select('*').eq('class_id', classId).order('taught_on'));
    return (rows as Row[]).map(toLesson);
  }
  async saveLesson(r: LessonRecord) {
    const res = await this.sb.from('lessons').upsert(fromLesson(r));
    if (res.error?.message.includes('lessons_class_slot'))
      throw new Error('This lesson time already has a record. Open it from the Lessons tab to change it.');
    check(res);
  }
  async deleteLesson(id: string) {
    check(await this.sb.from('lessons').delete().eq('id', id));
  }

  async listReviews(classId: string) {
    const rows = check(await this.sb.from('unit_reviews').select('*').eq('class_id', classId));
    return (rows as Row[]).map((r) => ({
      id: r.id as string,
      classId: r.class_id as string,
      unitId: r.unit_id as string,
      worked: r.worked as string,
      change: r.change as string,
      updatedAt: r.updated_at as string,
    }));
  }
  async saveReview(r: UnitReview) {
    check(
      await this.sb
        .from('unit_reviews')
        .upsert({ class_id: r.classId, unit_id: r.unitId, worked: r.worked, change: r.change }, { onConflict: 'class_id,unit_id' }),
    );
  }
}
