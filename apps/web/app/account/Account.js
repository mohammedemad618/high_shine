'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROLES } from '@lp/shared';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { api, deleteAccount, errorText } from '@/lib/api';
import { PLATFORM_LABEL, formatDate, formatDays } from '@/lib/format';
import styles from './account.module.css';

/** supportUrl and replaceCooldownDays come from /app-config (fetched by the server page); both may be null. */
export default function Account({ supportUrl = null, replaceCooldownDays = null }) {
  return (
    <RequireAuth>
      <div className="container page">
        <h1 className="page-title">حسابي</h1>
        <AccountDetails supportUrl={supportUrl} replaceCooldownDays={replaceCooldownDays} />
      </div>
    </RequireAuth>
  );
}

function AccountDetails({ supportUrl, replaceCooldownDays }) {
  const { user, setUser, logout } = useAuth();
  const [me, setMe] = useState({ user, currentDeviceId: null });
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  // Fresh profile and device list from the API (the stored copy may be old).
  useEffect(() => {
    const ctrl = new AbortController();
    api('/me', { signal: ctrl.signal })
      .then((data) => {
        setMe(data);
        setUser(data.user);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(errorText(err));
      });
    return () => ctrl.abort();
  }, [setUser]);

  // <RequireAuth> sends the user to the home page once the session is cleared.
  async function onLogout() {
    setLoggingOut(true);
    await logout();
  }

  const profile = me.user || user;
  const devices = profile.devices || [];

  return (
    <div className={styles.grid}>
      <section className={`card ${styles.block}`}>
        <h2 className={styles.heading}>البيانات الشخصية</h2>
        <dl className={styles.list}>
          <dt>الاسم</dt>
          <dd>{profile.name}</dd>
          <dt>رقم الهاتف</dt>
          <dd dir="ltr" className={styles.ltr}>
            {profile.phone}
          </dd>
          {profile.createdAt && (
            <>
              <dt>تاريخ التسجيل</dt>
              <dd>{formatDate(profile.createdAt)}</dd>
            </>
          )}
        </dl>
        <button type="button" className="btn btn-danger" onClick={onLogout} disabled={loggingOut}>
          {loggingOut ? 'جارٍ الخروج…' : 'تسجيل الخروج'}
        </button>
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className={styles.heading}>
          الأجهزة المرتبطة{' '}
          <span className="muted">
            ({devices.length} من {profile.maxDevices ?? '–'})
          </span>
        </h2>
        {error && <div className="alert alert-error">{error}</div>}
        {devices.length === 0 ? (
          <p className="muted">لا توجد أجهزة.</p>
        ) : (
          <ul className={styles.devices}>
            {devices.map((d) => (
              <li key={d.deviceId} className={styles.device}>
                <div>
                  <strong>{d.name || PLATFORM_LABEL[d.platform] || 'جهاز'}</strong>
                  {d.deviceId === me.currentDeviceId && <span className="badge badge-done">هذا الجهاز</span>}
                  <div className="muted">{PLATFORM_LABEL[d.platform] || d.platform}</div>
                </div>
                <div className={styles.deviceDates}>
                  <span>أُضيف: {formatDate(d.addedAt)}</span>
                  {d.lastSeenAt && <span>آخر استخدام: {formatDate(d.lastSeenAt)}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">
          تسجيل الخروج لا يحرّر مكان الجهاز. عند الدخول من جهاز جديد بعد بلوغ الحد يمكنك تسجيل الخروج من الجهاز الأقدم
          استخداماً بنفسك{replaceCooldownDays ? ` (مرة واحدة كل ${formatDays(replaceCooldownDays)})` : ''}، أو{' '}
          {supportUrl ? (
            <a href={supportUrl} target="_blank" rel="noopener noreferrer">
              التواصل مع الدعم
            </a>
          ) : (
            'التواصل مع الإدارة'
          )}
          .
        </p>
      </section>

      <ChangePassword />

      {profile.role === ROLES.STUDENT && <DeleteAccount />}
    </div>
  );
}

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirm: '' };

/** PATCH /me/password. The API signs out every other device; this one stays signed in. */
function ChangePassword() {
  const [form, setForm] = useState(EMPTY_PASSWORDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setDone(false);
  };

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setDone(false);
    if (!form.currentPassword) return setError('اكتب كلمة المرور الحالية');
    if (form.newPassword.length < 8) return setError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل');
    if (form.newPassword !== form.confirm) return setError('تأكيد كلمة المرور غير مطابق');

    setBusy(true);
    try {
      // A wrong current password is a 400 WRONG_PASSWORD, so it never signs this browser out.
      await api('/me/password', {
        method: 'PATCH',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      setForm(EMPTY_PASSWORDS);
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`card ${styles.block}`}>
      <h2 className={styles.heading}>تغيير كلمة المرور</h2>
      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="current-password">كلمة المرور الحالية</label>
          <input
            id="current-password"
            className="input"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={update('currentPassword')}
            maxLength={128}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="new-password">كلمة المرور الجديدة</label>
          <input
            id="new-password"
            className="input"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={update('newPassword')}
            minLength={8}
            maxLength={128}
            required
          />
          <span className="hint">8 أحرف على الأقل</span>
        </div>
        <div className="field">
          <label htmlFor="confirm-password">تأكيد كلمة المرور الجديدة</label>
          <input
            id="confirm-password"
            className="input"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={form.confirm}
            onChange={update('confirm')}
            maxLength={128}
            required
          />
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {done && (
          <div className="alert alert-success" role="status">
            تم تغيير كلمة المرور، وسُجّل الخروج من أجهزتك الأخرى.
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}
        </button>
      </form>
    </section>
  );
}

/** DELETE /me (students only; staff accounts are closed by an administrator). Two steps: explain, then password. */
function DeleteAccount() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function cancel() {
    setConfirming(false);
    setPassword('');
    setError('');
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!password) return setError('اكتب كلمة المرور لتأكيد الحذف');
    setBusy(true);
    try {
      await deleteAccount(password);
      router.replace('/');
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <section className={`card ${styles.block} ${styles.danger}`} aria-labelledby="delete-account-heading">
      <h2 id="delete-account-heading" className={`${styles.heading} ${styles.dangerHeading}`}>
        حذف الحساب
      </h2>
      <ul className={styles.consequences}>
        <li>يُحذف اسمك ورقم هاتفك وأجهزتك وسجل مشاهدتك.</li>
        <li>تفقد الوصول إلى كل الكورسات المفعّلة على هذا الحساب، ولا يمكن استرجاعها.</li>
        <li>تُسجَّل خارج كل أجهزتك فوراً، ولا يمكن التراجع عن الحذف.</li>
      </ul>

      {!confirming ? (
        <div>
          <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
            حذف حسابي
          </button>
        </div>
      ) : (
        <form className={`form ${styles.confirm}`} onSubmit={onSubmit} noValidate>
          <div className="alert alert-error">هل أنت متأكد؟ سيُحذف حسابك نهائياً. اكتب كلمة المرور للتأكيد.</div>
          <div className="field">
            <label htmlFor="delete-password">كلمة المرور</label>
            <input
              id="delete-password"
              className="input"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={128}
              autoFocus
              required
            />
          </div>
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
          <div className={styles.actions}>
            <button type="submit" className={`btn ${styles.dangerSolid}`} disabled={busy}>
              {busy ? 'جارٍ الحذف…' : 'حذف الحساب نهائياً'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={cancel} disabled={busy}>
              إلغاء
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
