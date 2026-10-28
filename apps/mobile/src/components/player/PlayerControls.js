import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { colors, formatDuration, spacing } from '../../theme';
import { Icon, T } from '../ui';

const AUTO_HIDE_MS = 3000;
const SKIP_SEC = 10;

/**
 * Overlay controls drawn over the video: tap to show/hide, ±10 s, play/pause and a draggable seek bar.
 * `header` (full screen only) is rendered at the top of the overlay.
 */
export function PlayerControls({ isPlaying, time, duration, fullscreen, onPlayPause, onSeek, header }) {
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef(null);

  // Auto-hide while playing; stay visible while paused.
  useEffect(() => {
    clearTimeout(hideTimer.current);
    if (visible && isPlaying) hideTimer.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    return () => clearTimeout(hideTimer.current);
  }, [visible, isPlaying]);

  const poke = () => setVisible(true);
  const skip = (delta) => {
    poke();
    onSeek(Math.max(0, Math.min(duration || 0, time + delta)));
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityLabel={visible ? 'إخفاء أدوات التحكم' : 'إظهار أدوات التحكم'}
        style={StyleSheet.absoluteFill}
        onPress={() => setVisible((v) => !v)}
      />
      {visible ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.header} pointerEvents="box-none">
            {header}
          </View>
          <View style={styles.center} pointerEvents="box-none">
            <RoundButton icon="rotate-ccw" label="رجوع 10 ثوانٍ" onPress={() => skip(-SKIP_SEC)} size={fullscreen ? 52 : 44} />
            <RoundButton
              icon={isPlaying ? 'pause' : 'play'}
              label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              onPress={() => {
                poke();
                onPlayPause();
              }}
              size={fullscreen ? 72 : 60}
              primary
            />
            <RoundButton icon="rotate-cw" label="تقديم 10 ثوانٍ" onPress={() => skip(SKIP_SEC)} size={fullscreen ? 52 : 44} />
          </View>
          <View style={[styles.bottom, fullscreen && styles.bottomFull]}>
            <SeekBar time={time} duration={duration} onSeek={onSeek} onInteract={poke} />
            <View style={styles.times}>
              <T size={12} color={colors.playerMuted}>
                {formatDuration(time)}
              </T>
              <T size={12} color={colors.playerMuted}>
                {duration ? formatDuration(duration) : '--:--'}
              </T>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function RoundButton({ icon, label, onPress, size, primary }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size, borderRadius: size / 2 },
        primary ? styles.roundPrimary : styles.roundGhost,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={primary ? Math.round(size * 0.38) : Math.round(size * 0.46)} color={primary ? colors.player : colors.white} />
    </Pressable>
  );
}

/** Left-to-right timeline (like the design) that seeks on tap and on drag. */
function SeekBar({ time, duration, onSeek, onInteract }) {
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState(null); // 0–1 while dragging
  const latest = useRef({ width, duration, onSeek, onInteract });
  latest.current = { width, duration, onSeek, onInteract };

  const responder = useMemo(() => {
    const ratio = (x) => {
      const w = latest.current.width;
      return w ? Math.max(0, Math.min(1, x / w)) : 0;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        latest.current.onInteract();
        setScrub(ratio(e.nativeEvent.locationX));
      },
      onPanResponderMove: (e) => setScrub(ratio(e.nativeEvent.locationX)),
      onPanResponderRelease: (e) => {
        const { duration: d, onSeek: seek } = latest.current;
        if (d) seek(ratio(e.nativeEvent.locationX) * d);
        setScrub(null);
      },
      onPanResponderTerminate: () => setScrub(null),
    });
  }, []);

  const progress = scrub ?? (duration ? Math.min(1, time / duration) : 0);
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="شريط التقدّم"
      accessibilityValue={{ min: 0, max: Math.round(duration || 0), now: Math.round(time) }}
      style={styles.seekHit}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...responder.panHandlers}
    >
      <View pointerEvents="none" style={styles.seekTrack}>
        <View style={[styles.seekFill, { width: `${progress * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: Math.max(0, progress * width - 7) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'space-between' },
  header: { minHeight: 8 },
  center: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
  bottom: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: 2 },
  bottomFull: { paddingHorizontal: 32, paddingBottom: 18 },
  times: { flexDirection: 'row', justifyContent: 'space-between', direction: 'ltr' },
  round: { alignItems: 'center', justifyContent: 'center' },
  roundPrimary: { backgroundColor: colors.white },
  roundGhost: { backgroundColor: 'rgba(0,0,0,0.4)' },
  pressed: { opacity: 0.75 },
  seekHit: { height: 24, justifyContent: 'center', direction: 'ltr' },
  seekTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  seekFill: { height: 4, backgroundColor: colors.amber },
  thumb: { position: 'absolute', top: 5, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.white },
});
