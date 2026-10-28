import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseCard } from '../../components/CourseCard';
import { Avatar, Chip, EmptyView, ErrorView, Icon, Loading, SectionHeader, T } from '../../components/ui';
import { useCourses, useMe, useMyCourses } from '../../hooks/queries';
import { useAuth } from '../../store/auth';
import { colors, formatDuration, radius, spacing } from '../../theme';

// Quick searches under the search bar.
const SUBJECTS = ['كيمياء', 'فيزياء', 'رياضيات', 'أحياء', 'إنكليزي'];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'صباح الخير' : 'مساء الخير';
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const courses = useCourses('');
  const mine = useMyCourses();
  const me = useMe();
  const storedUser = useAuth((s) => s.user);
  const name = me.data?.user.name || storedUser?.name || '';
  const shortName = name.split(/\s+/).slice(0, 2).join(' ');

  const enrolledIds = useMemo(() => new Set((mine.data?.items || []).map((i) => i.course.id)), [mine.data]);
  const resume = mine.data?.items.find((i) => i.continueLesson);

  const header = (
    <View style={styles.header}>
      <View style={styles.greetingRow}>
        <View style={styles.greeting}>
          <T size={14} color={colors.muted}>
            {greeting()}
          </T>
          <T weight="bold" size={22} numberOfLines={1}>
            {shortName || 'أهلاً بك'}
          </T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="حسابي" onPress={() => router.navigate('/account')}>
          <Avatar name={name || '؟'} />
        </Pressable>
      </View>

      <View style={styles.searchBlock}>
      <Pressable
        accessibilityRole="search"
        onPress={() => router.push('/search')}
        style={({ pressed }) => [styles.searchBar, pressed && styles.pressed]}
      >
        <Icon name="search" size={20} />
        <T size={15} color={colors.muted}>
          ابحث عن كورس أو مدرّس
        </T>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="الكل" active dark onPress={() => {}} />
        {SUBJECTS.map((s) => (
          <Chip key={s} label={s} onPress={() => router.push({ pathname: '/search', params: { q: s } })} />
        ))}
      </ScrollView>
      </View>

      {resume ? <ContinueCard item={resume} /> : null}

      <SectionHeader
        title="الكورسات المتاحة"
        aside={courses.data ? `${courses.data.total} كورس` : undefined}
      />
    </View>
  );

  if (courses.isPending) return <Loading />;
  if (courses.error) return <ErrorView error={courses.error} onRetry={courses.refetch} />;

  return (
    <FlatList
      style={styles.flex}
      data={courses.data.items}
      keyExtractor={(c) => c.id}
      contentContainerStyle={[styles.list, { paddingTop: insets.top + 20 }]}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <CourseCard course={item} enrolled={enrolledIds.has(item.id)} onPress={() => router.push(`/course/${item.id}`)} />
      )}
      ListEmptyComponent={<EmptyView icon="book-open" title="لا توجد كورسات بعد" text="ستظهر الكورسات هنا فور نشرها." />}
      refreshControl={
        <RefreshControl
          refreshing={courses.isRefetching}
          onRefresh={() => {
            courses.refetch();
            mine.refetch();
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    />
  );
}

function ContinueCard({ item }) {
  const { course, continueLesson, percent } = item;
  const open = () =>
    router.push({
      pathname: '/lesson/[id]',
      params: { id: continueLesson.id, title: continueLesson.title, start: String(continueLesson.positionSec || 0) },
    });
  return (
    <View style={styles.block}>
      <SectionHeader title="تابع المشاهدة" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`متابعة ${continueLesson.title}`}
        onPress={open}
        style={({ pressed }) => [styles.continue, pressed && styles.pressed]}
      >
        <View style={styles.thumb}>
          <View style={styles.playCircle}>
            <Icon name="play" size={16} color={colors.primary} />
          </View>
          <View style={styles.thumbTrack}>
            <View style={[styles.thumbFill, { width: `${Math.max(4, percent || 0)}%` }]} />
          </View>
        </View>
        <View style={styles.continueBody}>
          <T weight="semibold" size={12} color={colors.primary} numberOfLines={1}>
            {course.title}
          </T>
          <T weight="semibold" size={15} numberOfLines={2} style={styles.lines}>
            {continueLesson.title}
          </T>
          <T size={12} color={colors.muted}>
            {continueLesson.positionSec ? `توقفت عند ${formatDuration(continueLesson.positionSec)}` : 'ابدأ الدرس'}
          </T>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, flexGrow: 1 },
  header: { gap: 22, marginBottom: spacing.md },
  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { flex: 1, gap: 2 },
  pressed: { opacity: 0.8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
  },
  searchBlock: { gap: spacing.md },
  chips: { gap: spacing.sm },
  block: { gap: spacing.md },
  continue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  thumb: {
    width: 112,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: '#0B3D35',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbTrack: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  thumbFill: { height: 4, backgroundColor: colors.amber },
  continueBody: { flex: 1, gap: 4 },
  lines: { lineHeight: 22 },
});
