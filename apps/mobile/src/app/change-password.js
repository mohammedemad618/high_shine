import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { changePassword } from '../api/endpoints';
import { messageFor } from '../api/errors';
import { Button, IconButton, Note, T, TextField } from '../components/ui';
import { colors, spacing } from '../theme';

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function validate() {
    if (!current) return 'أدخل كلمة المرور الحالية';
    if (next.length < 8) return 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل';
    if (next !== confirm) return 'كلمتا المرور غير متطابقتين';
    if (next === current) return 'اختر كلمة مرور مختلفة عن الحالية';
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
      await changePassword({ currentPassword: current, newPassword: next });
      Alert.alert('تم تغيير كلمة المرور', 'سُجّل الخروج من أجهزتك الأخرى، وبقي هذا الجهاز متصلاً.', [
        { text: 'حسناً', onPress: () => router.back() },
      ]);
    } catch (err) {
      setError(messageFor(err));
    } finally {
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
        <T weight="bold" size={26}>
          تغيير كلمة المرور
        </T>
        <TextField
          label="كلمة المرور الحالية"
          icon="lock"
          secure
          value={current}
          onChangeText={setCurrent}
          autoComplete="current-password"
          textContentType="password"
        />
        <TextField
          label="كلمة المرور الجديدة"
          icon="key"
          secure
          value={next}
          onChangeText={setNext}
          placeholder="8 أحرف على الأقل"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <TextField
          label="تأكيد كلمة المرور الجديدة"
          icon="key"
          secure
          value={confirm}
          onChangeText={setConfirm}
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={submit}
        />
        {error ? (
          <T weight="medium" size={14} color={colors.danger} style={styles.center}>
            {error}
          </T>
        ) : null}
        <Button title="حفظ كلمة المرور" onPress={submit} loading={busy} />
        <Note icon="shield">سيُسجَّل الخروج من كل أجهزتك الأخرى، فإن كان أحد يستخدم حسابك سيفقد الوصول فوراً.</Note>
        <View style={styles.grow} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.card },
  container: { flexGrow: 1, paddingHorizontal: spacing.xxl, gap: spacing.xl },
  back: { marginEnd: -10, alignSelf: 'flex-start' },
  center: { textAlign: 'center' },
  grow: { flexGrow: 1 },
});
