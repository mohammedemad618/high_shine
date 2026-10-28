import Link from 'next/link';

export const metadata = { title: 'الصفحة غير موجودة' };

export default function NotFound() {
  return (
    <div className="container center-state">
      <h1>الصفحة غير موجودة</h1>
      <p className="muted">ربما حُذفت الصفحة أو أن الرابط غير صحيح.</p>
      <Link href="/" className="btn btn-primary">
        العودة للرئيسية
      </Link>
    </div>
  );
}
