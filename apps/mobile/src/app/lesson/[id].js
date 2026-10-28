import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ERROR_CODES, LESSON_STATUS } from '@lp/shared';
import { messageFor, SUBSCRIBERS_ONLY } from '../../api/errors';
import { Attachments } from '../../components/player/Attachments';
import { ConcurrentSheet } from '../../components/player/ConcurrentSheet';
import { LessonPlayer } from '../../components/player/LessonPlayer';
import { AUTO_QUALITY, PlayerOptions, speedLabel, SPEEDS } from '../../components/player/PlayerOptions';
import { Button, ErrorView, Icon, IconButton, Loading, T } from '../../components/ui';
import { useCourse } from '../../hooks/queries';
import { usePlayback } from '../../hooks/usePlayback';
import { useScreenProtection } from '../../hooks/useScreenProtection';
import { colors, formatDuration, radius, spacing } from '../../theme';

const goToLesson = (lesson, courseId) =>
  router.replace({ pathname: '/lesson/[id]', params: { id: lesson.id, title: lesson.title, courseId } });

export default function LessonScreen() {
  const insets = useSafeAreaInsets();
  const { id, title, start, courseId: courseParam } = useLocalSearchParams();
  const { data, error, loading, reload } = usePlayback(id);
  const { screenshotTaken, dismissScreenshotNotice } = useScreenProtection();
  const [fullscreen, setFullscreen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState(AUTO_QUALITY);

  // An explicit start (from "continue") wins; otherwise the server's resume point.
  const startParam = Number(start);
  const [startAt] = useState(() => (Number.isFinite(startParam) && start !== undefined ? startParam : null));

  // Course context (title, section, next lesson) from the cached course query.
  const courseId = courseParam || data?.lesson.courseId;
  const { data: courseData } = useCourse(courseId);
  const context = useMemo(() => lessonContext(courseData, id), [courseData, id]);

  useEffect(() => {
    const lock = fullscreen ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP;
    ScreenOrientation.lockAsync(lock).catch(() => {});
    if (!fullscreen) setDrawerOpen(false);
  }, [fullscreen]);

  // Back to portrait when leaving the player.
  useEffect(
    () => () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    },
    [],
  );

  useEffect(() => {
    if (!screenshotTaken) return undefined;
    const t = setTimeout(dismissScreenshotNotice, 4000);
    return () => clearTimeout(t);
  }, [screenshotTaken, dismissScreenshotNotice]);

  const onExpired = useCallback(() => reload(true), [reload]);
  const lessonTitle = data?.lesson.title || title || '';

  if (!data) {
    if (loading && !error) {
      return (
        <View style={styles.dark}>
          <Loading />
        </View>
      );
    }
    if (error?.code === ERROR_CODES.CONCURRENT_PLAYBACK) {
      return (
        <View style={styles.dark}>
          <StatusBar style="light" />
          <ConcurrentSheet visible retrying={loading} onRetry={() => reload()} onBack={() => router.back()} />
        </View>
      );
    }
    if (error?.code === ERROR_CODES.NOT_ENROLLED) return <NotEnrolled insets={insets} />;
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <IconButton name="arrow-right" label="رجوع" onPress={() => router.back()} style={styles.backLight} />
        <ErrorView error={error} onRetry={() => reload()} />
      </View>
    );
  }

  const renditions = data.renditions || [];
  const cycle = (list, current) => list[(list.indexOf(current) + 1) % list.length];
  const qualities = [AUTO_QUALITY, ...[...renditions].reverse().map((r) => r.name)];

  const fullscreenHeader = (
    <View style={styles.fsHeader}>
      <IconButton name="arrow-right" label="الخروج من ملء الشاشة" onPress={() => setFullscreen(false)} color={colors.white} />
      <View style={styles.flex}>
        <T weight="bold" size={16} color={colors.white} numberOfLines={1}>
          {lessonTitle}
        </T>
        {context.course ? (
          <T size={12} color={colors.playerMuted} numberOfLines={1}>
            {context.course.title}
          </T>
        ) : null}
      </View>
      {renditions.length > 1 ? (
        <Pill label={quality === AUTO_QUALITY ? 'تلقائي' : quality} onPress={() => setQuality(cycle(qualities, quality))} />
      ) : null}
      <Pill label={speedLabel(speed)} onPress={() => setSpeed(cycle(SPEEDS, speed))} />
      {context.sectionLessons.length > 1 ? <Pill label="الدروس" icon="list" solid onPress={() => setDrawerOpen((o) => !o)} /> : null}
    </View>
  );

  return (
    <View style={styles.flex}>
      <StatusBar hidden={fullscreen} style="light" />
      {/* The player keeps the same position in the tree so toggling full screen never remounts it. */}
      <View style={fullscreen ? styles.full : [styles.dark, styles.top, { paddingTop: insets.top + 8 }]}>
        {fullscreen ? null : (
          <View style={styles.topRow}>
            <IconButton name="arrow-right" label="رجوع" onPress={() => router.back()} color={colors.white} />
            <View style={styles.protected}>
              <Icon name="shield" size={14} color={colors.playerMuted} />
              <T size={12} color={colors.playerMuted}>
                محتوى محمي
              </T>
            </View>
            <IconButton name="maximize" label="ملء الشاشة" onPress={() => setFullscreen(true)} color={colors.white} iconSize={20} />
          </View>
        )}
        <LessonPlayer
          playback={data}
          startAt={startAt ?? data.resumePositionSec}
          fullscreen={fullscreen}
          speed={speed}
          quality={quality}
          onExpired={onExpired}
          header={fullscreen ? fullscreenHeader : null}
        >
          {fullscreen && drawerOpen ? (
            <LessonsDrawer
              section={context.section}
              lessons={context.sectionLessons}
              currentId={id}
              onClose={() => setDrawerOpen(false)}
              onPick={(l) => goToLesson(l, courseId)}
            />
          ) : null}
        </LessonPlayer>
      </View>

      {fullscreen ? null : (
        <ScrollView style={styles.flex} contentContainerStyle={[styles.details, { paddingBottom: insets.bottom + 24 }]}>
          {error ? (
            <View style={styles.banner}>
              <T weight="medium" size={14} color={colors.danger} style={styles.center}>
                {messageFor(error)}
              </T>
              <Button title="إعادة المحاولة" variant="danger" size="md" onPress={() => reload(true)} />
            </View>
          ) : null}
          <View style={styles.titleBlock}>
            {context.course ? (
              <T weight="semibold" size={13} color={colors.primary} numberOfLines={1}>
                {[context.course.title, context.section?.title].filter(Boolean).join(' · ')}
              </T>
            ) : null}
            <T weight="bold" size={20} style={styles.lines}>
              {lessonTitle}
            </T>
          </View>
          <PlayerOptions speed={speed} onSpeed={setSpeed} quality={quality} onQuality={setQuality} renditions={renditions} />
          <Attachments items={data.attachments} />
          {context.next ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`الدرس التالي: ${context.next.title}`}
              onPress={() => goToLesson(context.next, courseId)}
              style={({ pressed }) => [styles.next, pressed && styles.pressed]}
            >
              <View style={styles.flex}>
                <T weight="medium" size={12} color={colors.primaryDark}>
                  الدرس التالي
                </T>
                <T weight="bold" size={14} color={colors.primaryDark} numberOfLines={1}>
                  {context.next.title}
                </T>
              </View>
              <Icon name="chevron-left" size={20} color={colors.primaryDark} />
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      {screenshotTaken ? (
        <View style={styles.toast} pointerEvents="none">
          <T weight="medium" size={14} color={colors.white} style={styles.center}>
            تصوير الشاشة غير مسموح لمحتوى الدروس
          </T>
        </View>
      ) : null}
    </View>
  );
}

/** Course, section and the next playable lesson around `lessonId`. */
function lessonContext(courseData, lessonId) {
  const empty = { course: null, section: null, sectionLessons: [], next: null };
  if (!courseData) return empty;
  const enrolled = !!courseData.enrollment || courseData.canManage;
  const playable = (l) => (!l.status || l.status === LESSON_STATUS.READY) && (enrolled || l.isFreePreview);
  const all = courseData.sections.flatMap((s) => s.lessons.map((l) => ({ ...l, section: s })));
  const index = all.findIndex((l) => l.id === lessonId);
  if (index < 0) return { ...empty, course: courseData.course };
  const section = all[index].section;
  return {
    course: courseData.course,
    section,
    sectionLessons: section.lessons,
    next: all.slice(index + 1).find(playable) || null,
  };
}

function Pill({ label, icon, solid, onPress }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.pill, solid && styles.pillSolid, pressed && styles.pressed]}>
      {icon ? <Icon name={icon} size={16} color={solid ? colors.text : colors.white} /> : null}
      <T weight="semibold" size={13} color={solid ? colors.text : colors.white}>
        {label}
      </T>
    </Pressable>
  );
}

function LessonsDrawer({ section, lessons, currentId, onClose, onPick }) {
  return (
    <View style={styles.drawer}>
      <View style={styles.drawerHeader}>
        <T weight="bold" size={15} color={colors.white} numberOfLines={1} style={styles.flex}>
          {section?.title}
        </T>
        <IconButton name="x" label="إغلاق قائمة الدروس" onPress={onClose} color={colors.white} size={36} iconSize={18} />
      </View>
      <ScrollView contentContainerStyle={styles.drawerList}>
        {lessons.map((l, i) => {
          const current = l.id === currentId;
          return (
            <Pressable
              key={l.id}
              accessibilityRole="button"
              accessibilityState={{ selected: current }}
              onPress={() => (current ? onClose() : onPick(l))}
              style={[styles.drawerRow, current && styles.drawerRowActive]}
            >
              {l.progress?.completed ? (
                <Icon name="check" size={16} color="#5FC2AA" />
              ) : current ? (
                <Icon name="play" size={14} color={colors.amber} />
              ) : (
                <T weight="semibold" size={13} color={colors.playerMuted} style={styles.drawerIndex}>
                  {i + 1}
                </T>
              )}
              <T weight={current ? 'semibold' : 'regular'} size={13} color={current ? colors.white : colors.playerMuted} numberOfLines={1} style={styles.flex}>
                {l.title}
              </T>
              {l.durationSec ? (
                <T size={12} color={colors.playerMuted}>
                  {formatDuration(l.durationSec)}
                </T>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function NotEnrolled({ insets }) {
  return (
    <View style={[styles.flex, { paddingTop: insets.top + 8 }]}>
      <IconButton name="arrow-right" label="رجوع" onPress={() => router.back()} style={styles.backLight} />
      <View style={styles.lockedBox}>
        <View style={styles.lockIcon}>
          <Icon name="lock" size={26} />
        </View>
        <T weight="bold" size={18} style={styles.center}>
          {SUBSCRIBERS_ONLY}
        </T>
        <Button title="رجوع للكورس" variant="secondary" size="md" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  lines: { lineHeight: 30 },
  pressed: { opacity: 0.75 },
  dark: { flex: 1, backgroundColor: colors.player },
  top: { flex: 0 },
  full: { flex: 1, backgroundColor: colors.black },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: 10 },
  protected: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  details: { padding: spacing.xl, gap: 18, backgroundColor: colors.bg, flexGrow: 1 },
  titleBlock: { gap: 4 },
  banner: { backgroundColor: colors.dangerTint, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  toast: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(16,24,40,0.92)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  fsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: 24, paddingTop: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pillSolid: { backgroundColor: colors.white, borderColor: colors.white },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 300,
    backgroundColor: 'rgba(11,18,32,0.96)',
    paddingTop: 18,
    paddingHorizontal: spacing.lg,
  },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  drawerList: { gap: 4, paddingBottom: 18 },
  drawerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10 },
  drawerRowActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  drawerIndex: { width: 16, textAlign: 'center' },
  backLight: { marginHorizontal: spacing.md },
  lockedBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xxl },
  lockIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.divider, alignItems: 'center', justifyContent: 'center' },
});
