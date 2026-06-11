export const PITCH_CLASSES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

/** Predict the new key after shifting by N semitones. */
export function shiftKey(key: string, scale: string, semitones: number): string {
  const idx = PITCH_CLASSES.indexOf(key as (typeof PITCH_CLASSES)[number]);
  if (idx === -1) return `${key} ${scale}`;
  const next = PITCH_CLASSES[(((idx + Math.round(semitones)) % 12) + 12) % 12];
  return `${next} ${scale.charAt(0).toUpperCase()}${scale.slice(1)}`;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
