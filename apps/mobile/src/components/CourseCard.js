import { Pressable, StyleSheet, View } from 'react-native';
import { colors, formatHours, formatLessons, radius, spacing } from '../theme';
import { CourseCover } from './CourseCover';
import { Badge, T } from './ui';

const COVER_HEIGHT = 128;

// Deliberately no price: the app shows no purchase information (App Store rule 3.1.1).
export function CourseCard({ course, onPress, enrolled }) {
  const { lessonsCount = 0, totalDurationSec = 0 } = course.stats || {};
  const meta = [course.teacher?.name, formatLessons(lessonsCount), formatHours(totalDurationSec)].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={course.title}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <CourseCover course={course} height={COVER_HEIGHT} style={styles.cover}>
        {enrolled ? <Badge text="مشترك" tone="success" style={styles.badge} /> : null}
      </CourseCover>
      <View style={styles.body}>
        <T weight="bold" size={17} numberOfLines={2}>
          {course.title}
        </T>
        <T size={13} color={colors.muted} numberOfLines={1}>
          {meta.join(' · ')}
        </T>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  pressed: { opacity: 0.85 },
  cover: { height: COVER_HEIGHT, padding: spacing.lg },
  badge: { alignSelf: 'flex-start' },
  body: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: spacing.lg, gap: 6 },
});
