import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Scissors, Sparkles } from "lucide-react";
import { pollStemStatus, startStemSplit, stemAudioUrl } from "../lib/api";
import { STEM_NAMES, type StemName, type StemStatus } from "../types";
import StemTrack, { type StemHandle } from "./StemTrack";

const LOADING_LINES = [
  "Extracting vocals…",
  "Isolating drums…",
  "Pulling out the bassline…",
  "Untangling melodies…",
];

interface Props {
  trackId: string;
}

interface MixState {
  muted: boolean;
  solo: boolean;
  volume: number;
}

const initialMix = (): Record<StemName, MixState> =>
  Object.fromEntries(
    STEM_NAMES.map((s) => [s, { muted: false, solo: false, volume: 0.9 }])
  ) as Record<StemName, MixState>;

export default function StemMixer({ trackId }: Props) {
  const [status, setStatus] = useState<StemStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loadingLine, setLoadingLine] = useState(0);
  const [mix, setMix] = useState(initialMix);
  const [playing, setPlaying] = useState(false);
  const handles = useRef<Map<StemName, StemHandle>>(new Map());

  // Reset when a new track is loaded
  useEffect(() => {
    setStatus("idle");
    setError(null);
    setMix(initialMix());
    setPlaying(false);
    handles.current.clear();
  }, [trackId]);

  // Rotate the loading copy while the model runs
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => setLoadingLine((i) => (i + 1) % LOADING_LINES.length), 1800);
    return () => clearInterval(id);
  }, [status]);

  // Poll the backend job
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(async () => {
      try {
        const res = await pollStemStatus(trackId);
        if (res.status === "done") setStatus("done");
        if (res.status === "error") {
          setStatus("error");
          setError(res.error ?? "Separation failed");
        }
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Lost connection to the server");
      }
    }, 2000);
    return () => clearInterval(id);
  }, [status, trackId]);

  const split = async () => {
    setError(null);
    try {
      await startStemSplit(trackId);
      setStatus("running");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not start separation");
    }
  };

  const togglePlay = () => {
    const next = !playing;
    setPlaying(next);
    handles.current.forEach(({ ws }) => (next ? ws.play() : ws.pause()));
  };

  const anySolo = STEM_NAMES.some((s) => mix[s].solo);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-cyan-400" /> AI Stem Separation
        </h2>
        {status === "done" && (
          <button
            onClick={togglePlay}
            className="flex items-center gap-1.5 rounded-md bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-cyan-300"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "Pause stems" : "Play stems"}
          </button>
        )}
      </div>

      {status === "idle" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm text-zinc-400">
            Split this track into vocals, drums, bass, and melody for independent mixing.
          </p>
          <button
            onClick={split}
            className="flex items-center gap-2 rounded-lg bg-cyan-400 px-5 py-2.5 font-semibold text-zinc-950 transition hover:bg-cyan-300"
          >
            <Scissors className="h-4 w-4" /> Split audio
          </button>
        </div>
      )}

      {status === "running" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          <p className="font-mono text-sm text-cyan-300">{LOADING_LINES[loadingLine]}</p>
          <p className="text-xs text-zinc-500">
            The first run can take a few minutes while the model warms up.
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="py-4 text-sm text-red-400">
          {error}
          <button onClick={split} className="ml-3 text-cyan-300 underline underline-offset-2">
            Try again
          </button>
        </div>
      )}

      {status === "done" && (
        <div className="flex flex-col gap-2">
          {STEM_NAMES.map((name) => (
            <StemTrack
              key={`${trackId}-${name}`}
              name={name}
              src={stemAudioUrl(trackId, name)}
              muted={mix[name].muted}
              solo={mix[name].solo}
              silencedBySolo={anySolo && !mix[name].solo}
              volume={mix[name].volume}
              onMute={() =>
                setMix((m) => ({ ...m, [name]: { ...m[name], muted: !m[name].muted } }))
              }
              onSolo={() =>
                setMix((m) => ({ ...m, [name]: { ...m[name], solo: !m[name].solo } }))
              }
              onVolume={(v) => setMix((m) => ({ ...m, [name]: { ...m[name], volume: v } }))}
              onReady={(h) => handles.current.set(name, h)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
