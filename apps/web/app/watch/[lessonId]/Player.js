'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ERROR_CODES, PROGRESS_PING_SECONDS, errorMessage } from '@lp/shared';
import { api, errorText, sendOnUnload } from '@/lib/api';
import { formatBytes, formatClock } from '@/lib/format';
import Watermark from './Watermark';
import styles from './player.module.css';

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const HLS_MIME = 'application/vnd.apple.mpegurl';
// An expired playback token is renewed once; another failure soon after is shown as an error.
const RENEW_COOLDOWN_MS = 60_000;
const RATE_KEY = 'lp.playbackRate';
const CONTROLS_HIDE_MS = 2500;

function toPlayerError(err) {
  const code = err?.code;
  if (code === ERROR_CODES.NOT_ENROLLED) return { code, text: errorMessage(code), redeem: true };
  if (code === ERROR_CODES.CONCURRENT_PLAYBACK) return { code, text: errorMessage(code), retry: true };
  if (code === ERROR_CODES.LESSON_NOT_READY || code === ERROR_CODES.NOT_FOUND) return { code, text: errorMessage(code) };
  return { code, text: errorText(err), retry: true };
}

function readRate() {
  try {
    const r = Number(window.localStorage.getItem(RATE_KEY));
    return SPEEDS.includes(r) ? r : 1;
  } catch {
    return 1;
  }
}

export default function Player({ lessonId }) {
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const aliveRef = useRef(true);
  const startedRef = useRef(false); // playback actually started (pings only after that)
  const watchedRef = useRef(0); // seconds played since the last progress ping
  const lastTimeRef = useRef(0);
  const lastSentRef = useRef({ pos: -1 });
  const lastRenewRef = useRef(0);
  const nativeStartRef = useRef(0);
  const rateRef = useRef(1);
  const idleTimerRef = useRef(null);
  const takenOverRef = useRef(false); // another device took the account over: no more pings until a retry
  const lastPingRef = useRef(Promise.resolve()); // the latest progress request (ending the session waits for it)

  const [attempt, setAttempt] = useState(0);
  const [playback, setPlayback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [levels, setLevels] = useState([]);
  const [level, setLevel] = useState(-1);
  const [autoHeight, setAutoHeight] = useState(null);
  const [rate, setRate] = useState(1);
  const [paused, setPaused] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [course, setCourse] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const [attachmentError, setAttachmentError] = useState('');

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  // ---------- progress pings and the playback session ----------

  // A progress ping answered CONCURRENT_PLAYBACK: another device took the account over, so stop and say so.
  // The error's retry button asks for the session again.
  const stopTakenOver = useCallback(() => {
    takenOverRef.current = true;
    if (!aliveRef.current) return;
    videoRef.current?.pause();
    destroyHls();
    setError(toPlayerError({ code: ERROR_CODES.CONCURRENT_PLAYBACK }));
  }, [destroyHls]);

  /** Reports position and watch time. Returns the request's promise, which settles and never rejects. */
  const sendPing = useCallback(
    (mode) => {
      if (!startedRef.current || takenOverRef.current) return lastPingRef.current;
      // On unmount the <video> ref is already detached: fall back to the last time update.
      const positionSec = Math.floor(videoRef.current?.currentTime ?? lastTimeRef.current);
      const watchedDeltaSec = Math.min(600, Math.round(watchedRef.current * 10) / 10);
      // nothing new since the last ping (e.g. visibilitychange followed by pagehide)
      if (mode !== 'interval' && watchedDeltaSec === 0 && lastSentRef.current.pos === positionSec) {
        return lastPingRef.current;
      }
      watchedRef.current = 0;
      lastSentRef.current = { pos: positionSec };
      const path = `/lessons/${lessonId}/progress`;
      const body = { positionSec, watchedDeltaSec };
      lastPingRef.current =
        mode === 'unload'
          ? sendOnUnload(path, { body })
          : api(path, { method: 'POST', body }).catch((err) => {
              watchedRef.current += watchedDeltaSec; // credit it on the next ping
              if (err?.code === ERROR_CODES.CONCURRENT_PLAYBACK) stopTakenOver();
            });
      return lastPingRef.current;
    },
    [lessonId, stopTakenOver],
  );

  /**
   * Last ping, then DELETE the playback session so another device can play at once instead of after the server's
   * idle timeout. The DELETE waits for the ping, which would otherwise renew the session; on pagehide nothing runs
   * after the handler, so both go out together (best effort).
   */
  const endSession = useCallback(
    (unloading) => {
      const path = `/lessons/${lessonId}/playback`;
      const ping = sendPing('unload');
      if (unloading) sendOnUnload(path, { method: 'DELETE' });
      else ping.then(() => sendOnUnload(path, { method: 'DELETE' }));
    },
    [lessonId, sendPing],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused && !v.ended) sendPing('interval');
    }, PROGRESS_PING_SECONDS * 1000);
    const onPageHide = () => endSession(true);
    // Hidden tab: the next ping re-creates the session if this tab keeps playing and no other device took over.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') endSession(false);
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [sendPing, endSession]);

  // Leaving the lesson. The player is keyed by lessonId, so endSession never changes before the unmount.
  useEffect(() => () => endSession(false), [endSession]);

  // ---------- loading the stream ----------

  const play = useCallback(() => {
    videoRef.current?.play().catch(() => {
      // autoplay blocked: the big play button stays visible
    });
  }, []);

  const renewRef = useRef(null);

  const attach = useCallback(
    async (url, startAt, autoplay) => {
      const video = videoRef.current;
      if (!video) return;
      destroyHls();
      setLevels([]);
      setLevel(-1);
      setAutoHeight(null);

      const { default: Hls } = await import('hls.js');
      if (!aliveRef.current) return;

      if (Hls.isSupported()) {
        const hls = new Hls({ startPosition: startAt > 0 ? startAt : -1 });
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLevels(hls.levels.map((l, index) => ({ index, height: l.height })).sort((a, b) => b.height - a.height));
          if (autoplay) play();
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => setAutoHeight(hls.levels[data.level]?.height ?? null));
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          const status = data.response?.code ?? data.networkDetails?.status;
          // 409 from the key request: another device holds the account's playback session.
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && status === 409) {
            stopTakenOver();
            return;
          }
          // 401/403/410: the playback token or the signed segment links expired.
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && [401, 403, 410].includes(status) && renewRef.current?.()) {
            return;
          }
          destroyHls();
          setError({ code: 'NETWORK', text: 'تعذّر تحميل الفيديو، تحقق من الإنترنت ثم أعد المحاولة.', retry: true });
        });
        hls.loadSource(url);
        hls.attachMedia(video);
      } else if (video.canPlayType(HLS_MIME)) {
        // Safari / iOS: native HLS
        nativeStartRef.current = startAt > 0 ? startAt : 0;
        video.src = url;
        if (autoplay) play();
      } else {
        setError({ code: 'UNSUPPORTED', text: 'متصفحك لا يدعم تشغيل هذا الفيديو، جرّب متصفحاً حديثاً.' });
      }
    },
    [destroyHls, play, stopTakenOver],
  );

  /** Requests a fresh playback token and resumes at the current position. Returns false if not allowed now. */
  useEffect(() => {
    renewRef.current = () => {
      if (Date.now() - lastRenewRef.current < RENEW_COOLDOWN_MS) return false;
      lastRenewRef.current = Date.now();
      const video = videoRef.current;
      const position = video?.currentTime || 0;
      const wasPlaying = video ? !video.paused : true;
      destroyHls();
      setBuffering(true);
      api(`/lessons/${lessonId}/playback`, { method: 'POST' })
        .then((data) => {
          if (!aliveRef.current) return;
          setPlayback(data);
          return attach(data.playbackUrl, position, wasPlaying);
        })
        .catch((err) => aliveRef.current && setError(toPlayerError(err)))
        .finally(() => aliveRef.current && setBuffering(false));
      return true;
    };
  }, [lessonId, attach, destroyHls]);

  useEffect(() => {
    aliveRef.current = true;
    takenOverRef.current = false;
    const ctrl = new AbortController();
    rateRef.current = readRate();
    setRate(rateRef.current);
    setLoading(true);
    setError(null);

    api(`/lessons/${lessonId}/playback`, { method: 'POST', signal: ctrl.signal })
      .then(async (data) => {
        if (!aliveRef.current) return;
        setPlayback(data);
        if (data.durationSec) setDuration(data.durationSec);
        await attach(data.playbackUrl, data.resumePositionSec || 0, true);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError' && aliveRef.current) setError(toPlayerError(err));
      })
      .finally(() => aliveRef.current && setLoading(false));

    return () => {
      aliveRef.current = false;
      ctrl.abort();
      sendPing('unload');
      destroyHls();
    };
  }, [lessonId, attempt, attach, destroyHls, sendPing]);

  // Course outline for the side list (enrollment-aware when logged in).
  const courseId = playback?.lesson?.courseId;
  useEffect(() => {
    if (!courseId) return undefined;
    const ctrl = new AbortController();
    api(`/courses/${courseId}`, { auth: 'optional', signal: ctrl.signal })
      .then(setCourse)
      .catch(() => {});
    return () => ctrl.abort();
  }, [courseId]);

  // ---------- attachments ----------

  /**
   * Links are issued per click and expire within minutes, so a copied link soon stops working. The tab is opened
   * inside the click, before the request: a window opened after an await is blocked as a popup (Safari).
   */
  const openAttachment = async (attachment) => {
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    setAttachmentError('');
    setOpeningId(attachment.id);
    try {
      const { url } = await api(`/lessons/${lessonId}/attachments/${attachment.id}/link`, { method: 'POST' });
      if (tab) tab.location.href = url;
      else window.open(url, '_blank', 'noopener');
    } catch (err) {
      tab?.close();
      setAttachmentError(errorText(err));
    } finally {
      setOpeningId(null);
    }
  };

  // ---------- video element events ----------

  const onLoadedMetadata = () => {
    const video = videoRef.current;
    video.playbackRate = rateRef.current;
    video.defaultPlaybackRate = rateRef.current;
    if (nativeStartRef.current > 0) {
      video.currentTime = nativeStartRef.current;
      nativeStartRef.current = 0;
    }
    if (Number.isFinite(video.duration)) setDuration(video.duration);
  };

  const onTimeUpdate = () => {
    const video = videoRef.current;
    const t = video.currentTime;
    if (!video.paused && !video.seeking) {
      const delta = t - lastTimeRef.current;
      // ignore jumps (seeks); at 2x a timeupdate step is still well under 3 s
      if (delta > 0 && delta < 3) watchedRef.current += delta;
    }
    lastTimeRef.current = t;
    setTime(t);
  };

  const onPlaying = () => {
    startedRef.current = true;
    setBuffering(false);
    setPaused(false);
  };

  const onPause = () => {
    setPaused(true);
    if (!videoRef.current.ended) sendPing('pause');
  };

  const onVideoError = () => {
    // hls.js reports its own errors; this is the native (Safari) path.
    if (hlsRef.current || !videoRef.current?.error) return;
    if (renewRef.current?.()) return;
    setError({ code: 'MEDIA', text: 'تعذّر تشغيل الفيديو، أعد المحاولة.', retry: true });
  };

  // ---------- controls ----------

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) play();
    else video.pause();
  }, [play]);

  const seekBy = useCallback((sec) => {
    const video = videoRef.current;
    if (!video) return;
    const max = Number.isFinite(video.duration) ? video.duration : Infinity;
    video.currentTime = Math.min(max, Math.max(0, video.currentTime + sec));
  }, []);

  const changeRate = (r) => {
    rateRef.current = r;
    setRate(r);
    const video = videoRef.current;
    if (video) {
      video.playbackRate = r;
      video.defaultPlaybackRate = r;
    }
    try {
      window.localStorage.setItem(RATE_KEY, String(r));
    } catch {
      // ignore
    }
  };

  const changeLevel = (value) => {
    const idx = Number(value);
    setLevel(idx);
    if (hlsRef.current) hlsRef.current.currentLevel = idx; // -1 = auto
  };

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) video.muted = !video.muted;
  }, []);

  const changeVolume = (v) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    video.muted = v === 0;
  };

  // Fullscreen the wrapper (not the <video>) so the watermark and controls stay on top.
  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      return;
    }
    if (pseudoFullscreen) {
      setPseudoFullscreen(false);
      return;
    }
    const request = el?.requestFullscreen || el?.webkitRequestFullscreen;
    if (request) {
      Promise.resolve(request.call(el)).catch(() => setPseudoFullscreen(true));
    } else {
      // iPhone Safari has no element fullscreen: fill the viewport instead
      setPseudoFullscreen(true);
    }
  }, [pseudoFullscreen]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  useEffect(() => {
    if (!pseudoFullscreen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setPseudoFullscreen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [pseudoFullscreen]);

  const wakeControls = () => {
    setIdle(false);
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIdle(true), CONTROLS_HIDE_MS);
  };
  useEffect(() => () => clearTimeout(idleTimerRef.current), []);

  const onKeyDown = (e) => {
    if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(e.target.tagName)) return;
    const actions = {
      ' ': togglePlay,
      k: togglePlay,
      ArrowRight: () => seekBy(10),
      ArrowLeft: () => seekBy(-10),
      f: toggleFullscreen,
      m: toggleMute,
    };
    const action = actions[e.key];
    if (action) {
      e.preventDefault();
      action();
      wakeControls();
    }
  };

  // ---------- render ----------

  const lessons = course ? course.sections.flatMap((s) => s.lessons) : [];
  const currentIndex = lessons.findIndex((l) => l.id === lessonId);
  const nextLesson = currentIndex >= 0 ? lessons[currentIndex + 1] : null;
  const showControls = paused || !idle;
  const isFull = fullscreen || pseudoFullscreen;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.main}>
        <div
          ref={wrapperRef}
          className={[styles.wrapper, pseudoFullscreen && styles.pseudoFullscreen, isFull && styles.full, !showControls && styles.idle]
            .filter(Boolean)
            .join(' ')}
          onContextMenu={(e) => e.preventDefault()}
          onPointerMove={wakeControls}
          onKeyDown={onKeyDown}
          tabIndex={0}
          aria-label="مشغّل الفيديو"
        >
          <video
            ref={videoRef}
            className={styles.video}
            playsInline
            preload="auto"
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            disableRemotePlayback
            onContextMenu={(e) => e.preventDefault()}
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
            onLoadedMetadata={onLoadedMetadata}
            onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
            onTimeUpdate={onTimeUpdate}
            onSeeking={(e) => (lastTimeRef.current = e.currentTarget.currentTime)}
            onPlay={() => setPaused(false)}
            onPlaying={onPlaying}
            onPause={onPause}
            onWaiting={() => setBuffering(true)}
            onCanPlay={() => setBuffering(false)}
            onEnded={() => sendPing('ended')}
            onVolumeChange={(e) => {
              setVolume(e.currentTarget.volume);
              setMuted(e.currentTarget.muted);
            }}
            onError={onVideoError}
          />

          {playback && <Watermark text={playback.watermark?.text} />}

          {(loading || buffering) && !error && (
            <div className={styles.overlay}>
              <span className="spinner" aria-label="جارٍ التحميل" />
            </div>
          )}

          {!loading && !buffering && !error && paused && playback && (
            <button type="button" className={styles.bigPlay} onClick={togglePlay} aria-label="تشغيل">
              ▶
            </button>
          )}

          {error && (
            <div className={`${styles.overlay} ${styles.errorOverlay}`} role="alert">
              <p>{error.text}</p>
              <div className={styles.errorActions}>
                {error.redeem && (
                  <Link href="/redeem" className="btn btn-primary">
                    تفعيل الكورس بكود
                  </Link>
                )}
                {error.retry && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      lastRenewRef.current = 0;
                      setAttempt((a) => a + 1);
                    }}
                  >
                    إعادة المحاولة
                  </button>
                )}
                <Link href="/my-courses" className="btn btn-secondary">
                  كورساتي
                </Link>
              </div>
            </div>
          )}

          {playback && !error && (
            <div className={styles.controls} dir="ltr" onClick={(e) => e.stopPropagation()}>
              <input
                type="range"
                className={styles.seek}
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(time, duration || 0)}
                onChange={(e) => {
                  if (videoRef.current) videoRef.current.currentTime = Number(e.target.value);
                }}
                aria-label="موضع التشغيل"
              />
              <div className={styles.controlRow}>
                <button type="button" className={styles.ctrlBtn} onClick={togglePlay} aria-label={paused ? 'تشغيل' : 'إيقاف مؤقت'}>
                  {paused ? '▶' : '❚❚'}
                </button>
                <button type="button" className={styles.ctrlBtn} onClick={() => seekBy(-10)} aria-label="رجوع 10 ثوانٍ">
                  ↺10
                </button>
                <button type="button" className={styles.ctrlBtn} onClick={() => seekBy(10)} aria-label="تقديم 10 ثوانٍ">
                  10↻
                </button>
                <button type="button" className={styles.ctrlBtn} onClick={toggleMute} aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}>
                  {muted || volume === 0 ? '🔇' : '🔊'}
                </button>
                <input
                  type="range"
                  className={styles.volume}
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => changeVolume(Number(e.target.value))}
                  aria-label="مستوى الصوت"
                />
                <span className={styles.time}>
                  {formatClock(time)} / {formatClock(duration)}
                </span>
                <span className={styles.spacer} />
                <label className={styles.selectLabel}>
                  <span className="sr-only">سرعة التشغيل</span>
                  <select className={styles.select} value={rate} onChange={(e) => changeRate(Number(e.target.value))} title="سرعة التشغيل">
                    {SPEEDS.map((s) => (
                      <option key={s} value={s}>
                        {s}x
                      </option>
                    ))}
                  </select>
                </label>
                {levels.length > 0 && (
                  <label className={styles.selectLabel}>
                    <span className="sr-only">الجودة</span>
                    <select className={styles.select} value={level} onChange={(e) => changeLevel(e.target.value)} title="الجودة">
                      <option value={-1}>تلقائي{level === -1 && autoHeight ? ` (${autoHeight}p)` : ''}</option>
                      {levels.map((l) => (
                        <option key={l.index} value={l.index}>
                          {l.height}p
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className={styles.ctrlBtn}
                  onClick={toggleFullscreen}
                  aria-label={isFull ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
                >
                  <FullscreenIcon exit={isFull} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.info}>
          <div>
            <h1 className={styles.title}>{playback?.lesson?.title || (loading ? 'جارٍ التحميل…' : 'الدرس')}</h1>
            {course && (
              <Link href={`/courses/${course.course.slug}`} className={styles.courseLink}>
                {course.course.title}
              </Link>
            )}
          </div>
          {nextLesson && (
            <Link href={`/watch/${nextLesson.id}`} className="btn btn-secondary">
              الدرس التالي ←
            </Link>
          )}
        </div>

        {playback?.attachments?.length > 0 && (
          <section className={`card ${styles.attachments}`}>
            <h2 className={styles.subheading}>مرفقات الدرس</h2>
            <ul>
              {playback.attachments.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className={styles.attachmentLink}
                    onClick={() => openAttachment(a)}
                    disabled={openingId === a.id}
                  >
                    📄 {a.name}
                  </button>
                  <span className="muted">{openingId === a.id ? 'جارٍ الفتح…' : formatBytes(a.size)}</span>
                </li>
              ))}
            </ul>
            {attachmentError && (
              <div className={`alert alert-error ${styles.attachmentError}`} role="alert">
                {attachmentError}
              </div>
            )}
          </section>
        )}
      </div>

      {course && (
        <aside className={`card ${styles.sidebar}`} aria-label="دروس الكورس">
          <h2 className={styles.subheading}>دروس الكورس</h2>
          {course.sections.map((section) => (
            <div key={section.id} className={styles.sideSection}>
              <h3>{section.title}</h3>
              <ol>
                {section.lessons.map((l) => {
                  const locked = !course.enrollment && !course.canManage && !l.isFreePreview;
                  const cls = [styles.sideLesson, l.id === lessonId && styles.current, locked && styles.sideLocked]
                    .filter(Boolean)
                    .join(' ');
                  const label = (
                    <>
                      <span aria-hidden="true">{l.progress?.completed ? '✓' : locked ? '🔒' : '▶'}</span>
                      <span className={styles.sideTitle}>{l.title}</span>
                      {l.durationSec ? <span className={styles.sideDuration}>{formatClock(l.durationSec)}</span> : null}
                    </>
                  );
                  return (
                    <li key={l.id}>
                      {locked ? (
                        <span className={cls}>{label}</span>
                      ) : (
                        <Link href={`/watch/${l.id}`} className={cls} aria-current={l.id === lessonId ? 'page' : undefined}>
                          {label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}

function FullscreenIcon({ exit }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {exit ? (
        <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
      ) : (
        <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
      )}
    </svg>
  );
}
