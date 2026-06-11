"""Audio analysis: BPM and key/scale detection.

Uses librosa for both. Key detection is done with the Krumhansl–Schmuckler
key-finding algorithm over an averaged chromagram, which is lightweight and
does not require essentia (a heavier native dependency). If essentia is
installed, we prefer its KeyExtractor for slightly better accuracy.
"""
from __future__ import annotations

import numpy as np
import librosa

PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Krumhansl-Schmuckler key profiles
_MAJOR_PROFILE = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
_MINOR_PROFILE = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)


def _detect_key_librosa(y: np.ndarray, sr: int) -> tuple[str, str, float]:
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)

    best = ("C", "major", -2.0)
    for shift in range(12):
        rotated = np.roll(chroma_mean, -shift)
        for mode, profile in (("major", _MAJOR_PROFILE), ("minor", _MINOR_PROFILE)):
            corr = float(np.corrcoef(rotated, profile)[0, 1])
            if corr > best[2]:
                best = (PITCH_CLASSES[shift], mode, corr)
    tonic, mode, corr = best
    confidence = max(0.0, min(1.0, (corr + 1) / 2))
    return tonic, mode, confidence


def _detect_key(y: np.ndarray, sr: int) -> tuple[str, str, float]:
    try:  # optional, more accurate if present
        import essentia.standard as es  # type: ignore

        key, scale, strength = es.KeyExtractor()(y.astype(np.float32))
        return key, scale, float(strength)
    except Exception:
        return _detect_key_librosa(y, sr)


def analyze_audio(path: str) -> dict:
    y, sr = librosa.load(path, sr=22050, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))

    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(np.atleast_1d(tempo)[0])
    if not np.isfinite(bpm) or bpm <= 0:
        bpm = 120.0
    else:
        # Fold implausible halved/doubled estimates into a musical range.
        while bpm < 60:
            bpm *= 2
        while bpm > 200:
            bpm /= 2

    tonic, mode, confidence = _detect_key(y, sr)

    return {
        "bpm": round(bpm, 1),
        "key": tonic,
        "scale": mode,           # "major" | "minor"
        "keyLabel": f"{tonic} {mode.capitalize()}",
        "keyConfidence": round(confidence, 2),
        "duration": round(duration, 2),
        "sampleRate": sr,
    }
