import { useState } from 'react';
import { canLead, useApp } from '../app/context';
import { ErrorBox, useToast } from '../components/ui';
import { href } from '../app/router';
import { longDate } from '../lib/util';
import { LocalStore } from '../lib/store-local';

export function Settings() {
  const { store, member, session, faculty, reload } = useApp();
  const [name, setName] = useState(member?.displayName ?? '');
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string>();
  const [toast, say] = useToast();

  return (
    <>
      <div className="pagehead">
        <h1>Settings</h1>
        <p>{session?.email}</p>
      </div>
      <ErrorBox error={error} />
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(undefined);
          try {
            await store.updateDisplayName(member!.facultyId, name);
            say('Name saved');
            reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        }}
      >
        <div className="field">
          <label htmlFor="dn">Your name as colleagues see it</label>
          <input id="dn" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="submit">Save name</button>
      </form>

      <section className="card">
        <h2>School calendar</h2>
        <p className="small">
          {faculty?.calendar?.terms.length
            ? `${faculty.calendar.terms.length} terms set up, ${longDate(faculty.calendar.terms[0].studentsStart)} to ${longDate(faculty.calendar.terms.at(-1)!.end)}.`
            : 'Not set up yet. Term dates let each class list its lessons from its timetable.'}
        </p>
        <a className="btn" href={href('/calendar')}>
          {canLead(member) ? 'Edit school calendar' : 'View school calendar'}
        </a>
      </section>

      <section className="card">
        <h2>Privacy</h2>
        <ul className="small">
          <li>Students are stored as codes. Names stay on the device where you type them.</li>
          <li>Only you can change your classes. Head Teachers and admins in your faculty can read them.</li>
          <li>Downloads with names are made on your device. Store them with other confidential student records.</li>
        </ul>
      </section>

      {store.mode === 'cloud' && (
        <form
          className="card"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(undefined);
            try {
              await store.changePassword(pw);
              setPw('');
              say('Password changed');
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          <input type="email" name="email" autoComplete="username" value={session?.email ?? ''} readOnly hidden />
          <div className="field">
            <label htmlFor="npw">New password</label>
            <input id="npw" type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <button type="submit">Change password</button>
        </form>
      )}

      {store.mode === 'demo' ? (
        <section className="card">
          <h2>Demo data</h2>
          <p className="small">Put the sample lessons back the way they started.</p>
          <button
            type="button"
            onClick={() => {
              (store as LocalStore).reset();
              say('Demo reset');
            }}
          >
            Reset demo
          </button>
        </section>
      ) : (
        <button type="button" className="block" onClick={() => void store.signOut()}>
          Sign out
        </button>
      )}
      {toast}
    </>
  );
}
