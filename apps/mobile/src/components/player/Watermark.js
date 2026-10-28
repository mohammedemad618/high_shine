import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const MIN_MS = 5000;
const MAX_MS = 8000;
const randomDelay = () => MIN_MS + Math.random() * (MAX_MS - MIN_MS);

/**
 * Moving, semi-transparent watermark drawn over the video. It never takes touches (pointerEvents="none")
 * and jumps to a random spot every 5–8 s so it cannot be cropped or blurred out at a fixed position.
 */
export function Watermark({ text }) {
  const [box, setBox] = useState(null);
  const [label, setLabel] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!box || !label) return undefined;
    let timer;
    const move = () => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setPos({
          x: Math.random() * Math.max(0, box.width - label.width),
          y: Math.random() * Math.max(0, box.height - label.height),
        });
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
      timer = setTimeout(move, randomDelay());
    };
    move();
    return () => clearTimeout(timer);
  }, [box, label, opacity]);

  if (!text) return null;
  return (
    // direction: 'ltr' keeps the left/top offsets from being mirrored by the app-wide RTL layout.
    <View pointerEvents="none" style={styles.layer} onLayout={(e) => setBox(e.nativeEvent.layout)}>
      <Animated.Text
        style={[styles.text, { opacity, transform: [{ translateX: pos.x }, { translateY: pos.y }] }]}
        onLayout={(e) => setLabel(e.nativeEvent.layout)}
        numberOfLines={1}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, direction: 'ltr', overflow: 'hidden' },
  text: {
    position: 'absolute',
    top: 0,
    left: 0,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
