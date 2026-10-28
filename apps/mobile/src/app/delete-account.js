import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { messageFor } from '../api/errors';
import { deleteAccount } from '../api/session';
import { Button, Card, Icon, IconButton, T, TextField } from '../components/ui';
import { colors, spacing } from '../theme';

const CONSEQUENCES = [
  'يُحذف اسمك ورقم هاتفك وسجل مشاهدتك.',
  'تفقد الوصول إلى كل الكورسات المفعّلة على هذا الحساب، ولا يمكن استرجاعها.',
  'تُسجَّل خارج كل أجهزتك فوراً.',
];

/** Self-service account deletion (App Store 5.1.1(v)): password, one explicit confirmation, then gone. */
export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      // The route guard sends the now signed-out app back to the login screen.
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  function confirm() {
    if (!password) {
      setError('أدخل كلمة المرور للتأكيد');
      return;
    }
    Alert.alert('حذف الحساب نهائياً؟', 'لا يمكن التراجع عن هذه الخطوة.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: remove },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
      >
        <IconButton name="arrow-right" label="رجوع" onPress={() => router.back()} style={styles.back} />
        <T weight="bold" size={26}>
          حذف الحساب
        </T>
        <Card style={styles.warning}>
          {CONSEQUENCES.map((line) => (
            <View key={line} style={styles.line}>
              <Icon name="alert-triangle" size={18} color={colors.danger} style={styles.lineIcon} />
              <T size={14} style={styles.lineText}>
                {line}
              </T>
            </View>
          ))}
        </Card>
        <TextField
          label="كلمة المرور"
          icon="lock"
          secure
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={confirm}
        />
        {error ? (
          <T weight="medium" size={14} color={colors.danger} style={styles.center}>
            {error}
          </T>
        ) : null}
        <Button title="حذف حسابي نهائياً" variant="danger" icon="trash-2" onPress={confirm} loading={busy} />
        <Button title="إلغاء" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.card },
  container: { flexGrow: 1, paddingHorizontal: spacing.xxl, gap: spacing.xl },
  back: { marginEnd: -10, alignSelf: 'flex-start' },
  warning: { padding: spacing.lg, gap: spacing.md, borderColor: colors.dangerTint, backgroundColor: colors.dangerTint },
  line: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  lineIcon: { marginTop: 2 },
  lineText: { flex: 1, lineHeight: 22 },
  center: { textAlign: 'center' },
});
