import { useState, type FormEvent } from 'react';
import { useApp } from '../app/context';
import { ErrorBox } from '../components/ui';

export function Onboard() {
  const { store, reload } = useApp();
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [faculty, setFaculty] = useState('HSIE');
  const [school, setSchool] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'join') await store.joinFaculty(code, name);
      else await store.createFaculty(faculty, school, name);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 520, margin: '1rem auto' }}>
      <h1>{mode === 'join' ? 'Join your faculty' : 'Set up your faculty'}</h1>
      <p className="muted small">
        {mode === 'join'
          ? 'Ask your Head Teacher (or whoever set up Lesson Register) for the faculty code.'
          : 'You become the faculty’s admin and can invite colleagues with a code.'}
      </p>
      <ErrorBox error={error} />
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="display">Your name as colleagues see it</label>
          <input id="display" name="display" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {mode === 'join' ? (
          <div className="field">
            <label htmlFor="code">Faculty code</label>
            <input
              id="code"
              name="code"
              type="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="fac">Faculty</label>
              <input id="fac" name="fac" type="text" required value={faculty} onChange={(e) => setFaculty(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="school">School</label>
              <input id="school" name="school" type="text" autoComplete="organization" value={school} onChange={(e) => setSchool(e.target.value)} />
            </div>
          </>
        )}
        <button type="submit" className="primary block" disabled={busy}>
          {mode === 'join' ? 'Join faculty' : 'Create faculty'}
        </button>
      </form>
      <button type="button" className="quiet" style={{ marginTop: '0.75rem' }} onClick={() => setMode(mode === 'join' ? 'create' : 'join')}>
        {mode === 'join' ? 'First one here? Set up the faculty' : 'Have a code? Join a faculty'}
      </button>
    </div>
  );
}
