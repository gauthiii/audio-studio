import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Loader2 } from "lucide-react";
import type { StemName } from "../types";

const STEM_STYLE: Record<StemName, { label: string; wave: string; progress: string }> = {
  vocals: { label: "Vocals", wave: "#155e75", progress: "#22d3ee" },
  drums: { label: "Beats / Drums", wave: "#713f12", progress: "#fbbf24" },
  bass: { label: "Bass", wave: "#3b0764", progress: "#a78bfa" },
  other: { label: "Other (Melody)", wave: "#14532d", progress: "#34d399" },
};

export interface StemHandle {
  name: StemName;
  ws: WaveSurfer;
}

interface Props {
  name: StemName;
  src: string;
  muted: boolean;
  solo: boolean;
  /** True when some OTHER stem is soloed (this one is silenced). */
  silencedBySolo: boolean;
  volume: number;
  onMute: () => void;
  onSolo: () => void;
  onVolume: (v: number) => void;
  onReady: (handle: StemHandle) => void;
}

export default function StemTrack({
  name,
  src,
  muted,
  solo,
  silencedBySolo,
  volume,
  onMute,
  onSolo,
  onVolume,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [ready, setReady] = useState(false);
  const style = STEM_STYLE[name];

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: src,
      height: 52,
      waveColor: style.wave,
      progressColor: style.progress,
      cursorColor: "#71717a",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      interact: false, // master transport drives seeking
    });
    wsRef.current = ws;
    ws.on("ready", () => {
      setReady(true);
      onReady({ name, ws });
    });
    return () => ws.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const audible = !muted && !silencedBySolo;
  useEffect(() => {
    wsRef.current?.setVolume(audible ? volume : 0);
  }, [audible, volume]);

  return (
    <div
      className={`rounded-lg border bg-zinc-900/60 p-3 transition-opacity ${
        solo ? "border-cyan-500/60" : "border-zinc-800"
      } ${audible ? "" : "opacity-50"}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="w-32 truncate text-xs font-semibold" style={{ color: style.progress }}>
          {style.label}
        </span>
        <button
          onClick={onMute}
          aria-pressed={muted}
          className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold transition ${
            muted ? "bg-red-500 text-zinc-950" : "border border-zinc-700 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          M
        </button>
        <button
          onClick={onSolo}
          aria-pressed={solo}
          className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold transition ${
            solo ? "bg-amber-400 text-zinc-950" : "border border-zinc-700 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          S
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          aria-label={`${style.label} volume`}
          onChange={(e) => onVolume(parseFloat(e.target.value))}
          className="ml-2 w-28"
        />
        <span className="w-9 text-right font-mono text-[10px] text-zinc-500">
          {Math.round(volume * 100)}%
        </span>
      </div>
      <div className="relative min-h-[52px]">
        <div ref={containerRef} />
        {!ready && (
          <div className="absolute inset-0 flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading stem…
          </div>
        )}
      </div>
    </div>
  );
}
