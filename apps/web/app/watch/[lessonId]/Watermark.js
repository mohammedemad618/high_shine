'use client';

import { useEffect, useState } from 'react';
import styles from './player.module.css';

const MIN_MS = 5000;
const MAX_MS = 8000;

/**
 * Viewer's name and phone drawn over the video, jumping to a random spot every 5–8 s.
 * Browsers cannot block screen recording, so this is what makes a leaked recording traceable.
 * It sits inside the fullscreen wrapper, so it stays visible in fullscreen.
 */
export default function Watermark({ text }) {
  const [pos, setPos] = useState({ x: 8, y: 10 });

  useEffect(() => {
    let timer;
    const move = () => {
      setPos({ x: 4 + Math.random() * 92, y: 4 + Math.random() * 84 });
      timer = setTimeout(move, MIN_MS + Math.random() * (MAX_MS - MIN_MS));
    };
    timer = setTimeout(move, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!text) return null;
  return (
    <div
      className={styles.watermark}
      // translate by the same percentage so the text always stays fully inside the frame
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(-${pos.x}%, -${pos.y}%)` }}
      aria-hidden="true"
    >
      {text}
    </div>
  );
}
