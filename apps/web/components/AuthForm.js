'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ERROR_CODES, errorMessage, normalizePhone } from '@lp/shared';
import { useAuth } from './AuthProvider';
import { errorText } from '@/lib/api';
import { PLATFORM_LABEL, formatDate, formatDateTime, formatDays } from '@/lib/format';
import styles from './AuthForm.module.css';

// The API's rule once the number is normalized (Arabic digits, +964…, 00964… and 7… all become 07…).
const PHONE_RE = /^\+?\d{7,15}$/;

/** Only same-site relative paths are accepted as a post-login destination. */
function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/my-courses';
}

/** "Contact support" as a WhatsApp link when /app-config has a number, plain text otherwise. */
function ContactSupport({ url }) {
  if (!url) return 'تواصل مع إدارة المنصة';
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      تواصل مع الدعم عبر واتساب
    </a>
  );
}

/**
 * supportUrl and replaceCooldownDays come from /app-config (fetched by the server page); both may be null.
 */
export default function AuthForm({ mode, next, supportUrl = null, replaceCooldownDays = null }) {
  const isRegister = mode === 'register';
  const { user, ready, login, register, logoutReason } = useAuth();
  const router = useRouter();
  const destination = safeNext(next);

  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // DEVICE_LIMIT details ({ canReplace, nextReplaceAt, replaceTarget }) while that question is open.
  const [deviceLimit, setDeviceLimit] = useState(null);

  // Already logged in (or just logged in): go on.
  useEffect(() => {
    if (ready && user) router.replace(destination);
  }, [ready, user, router, destination]);

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setDeviceLimit(null); // the offer was made for the account typed before
  };

  async function send(replaceDevice) {
    setError('');
    setBusy(true);
    try {
      const payload = { phone: normalizePhone(form.phone), password: form.password };
      if (isRegister) await register({ ...payload, name: form.name.trim() });
      else await login({ ...payload, replaceDevice });
      // the effect above redirects once the session is stored
    } catch (err) {
      if (err?.code === ERROR_CODES.DEVICE_LIMIT) {
        setDeviceLimit(err.details || {});
      } else if (err?.code === ERROR_CODES.DEVICE_REPLACE_LOCKED) {
        setDeviceLimit({ canReplace: false, nextReplaceAt: err.details?.nextReplaceAt ?? null, replaceTarget: null });
      } else {
        setDeviceLimit(null);
        setError(errorText(err));
      }
      setBusy(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    setError('');
    setDeviceLimit(null);
    if (isRegister && form.name.trim().length < 2) return setError('اكتب اسمك الكامل');
    if (!PHONE_RE.test(normalizePhone(form.phone))) return setError('اكتب رقم هاتف صحيحاً، مثل 07xxxxxxxxx');
    if (isRegister && form.password.length < 8) return setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    if (!form.password) return setError('اكتب كلمة المرور');
    send(false);
  }

  // While the swap is offered, its button replaces the submit button (two primary buttons would compete).
  const offeringSwap = Boolean(deviceLimit?.canReplace && deviceLimit.replaceTarget);

  return (
    <div className={`container ${styles.wrap}`}>
      <div className={`card ${styles.card}`}>
        <h1 className={styles.title}>{isRegister ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</h1>
        {logoutReason && !error && !deviceLimit && <div className="alert alert-info">{errorMessage(logoutReason)}</div>}

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

          {deviceLimit && (
            <DeviceLimitNotice
              details={deviceLimit}
              busy={busy}
              supportUrl={supportUrl}
              cooldownDays={replaceCooldownDays}
              onReplace={() => send(true)}
              onCancel={() => setDeviceLimit(null)}
            />
          )}

          {isRegister && (
            <p className={styles.consent}>
              بإنشاء الحساب فإنك توافق على{' '}
              <Link href="/terms" target="_blank">
                شروط الاستخدام
              </Link>{' '}
              و
              <Link href="/privacy" target="_blank">
                سياسة الخصوصية
              </Link>
              .
            </p>
          )}

          {!offeringSwap && (
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'لحظة…' : isRegister ? 'إنشاء الحساب' : 'دخول'}
            </button>
          )}
        </form>

        {!isRegister && (
          <details className={styles.forgot}>
            <summary>نسيت كلمة المرور؟</summary>
            <p>
              لا يمكن استعادة كلمة المرور من الموقع. <ContactSupport url={supportUrl} /> ويُعاد تعيينها لك بعد التحقق من
              رقم هاتفك.
            </p>
          </details>
        )}

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

/**
 * The DEVICE_LIMIT answer. Offers to sign out the least recently used device (replaceTarget) and retry the login;
 * while that self-service swap is on cooldown it says when it becomes possible and points to support instead.
 */
function DeviceLimitNotice({ details, busy, supportUrl, cooldownDays, onReplace, onCancel }) {
  const target = details.replaceTarget;

  if (details.canReplace && target) {
    return (
      <div className={styles.notice} role="alert">
        <strong>{errorMessage(ERROR_CODES.DEVICE_LIMIT)}</strong>
        <p>للمتابعة على هذا الجهاز سيُسجَّل الخروج من الجهاز الأقدم استخداماً في حسابك:</p>
        <div className={styles.device}>
          <span className={styles.deviceName}>{target.name || PLATFORM_LABEL[target.platform] || 'جهاز'}</span>
          {target.lastSeenAt && <span className="hint">آخر استخدام: {formatDate(target.lastSeenAt)}</span>}
        </div>
        {cooldownDays ? <p className="hint">يمكنك استبدال جهاز بهذه الطريقة مرة واحدة كل {formatDays(cooldownDays)}.</p> : null}
        <button type="button" className="btn btn-primary btn-block" onClick={onReplace} disabled={busy}>
          {busy ? 'لحظة…' : 'تسجيل الخروج منه والمتابعة'}
        </button>
        <button type="button" className="btn btn-secondary btn-block" onClick={onCancel} disabled={busy}>
          إلغاء
        </button>
      </div>
    );
  }

  return (
    <div className={`${styles.notice} ${styles.noticeLocked}`} role="alert">
      <strong>{errorMessage(ERROR_CODES.DEVICE_LIMIT)}</strong>
      {details.nextReplaceAt ? (
        <p>
          استبدلت جهازاً مؤخراً، ويمكنك استبدال جهاز آخر بنفسك ابتداءً من {formatDateTime(details.nextReplaceAt)}. وللدخول
          قبل ذلك <ContactSupport url={supportUrl} /> لإزالة جهاز قديم.
        </p>
      ) : (
        <p>
          لإزالة جهاز قديم من حسابك <ContactSupport url={supportUrl} />.
        </p>
      )}
    </div>
  );
}
