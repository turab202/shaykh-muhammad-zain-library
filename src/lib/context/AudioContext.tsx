"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { PublicLesson } from "@/types/library";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface AudioContextValue {
  currentLesson: PublicLesson | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  isMiniPlayerOpen: boolean;
  playlist: PublicLesson[];
  playLesson: (lesson: PublicLesson) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seek: (seconds: number) => void;
  skip: (seconds: number) => void;
  setRate: (rate: number) => void;
  setVol: (volume: number) => void;
  toggleMute: () => void;
  closeMiniPlayer: () => void;
  setPlaylist: (lessons: PublicLesson[]) => void;
}

const AudioContext = createContext<AudioContextValue | undefined>(undefined);

// ─────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────

export function AudioProvider({ children }: { children: ReactNode }) {
  const [currentLesson, setCurrentLesson] = useState<PublicLesson | null>(null);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [currentTime, setCurrentTime]     = useState(0);
  const [duration, setDuration]           = useState(0);
  const [playbackRate, setPlaybackRate]   = useState(1);
  const [volume, setVolume]               = useState(1);
  const [isMuted, setIsMuted]             = useState(false);
  const [isMiniPlayerOpen, setIsMiniPlayerOpen] = useState(false);

  // Single audio element — created once, never recreated.
  const audioRef         = useRef<HTMLAudioElement | null>(null);
  // Ref mirrors so event-handler closures don't go stale.
  const currentLessonRef = useRef<PublicLesson | null>(null);
  const isPlayingRef     = useRef(false);

  // Playlist for auto-advance.
  const [playlist, setPlaylistState] = useState<PublicLesson[]>([]);
  const playlistRef = useRef<PublicLesson[]>([]);

  // Stable ref for playLesson so onEnded can call it without a stale closure.
  const playLessonRef = useRef<(lesson: PublicLesson) => void>(() => {});

  // Retry state for network error backoff.
  const retryCountRef  = useRef(0);
  const currentSrcRef  = useRef<string>("");

  // Keep refs in sync with state.
  useEffect(() => { currentLessonRef.current = currentLesson; }, [currentLesson]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);

  // ── Create the Audio element exactly once ─────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => {
      const t = audio.currentTime;
      setCurrentTime(t);
      const lesson = currentLessonRef.current;
      if (lesson) {
        try {
          localStorage.setItem(`progress_${lesson.id}`, JSON.stringify({
            lessonId: lesson.id,
            currentTime: t,
            duration: isNaN(audio.duration) ? lesson.duration : audio.duration,
            lastPlayed: new Date().toISOString(),
          }));
        } catch { /* ignore */ }
      }
    };

    const onLoadedMetadata = () => {
      const d = audio.duration;
      if (!isNaN(d) && d > 0) {
        setDuration(d);
        // Persist real duration to DB so the header shows correct time on next load.
        // Fire-and-forget — don't block playback.
        const lesson = currentLessonRef.current;
        if (lesson) {
          const durationSecs = Math.round(d);
          fetch(`/api/lessons/${lesson.id}/duration`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ duration: durationSecs }),
          }).catch(() => {}); // silent — non-critical
        }
      }
    };

    const onEnded = () => {
      const currentLesson = currentLessonRef.current;
      const pl = playlistRef.current;
      if (currentLesson && pl.length > 0) {
        const idx = pl.findIndex((l) => l.id === currentLesson.id);
        if (idx !== -1 && idx + 1 < pl.length) {
          playLessonRef.current(pl[idx + 1]);
          return;
        }
      }
      setIsPlaying(false);
    };

    const onError = () => {
      const err = audio.error;
      const code = err?.code ?? 0;
      const meanings = ["", "ABORTED", "NETWORK_ERROR", "DECODE_ERROR", "SRC_NOT_SUPPORTED"];
      console.error("[AudioContext] <audio> error:", {
        code,
        message: err?.message,
        meaning: meanings[code],
        src: audio.src?.slice(0, 120),
      });

      // ABORTED (1): do not retry
      // DECODE_ERROR (3) or SRC_NOT_SUPPORTED (4): do not retry
      // NETWORK_ERROR (2): retry up to 3 times with exponential backoff
      if (code === 2) {
        if (retryCountRef.current < 3) {
          const delay = Math.pow(2, retryCountRef.current) * 1000; // 1s, 2s, 4s
          retryCountRef.current += 1;
          // Close over the CURRENT src and time NOW — before the timeout fires
          // a new playLesson call might have changed currentSrcRef/currentTime.
          const srcToRetry = currentSrcRef.current;
          const timeToRestore = audio.currentTime; // capture pre-error position
          console.warn(`[AudioContext] Network error, retry ${retryCountRef.current}/3 in ${delay}ms`);
          setTimeout(() => {
            // Guard: if a new lesson was loaded in the meantime, abort this retry
            if (!srcToRetry || currentSrcRef.current !== srcToRetry) return;
            if (!audio.paused) audio.pause();
            audio.src = srcToRetry;
            audio.load();
            // Restore the position that existed before the error
            if (timeToRestore > 0) {
              const restoreOnSeekable = () => {
                try { audio.currentTime = timeToRestore; } catch { /* ignore */ }
                audio.removeEventListener("canplay", restoreOnSeekable);
              };
              audio.addEventListener("canplay", restoreOnSeekable);
            }
            audio.play()
              .then(() => setIsPlaying(true))
              .catch((playErr: Error) => {
                if (playErr.name !== "AbortError") {
                  console.error("[AudioContext] retry play() failed:", playErr);
                  setIsPlaying(false);
                }
              });
          }, delay);
        } else {
          console.error("[AudioContext] Network error after 3 retries, giving up.");
          setIsPlaying(false);
        }
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("timeupdate",     onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended",          onEnded);
    audio.addEventListener("error",          onError);

    return () => {
      audio.removeEventListener("timeupdate",     onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended",          onEnded);
      audio.removeEventListener("error",          onError);
      audio.pause();
      audio.src = "";
    };
  }, []); // ← empty: runs once on mount, never torn down mid-playback

  // ── Keyboard shortcuts ────────────────────────────────────
  const actionsRef = useRef({ togglePlay: () => {}, skip: (_: number) => {}, hasLesson: false });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" ||
          document.activeElement?.getAttribute("contenteditable") === "true") return;
      if (!actionsRef.current.hasLesson) return;
      if (e.code === "Space")      { e.preventDefault(); actionsRef.current.togglePlay(); }
      else if (e.code === "ArrowLeft")  { e.preventDefault(); actionsRef.current.skip(-10); }
      else if (e.code === "ArrowRight") { e.preventDefault(); actionsRef.current.skip(10);  }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Playback operations ───────────────────────────────────

  const pause = useCallback(() => {
    setIsPlaying(false);
    audioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    // Guard: only call play() if not already playing
    if (!audio.paused) { setIsPlaying(true); return; }
    audio.play()
      .then(() => setIsPlaying(true))
      .catch((err: Error) => {
        if (err.name === "AbortError") return; // interrupted by rapid pause — safe to ignore
        console.error("[AudioContext] resume play() failed:", err);
        setIsPlaying(false);
      });
  }, []);

  const togglePlay = useCallback(() => {
    if (!currentLessonRef.current) return;
    if (isPlayingRef.current) pause(); else resume();
  }, [pause, resume]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    const max = (audio && !isNaN(audio.duration) && audio.duration > 0)
      ? audio.duration
      : (currentLessonRef.current?.duration ?? 0);
    const clamped = Math.max(0, Math.min(seconds, max));
    setCurrentTime(clamped);
    if (audio) {
      try {
        audio.currentTime = clamped;
        // If audio was playing, seeking pauses it internally on some browsers —
        // re-trigger play so it continues from the new position.
        if (isPlayingRef.current && audio.paused) {
          audio.play().catch((err: Error) => {
            if (err.name !== "AbortError") console.error("[AudioContext] seek play() failed:", err);
          });
        }
      } catch { /* ignore */ }
    }
  }, []);

  const skip = useCallback((s: number) => {
    seek((audioRef.current?.currentTime ?? 0) + s);
  }, [seek]);

  const playLesson = useCallback((lesson: PublicLesson) => {
    const audio = audioRef.current;
    if (!audio) return;

    const audioUrl = lesson.audioUrl ?? "";
    const isTelegramProxy = audioUrl.startsWith("/api/audio/");

    // No real audio
    if (!audioUrl) {
      setCurrentLesson(lesson);
      setIsMiniPlayerOpen(true);
      setIsPlaying(false);
      return;
    }

    // For Telegram proxy URLs — play directly (bot streams the audio)
    // No redirect needed — the API route handles the streaming

    // Restore saved progress.
    let resumeTime = 0;
    try {
      const saved = localStorage.getItem(`progress_${lesson.id}`);
      if (saved) {
        const p = JSON.parse(saved) as { currentTime?: number };
        const t = p.currentTime ?? 0;
        resumeTime = t < ((lesson.duration ?? 0) - 10) ? t : 0;
      }
    } catch { /* ignore */ }

    // Update UI state immediately so player shows the lesson.
    setCurrentLesson(lesson);
    setDuration(lesson.duration ?? 0);
    setCurrentTime(resumeTime);
    setIsMiniPlayerOpen(true);

    // If this is a presign URL, resolve the real B2 URL first.
    // The real URL supports Range requests natively — seek works properly.
    const isPresign = audioUrl.startsWith("/api/media/presign");

    const doPlay = (resolvedUrl: string) => {
      currentSrcRef.current = resolvedUrl;
      if (audio.src !== resolvedUrl) {
        if (!audio.paused) audio.pause();
        audio.src          = resolvedUrl;
        audio.currentTime  = 0;
        audio.playbackRate = playbackRate;
      }
      if (resumeTime > 0) {
        try { audio.currentTime = resumeTime; } catch { /* ignore */ }
      }
      setTimeout(() => {
        audio.play()
          .then(() => setIsPlaying(true))
          .catch((err: Error) => {
            if (err.name === "AbortError") return;
            console.error("[AudioContext] play() failed:", err);
            setIsPlaying(false);
          });
      }, 0);
    };

    if (isPresign) {
      fetch(audioUrl)
        .then((r) => r.json())
        .then((data: { url?: string }) => {
          if (data.url) {
            retryCountRef.current = 0;
            doPlay(data.url);
          } else {
            console.error("[AudioContext] presign returned no URL:", data);
            setIsPlaying(false);
          }
        })
        .catch((err) => {
          console.error("[AudioContext] presign fetch failed:", err);
          setIsPlaying(false);
        });
    } else {
      retryCountRef.current = 0;
      doPlay(audioUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackRate]);

  // Keep playLessonRef in sync so onEnded can call it without a stale closure.
  useEffect(() => { playLessonRef.current = playLesson; }, [playLesson]);

  // Stable setter for the playlist.
  const setPlaylist = useCallback((lessons: PublicLesson[]) => {
    setPlaylistState(lessons);
  }, []);

  // Keep actionsRef fresh for the keyboard handler.
  useEffect(() => {
    actionsRef.current = { togglePlay, skip, hasLesson: currentLessonRef.current !== null };
  });

  const setRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, []);

  const setVol = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolume(clamped);
    setIsMuted(false);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
      audioRef.current.muted  = false;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  const closeMiniPlayer = useCallback(() => {
    pause();
    setIsMiniPlayerOpen(false);
  }, [pause]);

  return (
    <AudioContext.Provider value={{
      currentLesson,
      isPlaying,
      currentTime,
      duration: duration || currentLesson?.duration || 0,
      playbackRate,
      volume,
      isMuted,
      isMiniPlayerOpen,
      playlist,
      playLesson,
      togglePlay,
      pause,
      resume,
      seek,
      skip,
      setRate,
      setVol,
      toggleMute,
      closeMiniPlayer,
      setPlaylist,
    }}>
      {children}
    </AudioContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be used within an AudioProvider");
  return ctx;
}


