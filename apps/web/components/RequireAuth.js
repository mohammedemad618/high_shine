'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

/**
 * Renders children only for a logged-in user; otherwise sends them to /login and back afterwards.
 * After a deliberate logout on a protected page the user goes to the home page instead.
 */
export default function RequireAuth({ children }) {
  const { user, ready, logoutReason } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hadUser = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (user) {
      hadUser.current = true;
      return;
    }
    if (hadUser.current && !logoutReason) router.replace('/');
    else router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, user, logoutReason, router, pathname]);

  if (!ready || !user) {
    return (
      <div className="center-state">
        <span className="spinner" aria-label="جارٍ التحميل" />
      </div>
    );
  }
  return children;
}
