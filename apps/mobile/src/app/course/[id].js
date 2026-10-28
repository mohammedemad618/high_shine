import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ERROR_CODES, LESSON_STATUS, errorMessage } from '@lp/shared';
import { SUBSCRIBERS_ONLY } from '../../api/errors';
import { CourseCover } from '../../components/CourseCover';
import { Badge, Button, Card, ErrorView, Icon, IconButton, Loading, ProgressBar, T } from '../../components/ui';
import { useCourse } from '../../hooks/queries';
import { colors, daysUntil, formatDuration, formatHours, formatLessons, radius, spacing } from '../../theme';

const HERO_HEIGHT = 196;

function openLesson(lesson, course, start) {
  router.push({
    pathname: '/lesson/[id]',
    params: { id: lesson.id, title: lesson.title, courseId: course.id, ...(start !== undefined ? { start: String(start) } : {}) },
  });
}

export default function CourseScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const { data, error, isPending, isRefetching, refetch } = useCourse(id);

  const summary = useMemo(() => {
    const lessons = (data?.sections || []).flatMap((s) => s.lessons);
    const completed = lessons.filter((l) => l.progress?.completed).length;
    const inProgress = lessons.find((l) => l.progress && !l.progress.completed && l.progress.positionSec > 0);
    const next = inProgress || lessons.find((l) => !l.progress?.completed) || lessons[0];
    const freePreview = lessons.find((l) => l.isFreePreview);
    return { lessons, completed, next, freePreview, percent: lessons.length ? Math.round((completed / lessons.length) * 100) : 0 };
  }, [data]);

  if (isPending) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const { course, enrollment, sections } = data;
  const enrolled = !!enrollment || data.canManage;
  const meta = [course.teacher?.name, formatLessons(course.stats?.lessonsCount || 0), formatHours(course.stats?.totalDurationSec)].filter(Boolean);

  function onLessonPress(lesson) {
    if (lesson.status && lesson.status !== LESSON_STATUS.READY) {
      Alert.alert('', errorMessage(ERROR_CODES.LESSON_NOT_READY));
      return;
    }
    if (!enrolled && !lesson.isFreePreview) {
      Alert.alert('', SUBSCRIBERS_ONLY);
      return;
    }
    openLesson(lesson, course);
  }

  return (
    <View style={styles.flex}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <CourseCover course={course} height={HERO_HEIGHT} style={[styles.hero, { paddingTop: insets.top + 12, minHeight: HERO_HEIGHT + insets.top }]}>
          <IconButton name="arrow-right" label="رجوع" onPress={() => router.back()} color={colors.white} background="rgba(255,255,255,0.16)" />
          <View style={styles.heroText}>
            <T weight="bold" size={24} color={colors.white}>
              {course.title}
            </T>
            <T size={13} color="rgba(255,255,255,0.82)">
              {meta.join(' · ')}
            </T>
          </View>
        </CourseCover>

        <View style={styles.body}>
          {course.description ? (
            <T size={14} color={colors.textSecondary} style={styles.description}>
              {course.description}
            </T>
          ) : null}

          {enrolled ? (
            <EnrolledCard
              enrollment={enrollment}
              staff={data.canManage && !enrollment}
              summary={summary}
              onContinue={() => summary.next && openLesson(summary.next, course, summary.next.progress?.completed ? 0 : undefined)}
            />
          ) : (
            <LockedCard freePreview={summary.freePreview} onPreview={() => summary.freePreview && openLesson(summary.freePreview, course)} />
          )}

          {sections.map((section, i) => (
            <SectionBlock
              key={section.id}
              section={section}
              enrolled={enrolled}
              initiallyOpen={i === 0 || section.lessons.some((l) => l.id === summary.next?.id)}
              onLessonPress={onLessonPress}
            />
          ))}
          {!sections.some((s) => s.lessons.length) ? (
            <T size={14} color={colors.muted} style={styles.centerText}>
              لا توجد دروس منشورة بعد
            </T>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function EnrolledCard({ enrollment, staff, summary, onContinue }) {
  const days = daysUntil(enrollment?.expiresAt);
  return (
    <Card style={styles.panel}>
      <View style={styles.rowBetween}>
        <View style={styles.rowGap}>
          <Badge text={staff ? 'معاينة المدرّس' : 'مشترك'} tone="success" />
          {enrollment ? (
            <T size={12} color={colors.muted}>
              {enrollment.expiresAt ? `متبقٍ ${Math.max(days, 0)} يوماً` : 'اشتراك دائم'}
            </T>
          ) : null}
        </View>
        <T weight="bold" size={14} color={colors.primaryDark}>
          {summary.percent}%
        </T>
      </View>
      <ProgressBar percent={summary.percent} />
      <T size={13} color={colors.muted}>
        أكملت {summary.completed} من {summary.lessons.length}
      </T>
      {summary.next ? (
        <Button title={`متابعة: ${summary.next.title}`} icon="play" onPress={onContinue} size="md" />
      ) : null}
    </Card>
  );
}

// Neutral wording only: no prices or purchase hints inside the app (App Store rule 3.1.1).
function LockedCard({ freePreview, onPreview }) {
  return (
    <Card style={styles.panel}>
      <View style={styles.lockedRow}>
        <View style={styles.lockIcon}>
          <Icon name="lock" size={20} />
        </View>
        <View style={styles.flex}>
          <T weight="bold" size={15}>
            {SUBSCRIBERS_ONLY}
          </T>
          {freePreview ? (
            <T size={13} color={colors.muted} style={styles.lines}>
              يمكنك مشاهدة الدرس المجاني الآن للتعرّف على أسلوب الشرح.
            </T>
          ) : null}
        </View>
      </View>
      {freePreview ? <Button title="شاهد الدرس المجاني" icon="play" variant="amber" size="md" onPress={onPreview} /> : null}
    </Card>
  );
}

function SectionBlock({ section, enrolled, initiallyOpen, onLessonPress }) {
  const [open, setOpen] = useState(initiallyOpen);
  const done = section.lessons.filter((l) => l.progress?.completed).length;
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={[styles.sectionHeader, !open && styles.sectionClosed]}
      >
        <T weight="bold" size={16} style={styles.flex}>
          {section.title}
        </T>
        <T size={12} color={colors.muted}>
          {enrolled && done ? `${done} من ${section.lessons.length}` : formatLessons(section.lessons.length)}
        </T>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} />
      </Pressable>
      {open && section.lessons.length ? (
        <Card style={styles.lessons}>
          {section.lessons.map((lesson, i) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              index={i + 1}
              locked={!enrolled && !lesson.isFreePreview}
              last={i === section.lessons.length - 1}
              onPress={() => onLessonPress(lesson)}
            />
          ))}
        </Card>
      ) : null}
    </View>
  );
}

function LessonRow({ lesson, index, locked, last, onPress }) {
  const completed = lesson.progress?.completed;
  const resumeAt = !completed && lesson.progress?.positionSec > 0 ? lesson.progress.positionSec : 0;
  const notReady = lesson.status && lesson.status !== LESSON_STATUS.READY;

  let marker;
  if (completed) {
    marker = (
      <View style={[styles.marker, { backgroundColor: colors.primary }]}>
        <Icon name="check" size={16} color={colors.white} />
      </View>
    );
  } else if (locked) {
    marker = (
      <View style={[styles.marker, { backgroundColor: colors.divider }]}>
        <Icon name="lock" size={14} />
      </View>
    );
  } else if (resumeAt) {
    marker = (
      <View style={[styles.marker, styles.resumeRing]}>
        <Icon name="play" size={12} color={colors.primary} />
      </View>
    );
  } else if (lesson.isFreePreview) {
    marker = (
      <View style={[styles.marker, { backgroundColor: colors.amberTint }]}>
        <Icon name="play" size={12} color={colors.amberText} />
      </View>
    );
  } else {
    marker = (
      <View style={[styles.marker, { backgroundColor: colors.divider }]}>
        <T weight="semibold" size={13} color={colors.muted}>
          {index}
        </T>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={lesson.title}
      accessibilityState={{ disabled: locked }}
      onPress={onPress}
      style={({ pressed }) => [styles.lesson, !last && styles.lessonDivider, resumeAt > 0 && styles.lessonActive, pressed && styles.pressed]}
    >
      {marker}
      <View style={styles.lessonBody}>
        <T weight="semibold" size={14} color={locked ? colors.textSecondary : colors.text} numberOfLines={2}>
          {lesson.title}
        </T>
        <View style={styles.rowGap}>
          {resumeAt ? (
            <T weight="medium" size={12} color={colors.primaryDark}>
              توقفت عند {formatDuration(resumeAt)}
              {lesson.durationSec ? ` من ${formatDuration(lesson.durationSec)}` : ''}
            </T>
          ) : lesson.durationSec ? (
            <T size={12} color={colors.muted}>
              {formatDuration(lesson.durationSec)}
            </T>
          ) : null}
          {lesson.isFreePreview && !completed ? <Badge text="معاينة مجانية" tone="amber" /> : null}
          {lesson.attachmentsCount ? (
            <View style={styles.rowGap}>
              <Icon name="file-text" size={14} />
              <T size={12} color={colors.muted}>
                ملزمة PDF
              </T>
            </View>
          ) : null}
          {notReady ? <Badge text="قيد المعالجة" tone="info" /> : null}
        </View>
      </View>
      {completed ? (
        <T weight="semibold" size={12} color={colors.primaryDark}>
          مكتمل
        </T>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: 22 },
  heroText: { gap: 6, marginTop: spacing.xl },
  body: { padding: spacing.xl, gap: 18 },
  description: { lineHeight: 25 },
  panel: { padding: spacing.lg, gap: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  lockedRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  lockIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.divider, alignItems: 'center', justifyContent: 'center' },
  lines: { lineHeight: 22 },
  centerText: { textAlign: 'center' },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  sectionClosed: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  lessons: { overflow: 'hidden' },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  lessonDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  lessonActive: { backgroundColor: colors.primaryRowTint },
  pressed: { opacity: 0.75 },
  lessonBody: { flex: 1, minWidth: 0, gap: 3 },
  marker: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  resumeRing: { borderWidth: 2.5, borderColor: colors.track, borderTopColor: colors.primary, borderRightColor: colors.primary },
});
