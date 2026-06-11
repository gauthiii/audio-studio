"""AI Audio Modifier & Stem Splitter — FastAPI backend.

Endpoints
  POST /api/upload            -> store file, return track id + analysis
  GET  /api/tracks/{id}/audio -> stream the original audio
  POST /api/process           -> apply tempo/pitch, returns processed file id
  POST /api/stems/{id}        -> run 4-stem separation (background job)
  GET  /api/stems/{id}/status -> poll separation progress
  GET  /api/stems/{id}/{stem} -> stream an individual stem
  POST /api/export            -> full mix or stems, with tempo/pitch applied,
                                 as WAV or MP3 (stems come back zipped)

Run:  uvicorn app.main:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import io
import logging
import shutil
import tempfile
import threading
import time
import uuid
import zipfile
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from .analysis import analyze_audio
from .processing import encode_audio, load_audio, process_audio
from .stems import STEM_MODE, STEM_NAMES, separate_stems

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("audio_studio.api")

app = FastAPI(title="AI Audio Modifier & Stem Splitter")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)

STORAGE = Path(tempfile.gettempdir()) / "audio-studio"
STORAGE.mkdir(exist_ok=True)

ALLOWED_EXT = {".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg"}
MAX_UPLOAD_MB = 100

# In-memory registries (use Redis/DB for production)
TRACKS: dict[str, dict] = {}
STEM_JOBS: dict[str, dict] = {}
_LOCK = threading.Lock()


@app.middleware("http")
async def log_api_requests(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:8]
    start = time.perf_counter()
    logger.info("request start id=%s method=%s path=%s", request_id, request.method, request.url.path)
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "request error id=%s method=%s path=%s duration_ms=%.1f",
            request_id,
            request.method,
            request.url.path,
            elapsed_ms,
        )
        raise

    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "request end id=%s method=%s path=%s status=%s duration_ms=%.1f",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    response.headers["x-request-id"] = request_id
    return response


class ProcessRequest(BaseModel):
    track_id: str
    tempo_ratio: float = Field(1.0, gt=0.25, lt=4.0)
    semitones: float = Field(0.0, ge=-12, le=12)


class ExportRequest(ProcessRequest):
    target: str = Field("mix", pattern="^(mix|stems)$")
    format: str = Field("wav", pattern="^(wav|mp3)$")


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    ext = Path(file.filename or "audio").suffix.lower()
    logger.info("upload received filename=%s ext=%s", file.filename, ext)
    if ext not in ALLOWED_EXT:
        logger.warning("upload rejected filename=%s reason=unsupported_format ext=%s", file.filename, ext)
        raise HTTPException(400, f"Unsupported format '{ext}'. Allowed: {sorted(ALLOWED_EXT)}")

    track_id = uuid.uuid4().hex[:12]
    dest = STORAGE / f"{track_id}{ext}"
    size = 0
    with dest.open("wb") as out:
        while chunk := await file.read(1 << 20):
            size += len(chunk)
            if size > MAX_UPLOAD_MB * (1 << 20):
                dest.unlink(missing_ok=True)
                logger.warning("upload rejected track_id=%s reason=size_limit size=%s", track_id, size)
                raise HTTPException(413, f"File exceeds {MAX_UPLOAD_MB}MB limit")
            out.write(chunk)

    logger.info("upload stored track_id=%s bytes=%s path=%s", track_id, size, dest)
    try:
        logger.info("analysis start track_id=%s", track_id)
        analysis = analyze_audio(str(dest))
        logger.info("analysis done track_id=%s bpm=%s key=%s", track_id, analysis["bpm"], analysis["keyLabel"])
    except Exception as exc:
        dest.unlink(missing_ok=True)
        logger.exception("analysis failed track_id=%s", track_id)
        raise HTTPException(422, f"Could not decode audio: {exc}") from exc

    TRACKS[track_id] = {"path": str(dest), "name": file.filename, "analysis": analysis}
    logger.info("track registered track_id=%s filename=%s", track_id, file.filename)
    return {"trackId": track_id, "name": file.filename, "analysis": analysis}


def _get_track(track_id: str) -> dict:
    track = TRACKS.get(track_id)
    if not track:
        logger.warning("unknown track_id=%s", track_id)
        raise HTTPException(404, "Unknown track id")
    return track


@app.get("/api/tracks/{track_id}/audio")
def track_audio(track_id: str):
    logger.info("track audio requested track_id=%s", track_id)
    track = _get_track(track_id)
    return FileResponse(track["path"], filename=track["name"])


@app.post("/api/process")
def process(req: ProcessRequest):
    """Render the master with tempo/pitch applied; returns playable WAV."""
    logger.info(
        "process requested track_id=%s tempo_ratio=%s semitones=%s",
        req.track_id,
        req.tempo_ratio,
        req.semitones,
    )
    track = _get_track(req.track_id)
    y, sr = load_audio(track["path"])
    out = process_audio(y, sr, req.tempo_ratio, req.semitones)
    data, mime = encode_audio(out, sr, "wav")
    return Response(content=data, media_type=mime)


def _run_stem_job(track_id: str):
    job = STEM_JOBS[track_id]
    try:
        logger.info("stem job start track_id=%s mode=%s", track_id, STEM_MODE)
        out_dir = STORAGE / f"{track_id}_stems"
        paths = separate_stems(TRACKS[track_id]["path"], str(out_dir))
        with _LOCK:
            job.update(status="done", stems=paths)
        logger.info("stem job done track_id=%s stems=%s", track_id, sorted(paths.keys()))
    except Exception as exc:  # surface failures to the client
        with _LOCK:
            job.update(status="error", error=str(exc))
        logger.exception("stem job failed track_id=%s", track_id)


@app.post("/api/stems/{track_id}")
def split_stems(track_id: str, background: BackgroundTasks):
    logger.info("stem split requested track_id=%s", track_id)
    _get_track(track_id)
    existing = STEM_JOBS.get(track_id)
    if existing and existing["status"] in ("running", "done"):
        logger.info("stem split reused track_id=%s status=%s", track_id, existing["status"])
        return {"status": existing["status"], "mode": STEM_MODE}
    STEM_JOBS[track_id] = {"status": "running", "stems": {}, "error": None}
    background.add_task(_run_stem_job, track_id)
    return {"status": "running", "mode": STEM_MODE}


@app.get("/api/stems/{track_id}/status")
def stem_status(track_id: str):
    logger.info("stem status requested track_id=%s", track_id)
    job = STEM_JOBS.get(track_id)
    if not job:
        return {"status": "idle"}
    return {
        "status": job["status"],
        "error": job.get("error"),
        "stems": sorted(job.get("stems", {}).keys()),
    }


@app.get("/api/stems/{track_id}/{stem}")
def stem_audio(track_id: str, stem: str):
    logger.info("stem audio requested track_id=%s stem=%s", track_id, stem)
    if stem not in STEM_NAMES:
        raise HTTPException(404, f"Unknown stem '{stem}'")
    job = STEM_JOBS.get(track_id)
    if not job or job["status"] != "done":
        raise HTTPException(409, "Stems not ready")
    return FileResponse(job["stems"][stem], filename=f"{stem}.wav")


@app.post("/api/export")
def export(req: ExportRequest):
    logger.info(
        "export requested track_id=%s target=%s format=%s tempo_ratio=%s semitones=%s",
        req.track_id,
        req.target,
        req.format,
        req.tempo_ratio,
        req.semitones,
    )
    track = _get_track(req.track_id)
    base = Path(track["name"] or "track").stem

    if req.target == "mix":
        y, sr = load_audio(track["path"])
        out = process_audio(y, sr, req.tempo_ratio, req.semitones)
        data, mime = encode_audio(out, sr, req.format)
        fname = f"{base}_modified.{req.format}"
        return Response(
            content=data,
            media_type=mime,
            headers={"Content-Disposition": f'attachment; filename="{fname}"'},
        )

    # target == "stems": zip all 4 stems with modifications applied
    job = STEM_JOBS.get(req.track_id)
    if not job or job["status"] != "done":
        raise HTTPException(409, "Run stem separation before exporting stems")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for stem, path in job["stems"].items():
            y, sr = load_audio(path)
            out = process_audio(y, sr, req.tempo_ratio, req.semitones)
            data, _ = encode_audio(out, sr, req.format)
            zf.writestr(f"{base}_{stem}.{req.format}", data)
    buf.seek(0)
    fname = f"{base}_stems_{req.format}.zip"
    return Response(
        content=buf.read(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@app.get("/api/health")
def health():
    logger.info("health requested")
    return {"ok": True, "stemMode": STEM_MODE}
