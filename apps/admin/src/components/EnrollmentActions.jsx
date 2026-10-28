import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ENROLLMENT_STATUS } from '@lp/shared';
import { api } from '../api/client.js';
import { keys } from '../api/hooks.js';
import { fmtDate, fromDateInput, toDateInput } from '../lib/format.js';
import { ErrorBox, Field, Modal } from './ui.jsx';

export function enrollmentState(e) {
  if (e.status === ENROLLMENT_STATUS.REVOKED) return { label: 'ملغى', tone: 'failed' };
  if (e.expiresAt && new Date(e.expiresAt) < new Date()) return { label: 'منتهي', tone: 'draft' };
  return { label: 'فعّال', tone: 'ready' };
}

export const SOURCE_LABELS = { code: 'كود تفعيل', admin: 'الإدارة' };

export function EnrollmentExpiry({ enrollment }) {
  return enrollment.expiresAt ? fmtDate(enrollment.expiresAt) : 'دائم';
}

function useEnrollmentUpdate(onDone) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api(`/admin/enrollments/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      onDone?.();
    },
  });
}

function ExtendModal({ enrollment, onClose }) {
  const update = useEnrollmentUpdate(onClose);
  const base = enrollment.expiresAt && new Date(enrollment.expiresAt) > new Date() ? new Date(enrollment.expiresAt) : new Date();
  const [permanent, setPermanent] = useState(!enrollment.expiresAt);
  const [date, setDate] = useState(toDateInput(enrollment.expiresAt || new Date(base.getTime() + 30 * 86400_000)));

  const addDays = (days) => setDate(toDateInput(new Date(base.getTime() + days * 86400_000)));

  return (
    <Modal title="تمديد الاشتراك" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ id: enrollment.id, body: { expiresAt: permanent ? null : fromDateInput(date) } });
        }}
      >
        <ErrorBox error={update.error} />
        <p className="muted">
          ينتهي حالياً: <EnrollmentExpiry enrollment={enrollment} />
        </p>
        <label className="check">
          <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
          اشتراك دائم (بلا تاريخ انتهاء)
        </label>
        {!permanent && (
          <>
            <Field label="تاريخ الانتهاء الجديد">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <div className="chips">
              {[30, 90, 180, 365].map((d) => (
                <button key={d} type="button" className="btn btn-sm" onClick={() => addDays(d)}>
                  +{d} يوم
                </button>
              ))}
            </div>
          </>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={update.isPending}>
            حفظ
          </button>
          <button type="button" className="btn" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Revoke / re-activate / extend buttons for one enrollment. */
export default function EnrollmentActions({ enrollment }) {
  const [extending, setExtending] = useState(false);
  const update = useEnrollmentUpdate();
  const revoked = enrollment.status === ENROLLMENT_STATUS.REVOKED;

  return (
    <div className="row-actions">
      {revoked ? (
        <button
          type="button"
          className="btn btn-sm"
          disabled={update.isPending}
          onClick={() => update.mutate({ id: enrollment.id, body: { status: ENROLLMENT_STATUS.ACTIVE } })}
        >
          إعادة التفعيل
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-sm btn-ghost danger"
          disabled={update.isPending}
          onClick={() =>
            window.confirm('إلغاء هذا الاشتراك؟ سيفقد الطالب الوصول إلى الكورس.') &&
            update.mutate({ id: enrollment.id, body: { status: ENROLLMENT_STATUS.REVOKED } })
          }
        >
          إلغاء
        </button>
      )}
      <button type="button" className="btn btn-sm" onClick={() => setExtending(true)}>
        تمديد
      </button>
      {update.error && <span className="text-error small">{update.error.message}</span>}
      {extending && <ExtendModal enrollment={enrollment} onClose={() => setExtending(false)} />}
    </div>
  );
}
