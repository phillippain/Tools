import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppCtx, canLead, type AppState } from './app/context';
import { href, useRoute, useRoutePath } from './app/router';
import { DEMO, SUPABASE_KEY, SUPABASE_URL } from './config';
import { LocalStore } from './lib/store-local';
import { SupabaseStore } from './lib/store-supabase';
import type { Store, Session } from './lib/store';
import type { Faculty, Member } from './lib/types';
import { Icon, Loading } from './components/ui';
import { SignIn } from './pages/SignIn';
import { Onboard } from './pages/Onboard';
import { Today } from './pages/Today';
import { Classes } from './pages/Classes';
import { ClassPage } from './pages/ClassPage';
import { RecordLesson } from './pages/RecordLesson';
import { Programs } from './pages/Programs';
import { ProgramView } from './pages/ProgramView';
import { FacultyPage } from './pages/Faculty';
import { Settings } from './pages/Settings';
import { CalendarPage } from './pages/CalendarPage';
import { TimetablePage } from './pages/TimetablePage';

function makeStore(): Store {
  return DEMO ? new LocalStore() : new SupabaseStore(SUPABASE_URL, SUPABASE_KEY);
}

export default function App() {
  const store = useMemo(makeStore, []);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const s = await store.currentUser();
      setSession(s);
      if (s) {
        const m = await store.myMembership();
        setMember(m);
        setFaculty(m ? await store.getFaculty(m.facultyId) : null);
      } else {
        setMember(null);
        setFaculty(null);
      }
      setBootError(undefined);
    } catch (e) {
      setBootError(e instanceof Error ? e.message : String(e));
    } finally {
      setReady(true);
    }
  }, [store]);

  useEffect(() => {
    void load();
    return store.onAuthChange(() => void load());
  }, [store, load]);

  const state: AppState = { store, session, member, faculty, reload: () => void load() };

  return (
    <AppCtx.Provider value={state}>
      <header className="topbar">
        <a className="brand" href={href('/')}>
          Lesson Register
        </a>
        {faculty && (
          <span className="where">
            {faculty.name}
            {faculty.school ? ` · ${faculty.school}` : ''}
          </span>
        )}
      </header>
      {store.mode === 'demo' && (
        <div className="demo-banner">
          <strong>Demo.</strong> Sample data, kept only in this browser. Nothing is sent anywhere.
        </div>
      )}
      <main>
        {!ready ? (
          <Loading />
        ) : bootError ? (
          <div className="error" role="alert">
            Couldn’t reach the database: {bootError}
          </div>
        ) : !session ? (
          <SignIn />
        ) : !member ? (
          <Onboard />
        ) : (
          <Routes />
        )}
      </main>
      {ready && session && member && <BottomNav lead={canLead(member)} />}
    </AppCtx.Provider>
  );
}

function Routes() {
  const path = useRoutePath();
  const r = useRoute();
  const [a, b, c, d] = r;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);
  if (!a) return <Today />;
  if (a === 'classes') return <Classes />;
  if (a === 'class' && b && c === 'record') return <RecordLesson classId={b} />;
  if (a === 'class' && b && c === 'timetable') return <TimetablePage classId={b} />;
  if (a === 'class' && b && c === 'lesson' && d) return <RecordLesson classId={b} lessonId={d} />;
  if (a === 'class' && b) return <ClassPage classId={b} tab={c ?? 'progress'} />;
  if (a === 'programs') return <Programs />;
  if (a === 'program' && b) return <ProgramView programId={b} />;
  if (a === 'faculty') return <FacultyPage />;
  if (a === 'settings') return <Settings />;
  if (a === 'calendar') return <CalendarPage />;
  return (
    <div className="card">
      <h1>Page not found</h1>
      <a href={href('/')}>Back to today</a>
    </div>
  );
}

function BottomNav({ lead }: { lead: boolean }) {
  const [a] = useRoute();
  const cur = (k: string) => (k === (a ?? '') || (k === 'classes' && a === 'class') || (k === 'programs' && a === 'program') || (k === 'settings' && a === 'calendar') ? 'page' : undefined);
  return (
    <nav className="bottomnav" aria-label="Main">
      <a href={href('/')} aria-current={cur('')}>
        {Icon.today}Today
      </a>
      <a href={href('/classes')} aria-current={cur('classes')}>
        {Icon.classes}Classes
      </a>
      <a href={href('/programs')} aria-current={cur('programs')}>
        {Icon.programs}Programs
      </a>
      {lead && (
        <a href={href('/faculty')} aria-current={cur('faculty')}>
          {Icon.faculty}Faculty
        </a>
      )}
      <a href={href('/settings')} aria-current={cur('settings')}>
        {Icon.settings}Settings
      </a>
    </nav>
  );
}
