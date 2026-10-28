import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <div className="empty">
      <h1>الصفحة غير موجودة</h1>
      <Link to="/" className="btn">
        العودة إلى الرئيسية
      </Link>
    </div>
  );
}
