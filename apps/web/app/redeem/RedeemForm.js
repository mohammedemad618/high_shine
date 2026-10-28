'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ROLES } from '@lp/shared';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { api, errorText } from '@/lib/api';
import { formatDate } from '@/lib/format';
import styles from './redeem.module.css';

export default function RedeemForm() {
  return (
    <RequireAuth>
      <div className={`container ${styles.wrap}`}>
        <Redeem />
      </div>
    </RequireAuth>
  );
}

/** Shows the code as XXXX-XXXX-XXXX while typing; the API accepts any spacing or case anyway. */
function formatCode(raw) {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return compact.match(/.{1,4}/g)?.join('-') ?? '';
}

function Redeem() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  if (user.role !== ROLES.STUDENT) {
    return <div className="empty-state card">تفعيل الأكواد متاح لحسابات الطلاب فقط.</div>;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (code.replace(/-/g, '').length < 4) return setError('اكتب كود التفعيل');
    setBusy(true);
    try {
      setResult(await api('/enrollments/redeem', { method: 'POST', body: { code } }));
      setCode('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const { course, enrollment } = result;
    return (
      <div className={`card ${styles.card}`}>
        <div className={styles.successIcon} aria-hidden="true">
          ✓
        </div>
        <h1 className={styles.title}>تم تفعيل الكورس</h1>
        <p className={styles.courseName}>{course.title}</p>
        <p className="muted">
          {enrollment.expiresAt ? `الاشتراك فعّال حتى ${formatDate(enrollment.expiresAt)}` : 'اشتراك دائم'}
        </p>
        <Link href={`/courses/${course.slug}`} className="btn btn-primary btn-block">
          اذهب إلى الكورس
        </Link>
        <button type="button" className="btn btn-secondary btn-block" onClick={() => setResult(null)}>
          تفعيل كود آخر
        </button>
      </div>
    );
  }

  return (
    <div className={`card ${styles.card}`}>
      <h1 className={styles.title}>تفعيل كورس بكود</h1>
      <p className="muted">اكتب كود التفعيل الذي حصلت عليه لفتح الكورس في حسابك.</p>
      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="code">كود التفعيل</label>
          <input
            id="code"
            className={`input ${styles.codeInput}`}
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXX-XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(formatCode(e.target.value))}
            required
          />
        </div>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'جارٍ التفعيل…' : 'تفعيل'}
        </button>
      </form>
    </div>
  );
}
