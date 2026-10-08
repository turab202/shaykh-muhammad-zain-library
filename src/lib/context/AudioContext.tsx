"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
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
}

// ─────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────

const AudioContext = createContext<AudioContextValue | undefined>(undefined);

// ─────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────

export function AudioProvider({ children }: { children: ReactNode }) {
  const [currentLesson, setCurrentLesson] = useState<PublicLesson | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isMiniPlayerOpen, setIsMiniPlayerOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Synthetic fallback timer — used when the audio element cannot stream
  // (e.g. in sandboxed or offline environments). Simulates playback progress
  // so the UI remains functional even without a live audio URL.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Initialise HTML5 Audio element ───────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (!audioRef.current) return;
      setCurrentTime(audioRef.current.currentTime);
      // Persist progress so the user can resume later.
      if (currentLesson) {
        try {
          localStorage.setItem(
            `progress_${currentLesson.id}`,
            JSON.stringify({
              lessonId: currentLesson.id,
              currentTime: audioRef.current.currentTime,
              duration: audioRef.current.duration || currentLesson.duration,
              lastPlayed: new Date().toISOString(),
            })
          );
        } catch {
          // ignore — localStorage may be unavailable
        }
      }
    };

    const onLoadedMetadata = () => {
      if (!audioRef.current) return;
      const d = audioRef.current.duration;
      if (!isNaN(d) && d > 0) setDuration(d);
    };

    const onEnded = () => {
      setIsPlaying(false);
    };

    const onError = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      const err = audio.error;
      console.error("[AudioContext] <audio> error:", {
        code: err?.code,
        message: err?.message,
        // MediaError codes: 1=ABORTED 2=NETWORK 3=DECODE 4=SRC_NOT_SUPPORTED
        meaning: ["", "ABORTED", "NETWORK_ERROR", "DECODE_ERROR", "SRC_NOT_SUPPORTED"][err?.code ?? 0],
        src: audio.src?.slice(0, 120),
      });
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLesson]);

  // ── Synthetic fallback timer ─────────────────────────────
  // Kicks in when the HTML5 element has no valid duration.
  useEffect(() => {
    const audioBroken =
      !audioRef.current ||
      isNaN(audioRef.current.duration) ||
      audioRef.current.duration === 0;

    if (isPlaying && audioBroken) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const target = duration || (currentLesson?.duration ?? 1800);
          if (prev >= target) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / playbackRate);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, duration, currentLesson, playbackRate]);

  // ── Keyboard shortcuts ───────────────────────────────────
  // Space = play/pause, ArrowLeft/Right = skip ±10 s.
  // Guards against triggering while the user types in an input.
  const actionsRef = useRef({ togglePlay: () => {}, skip: (_: number) => {}, hasLesson: false });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) return;

      if (!actionsRef.current.hasLesson) return;

      if (e.code === "Space") {
        e.preventDefault();
        actionsRef.current.togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        actionsRef.current.skip(-10);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        actionsRef.current.skip(10);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Playback operations ──────────────────────────────────

  const pause = () => {
    setIsPlaying(false);
    audioRef.current?.pause();
  };

  const resume = () => {
    setIsPlaying(true);
    audioRef.current?.play().catch(() => {});
  };

  const togglePlay = () => {
    if (!currentLesson) return;
    if (isPlaying) pause(); else resume();
  };

  const seek = (seconds: number) => {
    const max = duration || currentLesson?.duration || 0;
    const clamped = Math.max(0, Math.min(seconds, max));
    setCurrentTime(clamped);
    if (audioRef.current) {
      try { audioRef.current.currentTime = clamped; } catch { /* ignore */ }
    }
  };

  const skip = (seconds: number) => seek(currentTime + seconds);

  const playLesson = (lesson: PublicLesson) => {
    setCurrentLesson(lesson);
    setDuration(lesson.duration);
    setIsMiniPlayerOpen(true);

    // If there is no real audio URL (empty or proxy that redirects to Telegram),
    // open the Telegram message directly in a new tab so the user can listen.
    // This happens when audio files haven't been downloaded to storage yet.
    const audioUrl = lesson.audioUrl ?? "";
    const isTelegramProxy = audioUrl.startsWith("/api/audio/");
    const hasRealAudio = audioUrl.length > 0 && !isTelegramProxy;

    if (isTelegramProxy && !hasRealAudio) {
      // Extract messageId from /api/audio/{messageId} and open t.me
      const msgId = audioUrl.split("/").pop();
      if (msgId) {
        window.open(`https://t.me/SheikhMuhammedZain/${msgId}`, "_blank", "noopener");
      }
      setIsPlaying(false);
      return;
    }

    // Restore saved progress if available.
    try {
      const saved = localStorage.getItem(`progress_${lesson.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const resume = parsed.currentTime ?? 0;
        setCurrentTime(resume < lesson.duration - 10 ? resume : 0);
      } else {
        setCurrentTime(0);
      }
    } catch {
      setCurrentTime(0);
    }

    if (audioRef.current) {
      if (audioRef.current.src !== lesson.audioUrl) {
        audioRef.current.src = lesson.audioUrl;
        audioRef.current.playbackRate = playbackRate;
      }
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          // Audio failed to play — do NOT start the fake timer.
          // Log the real error so we can see it in DevTools console.
          console.error("[AudioContext] play() failed:", err);
          setIsPlaying(false);
        });
    }
  };

  // Keep actionsRef current to avoid stale closures in the keyboard handler.
  useEffect(() => {
    actionsRef.current = { togglePlay, skip, hasLesson: currentLesson !== null };
  });

  const setRate = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };

  const setVol = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolume(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
    if (clamped > 0 && isMuted) setIsMuted(false);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
  };

  const closeMiniPlayer = () => {
    pause();
    setIsMiniPlayerOpen(false);
  };

  return (
    <AudioContext.Provider
      value={{
        currentLesson,
        isPlaying,
        currentTime,
        duration: duration || currentLesson?.duration || 0,
        playbackRate,
        volume,
        isMuted,
        isMiniPlayerOpen,
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
      }}
    >
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
