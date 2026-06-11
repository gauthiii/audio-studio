import { Music3 } from "lucide-react";
import type { Analysis } from "../types";
import { shiftKey } from "../lib/music";

interface Props {
  analysis: Analysis;
  semitones: number;
  onChange: (semitones: number) => void;
}

const RANGE = Array.from({ length: 12 }, (_, i) => i - 5); // -5 … +6

export default function PitchControl({ analysis, semitones, onChange }: Props) {
  const predicted = shiftKey(analysis.key, analysis.scale, semitones);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Music3 className="h-4 w-4 text-cyan-400" /> Key / Pitch
        </h3>
        <button
          onClick={() => onChange(0)}
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Semitone shift">
        {RANGE.map((st) => (
          <button
            key={st}
            role="radio"
            aria-checked={semitones === st}
            onClick={() => onChange(st)}
            className={`rounded-md border py-1.5 font-mono text-xs transition ${
              semitones === st
                ? "border-cyan-400 bg-cyan-400/15 font-bold text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.35)]"
                : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {st > 0 ? `+${st}` : st}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-baseline justify-between rounded-md bg-zinc-950 px-3 py-2">
        <span className="text-xs text-zinc-500">Predicted key</span>
        <span className="font-mono text-sm font-bold text-cyan-300">
          {analysis.keyLabel}
          {semitones !== 0 && <span className="text-zinc-500"> → </span>}
          {semitones !== 0 && predicted}
        </span>
      </div>
    </div>
  );
}
