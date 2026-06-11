import { useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { exportAudio } from "../lib/api";

interface Props {
  trackId: string;
  tempoRatio: number;
  semitones: number;
  stemsReady: boolean;
  onClose: () => void;
}

export default function ExportModal({
  trackId,
  tempoRatio,
  semitones,
  stemsReady,
  onClose,
}: Props) {
  const [target, setTarget] = useState<"mix" | "stems">("mix");
  const [format, setFormat] = useState<"wav" | "mp3">("mp3");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = Math.abs(tempoRatio - 1) > 1e-3 || semitones !== 0;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportAudio({ trackId, tempoRatio, semitones, target, format });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Export options"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Export</h2>
          <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <fieldset className="mb-4">
          <legend className="mb-2 text-xs uppercase tracking-wider text-zinc-500">What to export</legend>
          <div className="flex flex-col gap-2">
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${target === "mix" ? "border-cyan-400 bg-cyan-400/5" : "border-zinc-700"}`}>
              <input type="radio" checked={target === "mix"} onChange={() => setTarget("mix")} className="mt-1 accent-cyan-400" />
              <span>
                <span className="block text-sm font-medium">Full mix</span>
                <span className="block text-xs text-zinc-500">
                  One file{hasChanges ? " with your tempo and key changes applied" : ""}
                </span>
              </span>
            </label>
            <label className={`flex items-start gap-3 rounded-lg border p-3 ${!stemsReady ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${target === "stems" ? "border-cyan-400 bg-cyan-400/5" : "border-zinc-700"}`}>
              <input type="radio" disabled={!stemsReady} checked={target === "stems"} onChange={() => setTarget("stems")} className="mt-1 accent-cyan-400" />
              <span>
                <span className="block text-sm font-medium">Individual stems (.zip)</span>
                <span className="block text-xs text-zinc-500">
                  {stemsReady
                    ? "Vocals, drums, bass & other — each with your changes applied"
                    : "Run stem separation first to enable this"}
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset className="mb-5">
          <legend className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Format</legend>
          <div className="flex gap-2">
            {(["mp3", "wav"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 rounded-md border py-2 font-mono text-sm transition ${
                  format === f
                    ? "border-cyan-400 bg-cyan-400/10 font-bold text-cyan-300"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                {f.toUpperCase()}
                <span className="ml-1 text-[10px] text-zinc-500">
                  {f === "mp3" ? "320kbps" : "lossless"}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        <button
          onClick={run}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-400 py-2.5 font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy ? "Rendering…" : "Export & download"}
        </button>
      </div>
    </div>
  );
}
