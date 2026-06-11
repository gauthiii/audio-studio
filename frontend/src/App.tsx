import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Download, FileAudio } from "lucide-react";
import AnalysisPanel from "./components/AnalysisPanel";
import ExportModal from "./components/ExportModal";
import PitchControl from "./components/PitchControl";
import StemMixer from "./components/StemMixer";
import TempoControl from "./components/TempoControl";
import UploadZone from "./components/UploadZone";
import WaveformPlayer from "./components/WaveformPlayer";
import { pollStemStatus, processTrack, trackAudioUrl, uploadTrack } from "./lib/api";
import type { Track } from "./types";

export default function App() {
  const [track, setTrack] = useState<Track | null>(null);
  const [tempoRatio, setTempoRatio] = useState(1);
  const [tempoMode, setTempoMode] = useState<"bpm" | "percent">("bpm");
  const [semitones, setSemitones] = useState(0);
  const [playerSrc, setPlayerSrc] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [stemsReady, setStemsReady] = useState(false);
  const renderTimer = useRef<number | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    const t = await uploadTrack(file);
    setTrack(t);
    setTempoRatio(1);
    setSemitones(0);
    setStemsReady(false);
    setPlayerSrc(trackAudioUrl(t.trackId));
  }, []);

  // Debounced server-side render whenever tempo/pitch changes
  useEffect(() => {
    if (!track) return;
    if (renderTimer.current) window.clearTimeout(renderTimer.current);

    const unchanged = Math.abs(tempoRatio - 1) < 1e-3 && semitones === 0;
    if (unchanged) {
      setPlayerSrc(trackAudioUrl(track.trackId));
      setRendering(false);
      return;
    }

    setRendering(true);
    renderTimer.current = window.setTimeout(async () => {
      try {
        const url = await processTrack(track.trackId, tempoRatio, semitones);
        setPlayerSrc(url);
      } catch (e) {
        console.error("Render failed", e);
      } finally {
        setRendering(false);
      }
    }, 600);
  }, [track, tempoRatio, semitones]);

  // Keep export modal's "stems ready" flag in sync
  useEffect(() => {
    if (!track || stemsReady) return;
    const id = setInterval(async () => {
      try {
        const res = await pollStemStatus(track.trackId);
        if (res.status === "done") setStemsReady(true);
      } catch {
        /* backend offline — ignore */
      }
    }, 3000);
    return () => clearInterval(id);
  }, [track, stemsReady]);

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400/10 ring-1 ring-cyan-400/40">
            <AudioLines className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Resonate</h1>
            <p className="text-xs text-zinc-500">AI audio modifier & stem splitter</p>
          </div>
        </div>
        {track && (
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300"
          >
            <Download className="h-4 w-4" /> Export
          </button>
        )}
      </header>

      {!track ? (
        <UploadZone onUpload={handleUpload} />
      ) : (
        <main className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <FileAudio className="h-4 w-4 text-cyan-400" />
            <span className="truncate font-medium text-zinc-200">{track.name}</span>
            <button
              onClick={() => setTrack(null)}
              className="ml-auto text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
            >
              Load a different track
            </button>
          </div>

          <AnalysisPanel analysis={track.analysis} tempoRatio={tempoRatio} semitones={semitones} />

          {playerSrc && <WaveformPlayer src={playerSrc} rendering={rendering} />}

          <div className="grid gap-4 md:grid-cols-2">
            <TempoControl
              originalBpm={track.analysis.bpm}
              tempoRatio={tempoRatio}
              onChange={setTempoRatio}
              mode={tempoMode}
              onModeChange={setTempoMode}
            />
            <PitchControl analysis={track.analysis} semitones={semitones} onChange={setSemitones} />
          </div>

          <StemMixer trackId={track.trackId} />
        </main>
      )}

      {exportOpen && track && (
        <ExportModal
          trackId={track.trackId}
          tempoRatio={tempoRatio}
          semitones={semitones}
          stemsReady={stemsReady}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}
