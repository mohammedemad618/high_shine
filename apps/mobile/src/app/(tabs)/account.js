import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from '../../api/session';
import { Avatar, Badge, Button, Card, ErrorView, Icon, Loading, ScreenTitle, T } from '../../components/ui';
import { useMe } from '../../hooks/queries';
import { colors, radius, spacing } from '../../theme';

const PLATFORM = {
  ios: { icon: 'smartphone', label: 'آيفون' },
  android: { icon: 'smartphone', label: 'أندرويد' },
  web: { icon: 'monitor', label: 'ويب' },
};

function lastSeen(iso) {
  if (!iso) return '';
  const minutes = (Date.now() - new Date(iso).getTime()) / 60000;
  if (minutes < 5) return 'نشط الآن';
  if (minutes < 60 * 24) return 'آخر نشاط اليوم';
  if (minutes < 60 * 48) return 'آخر نشاط أمس';
  try {
    return `آخر نشاط ${new Date(iso).toLocaleDateString('ar-IQ', { month: 'long', day: 'numeric' })}`;
  } catch {
    return '';
  }
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { data, error, isPending, isRefetching, refetch } = useMe();
  const [signingOut, setSigningOut] = useState(false);

  function confirmLogout() {
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج من هذا الجهاز؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
        },
      },
    ]);
  }

  if (isPending) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const { user, currentDeviceId } = data;
  const full = user.devices.length >= user.maxDevices;
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 20 }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <ScreenTitle>حسابي</ScreenTitle>

      <Card style={styles.profile}>
        <Avatar name={user.name} size={60} background={colors.primary} color={colors.white} />
        <View style={styles.flexFill}>
          <T weight="bold" size={18}>
            {user.name}
          </T>
          <T size={14} color={colors.muted} style={styles.ltr}>
            {user.phone}
          </T>
        </View>
      </Card>

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <T weight="bold" size={16}>
            الأجهزة المرتبطة
          </T>
          <Badge text={`${user.devices.length} من ${user.maxDevices}`} tone={full ? 'amber' : 'success'} />
        </View>
        <Card>
          {user.devices.map((d, i) => {
            const p = PLATFORM[d.platform] || { icon: 'smartphone', label: '' };
            const current = d.deviceId === currentDeviceId;
            return (
              <View key={d.deviceId} style={[styles.device, i > 0 && styles.divider]}>
                <View style={[styles.deviceIcon, current && styles.deviceIconCurrent]}>
                  <Icon name={p.icon} size={20} color={current ? colors.primary : colors.muted} />
                </View>
                <View style={styles.flexFill}>
                  <T weight="semibold" size={14} numberOfLines={1}>
                    {[d.name || 'جهاز', p.label].filter(Boolean).join(' · ')}
                  </T>
                  <T size={12} color={colors.muted}>
                    {current ? 'نشط الآن' : lastSeen(d.lastSeenAt)}
                  </T>
                </View>
                {current ? (
                  <T weight="semibold" size={12} color={colors.primaryDark}>
                    هذا الجهاز
                  </T>
                ) : null}
              </View>
            );
          })}
        </Card>
        <View style={styles.hint}>
          <Icon name="info" size={18} style={styles.hintIcon} />
          <T size={13} color={colors.muted} style={styles.hintText}>
            غيّرت هاتفك؟ تواصل مع الإدارة لإزالة الجهاز القديم من حسابك.
          </T>
        </View>
      </View>

      <Button title="تسجيل الخروج" icon="log-out" variant="danger" onPress={confirmLogout} loading={signingOut} />
      <T size={12} color={colors.muted} style={styles.version}>
        الإصدار {Constants.expoConfig?.version || ''}
      </T>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  flexFill: { flex: 1, gap: 4 },
  container: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  ltr: { writingDirection: 'ltr' },
  section: { gap: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  device: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  deviceIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.divider, alignItems: 'center', justifyContent: 'center' },
  deviceIconCurrent: { backgroundColor: colors.primaryTint },
  hint: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 4 },
  hintIcon: { marginTop: 2 },
  hintText: { flex: 1, lineHeight: 22 },
  version: { textAlign: 'center' },
});
