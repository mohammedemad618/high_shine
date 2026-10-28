import { Alert, Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { colors, formatSize, radius, spacing } from '../../theme';
import { Icon, T } from '../ui';

/** Lesson PDFs. `url` is a signed link valid until the playback token expires. */
export function Attachments({ items }) {
  if (!items?.length) return null;

  async function open(item) {
    try {
      await WebBrowser.openBrowserAsync(item.url);
    } catch {
      Alert.alert('', 'تعذّر فتح الملف');
    }
  }

  return (
    <View style={styles.box}>
      <T weight="semibold" size={13} color={colors.muted}>
        المرفقات
      </T>
      {items.map((a) => (
        <Pressable
          key={a.id}
          accessibilityRole="button"
          accessibilityLabel={`فتح ${a.name}`}
          onPress={() => open(a)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.fileIcon}>
            <Icon name="file-text" size={20} color={colors.danger} />
          </View>
          <View style={styles.body}>
            <T weight="semibold" size={14} numberOfLines={1}>
              {a.name}
            </T>
            {a.size ? (
              <T size={12} color={colors.muted}>
                {formatSize(a.size)}
              </T>
            ) : null}
          </View>
          <Icon name="download" size={20} color={colors.primary} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.75 },
  fileIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.dangerTint, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
});
