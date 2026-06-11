import { useCallback, useRef, useState } from "react";
import { FileAudio, Loader2, UploadCloud } from "lucide-react";

const ACCEPT = ".mp3,.wav,.aac,.m4a,.flac,.ogg";

interface Props {
  onUpload: (file: File) => Promise<void>;
}

export default function UploadZone({ onUpload }: Props) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      setBusy(true);
      try {
        await onUpload(file);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [onUpload]
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload an audio file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
          dragging
            ? "border-cyan-400 bg-cyan-400/5"
            : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/40"
        }`}
      >
        {busy ? (
          <>
            <Loader2 className="h-9 w-9 animate-spin text-cyan-400" />
            <p className="text-sm text-zinc-400">Uploading and analyzing key & BPM…</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-9 w-9 text-cyan-400" />
            <p className="font-medium">Drop a track here, or click to browse</p>
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <FileAudio className="h-3.5 w-3.5" /> MP3 · WAV · AAC · M4A · FLAC — up to 100MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
