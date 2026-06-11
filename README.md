# Resonate — AI Audio Modifier & Stem Splitter

Upload any audio file, get instant BPM and key/scale analysis, reshape its tempo and pitch with studio-quality stretching, split it into 4 AI-separated stems (vocals / drums / bass / other) with a live mute–solo–volume mixer, and export the full mix or individual stems as WAV or MP3.

## Architecture

```
frontend/   React 18 + TypeScript + Vite + Tailwind + Wavesurfer.js
backend/    FastAPI + librosa (analysis) + Rubber Band (tempo/pitch) + Demucs (stems)
```

The frontend dev server proxies `/api/*` to the backend at `http://127.0.0.1:8000`, so no CORS or env config is needed for local development.

## Backend setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# System dependencies (Ubuntu/Debian):
sudo apt install ffmpeg rubberband-cli
#   ffmpeg         -> decoding mp3/aac/m4a + MP3 export
#   rubberband-cli -> high-quality pitch/tempo (optional; librosa fallback is automatic)

uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Stem separation modes

| Mode | Command | Notes |
|---|---|---|
| Real AI (default) | `uvicorn app.main:app --host 127.0.0.1 --port 8000` | Uses Meta's `htdemucs`. First run downloads ~1.7GB of weights. CPU works; GPU is much faster. |
| Mock / demo | `STEM_MODE=mock uvicorn app.main:app --host 127.0.0.1 --port 8000` | Instant frequency-band stems — perfect for testing the mixer UI without the heavy model. |

## Frontend setup

```bash
cd frontend
npm install
npm run dev          # http://127.0.0.1:5173
```

For a production build: `npm run build`, then serve `dist/` and set `VITE_API_URL` to the backend origin at build time if it's on a different host.

If your backend is running somewhere else during local development, start Vite with `VITE_API_PROXY_TARGET=http://127.0.0.1:9000 npm run dev`.

## Development logs

During local development, requests are logged in three places:

- Browser console: frontend API calls, status codes, timings, and track IDs.
- Vite terminal: proxy forwarding, for example `/api/upload -> http://127.0.0.1:8000/api/upload`.
- Backend terminal: request IDs, upload progress, analysis start/done, stem jobs, exports, and errors.

Health checks:

```bash
curl -i http://127.0.0.1:8000/api/health
curl -i http://127.0.0.1:5173/api/health
```

## API reference

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/upload` | Upload audio → `{trackId, analysis: {bpm, key, scale, …}}` |
| GET | `/api/tracks/{id}/audio` | Stream original audio |
| POST | `/api/process` | `{track_id, tempo_ratio, semitones}` → processed WAV |
| POST | `/api/stems/{id}` | Start 4-stem separation (background job) |
| GET | `/api/stems/{id}/status` | Poll: `idle / running / done / error` |
| GET | `/api/stems/{id}/{stem}` | Stream `vocals / drums / bass / other` |
| POST | `/api/export` | `target: mix\|stems`, `format: wav\|mp3` → file download (stems come zipped) |

## Notes & production hardening

- Tracks and stem jobs live in memory + temp files; swap for Redis/S3 in production.
- `tempo_ratio` is bounded 0.25–4.0 and `semitones` ±12 by the API; the UI exposes 50–200% and −5…+6.
- Stem export applies your current tempo/pitch settings to each stem before zipping.
- Set `allow_origins` in `app/main.py` to your real frontend origin before deploying.
