import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { messageFor } from '../api/errors';
import { signUp } from '../api/session';
import { Button, IconButton, Note, T, TextField } from '../components/ui';
import { colors, fonts, spacing } from '../theme';

const PHONE_RE = /^\+?\d{7,15}$/;

// 0–4: length, letters + digits, mixed case or symbols, 12+ characters.
function passwordScore(pw) {
  if (!pw) return 0;
  let score = pw.length >= 8 ? 1 : 0;
  if (/[a-z؀-ۿ]/i.test(pw) && /\d/.test(pw)) score += 1;
  if (/[^a-z0-9؀-ۿ]/i.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) score += 1;
  if (pw.length >= 12) score += 1;
  return score;
}
const STRENGTH = ['', 'ضعيفة', 'مقبولة', 'قوية', 'قوية جداً'];

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const score = passwordScore(password);

  function validate() {
    if (name.trim().length < 2) return 'أدخل الاسم الكامل';
    if (!PHONE_RE.test(phone.replace(/[\s-]/g, ''))) return 'رقم الهاتف غير صحيح';
    if (password.length < 8) return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
    return null;
  }

  async function submit() {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signUp({ name: name.trim(), phone: phone.trim(), password });
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
      >
        <IconButton name="arrow-right" label="رجوع" onPress={() => router.back()} style={styles.back} />
        <View style={styles.heading}>
          <T weight="bold" size={28}>
            إنشاء حساب
          </T>
          <T size={15} color={colors.muted} style={styles.lines}>
            حساب واحد لكل الكورسات، على الهاتف والموقع.
          </T>
        </View>

        <TextField
          label="الاسم الكامل"
          icon="user"
          value={name}
          onChangeText={setName}
          placeholder="مثال: علي حسن"
          autoComplete="name"
          textContentType="name"
          hint="يظهر اسمك في العلامة المائية أثناء المشاهدة."
        />
        <TextField
          label="رقم الهاتف"
          icon="smartphone"
          value={phone}
          onChangeText={setPhone}
          placeholder="07xxxxxxxxx"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
        <View style={styles.passwordBlock}>
          <TextField
            label="كلمة المرور"
            icon="lock"
            secure
            value={password}
            onChangeText={setPassword}
            placeholder="8 أحرف على الأقل"
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={submit}
          />
          {password ? (
            <View style={styles.strength} accessibilityLabel={`قوة كلمة المرور: ${STRENGTH[score] || 'ضعيفة'}`}>
              <View style={styles.segments}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={[styles.segment, i <= score && { backgroundColor: score >= 3 ? colors.primary : colors.amber }]} />
                ))}
              </View>
              <T weight="semibold" size={12} color={score >= 3 ? colors.primaryDark : colors.amberText}>
                {STRENGTH[score] || 'ضعيفة'}
              </T>
            </View>
          ) : null}
        </View>

        {error ? (
          <T weight="medium" size={14} color={colors.danger} style={styles.center}>
            {error}
          </T>
        ) : null}
        <Button title="إنشاء الحساب" onPress={submit} loading={busy} />
        <Note icon="smartphone">هذا الجهاز سيكون أول جهاز مرتبط بحسابك، ويمكنك إضافة جهاز ثانٍ لاحقاً.</Note>

        <View style={styles.footer}>
          <T size={14} color={colors.muted}>
            لديك حساب؟
          </T>
          <Link href="/login" style={styles.link}>
            تسجيل الدخول
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.card },
  container: { flexGrow: 1, paddingHorizontal: spacing.xxl, gap: spacing.xl },
  back: { marginEnd: -10, alignSelf: 'flex-start' },
  heading: { gap: spacing.sm },
  lines: { lineHeight: 24 },
  passwordBlock: { gap: 10 },
  strength: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  segments: { flex: 1, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.track },
  center: { textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 'auto' },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
});
