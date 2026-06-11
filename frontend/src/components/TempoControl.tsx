import { Gauge } from "lucide-react";
import { clamp } from "../lib/music";

interface Props {
  originalBpm: number;
  /** Multiplier of the original tempo, 0.5–2.0. */
  tempoRatio: number;
  onChange: (ratio: number) => void;
  mode: "bpm" | "percent";
  onModeChange: (mode: "bpm" | "percent") => void;
}

const MIN_RATIO = 0.5;
const MAX_RATIO = 2.0;

export default function TempoControl({
  originalBpm,
  tempoRatio,
  onChange,
  mode,
  onModeChange,
}: Props) {
  const bpmValue = originalBpm * tempoRatio;
  const percentValue = tempoRatio * 100;

  const setFromInput = (raw: string) => {
    const n = parseFloat(raw);
    if (Number.isNaN(n) || n <= 0) return; // reject negatives / garbage
    const ratio = mode === "bpm" ? n / originalBpm : n / 100;
    onChange(clamp(ratio, MIN_RATIO, MAX_RATIO));
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Gauge className="h-4 w-4 text-cyan-400" /> Tempo
        </h3>
        <div className="flex rounded-md border border-zinc-700 p-0.5 text-xs" role="tablist">
          {(["bpm", "percent"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => onModeChange(m)}
              className={`rounded px-2.5 py-1 transition ${
                mode === m ? "bg-cyan-400 font-semibold text-zinc-950" : "text-zinc-400"
              }`}
            >
              {m === "bpm" ? "BPM" : "%"}
            </button>
          ))}
        </div>
      </div>

      <input
        type="range"
        min={MIN_RATIO}
        max={MAX_RATIO}
        step={0.005}
        value={tempoRatio}
        aria-label="Tempo"
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
        <span>{mode === "bpm" ? (originalBpm * MIN_RATIO).toFixed(0) : "50%"}</span>
        <span>{mode === "bpm" ? originalBpm.toFixed(0) : "100%"}</span>
        <span>{mode === "bpm" ? (originalBpm * MAX_RATIO).toFixed(0) : "200%"}</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          min={mode === "bpm" ? originalBpm * MIN_RATIO : 50}
          max={mode === "bpm" ? originalBpm * MAX_RATIO : 200}
          step={mode === "bpm" ? 1 : 5}
          value={mode === "bpm" ? bpmValue.toFixed(1) : percentValue.toFixed(0)}
          onChange={(e) => setFromInput(e.target.value)}
          aria-label={mode === "bpm" ? "Tempo in BPM" : "Tempo percentage"}
          className="w-28 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-sm text-cyan-300 outline-none focus:border-cyan-400"
        />
        <span className="text-xs text-zinc-500">{mode === "bpm" ? "BPM" : "% of original"}</span>
        <button
          onClick={() => onChange(1)}
          className="ml-auto text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
