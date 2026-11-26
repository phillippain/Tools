import { useState, type FormEvent } from 'react';
import { useApp } from '../app/context';
import { ErrorBox } from '../components/ui';

type Mode = 'password' | 'create' | 'code';

export function SignIn() {
  const { store } = useApp();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    setInfo(undefined);
    try {
      if (mode === 'password') await store.signInWithPassword(email, password);
      else if (mode === 'create') {
        const r = await store.signUp(email, password);
        if (r === 'confirm-email')
          setInfo('Check your email and open the confirmation link, then sign in here. If the link says it has expired, try signing in anyway: school email filters sometimes open links first.');
      } else if (!codeSent) {
        await store.sendCode(email);
        setCodeSent(true);
        setInfo('We emailed you a sign-in code. Enter it below.');
      } else await store.verifyCode(email, code);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'create' ? 'Create your account' : 'Sign in';
  return (
    <div className="card" style={{ maxWidth: 460, margin: '1rem auto' }}>
      <h1>{title}</h1>
      <p className="muted small">Use your school email. Your lesson records are private to you and your faculty leaders.</p>
      <ErrorBox error={error} />
      {info && (
        <div className="notice" role="status">
          {info}
        </div>
      )}
      <form onSubmit={submit} aria-label={title}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            enterKeyHint={mode === 'code' && !codeSent ? 'send' : 'next'}
          />
        </div>
        {mode !== 'code' && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type={showPw ? 'text' : 'password'}
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              minLength={mode === 'create' ? 8 : undefined}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              enterKeyHint="done"
            />
            <button type="button" className="quiet" aria-pressed={showPw} onClick={() => setShowPw((v) => !v)} style={{ alignSelf: 'flex-start' }}>
              {showPw ? 'Hide password' : 'Show password'}
            </button>
          </div>
        )}
        {mode === 'code' && codeSent && (
          <div className="field">
            <label htmlFor="code">Code from the email</label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        )}
        <button type="submit" className="primary block" disabled={busy}>
          {mode === 'password' ? 'Sign in' : mode === 'create' ? 'Create account' : codeSent ? 'Sign in with code' : 'Email me a code'}
        </button>
      </form>
      <div className="stack" style={{ marginTop: '1rem' }}>
        {mode !== 'password' && (
          <button type="button" className="quiet" onClick={() => setMode('password')}>
            Sign in with a password
          </button>
        )}
        {mode !== 'create' && (
          <button type="button" className="quiet" onClick={() => setMode('create')}>
            New here? Create an account
          </button>
        )}
        {mode !== 'code' && (
          <button
            type="button"
            className="quiet"
            onClick={() => {
              setMode('code');
              setCodeSent(false);
            }}
          >
            Forgot your password? Email me a code
          </button>
        )}
      </div>
    </div>
  );
}
