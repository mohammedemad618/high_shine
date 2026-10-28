import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { logout } from '../api/client.js';
import { useSession } from '../api/hooks.js';
import UploadPanel from './UploadPanel.jsx';

const TEACHER_LINKS = [{ to: '/courses', label: 'كورساتي' }];

const ADMIN_LINKS = [
  { to: '/admin', label: 'الإحصائيات', end: true },
  { to: '/courses', label: 'الكورسات' },
  { to: '/admin/teachers', label: 'المدرّسون' },
  { to: '/admin/students', label: 'الطلاب' },
  { to: '/admin/codes', label: 'أكواد التفعيل' },
  { to: '/admin/enrollments', label: 'الاشتراكات' },
];

export default function Layout() {
  const { user, isAdmin } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = isAdmin ? ADMIN_LINKS : TEACHER_LINKS;

  return (
    <div className="shell">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">▶</span>
          <span>لوحة التحكم</span>
        </div>
        <nav className="nav" onClick={() => setMenuOpen(false)}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-name">{user?.name}</div>
          <div className="user-role">{isAdmin ? 'مدير' : 'مدرّس'}</div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => logout()}>
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="btn-icon menu-toggle" onClick={() => setMenuOpen((v) => !v)} aria-label="القائمة">
            ☰
          </button>
          <span className="topbar-title">لوحة التحكم</span>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      <UploadPanel />
    </div>
  );
}
