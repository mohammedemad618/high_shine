'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { errorMessage } from '@lp/shared';
import { useAuth } from './AuthProvider';
import { errorText } from '@/lib/api';
import styles from './AuthForm.module.css';

/** Only same-site relative paths are accepted as a post-login destination. */
function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/my-courses';
}

export default function AuthForm({ mode, next }) {
  const isRegister = mode === 'register';
  const { user, ready, login, register, logoutReason } = useAuth();
  const router = useRouter();
  const destination = safeNext(next);

  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Already logged in (or just logged in): go on.
  useEffect(() => {
    if (ready && user) router.replace(destination);
  }, [ready, user, router, destination]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (isRegister && form.name.trim().length < 2) return setError('اكتب اسمك الكامل');
    if (form.password.length < (isRegister ? 8 : 1)) return setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');

    setBusy(true);
    try {
      const payload = { phone: form.phone.trim(), password: form.password };
      if (isRegister) await register({ ...payload, name: form.name.trim() });
      else await login(payload);
      // the effect above redirects once the session is stored
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <div className={`container ${styles.wrap}`}>
      <div className={`card ${styles.card}`}>
        <h1 className={styles.title}>{isRegister ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</h1>
        {logoutReason && !error && <div className="alert alert-info">{errorMessage(logoutReason)}</div>}

        <form className="form" onSubmit={onSubmit} noValidate>
          {isRegister && (
            <div className="field">
              <label htmlFor="name">الاسم الكامل</label>
              <input
                id="name"
                className="input"
                autoComplete="name"
                value={form.name}
                onChange={update('name')}
                maxLength={80}
                required
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="phone">رقم الهاتف</label>
            <input
              id="phone"
              className="input"
              type="tel"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              placeholder="07xxxxxxxxx"
              value={form.phone}
              onChange={update('phone')}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">كلمة المرور</label>
            <input
              id="password"
              className="input"
              type="password"
              dir="ltr"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={update('password')}
              minLength={isRegister ? 8 : undefined}
              maxLength={128}
              required
            />
            {isRegister && <span className="hint">8 أحرف على الأقل</span>}
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'لحظة…' : isRegister ? 'إنشاء الحساب' : 'دخول'}
          </button>
        </form>

        <p className={styles.note}>
          يُربط حسابك بالأجهزة التي تسجّل الدخول منها وعددها محدود، فلا تسجّل الدخول من أجهزة لا تملكها.
        </p>

        <p className={styles.switch}>
          {isRegister ? (
            <>
              لديك حساب؟{' '}
              <Link href={next ? `/login?next=${encodeURIComponent(destination)}` : '/login'}>سجّل الدخول</Link>
            </>
          ) : (
            <>
              ليس لديك حساب؟{' '}
              <Link href={next ? `/register?next=${encodeURIComponent(destination)}` : '/register'}>أنشئ حساباً</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
