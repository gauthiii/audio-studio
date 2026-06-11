import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { formatTime } from "../lib/music";

interface Props {
  /** Audio URL — original track or a processed blob URL. */
  src: string;
  /** True while a new processed render is being fetched. */
  rendering?: boolean;
}

export default function WaveformPlayer({ src, rendering }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    setReady(false);
    setPlaying(false);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: src,
      height: 110,
      waveColor: "#3f3f46",
      progressColor: "#22d3ee",
      cursorColor: "#a5f3fc",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    });
    wsRef.current = ws;
    ws.on("ready", () => {
      setReady(true);
      setDuration(ws.getDuration());
    });
    ws.on("timeupdate", (t) => setTime(t));
    ws.on("play", () => setPlaying(true));
    ws.on("pause", () => setPlaying(false));
    ws.on("finish", () => setPlaying(false));

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [src]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="relative">
        <div ref={containerRef} className={ready ? "" : "opacity-30"} />
        {(!ready || rendering) && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
            {rendering ? "Rendering tempo & pitch changes…" : "Building waveform…"}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => wsRef.current?.playPause()}
          disabled={!ready}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400 text-zinc-950 transition hover:bg-cyan-300 disabled:opacity-40"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <button
          onClick={() => wsRef.current?.seekTo(0)}
          disabled={!ready}
          aria-label="Back to start"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 hover:text-zinc-100 disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <span className="ml-auto font-mono text-xs text-zinc-500">
          {formatTime(time)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
