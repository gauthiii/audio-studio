import type { StemName, StemStatus, Track } from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function ok(res: Response): Promise<Response> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* keep statusText */
    }
    throw new Error(detail);
  }
  return res;
}

export async function uploadTrack(file: File): Promise<Track> {
  const form = new FormData();
  form.append("file", file);
  const res = await ok(await fetch(`${BASE}/api/upload`, { method: "POST", body: form }));
  return res.json();
}

export function trackAudioUrl(trackId: string): string {
  return `${BASE}/api/tracks/${trackId}/audio`;
}

export function stemAudioUrl(trackId: string, stem: StemName): string {
  return `${BASE}/api/stems/${trackId}/${stem}`;
}

/** Render the master with tempo/pitch applied; returns a blob URL for playback. */
export async function processTrack(
  trackId: string,
  tempoRatio: number,
  semitones: number
): Promise<string> {
  const res = await ok(
    await fetch(`${BASE}/api/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_id: trackId, tempo_ratio: tempoRatio, semitones }),
    })
  );
  return URL.createObjectURL(await res.blob());
}

export async function startStemSplit(trackId: string): Promise<{ status: StemStatus }> {
  const res = await ok(await fetch(`${BASE}/api/stems/${trackId}`, { method: "POST" }));
  return res.json();
}

export async function pollStemStatus(
  trackId: string
): Promise<{ status: StemStatus; error?: string }> {
  const res = await ok(await fetch(`${BASE}/api/stems/${trackId}/status`));
  return res.json();
}

export async function exportAudio(opts: {
  trackId: string;
  tempoRatio: number;
  semitones: number;
  target: "mix" | "stems";
  format: "wav" | "mp3";
}): Promise<void> {
  const res = await ok(
    await fetch(`${BASE}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        track_id: opts.trackId,
        tempo_ratio: opts.tempoRatio,
        semitones: opts.semitones,
        target: opts.target,
        format: opts.format,
      }),
    })
  );
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? `export.${opts.target === "stems" ? "zip" : opts.format}`;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
