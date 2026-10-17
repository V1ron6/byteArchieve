import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ErrorMsg } from '../ui.jsx';

export default function Auth({ mode }) {
  const { authenticate } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isReg = mode === 'register';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await authenticate(mode, username.trim(), password);
      nav(loc.state?.from || '/upload', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="center">
      <form className="card narrow" onSubmit={submit}>
        <h2>{isReg ? 'Create an account' : 'Welcome back'}</h2>
        <p className="muted">{isReg ? 'You need an account to upload. Downloading is always free.' : 'Log in to upload files.'}</p>

        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isReg ? 'new-password' : 'current-password'}
            minLength={isReg ? 8 : undefined}
            required
          />
        </label>

        <ErrorMsg error={error} />
        <button className="btn block" disabled={busy}>{busy ? 'Please wait…' : isReg ? 'Sign up' : 'Log in'}</button>
        <p className="muted small">
          {isReg ? <>Have an account? <Link to="/login">Log in</Link></> : <>New here? <Link to="/register">Sign up</Link></>}
        </p>
      </form>
    </section>
  );
}
