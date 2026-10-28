import { Image, StyleSheet, View } from 'react-native';
import { coverColor } from '../theme';

// Decorative rings drawn over courses that have no uploaded cover (no SVG library in the build).
const RINGS = [
  { size: 0.34, top: 0.18, left: 0.08 },
  { size: 0.46, top: 0.42, left: 0.24 },
  { size: 0.2, top: 0.68, left: 0.02 },
];

/**
 * The course's uploaded cover, or a coloured block with rings in the course's colour.
 * `height` sizes the decoration; the block itself takes `style`.
 */
export function CourseCover({ course, height, style, children }) {
  if (course.coverUrl) {
    return (
      <View style={[styles.base, style]}>
        <Image source={{ uri: course.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        {children}
      </View>
    );
  }
  return (
    <View style={[styles.base, { backgroundColor: coverColor(course.id) }, style]}>
      {RINGS.map((r, i) => {
        const d = Math.round(height * r.size);
        return (
          <View
            key={i}
            pointerEvents="none"
            style={[
              styles.ring,
              // `end` keeps the rings on the far side from the start edge (where back buttons and badges sit) in RTL.
              { width: d, height: d, borderRadius: d / 2, top: height * r.top, end: height * r.left },
            ]}
          />
        );
      })}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  ring: { position: 'absolute', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.16)' },
});
