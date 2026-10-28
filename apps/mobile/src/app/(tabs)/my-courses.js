import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseCover } from '../../components/CourseCover';
import { Badge, Button, Card, EmptyView, ErrorView, Loading, ProgressBar, ScreenTitle, T } from '../../components/ui';
import { useMyCourses } from '../../hooks/queries';
import { colors, daysUntil, radius, spacing } from '../../theme';

export default function MyCoursesScreen() {
  const insets = useSafeAreaInsets();
  const { data, error, isPending, isRefetching, refetch } = useMyCourses();

  if (isPending) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const items = data.items;
  const completed = items.reduce((n, i) => n + (i.completedLessons || 0), 0);
  const remaining = items.reduce((n, i) => n + Math.max(0, (i.totalLessons || 0) - (i.completedLessons || 0)), 0);

  return (
    <FlatList
      style={styles.flex}
      data={items}
      keyExtractor={(item) => item.enrollment.id}
      contentContainerStyle={[styles.list, { paddingTop: insets.top + 20 }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenTitle>كورساتي</ScreenTitle>
          {items.length ? (
            <View style={styles.stats}>
              <Stat value={items.length} label="كورس مفعّل" />
              <Stat value={completed} label="درس مكتمل" />
              <Stat value={remaining} label="درس متبقٍ" />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <EmptyView
          icon="play-circle"
          title="لا توجد كورسات مفعّلة بعد"
          text="عندما يُفعَّل لك كورس سيظهر هنا، ومعه تقدّمك في كل درس وزر لمتابعة آخر ما شاهدته."
          action={
            <View style={styles.emptyActions}>
              <Button title="تصفّح الكورسات" size="md" onPress={() => router.navigate('/')} />
              <Button title="جرّب الدروس المجانية" variant="soft" size="md" onPress={() => router.push('/search')} />
            </View>
          }
        />
      }
      renderItem={({ item }) => <MyCourseItem item={item} />}
    />
  );
}

function Stat({ value, label }) {
  return (
    <Card style={styles.stat}>
      <T weight="bold" size={22}>
        {value}
      </T>
      <T size={12} color={colors.muted}>
        {label}
      </T>
    </Card>
  );
}

function MyCourseItem({ item }) {
  const { course, enrollment, completedLessons, totalLessons, percent, continueLesson } = item;
  const days = daysUntil(enrollment.expiresAt);
  const openCourse = () => router.push(`/course/${course.id}`);
  const resume = () =>
    router.push({
      pathname: '/lesson/[id]',
      params: {
        id: continueLesson.id,
        title: continueLesson.title,
        courseId: course.id,
        start: String(continueLesson.positionSec || 0),
      },
    });

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <CourseCover course={course} height={64} style={styles.thumb} />
        <View style={styles.info}>
          <T weight="bold" size={16} numberOfLines={2}>
            {course.title}
          </T>
          {course.teacher?.name ? (
            <T size={13} color={colors.muted}>
              {course.teacher.name}
            </T>
          ) : null}
          {enrollment.expiresAt ? (
            <Badge text={days > 0 ? `ينتهي بعد ${days} يوماً` : 'ينتهي اليوم'} tone={days <= 7 ? 'danger' : 'amber'} />
          ) : (
            <Badge text="اشتراك دائم" tone="success" />
          )}
        </View>
      </View>
      <View style={styles.progress}>
        <View style={styles.progressText}>
          <T size={13} color={colors.muted}>
            أكملت {completedLessons} من {totalLessons}
          </T>
          <T weight="bold" size={13} color={colors.primaryDark}>
            {Math.round(percent || 0)}%
          </T>
        </View>
        <ProgressBar percent={percent} />
      </View>
      {continueLesson ? (
        <Button title={`متابعة: ${continueLesson.title}`} icon="play" size="md" onPress={resume} />
      ) : (
        <Button title="عرض الكورس" variant="secondary" size="md" onPress={openCourse} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg, flexGrow: 1 },
  header: { gap: spacing.xl },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 14, gap: 4, borderRadius: radius.lg },
  card: { padding: spacing.lg, gap: 14 },
  top: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: radius.lg },
  info: { flex: 1, minWidth: 0, gap: 4 },
  progress: { gap: 6 },
  progressText: { flexDirection: 'row', justifyContent: 'space-between' },
  emptyActions: { gap: 10, alignSelf: 'stretch' },
});
