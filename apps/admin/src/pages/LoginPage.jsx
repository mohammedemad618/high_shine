import { useState } from 'react';
import { Navigate } from 'react-router';
import { login } from '../api/client.js';
import { useSession } from '../api/hooks.js';
import { Field, Spinner } from '../components/ui.jsx';

export default function LoginPage() {
  const { status, notice } = useSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (status === 'loading') return <Spinner />;
  if (status === 'authenticated') return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(phone.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={onSubmit}>
        <h1>تسجيل الدخول</h1>
        <p className="muted">لوحة المدرّسين والإدارة</p>
        {(error || notice) && (
          <div className="alert alert-error" role="alert">
            {error || notice}
          </div>
        )}
        <Field label="رقم الهاتف">
          <input
            type="tel"
            dir="ltr"
            inputMode="tel"
            autoComplete="username"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07xxxxxxxxx"
            required
          />
        </Field>
        <Field label="كلمة المرور">
          <input
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'جارٍ الدخول…' : 'دخول'}
        </button>
      </form>
    </div>
  );
}
