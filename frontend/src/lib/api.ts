import type { StemName, StemStatus, Track } from "../types";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
let requestCount = 0;

console.info(`[api] base=${BASE || "(same origin / Vite proxy)"}`);

function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const id = ++requestCount;
  const method = init.method ?? "GET";
  const url = apiUrl(path);
  const start = performance.now();
  console.info(`[api:${id}] -> ${method} ${url}`);
  try {
    const res = await fetch(url, init);
    const elapsed = Math.round(performance.now() - start);
    console.info(`[api:${id}] <- ${res.status} ${res.statusText} ${method} ${url} (${elapsed}ms)`);
    return ok(res);
  } catch (error) {
    const elapsed = Math.round(performance.now() - start);
    console.error(`[api:${id}] !! ${method} ${url} failed after ${elapsed}ms`, error);
    throw error;
  }
}

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
  console.info(`[api] upload file="${file.name}" size=${file.size}`);
  const res = await apiFetch("/api/upload", { method: "POST", body: form });
  const track = (await res.json()) as Track;
  console.info(`[api] uploaded trackId=${track.trackId}`);
  return track;
}

export function trackAudioUrl(trackId: string): string {
  const url = apiUrl(`/api/tracks/${trackId}/audio`);
  console.info(`[api] track audio url trackId=${trackId} url=${url}`);
  return url;
}

export function stemAudioUrl(trackId: string, stem: StemName): string {
  const url = apiUrl(`/api/stems/${trackId}/${stem}`);
  console.info(`[api] stem audio url trackId=${trackId} stem=${stem} url=${url}`);
  return url;
}

/** Render the master with tempo/pitch applied; returns a blob URL for playback. */
export async function processTrack(
  trackId: string,
  tempoRatio: number,
  semitones: number
): Promise<string> {
  console.info(`[api] process trackId=${trackId} tempoRatio=${tempoRatio} semitones=${semitones}`);
  const res = await apiFetch("/api/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ track_id: trackId, tempo_ratio: tempoRatio, semitones }),
  });
  return URL.createObjectURL(await res.blob());
}

export async function startStemSplit(trackId: string): Promise<{ status: StemStatus }> {
  console.info(`[api] start stems trackId=${trackId}`);
  const res = await apiFetch(`/api/stems/${trackId}`, { method: "POST" });
  return res.json();
}

export async function pollStemStatus(
  trackId: string
): Promise<{ status: StemStatus; error?: string }> {
  console.info(`[api] poll stems trackId=${trackId}`);
  const res = await apiFetch(`/api/stems/${trackId}/status`);
  return res.json();
}

export async function exportAudio(opts: {
  trackId: string;
  tempoRatio: number;
  semitones: number;
  target: "mix" | "stems";
  format: "wav" | "mp3";
}): Promise<void> {
  console.info(`[api] export trackId=${opts.trackId} target=${opts.target} format=${opts.format}`);
  const res = await apiFetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      track_id: opts.trackId,
      tempo_ratio: opts.tempoRatio,
      semitones: opts.semitones,
      target: opts.target,
      format: opts.format,
    }),
  });
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
