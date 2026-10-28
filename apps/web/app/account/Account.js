'use client';

import { useEffect, useState } from 'react';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { api, errorText } from '@/lib/api';
import { formatDate } from '@/lib/format';
import styles from './account.module.css';

const PLATFORM_LABEL = { web: 'متصفح', ios: 'iPhone / iPad', android: 'Android', other: 'جهاز آخر' };

export default function Account() {
  return (
    <RequireAuth>
      <div className="container page">
        <h1 className="page-title">حسابي</h1>
        <AccountDetails />
      </div>
    </RequireAuth>
  );
}

function AccountDetails() {
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
          تسجيل الخروج لا يحرّر مكان الجهاز. لإزالة جهاز قديم تواصل مع الإدارة.
        </p>
      </section>
    </div>
  );
}
