import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { messageFor } from '../api/errors';
import { signIn } from '../api/session';
import { Button, Note, T, TextField } from '../components/ui';
import { colors, fonts, spacing } from '../theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!phone.trim() || !password) {
      setError('أدخل رقم الهاتف وكلمة المرور');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn({ phone: phone.trim(), password });
      // The route guard in the root layout switches to the app once the session is stored.
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
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
            onSubmitEditing={submit}
          />
          {error ? (
            <T weight="medium" size={14} color={colors.danger} style={styles.center}>
              {error}
            </T>
          ) : null}
          <Button title="تسجيل الدخول" onPress={submit} loading={busy} />
          <Note icon="shield">سيُربط هذا الجهاز بحسابك. يسمح الحساب بجهازين فقط، ولتغيير جهاز تواصل مع الإدارة.</Note>
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
  grow: { flexGrow: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
});
