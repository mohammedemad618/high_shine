import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { COURSE_STATUS } from '@lp/shared';
import { api } from '../../api/client.js';
import { keys } from '../../api/hooks.js';
import { CourseStatusBadge, ErrorBox, Spinner } from '../../components/ui.jsx';
import CourseInfoForm from './CourseInfoForm.jsx';
import SectionsBoard from './SectionsBoard.jsx';
import UploadVideosModal from './UploadVideosModal.jsx';
import { setCourseSummary } from './courseCache.js';

export default function CourseEditorPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const details = useQuery({ queryKey: keys.course(id), queryFn: () => api(`/courses/${id}`) });

  const course = details.data?.course;
  const published = course?.status === COURSE_STATUS.PUBLISHED;

  const publish = useMutation({
    mutationFn: () => api(`/courses/${course.id}/publish`, { method: 'POST', body: { published: !published } }),
    onSuccess: (data) => setCourseSummary(qc, course.id, data.course),
  });

  if (details.isPending) return <Spinner />;
  if (details.error) return <ErrorBox error={details.error} onRetry={() => details.refetch()} />;

  // Lessons are addressed by the real id even when the route used a slug.
  const courseId = course.id;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/courses" className="back-link">
            → الكورسات
          </Link>
          <h1>
            {course.title} <CourseStatusBadge status={course.status} />
          </h1>
        </div>
        <div className="header-actions">
          <Link to={`/courses/${courseId}/stats`} className="btn">
            الإحصائيات
          </Link>
          <button
            type="button"
            className={`btn ${published ? '' : 'btn-primary'}`}
            disabled={publish.isPending}
            onClick={() => {
              if (published && !window.confirm('إخفاء الكورس؟ لن يظهر للطلاب الجدد في القائمة.')) return;
              publish.mutate();
            }}
          >
            {published ? 'إخفاء الكورس' : 'نشر الكورس'}
          </button>
        </div>
      </div>
      <ErrorBox error={publish.error} />

      <CourseInfoForm key={courseId} course={course} />

      <section className="card">
        <div className="row-between">
          <h2 className="card-title">الأقسام والدروس</h2>
          <button type="button" className="btn btn-primary" onClick={() => setUploading(true)} disabled={!details.data.sections.length}>
            رفع فيديوهات
          </button>
        </div>
        <p className="muted small">اسحب ⠿ لإعادة ترتيب الأقسام والدروس، ويمكن نقل الدرس بين الأقسام.</p>
        <SectionsBoard courseId={courseId} sections={details.data.sections} />
      </section>

      {uploading && <UploadVideosModal courseId={courseId} sections={details.data.sections} onClose={() => setUploading(false)} />}
    </div>
  );
}
