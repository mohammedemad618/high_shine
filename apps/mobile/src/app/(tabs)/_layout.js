import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/ui';
import { colors, fonts } from '../../theme';

// The active tab's icon sits in a tinted pill, as in the design.
const icon = (name) =>
  function TabIcon({ color, focused }) {
    return (
      <View style={[styles.pill, focused && styles.pillActive]}>
        <Icon name={name} size={22} color={color} />
      </View>
    );
  };

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [styles.bar, { height: 68 + insets.bottom, paddingBottom: Math.max(insets.bottom, 8) }],
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="my-courses" options={{ title: 'كورساتي', tabBarIcon: icon('play-circle') }} />
      <Tabs.Screen name="account" options={{ title: 'حسابي', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.card, borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 12, marginTop: 2 },
  pill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.primaryTint },
});
