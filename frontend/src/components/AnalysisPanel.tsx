import { Activity, Clock, Music2 } from "lucide-react";
import type { Analysis } from "../types";
import { formatTime, shiftKey } from "../lib/music";

interface Props {
  analysis: Analysis;
  tempoRatio: number;
  semitones: number;
}

function Readout({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-zinc-500">
        {icon} {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-bold text-cyan-300 [text-shadow:0_0_14px_rgba(34,211,238,0.45)]">
        {value}
      </div>
      {sub && <div className="font-mono text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export default function AnalysisPanel({ analysis, tempoRatio, semitones }: Props) {
  const newBpm = analysis.bpm * tempoRatio;
  const newKey = shiftKey(analysis.key, analysis.scale, semitones);
  const tempoChanged = Math.abs(tempoRatio - 1) > 1e-3;
  const keyChanged = Math.round(semitones) !== 0;

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Readout
        icon={<Activity className="h-3 w-3" />}
        label="Tempo"
        value={`${analysis.bpm.toFixed(1)} BPM`}
        sub={tempoChanged ? `→ ${newBpm.toFixed(1)} BPM after stretch` : "original"}
      />
      <Readout
        icon={<Music2 className="h-3 w-3" />}
        label="Key / Scale"
        value={analysis.keyLabel}
        sub={
          keyChanged
            ? `→ ${newKey} after shift`
            : `confidence ${(analysis.keyConfidence * 100).toFixed(0)}%`
        }
      />
      <Readout
        icon={<Clock className="h-3 w-3" />}
        label="Length"
        value={formatTime(analysis.duration)}
        sub={`${(analysis.sampleRate / 1000).toFixed(1)} kHz analysis`}
      />
    </div>
  );
}
