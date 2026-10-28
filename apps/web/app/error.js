'use client';

export default function ErrorPage({ reset }) {
  return (
    <div className="container center-state">
      <h1>حدث خطأ غير متوقع</h1>
      <p className="muted">حاول مرة أخرى بعد قليل.</p>
      <button type="button" className="btn btn-primary" onClick={() => reset()}>
        إعادة المحاولة
      </button>
    </div>
  );
}
