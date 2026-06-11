export interface Analysis {
  bpm: number;
  key: string;
  scale: "major" | "minor";
  keyLabel: string;
  keyConfidence: number;
  duration: number;
  sampleRate: number;
}

export interface Track {
  trackId: string;
  name: string;
  analysis: Analysis;
}

export type StemName = "vocals" | "drums" | "bass" | "other";
export const STEM_NAMES: StemName[] = ["vocals", "drums", "bass", "other"];

export type StemStatus = "idle" | "running" | "done" | "error";
