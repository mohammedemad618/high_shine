import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ERROR_CODES } from '@lp/shared';
import { messageFor } from '../api/errors';
import { signIn } from '../api/session';
import { Button, Card, Icon, Note, T, TextField } from '../components/ui';
import { useAppConfig } from '../hooks/queries';
import { openSupport, shortDate, supportUrl } from '../lib/support';
import { colors, fonts, spacing } from '../theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { data: config } = useAppConfig();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // DEVICE_LIMIT details: which device a swap would sign out, or when the next swap is allowed.
  const [limit, setLimit] = useState(null);

  async function submit(replaceDevice = false) {
    if (!phone.trim() || !password) {
      setError('أدخل رقم الهاتف وكلمة المرور');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn({ phone: phone.trim(), password, replaceDevice });
      // The route guard in the root layout switches to the app once the session is stored.
    } catch (err) {
      if (err.code === ERROR_CODES.DEVICE_LIMIT || err.code === ERROR_CODES.DEVICE_REPLACE_LOCKED) {
        setLimit({ ...err.details, canReplace: err.code === ERROR_CODES.DEVICE_LIMIT && err.details?.canReplace });
      } else {
        setLimit(null);
        setError(messageFor(err));
      }
      setBusy(false);
    }
  }

  function forgotPassword() {
    const canChat = !!supportUrl(config);
    Alert.alert('نسيت كلمة المرور؟', 'يعيد فريق الدعم تعيين كلمة المرور بعد التحقق من رقم هاتفك.', [
      { text: 'حسناً', style: 'cancel' },
      ...(canChat
        ? [{ text: 'مراسلة الدعم', onPress: () => openSupport(config, `نسيت كلمة المرور. رقمي: ${phone.trim()}`) }]
        : []),
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={[styles.hero, { paddingTop: insets.top + 40 }]}>
          <View style={[styles.ring, styles.ringLg]} />
          <View style={[styles.ring, styles.ringMd]} />
          <View style={[styles.ring, styles.ringSm]} />
          <Logo />
          <T weight="bold" size={28} color={colors.white}>
            أهلاً بعودتك
          </T>
          <T size={15} color={colors.onPrimaryMuted} style={styles.lines}>
            سجّل دخولك لمتابعة محاضراتك من حيث توقفت.
          </T>
        </View>

        <View style={[styles.form, { paddingBottom: insets.bottom + spacing.xxl }]}>
          <TextField
            label="رقم الهاتف"
            icon="smartphone"
            value={phone}
            onChangeText={setPhone}
            placeholder="07xxxxxxxxx"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="next"
          />
          <TextField
            label="كلمة المرور"
            icon="lock"
            secure
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={() => submit()}
          />
          <Pressable accessibilityRole="button" onPress={forgotPassword} hitSlop={8} style={styles.forgot}>
            <T weight="semibold" size={14} color={colors.primary}>
              نسيت كلمة المرور؟
            </T>
          </Pressable>
          {error ? (
            <T weight="medium" size={14} color={colors.danger} style={styles.center}>
              {error}
            </T>
          ) : null}
          {limit ? (
            <DeviceLimit limit={limit} busy={busy} config={config} onReplace={() => submit(true)} />
          ) : (
            <Button title="تسجيل الدخول" onPress={() => submit()} loading={busy} />
          )}
          <Note icon="shield">سيُربط هذا الجهاز بحسابك. يسمح الحساب بجهازين، ويمكنك استبدال جهاز قديم بنفسك عند الحاجة.</Note>
          <View style={styles.grow} />
          <View style={styles.footer}>
            <T size={14} color={colors.muted}>
              ليس لديك حساب؟
            </T>
            <Link href="/register" style={styles.link}>
              إنشاء حساب جديد
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The account already has its maximum devices: offer the self-service swap, or say when it is possible again. */
function DeviceLimit({ limit, busy, config, onReplace }) {
  const target = limit.replaceTarget;
  const days = config?.deviceReplaceCooldownDays;
  return (
    <Card style={styles.limit}>
      <View style={styles.limitHead}>
        <Icon name="smartphone" size={20} color={colors.amberText} />
        <T weight="bold" size={15} style={styles.flexText}>
          وصل حسابك إلى الحد الأقصى للأجهزة
        </T>
      </View>
      {limit.canReplace ? (
        <>
          <T size={14} color={colors.muted} style={styles.lines}>
            {`يمكنك تسجيل الخروج من «${target?.name || 'جهاز قديم'}»${
              target?.lastSeenAt ? ` (آخر استخدام ${shortDate(target.lastSeenAt)})` : ''
            } والمتابعة بهذا الجهاز.${days ? ` يُسمح بالاستبدال مرة كل ${days} يوماً.` : ''}`}
          </T>
          <Button title="تسجيل الخروج منه والمتابعة" variant="amber" icon="repeat" onPress={onReplace} loading={busy} />
        </>
      ) : (
        <T size={14} color={colors.muted} style={styles.lines}>
          {limit.nextReplaceAt
            ? `استبدلت جهازاً مؤخراً. يمكنك الاستبدال مجدداً بعد ${shortDate(limit.nextReplaceAt)}، أو راسل الدعم.`
            : 'تواصل مع الدعم لإزالة جهاز قديم من حسابك.'}
        </T>
      )}
      {supportUrl(config) ? (
        <Button
          title="مراسلة الدعم"
          variant="secondary"
          icon="message-circle"
          size="md"
          onPress={() => openSupport(config, 'أحتاج مساعدة في أجهزة حسابي')}
        />
      ) : null}
    </Card>
  );
}

/** The app mark: a white tile with a teal play triangle and an amber dot. */
function Logo() {
  return (
    <View style={styles.logo}>
      <View style={styles.triangle} />
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.card },
  scroll: { flexGrow: 1 },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingBottom: 36,
    gap: 10,
    overflow: 'hidden',
  },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  ringLg: { width: 280, height: 280, borderRadius: 140, top: -100, left: -100 },
  ringMd: { width: 192, height: 192, borderRadius: 96, top: -56, left: -56 },
  ringSm: { width: 104, height: 104, borderRadius: 52, top: -12, left: -12 },
  lines: { lineHeight: 24 },
  logo: {
    // LTR so the RTL layout does not mirror the triangle's border sides.
    direction: 'ltr',
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  triangle: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 16,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.primary,
  },
  dot: { position: 'absolute', top: 9, left: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  form: { flexGrow: 1, paddingHorizontal: spacing.xxl, paddingTop: 32, gap: spacing.xl },
  center: { textAlign: 'center' },
  forgot: { alignSelf: 'flex-start', marginTop: -8 },
  limit: { padding: spacing.lg, gap: spacing.md, borderColor: colors.amber },
  limitHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flexText: { flex: 1 },
  grow: { flexGrow: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
});
