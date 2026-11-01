# Auto-advance and network retry for the audio player

The change adds two behavioral features to the global audio player: automatic playlist advancement when a lesson ends, and exponential-backoff retry on network errors. The playlist is stored in both React state and a parallel ref so the `onEnded` event handler — which is registered once at mount and never re-registered — can read it without a stale closure. The retry path re-uses the same single `<audio>` element and the `currentSrcRef` to avoid re-entering `playLesson`. Watch for: the retry loop does not cancel itself when `playLesson` is called mid-retry (confirmed gap), and the `onEnded` handler has one remaining stale-closure path via `playLessonRef` that deserves scrutiny.

**Verdict**: NEEDS_CHANGES

---

## High-level view

The stale-closure problem for `onEnded` is solved correctly: `currentLessonRef`, `playlistRef`, and `playLessonRef` are all refs that are kept in sync with their state/callback counterparts, so the handler registered at mount always reads current values. `playLessonRef` is updated via a dedicated `useEffect([playLesson])`, and `playLesson` itself is a `useCallback` — the chain is sound.

The retry loop for NETWORK_ERROR resets `retryCountRef` to 0 at the start of every `playLesson` call (for both presign and direct-URL paths), so a new lesson always starts with a clean retry budget. However, a `setTimeout`-based retry that fires after a new `playLesson` call has already started will still execute: it reads `currentSrcRef.current`, which by then holds the new lesson's URL, and calls `audio.src = src` on the active element — stomping the in-progress new lesson. This is a confirmed race condition.

`SeriesPlaylist` syncs the playlist into context via a `useEffect([lessons, setPlaylist])`. Because `setPlaylist` is a stable `useCallback(() => {})`, the effect will only re-run when `lessons` changes identity, which is the correct behaviour for a server-rendered prop. The dependency array is correct.

The `AudioContextValue` interface explicitly declares both `playlist: PublicLesson[]` and `setPlaylist: (lessons: PublicLesson[]) => void`, and both are present in the provider's value object. No pre-existing context fields were removed.

---

<details>
<summary>Issues (2)</summary>

1. **Retry-vs-new-lesson race** — A delayed retry `setTimeout` fired after `playLesson` is called for a different lesson will read the updated `currentSrcRef` (the new lesson's URL) and call `audio.src = newSrc` again, interrupting or doubling the new lesson's load. Fix: capture the src at the time the retry is scheduled (`const src = currentSrcRef.current` before the `setTimeout`), and add a guard inside the callback that aborts if `currentSrcRef.current !== src` at fire time.

2. **Retry does not restore `resumeTime`** — The retry path sets `audio.src` and calls `audio.play()` from `currentTime = 0`. If the user was 10 minutes into a lesson when the network error hit, the retry restarts from the beginning. Fix: capture `audio.currentTime` before the error fires and restore it after `audio.load()` in the retry callback.

</details>

<details>
<summary>Details</summary>

### Stale-closure safety in `onEnded`

`onEnded` is registered once in the mount-time `useEffect([])`. At fire time it reads `currentLessonRef.current` and `playlistRef.current` (both refs, always fresh) and then calls `playLessonRef.current(nextLesson)`. `playLessonRef` is updated by:

```ts
useEffect(() => { playLessonRef.current = playLesson; }, [playLesson]);
```

`playLesson` is a `useCallback` that only changes when `playbackRate` changes. Between rate changes the ref holds the current closure. If the user changes playback rate and the `onEnded` fires in the narrow window before the `useEffect` flushes, the ref briefly holds the previous closure — but since `playLesson`'s only captured state is `playbackRate`, the only observable difference is that the next lesson starts at the old rate, which is immediately corrected by the `audio.playbackRate = playbackRate` line inside `doPlay`. This is a benign race; no data is lost.

### Retry-vs-new-lesson race (confirmed)

The problematic code path:

```ts
// Inside onError, code === 2:
setTimeout(() => {
  const src = currentSrcRef.current;   // ← read AFTER the timeout fires
  if (!src) return;
  audio.src = src;
  audio.load();
  audio.play()...
}, delay);
```

`currentSrcRef` is a module-level ref that `playLesson → doPlay` writes to before every new load:

```ts
const doPlay = (resolvedUrl: string) => {
  currentSrcRef.current = resolvedUrl;   // ← overwritten by new lesson
  ...
};
```

If the user clicks a different lesson while a retry `setTimeout` is pending, the ref is overwritten. When the timeout fires it reads the new lesson's URL and calls `audio.src = newUrl` again, issuing a redundant `load()` that can interrupt the already-in-progress play or reset `currentTime` back to 0.

The fix is straightforward: close over the src at scheduling time and guard on identity at fire time.

```ts
const src = currentSrcRef.current;  // capture now
setTimeout(() => {
  if (currentSrcRef.current !== src) return;  // a new lesson started — abort
  audio.src = src;
  audio.load();
  audio.play()...
}, delay);
```

### Retry progress loss

When `onError` fires, `audio.currentTime` still holds the position the player had reached before the network dropped. The retry path does:

```ts
audio.src = src;
audio.load();   // resets currentTime to 0
audio.play();
```

No attempt is made to seek back. For a short lesson this is a minor annoyance; for a 45-minute lecture interrupted at minute 40 it is a meaningful regression. The fix is to capture `audio.currentTime` before `audio.load()` and restore it in the `loadedmetadata` or `canplay` handler, or simply set `audio.currentTime = captured` immediately after `audio.load()`.

### `SeriesPlaylist` useEffect dependencies

```ts
useEffect(() => {
  setPlaylist(lessons);
}, [lessons, setPlaylist]);
```

`setPlaylist` is `useCallback([], [])` — stable across renders. `lessons` is a prop passed from a Server Component, so its identity changes only when the server re-renders, which is the correct trigger. The dependency array is complete and correct; the effect will not over-fire.

### TypeScript interface completeness

`AudioContextValue` declares `playlist` and `setPlaylist` alongside all pre-existing fields. The provider's `value` object includes both. No existing fields (`currentLesson`, `isPlaying`, `currentTime`, `duration`, `playbackRate`, `volume`, `isMuted`, `isMiniPlayerOpen`, and all callbacks) were removed.

</details>

---

<details>
<summary>File map</summary>

- `src/lib/context/AudioContext.tsx` — Added `playlist`/`setPlaylist` state+ref pair, `playlistRef`, `playLessonRef`, `retryCountRef`, `currentSrcRef`; updated `onEnded` for auto-advance; added `onError` retry loop; extended `AudioContextValue` interface; exposed `playlist` and `setPlaylist` in provider value.
- `src/app/[locale]/(public)/duruus/[slug]/SeriesPlaylist.tsx` — Added `useEffect` that calls `setPlaylist(lessons)` on mount/lessons-change to register the current series with the audio context.

Full diff: `git diff main -- src/lib/context/AudioContext.tsx src/app/\[locale\]/\(public\)/duruus/\[slug\]/SeriesPlaylist.tsx`

</details>
