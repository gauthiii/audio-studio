"""Tempo / pitch processing and export encoding.

Prefers Rubber Band (via pyrubberband) for high-quality, formant-preserving
time-stretching and pitch-shifting. Falls back to librosa's phase vocoder if
the rubberband CLI is not installed, so the app always works.
"""
from __future__ import annotations

import io
import shutil

import numpy as np
import librosa
import soundfile as sf

_HAS_RUBBERBAND = shutil.which("rubberband") is not None
if _HAS_RUBBERBAND:
    import pyrubberband as pyrb  # type: ignore


def load_audio(path: str) -> tuple[np.ndarray, int]:
    """Load audio at native sample rate, preserving stereo. Returns (samples, sr).

    Samples are float32, shape (n,) mono or (n, 2) stereo.
    """
    y, sr = librosa.load(path, sr=None, mono=False)
    if y.ndim == 2:  # librosa gives (channels, n); soundfile wants (n, channels)
        y = y.T
    return y.astype(np.float32), sr


def process_audio(
    y: np.ndarray, sr: int, tempo_ratio: float = 1.0, semitones: float = 0.0
) -> np.ndarray:
    """Apply tempo stretch (ratio of new/original BPM) and pitch shift (semitones)."""
    if abs(tempo_ratio - 1.0) < 1e-4 and abs(semitones) < 1e-4:
        return y

    if _HAS_RUBBERBAND:
        out = y
        if abs(tempo_ratio - 1.0) >= 1e-4:
            out = pyrb.time_stretch(out, sr, tempo_ratio)
        if abs(semitones) >= 1e-4:
            out = pyrb.pitch_shift(out, sr, semitones)
        return out.astype(np.float32)

    # librosa fallback expects (channels, n) or mono
    mono_in = y.ndim == 1
    work = y if mono_in else y.T
    if abs(tempo_ratio - 1.0) >= 1e-4:
        work = librosa.effects.time_stretch(work, rate=tempo_ratio)
    if abs(semitones) >= 1e-4:
        work = librosa.effects.pitch_shift(work, sr=sr, n_steps=semitones)
    return (work if mono_in else work.T).astype(np.float32)


def encode_audio(y: np.ndarray, sr: int, fmt: str = "wav") -> tuple[bytes, str]:
    """Encode samples to WAV or MP3 bytes. Returns (data, mime_type)."""
    wav_buf = io.BytesIO()
    sf.write(wav_buf, y, sr, format="WAV", subtype="PCM_16")
    wav_buf.seek(0)

    if fmt == "wav":
        return wav_buf.read(), "audio/wav"

    # MP3 via pydub/ffmpeg
    from pydub import AudioSegment

    seg = AudioSegment.from_file(wav_buf, format="wav")
    mp3_buf = io.BytesIO()
    seg.export(mp3_buf, format="mp3", bitrate="320k")
    return mp3_buf.getvalue(), "audio/mpeg"
