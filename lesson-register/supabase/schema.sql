-- Lesson Register: database schema and security rules.
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.
--
-- Who can see what (enforced by the database, not just the app):
--   * Teachers see and change only their own classes and lessons.
--   * Head Teachers and admins can read every class in their faculty.
--   * Students are stored as codes only. Names never reach this database.

create extension if not exists pgcrypto;

-- ---------- Tables ----------

create table if not exists public.faculties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school text not null default '',
  join_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  faculty_id uuid not null references public.faculties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'teacher' check (role in ('teacher', 'head_teacher', 'admin')),
  display_name text not null default '',
  email text,
  created_at timestamptz not null default now(),
  primary key (faculty_id, user_id)
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculties(id) on delete cascade,
  title text not null,
  subject text not null default '',
  year int,
  version int not null default 1,
  content jsonb not null,
  archived boolean not null default false,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculties(id) on delete cascade,
  name text not null,
  year int not null,
  program_id uuid not null references public.programs(id),
  teacher_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  code text not null check (char_length(code) between 1 and 12),
  planned jsonb not null default '[]',
  level text not null default '' check (level in ('', 'QDTP', 'Supplementary', 'Substantial', 'Extensive')),
  active boolean not null default true,
  unique (class_id, code)
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  taught_on date not null,
  held boolean not null default true,
  not_held_reason text,
  items jsonb not null default '[]',
  activities jsonb not null default '{}',
  added jsonb not null default '[]',
  resources jsonb not null default '{}',
  added_resources jsonb not null default '[]',
  syllabus jsonb not null default '[]',
  outcomes jsonb not null default '[]',
  adjustments jsonb not null default '{"asPlanned": true, "exceptions": []}',
  note text,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lessons_class_date on public.lessons (class_id, taught_on);

create table if not exists public.unit_reviews (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  unit_id text not null,
  worked text not null default '',
  change text not null default '',
  updated_at timestamptz not null default now(),
  unique (class_id, unit_id)
);

-- Added after the first version: school calendar, class timetables, lesson times and rooms.
-- Safe to run again on an existing database.
alter table public.faculties add column if not exists calendar jsonb not null default '{}';
alter table public.classes add column if not exists timetable jsonb not null default '{"slots": []}';
alter table public.lessons add column if not exists slot jsonb;
alter table public.lessons add column if not exists room text check (room is null or char_length(room) <= 60);
-- One record per timetabled lesson, so a lesson can't be counted twice in the coverage matrix.
create unique index if not exists lessons_class_slot on public.lessons (class_id, (slot ->> 'key')) where slot is not null;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists lessons_touch on public.lessons;
create trigger lessons_touch before update on public.lessons
  for each row execute function public.touch_updated_at();
drop trigger if exists reviews_touch on public.unit_reviews;
create trigger reviews_touch before update on public.unit_reviews
  for each row execute function public.touch_updated_at();

-- ---------- Helper functions used by the rules ----------

create or replace function public.is_member(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where faculty_id = f and user_id = auth.uid());
$$;

create or replace function public.has_role(f uuid, roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where faculty_id = f and user_id = auth.uid() and role = any (roles));
$$;

create or replace function public.can_read_class(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from classes k
    where k.id = c
      and (k.teacher_id = auth.uid() or public.has_role(k.faculty_id, array['head_teacher', 'admin']))
  );
$$;

create or replace function public.can_write_class(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes k where k.id = c and k.teacher_id = auth.uid());
$$;

-- ---------- Actions the app calls ----------

-- Create a faculty; the caller becomes its admin.
create or replace function public.create_faculty(p_name text, p_school text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into faculties (name, school) values (trim(p_name), coalesce(trim(p_school), '')) returning id into fid;
  insert into members (faculty_id, user_id, role, display_name, email)
    values (fid, auth.uid(), 'admin', trim(p_display_name), auth.jwt() ->> 'email');
  return fid;
end $$;

-- Join a faculty with the code its admin shares; the caller joins as a teacher.
create or replace function public.join_faculty(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into fid from faculties where join_code = upper(trim(p_code));
  if fid is null then raise exception 'That code does not match a faculty'; end if;
  insert into members (faculty_id, user_id, role, display_name, email)
    values (fid, auth.uid(), 'teacher', trim(p_display_name), auth.jwt() ->> 'email')
    on conflict (faculty_id, user_id) do update set display_name = excluded.display_name;
  return fid;
end $$;

-- Change your own display name (and nothing else about your membership).
create or replace function public.update_display_name(p_faculty uuid, p_name text)
returns void language sql security definer set search_path = public as $$
  update members set display_name = trim(p_name) where faculty_id = p_faculty and user_id = auth.uid();
$$;

-- Tiny call used by the keep-awake job so a free project is not paused over the holidays.
create or replace function public.ping() returns timestamptz
language sql stable as $$ select now(); $$;

-- ---------- Row-level security ----------

alter table public.faculties enable row level security;
alter table public.members enable row level security;
alter table public.programs enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.lessons enable row level security;
alter table public.unit_reviews enable row level security;

drop policy if exists faculty_read on public.faculties;
create policy faculty_read on public.faculties for select to authenticated using (public.is_member(id));
-- Admins and Head Teachers can edit the faculty (including its school calendar).
drop policy if exists faculty_admin_update on public.faculties;
create policy faculty_admin_update on public.faculties for update to authenticated
  using (public.has_role(id, array['admin', 'head_teacher'])) with check (public.has_role(id, array['admin', 'head_teacher']));

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (public.is_member(faculty_id));
drop policy if exists members_admin_update on public.members;
create policy members_admin_update on public.members for update to authenticated
  using (public.has_role(faculty_id, array['admin'])) with check (public.has_role(faculty_id, array['admin']));
drop policy if exists members_admin_delete on public.members;
create policy members_admin_delete on public.members for delete to authenticated
  using (public.has_role(faculty_id, array['admin']));

drop policy if exists programs_read on public.programs;
create policy programs_read on public.programs for select to authenticated using (public.is_member(faculty_id));
drop policy if exists programs_add on public.programs;
create policy programs_add on public.programs for insert to authenticated
  with check (public.is_member(faculty_id) and created_by = auth.uid());
drop policy if exists programs_edit on public.programs;
create policy programs_edit on public.programs for update to authenticated
  using (created_by = auth.uid() or public.has_role(faculty_id, array['head_teacher', 'admin']))
  with check (public.is_member(faculty_id));
drop policy if exists programs_delete on public.programs;
create policy programs_delete on public.programs for delete to authenticated
  using (public.has_role(faculty_id, array['head_teacher', 'admin']));

drop policy if exists classes_read on public.classes;
create policy classes_read on public.classes for select to authenticated
  using (teacher_id = auth.uid() or public.has_role(faculty_id, array['head_teacher', 'admin']));
drop policy if exists classes_add on public.classes;
create policy classes_add on public.classes for insert to authenticated
  with check (teacher_id = auth.uid() and public.is_member(faculty_id));
drop policy if exists classes_edit on public.classes;
create policy classes_edit on public.classes for update to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid() and public.is_member(faculty_id));
drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes for delete to authenticated using (teacher_id = auth.uid());

-- Students, lessons and reviews follow their class.
drop policy if exists students_read on public.students;
create policy students_read on public.students for select to authenticated using (public.can_read_class(class_id));
drop policy if exists students_add on public.students;
create policy students_add on public.students for insert to authenticated with check (public.can_write_class(class_id));
drop policy if exists students_edit on public.students;
create policy students_edit on public.students for update to authenticated
  using (public.can_write_class(class_id)) with check (public.can_write_class(class_id));
drop policy if exists students_delete on public.students;
create policy students_delete on public.students for delete to authenticated using (public.can_write_class(class_id));

drop policy if exists lessons_read on public.lessons;
create policy lessons_read on public.lessons for select to authenticated using (public.can_read_class(class_id));
drop policy if exists lessons_add on public.lessons;
create policy lessons_add on public.lessons for insert to authenticated with check (public.can_write_class(class_id));
drop policy if exists lessons_edit on public.lessons;
create policy lessons_edit on public.lessons for update to authenticated
  using (public.can_write_class(class_id)) with check (public.can_write_class(class_id));
drop policy if exists lessons_delete on public.lessons;
create policy lessons_delete on public.lessons for delete to authenticated using (public.can_write_class(class_id));

drop policy if exists reviews_read on public.unit_reviews;
create policy reviews_read on public.unit_reviews for select to authenticated using (public.can_read_class(class_id));
drop policy if exists reviews_add on public.unit_reviews;
create policy reviews_add on public.unit_reviews for insert to authenticated with check (public.can_write_class(class_id));
drop policy if exists reviews_edit on public.unit_reviews;
create policy reviews_edit on public.unit_reviews for update to authenticated
  using (public.can_write_class(class_id)) with check (public.can_write_class(class_id));
drop policy if exists reviews_delete on public.unit_reviews;
create policy reviews_delete on public.unit_reviews for delete to authenticated using (public.can_write_class(class_id));

-- ---------- Data API access ----------
-- New Supabase projects no longer expose tables automatically, so grant
-- signed-in users access explicitly. Anonymous visitors get nothing except ping().

revoke all on public.faculties, public.members, public.programs, public.classes,
  public.students, public.lessons, public.unit_reviews from anon;
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on public.members, public.programs,
  public.classes, public.students, public.lessons, public.unit_reviews to authenticated;
-- Faculties are created and joined only through the functions below. Admins and
-- Head Teachers may change the name, school and calendar, never the join code.
revoke all on public.faculties from authenticated;
grant select on public.faculties to authenticated;
grant update (name, school, calendar) on public.faculties to authenticated;

revoke execute on function public.create_faculty(text, text, text), public.join_faculty(text, text),
  public.update_display_name(uuid, text), public.is_member(uuid), public.has_role(uuid, text[]),
  public.can_read_class(uuid), public.can_write_class(uuid) from public, anon;
grant execute on function public.create_faculty(text, text, text), public.join_faculty(text, text),
  public.update_display_name(uuid, text), public.is_member(uuid), public.has_role(uuid, text[]),
  public.can_read_class(uuid), public.can_write_class(uuid) to authenticated;
grant execute on function public.ping() to anon, authenticated;
