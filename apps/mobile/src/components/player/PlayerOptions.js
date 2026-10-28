import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { Chip, T } from '../ui';

export const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
export const AUTO_QUALITY = 'auto';

export const speedLabel = (s) => `${s}×`;
export function qualityLabel(quality, renditions = []) {
  if (quality !== AUTO_QUALITY) return quality;
  const top = renditions[renditions.length - 1];
  return top ? `تلقائي (${top.name})` : 'تلقائي';
}

function Group({ title, children }) {
  return (
    <View style={styles.group}>
      <T weight="semibold" size={13} color={colors.muted}>
        {title}
      </T>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

/** Quality and speed pickers. `renditions` come from the playback response ({name, height}). */
export function PlayerOptions({ speed, onSpeed, quality, onQuality, renditions }) {
  return (
    <View style={styles.box}>
      {renditions?.length > 1 ? (
        <Group title="الجودة">
          <Chip label={qualityLabel(AUTO_QUALITY, renditions)} active={quality === AUTO_QUALITY} onPress={() => onQuality(AUTO_QUALITY)} />
          {[...renditions].reverse().map((r) => (
            <Chip key={r.name} label={r.name} active={quality === r.name} onPress={() => onQuality(r.name)} />
          ))}
        </Group>
      ) : null}
      <Group title="سرعة التشغيل">
        {SPEEDS.map((s) => (
          <Chip key={s} label={speedLabel(s)} active={speed === s} onPress={() => onSpeed(s)} />
        ))}
      </Group>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 18 },
  group: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
