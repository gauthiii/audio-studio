"""4-stem separation: vocals, drums, bass, other.

Two modes, selected by the STEM_MODE environment variable:

  STEM_MODE=demucs  (default)  Real AI separation with Meta's htdemucs model.
                               First run downloads ~1.7GB of weights.
  STEM_MODE=mock                Instant stub for frontend development / demos:
                               produces 4 frequency-band-filtered copies so the
                               mixer UI has real, distinct-sounding audio to play.
"""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import soundfile as sf

STEM_NAMES = ["vocals", "drums", "bass", "other"]
STEM_MODE = os.environ.get("STEM_MODE", "demucs").lower()


def _mock_separate(input_path: str, out_dir: Path) -> dict[str, str]:
    """Cheap band-split 'stems' so the UI is fully testable without a GPU."""
    import librosa
    from scipy.signal import butter, sosfilt

    y, sr = librosa.load(input_path, sr=None, mono=False)
    if y.ndim == 1:
        y = y[np.newaxis, :]

    def bandpass(low: float | None, high: float | None) -> np.ndarray:
        nyq = sr / 2
        if low and high:
            sos = butter(4, [low / nyq, high / nyq], btype="band", output="sos")
        elif low:
            sos = butter(4, low / nyq, btype="high", output="sos")
        else:
            sos = butter(4, high / nyq, btype="low", output="sos")
        return sosfilt(sos, y, axis=1).astype(np.float32)

    bands = {
        "bass": bandpass(None, 250),
        "vocals": bandpass(300, 3400),
        "other": bandpass(800, 8000),
        "drums": bandpass(2000, None) * 0.8 + bandpass(None, 150) * 0.6,
    }

    paths: dict[str, str] = {}
    for name, data in bands.items():
        p = out_dir / f"{name}.wav"
        sf.write(p, data.T, sr, subtype="PCM_16")
        paths[name] = str(p)
    return paths


def _demucs_separate(input_path: str, out_dir: Path) -> dict[str, str]:
    import torch
    from demucs.apply import apply_model
    from demucs.pretrained import get_model
    from demucs.audio import AudioFile, save_audio

    model = get_model("htdemucs")
    model.eval()

    wav = AudioFile(input_path).read(
        streams=0, samplerate=model.samplerate, channels=model.audio_channels
    )
    ref = wav.mean(0)
    wav = (wav - ref.mean()) / (ref.std() + 1e-8)

    with torch.no_grad():
        sources = apply_model(model, wav[None], device="cuda" if torch.cuda.is_available() else "cpu")[0]
    sources = sources * (ref.std() + 1e-8) + ref.mean()

    paths: dict[str, str] = {}
    for name, source in zip(model.sources, sources):  # drums, bass, other, vocals
        p = out_dir / f"{name}.wav"
        save_audio(source, str(p), samplerate=model.samplerate)
        paths[name] = str(p)
    return paths


def separate_stems(input_path: str, out_dir: str) -> dict[str, str]:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    if STEM_MODE == "mock":
        return _mock_separate(input_path, out)
    return _demucs_separate(input_path, out)
