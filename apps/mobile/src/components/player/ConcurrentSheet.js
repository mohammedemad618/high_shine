import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { Button, Icon, T } from '../ui';

/**
 * Bottom sheet for CONCURRENT_PLAYBACK: the account is playing on another device right now.
 * The server frees the slot about a minute after the other device stops sending progress.
 */
export function ConcurrentSheet({ visible, retrying, onRetry, onBack }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onBack}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.handle} />
          <View style={styles.icon}>
            <Icon name="monitor" size={28} color={colors.amberText} />
          </View>
          <View style={styles.text}>
            <T weight="bold" size={20} accessibilityRole="header">
              الحساب يشاهد من جهاز آخر
            </T>
            <T size={14} color={colors.muted} style={styles.lines}>
              يمكن تشغيل المحاضرات على جهاز واحد في الوقت نفسه. أوقف المشاهدة على الجهاز الآخر، ثم حاول مجدداً بعد دقيقة.
            </T>
          </View>
          <View style={styles.actions}>
            <Button title="حاول مجدداً" icon="refresh-cw" onPress={onRetry} loading={retrying} />
            <Button title="رجوع للكورس" variant="secondary" onPress={onBack} />
          </View>
          <T size={12} color={colors.muted} style={styles.foot}>
            ليس جهازك؟ غيّر كلمة المرور أو تواصل مع الإدارة.
          </T>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: spacing.md,
    gap: 18,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong },
  icon: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.amberTint, alignItems: 'center', justifyContent: 'center' },
  text: { gap: spacing.sm },
  lines: { lineHeight: 25 },
  actions: { gap: 10 },
  foot: { textAlign: 'center', lineHeight: 20 },
});
