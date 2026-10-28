import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourseCover } from '../components/CourseCover';
import { Badge, Chip, EmptyView, ErrorView, Icon, IconButton, Loading, T } from '../components/ui';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useCourses, useMyCourses } from '../hooks/queries';
import { useRecentSearches } from '../store/recentSearches';
import { colors, fonts, formatHours, formatLessons, radius, spacing } from '../theme';

const SUBJECTS = ['كيمياء', 'فيزياء', 'رياضيات', 'أحياء', 'إنكليزي'];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [text, setText] = useState(typeof params.q === 'string' ? params.q : '');
  const q = useDebouncedValue(text.trim());
  const recent = useRecentSearches();
  const results = useCourses(q);
  const mine = useMyCourses();
  const enrolledIds = useMemo(() => new Set((mine.data?.items || []).map((i) => i.course.id)), [mine.data]);

  // Remember a term once it has produced results.
  const { add } = recent;
  useEffect(() => {
    if (q && results.data?.items.length) add(q);
  }, [q, results.data, add]);

  let body;
  if (!q) {
    body = <Suggestions recent={recent} onPick={setText} />;
  } else if (results.isPending) {
    body = <Loading />;
  } else if (results.error) {
    body = <ErrorView error={results.error} onRetry={results.refetch} />;
  } else {
    body = (
      <FlatList
        data={results.data.items}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          results.data.items.length ? (
            <T size={13} color={colors.muted} style={styles.count}>
              {results.data.total} نتيجة لـ «{q}»
            </T>
          ) : null
        }
        renderItem={({ item }) => <ResultRow course={item} query={q} enrolled={enrolledIds.has(item.id)} />}
        ListEmptyComponent={
          <EmptyView icon="search" title={`لا نتائج لـ «${q}»`} text="جرّب كلمة أقصر أو اسم المدرّس." />
        }
      />
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <View style={styles.searchRow}>
          <IconButton name="arrow-right" label="رجوع" onPress={() => router.back()} />
          <View style={styles.inputBox}>
            <Icon name="search" size={20} color={colors.primary} />
            <TextInput
              value={text}
              onChangeText={setText}
              autoFocus
              placeholder="ابحث عن كورس أو مدرّس"
              placeholderTextColor={colors.subtle}
              returnKeyType="search"
              accessibilityLabel="بحث"
              style={styles.input}
            />
            {text ? (
              <IconButton
                name="x"
                label="مسح البحث"
                onPress={() => setText('')}
                size={28}
                iconSize={14}
                color={colors.white}
                background={colors.borderStrong}
              />
            ) : null}
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          <Chip label="الكل" dark active={!SUBJECTS.includes(q)} onPress={() => setText('')} />
          {SUBJECTS.map((s) => (
            <Chip key={s} label={s} dark active={q === s} onPress={() => setText(s)} />
          ))}
        </ScrollView>
      </View>
      {body}
    </View>
  );
}

function Suggestions({ recent, onPick }) {
  if (!recent.terms.length) {
    return <EmptyView icon="search" title="ابحث في الكورسات" text="اكتب اسم المادة أو الكورس أو المدرّس." />;
  }
  return (
    <View style={styles.suggestions}>
      <View style={styles.suggestionsHeader}>
        <T weight="bold" size={15}>
          عمليات بحث سابقة
        </T>
        <Pressable accessibilityRole="button" onPress={recent.clear} hitSlop={10}>
          <T weight="semibold" size={13} color={colors.primary}>
            مسح
          </T>
        </Pressable>
      </View>
      <View style={styles.recentWrap}>
        {recent.terms.map((t) => (
          <Pressable key={t} accessibilityRole="button" onPress={() => onPick(t)} style={styles.recent}>
            <Icon name="clock" size={14} />
            <T size={13} color={colors.textSecondary}>
              {t}
            </T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Splits the title around the first match so the matched part can be coloured. */
function highlight(title, query) {
  const i = title.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return [title, '', ''];
  return [title.slice(0, i), title.slice(i, i + query.length), title.slice(i + query.length)];
}

function ResultRow({ course, query, enrolled }) {
  const [before, match, after] = highlight(course.title, query);
  const { lessonsCount = 0, totalDurationSec = 0 } = course.stats || {};
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={course.title}
      onPress={() => router.push(`/course/${course.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <CourseCover course={course} height={72} style={styles.thumb} />
      <View style={styles.rowBody}>
        <T weight="bold" size={15} numberOfLines={2}>
          {before}
          <T weight="bold" size={15} color={colors.primary}>
            {match}
          </T>
          {after}
        </T>
        {course.teacher?.name ? (
          <T size={13} color={colors.muted}>
            {course.teacher.name}
          </T>
        ) : null}
        <View style={styles.meta}>
          <T size={12} color={colors.muted}>
            {[formatLessons(lessonsCount), formatHours(totalDurationSec)].filter(Boolean).join(' · ')}
          </T>
          {enrolled ? <Badge text="مشترك" tone="success" /> : null}
        </View>
      </View>
      <Icon name="chevron-left" size={18} color={colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  top: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: 14,
    gap: 14,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: 16, color: colors.text, paddingVertical: 0 },
  chips: { gap: spacing.sm },
  list: { padding: spacing.xl, gap: 14, flexGrow: 1 },
  count: { marginBottom: 2 },
  pressed: { opacity: 0.8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  thumb: { width: 72, height: 72, borderRadius: radius.md },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  suggestions: { padding: spacing.xl, gap: 10 },
  suggestionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  recentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  recent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
});
