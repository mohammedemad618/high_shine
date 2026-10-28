import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { messageFor } from '../api/errors';
import { colors, fonts, initials, radius, spacing } from '../theme';

// ---- Text --------------------------------------------------------------------------------------

/**
 * Text in the app font. weight: regular | medium | semibold | bold.
 * No textAlign: React Native mirrors 'left'/'right' in RTL, and the default follows the Arabic text.
 */
export function T({ weight = 'regular', size = 15, color = colors.text, style, ...rest }) {
  return <Text style={[{ fontFamily: fonts[weight], fontSize: size, color }, style]} {...rest} />;
}

export function Icon({ name, size = 20, color = colors.muted, style }) {
  return <Feather name={name} size={size} color={color} style={style} />;
}

// ---- Buttons -----------------------------------------------------------------------------------

const variants = {
  primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
  secondary: { bg: colors.card, fg: colors.text, border: colors.borderStrong },
  soft: { bg: colors.primaryTint, fg: colors.primaryDark, border: colors.primaryTint },
  amber: { bg: colors.amber, fg: colors.amberInk, border: colors.amber },
  danger: { bg: colors.card, fg: colors.danger, border: colors.dangerBorder },
};

export function Button({ title, onPress, loading, disabled, variant = 'primary', icon, size = 'lg', style }) {
  const v = variants[variant] || variants.primary;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        size === 'md' && styles.buttonMd,
        { backgroundColor: v.bg, borderColor: v.border },
        (pressed || isDisabled) && styles.dimmed,
        style,
      ]}
    >
      {/* The label stays mounted under the spinner, on one line: after a re-layout Android could wrap the
          Arabic label's last word onto a second line that the button then cut off. */}
      <View style={[styles.buttonInner, loading && styles.hidden]}>
        {icon ? <Icon name={icon} size={18} color={v.fg} /> : null}
        <T weight="semibold" size={size === 'md' ? 15 : 16} color={v.fg} numberOfLines={1}>
          {title}
        </T>
      </View>
      {loading ? <ActivityIndicator color={v.fg} style={styles.spinner} /> : null}
    </Pressable>
  );
}

export function IconButton({ name, onPress, label, color = colors.text, background = 'transparent', size = 44, iconSize = 22, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
        styles.center,
        pressed && styles.dimmed,
        style,
      ]}
    >
      <Icon name={name} size={iconSize} color={color} />
    </Pressable>
  );
}

// ---- Inputs ------------------------------------------------------------------------------------

/**
 * Labelled input with a leading icon, a focus ring and an optional hint. `secure` adds a show/hide toggle.
 */
export function TextField({ label, icon, hint, secure, style, inputStyle, ltr, ...inputProps }) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={[styles.field, style]}>
      {label ? (
        <T weight="medium" size={14} color={colors.textSecondary}>
          {label}
        </T>
      ) : null}
      <View style={[styles.inputBox, focused && styles.inputFocused]}>
        {icon ? <Icon name={icon} size={20} /> : null}
        <TextInput
          placeholderTextColor={colors.subtle}
          style={[styles.input, ltr && styles.ltr, inputStyle]}
          secureTextEntry={secure ? hidden : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
        {secure ? (
          <IconButton
            name={hidden ? 'eye' : 'eye-off'}
            label={hidden ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور'}
            onPress={() => setHidden((h) => !h)}
            size={36}
            iconSize={20}
            color={colors.muted}
          />
        ) : null}
      </View>
      {hint ? (
        <T size={12} color={colors.muted}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

// ---- Small pieces ------------------------------------------------------------------------------

const badgeTones = {
  success: { bg: colors.primaryTint, fg: colors.primaryDark },
  amber: { bg: colors.amberTint, fg: colors.amberText },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  info: { bg: colors.infoTint, fg: colors.info },
  neutral: { bg: colors.divider, fg: colors.muted },
};

export function Badge({ text, tone = 'amber', style }) {
  const t = badgeTones[tone] || badgeTones.amber;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      <T weight="semibold" size={12} color={t.fg}>
        {text}
      </T>
    </View>
  );
}

export function Chip({ label, active, onPress, dark }) {
  const activeStyle = dark ? styles.chipDark : styles.chipActive;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && activeStyle, pressed && styles.dimmed]}
    >
      <T
        weight={active ? 'semibold' : 'medium'}
        size={13}
        color={active ? (dark ? colors.white : colors.primaryDark) : colors.textSecondary}
      >
        {label}
      </T>
    </Pressable>
  );
}

export function ProgressBar({ percent, color = colors.primary, track = colors.track, height = 8 }) {
  const p = Math.max(0, Math.min(100, percent || 0));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: track }]}>
      <View style={{ width: `${p}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function Card({ style, children }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Avatar({ name, size = 44, background = colors.primaryTint, color = colors.primaryDark }) {
  return (
    <View style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}>
      <T weight="bold" size={Math.round(size * 0.32)} color={color} numberOfLines={1} style={styles.avatarText}>
        {initials(name)}
      </T>
    </View>
  );
}

/** Icon + text on a grey panel, for short explanations under a form or list. */
export function Note({ icon = 'info', children, style }) {
  return (
    <View style={[styles.note, style]}>
      <Icon name={icon} size={18} color={colors.primary} style={styles.noteIcon} />
      <T size={13} color={colors.muted} style={styles.noteText}>
        {children}
      </T>
    </View>
  );
}

export function ScreenTitle({ children, style }) {
  return (
    <T weight="bold" size={26} style={style}>
      {children}
    </T>
  );
}

export function SectionHeader({ title, aside }) {
  return (
    <View style={styles.sectionHeader}>
      <T weight="bold" size={17}>
        {title}
      </T>
      {aside ? (
        <T size={13} color={colors.muted}>
          {aside}
        </T>
      ) : null}
    </View>
  );
}

// ---- States ------------------------------------------------------------------------------------

export function Loading() {
  return (
    <View style={[styles.fill, styles.center]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function ErrorView({ error, message, onRetry }) {
  return (
    <View style={[styles.fill, styles.center, styles.stateBox]}>
      <View style={[styles.stateIcon, { backgroundColor: colors.dangerTint }]}>
        <Icon name="alert-circle" size={26} color={colors.danger} />
      </View>
      <T weight="semibold" size={16} style={styles.centerText}>
        {message || messageFor(error)}
      </T>
      {onRetry ? <Button title="إعادة المحاولة" variant="secondary" size="md" icon="refresh-cw" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyView({ icon = 'inbox', title, text, action }) {
  return (
    <View style={[styles.fill, styles.center, styles.stateBox]}>
      <View style={[styles.stateIcon, { backgroundColor: colors.primaryTint }]}>
        <Icon name={icon} size={26} color={colors.primary} />
      </View>
      {title ? (
        <T weight="bold" size={18} style={styles.centerText}>
          {title}
        </T>
      ) : null}
      {text ? (
        <T size={14} color={colors.muted} style={[styles.centerText, styles.lines]}>
          {text}
        </T>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  avatarText: { textAlign: 'center', minWidth: 40 },
  lines: { lineHeight: 24 },
  dimmed: { opacity: 0.7 },

  button: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonMd: { minHeight: 46, borderRadius: radius.md },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hidden: { opacity: 0 },
  spinner: { position: 'absolute' },

  field: { gap: spacing.sm },
  // Focus only changes colours. Adding shadow props on focus makes Android re-create the native view,
  // and the TextInput inside loses focus right after gaining it.
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.primaryRowTint },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 12,
  },
  ltr: { writingDirection: 'ltr' },

  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  chip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.primaryTint },
  chipDark: { borderColor: colors.text, backgroundColor: colors.text },
  track: { overflow: 'hidden', width: '100%' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    padding: 14,
  },
  noteIcon: { marginTop: 2 },
  noteText: { flex: 1, lineHeight: 22 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  stateBox: { padding: spacing.xxl, gap: spacing.md },
  stateIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
