import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { getAttachmentLink } from '../../api/endpoints';
import { messageFor } from '../../api/errors';
import { colors, formatSize, radius, spacing } from '../../theme';
import { Icon, T } from '../ui';

/**
 * Lesson PDFs. A tap asks the server for a link valid a few minutes; the file it serves carries the
 * student's watermark, so a shared copy is traceable.
 */
export function Attachments({ lessonId, items }) {
  const [opening, setOpening] = useState(null);
  if (!items?.length) return null;

  async function open(item) {
    if (opening) return;
    setOpening(item.id);
    try {
      const { url } = await getAttachmentLink(lessonId, item.id);
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      Alert.alert('', err?.status ? messageFor(err) : 'تعذّر فتح الملف');
    } finally {
      setOpening(null);
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
          accessibilityState={{ busy: opening === a.id }}
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
          {opening === a.id ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Icon name="download" size={20} color={colors.primary} />
          )}
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
