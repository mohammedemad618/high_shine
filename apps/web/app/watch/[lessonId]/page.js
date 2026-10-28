import RequireAuth from '@/components/RequireAuth';
import Player from './Player';

export const metadata = { title: 'مشاهدة الدرس', robots: { index: false, follow: false } };

export default async function WatchPage({ params }) {
  const { lessonId } = await params;
  return (
    <RequireAuth>
      {/* key: a new lesson gets a fresh player (new playback session, new progress counters) */}
      <Player key={lessonId} lessonId={lessonId} />
    </RequireAuth>
  );
}
