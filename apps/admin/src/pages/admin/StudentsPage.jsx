import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ROLES } from '@lp/shared';
import { api } from '../../api/client.js';
import { keys } from '../../api/hooks.js';
import { EmptyState, ErrorBox, Pagination, Spinner, USER_STATUS_LABELS, UserStatusBadge } from '../../components/ui.jsx';
import { fmtDate } from '../../lib/format.js';

// Empty values stay out of the URL.
const withoutEmpty = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v));

export default function StudentsPage() {
  // Search, status filter and page live in the URL so "back" from a student returns to the same list.
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const status = params.get('status') || '';
  const page = Number(params.get('page')) || 1;
  const [input, setInput] = useState(q);

  useEffect(() => setInput(q), [q]);

  // Debounced search.
  useEffect(() => {
    if (input.trim() === q) return undefined;
    const t = setTimeout(() => setParams(withoutEmpty({ q: input.trim(), status }), { replace: true }), 400);
    return () => clearTimeout(t);
  }, [input, q, status, setParams]);

  const query = { role: ROLES.STUDENT, status: status || undefined, q: q || undefined, page, limit: 20 };
  const list = useQuery({
    queryKey: keys.users(query),
    queryFn: () => api('/admin/users', { query }),
    placeholderData: (prev) => prev,
  });

  const goTo = (p) => setParams(withoutEmpty({ q, status, page: String(p) }));

  return (
    <div className="page">
      <div className="page-header">
        <h1>الطلاب</h1>
        {list.data && <span className="muted">{list.data.total} طالب</span>}
      </div>
      <div className="row-between">
        <input
          className="search"
          type="search"
          placeholder="ابحث بالاسم أو رقم الهاتف…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <select value={status} onChange={(e) => setParams(withoutEmpty({ q, status: e.target.value }))} aria-label="تصفية حسب الحالة">
          <option value="">كل الحالات</option>
          {Object.entries(USER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {list.isPending && <Spinner />}
      <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      {list.data && !list.data.items.length && <EmptyState>لا توجد نتائج.</EmptyState>}
      {list.data?.items.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>الحالة</th>
                <th>الأجهزة</th>
                <th>تاريخ التسجيل</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td dir="ltr" className="ltr-cell">{s.phone}</td>
                  <td>
                    <UserStatusBadge status={s.status} />
                  </td>
                  <td>
                    {s.devices.length}/{s.maxDevices}
                  </td>
                  <td>{fmtDate(s.createdAt)}</td>
                  <td>
                    <Link to={`/admin/students/${s.id}`} className="btn btn-sm">
                      التفاصيل
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data && <Pagination page={page} limit={list.data.limit} total={list.data.total} onChange={goTo} />}
    </div>
  );
}
