"""LED-Panel Dashboard (Pi-side).

Serves the built frontend (dist/) and proxies control calls to the PC
serial bridge.  Runs 24/7 on the Pi; the bridge comes and goes with the
PC.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("pi-dashboard")

BRIDGE_URL = os.environ.get("LED_BRIDGE_URL", "http://127.0.0.1:8765")
STATIC_DIR = Path(__file__).resolve().parent.parent / "web" / "dist"

app = FastAPI(title="LED-Panel Dashboard")
client = httpx.AsyncClient(base_url=BRIDGE_URL, timeout=2.5)


class StatePatch(BaseModel):
    mode: Optional[str] = None
    bri: Optional[int] = Field(default=None, ge=0, le=255)
    speed: Optional[int] = Field(default=None, ge=100, le=60000)
    hue: Optional[int] = Field(default=None, ge=0, le=255)
    sat: Optional[int] = Field(default=None, ge=0, le=255)


@app.get("/api/status")
async def status():
    try:
        r = await client.get("/health", timeout=1.5)
        return {"bridge": r.json(), "reachable": True}
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout):
        return {"bridge": None, "reachable": False}
    except Exception as e:
        log.warning("bridge probe failed: %s", e)
        return {"bridge": None, "reachable": False}


@app.get("/api/state")
async def get_state():
    try:
        r = await client.get("/state")
        return r.json()
    except Exception as e:
        raise HTTPException(502, f"bridge unreachable: {e}")


@app.post("/api/state")
async def post_state(patch: StatePatch):
    try:
        r = await client.post("/state", json=patch.model_dump(exclude_none=True))
        return r.json()
    except Exception as e:
        raise HTTPException(502, f"bridge unreachable: {e}")


class CommandLine(BaseModel):
    line: str


@app.post("/api/command")
async def post_command(cmd: CommandLine):
    try:
        # Frame-streaming lines can be ~390 bytes; allow a longer timeout.
        r = await client.post("/command", json=cmd.model_dump(), timeout=1.0)
        return r.json()
    except Exception as e:
        raise HTTPException(502, f"bridge unreachable: {e}")


# ── Static hosting ──────────────────────────────────────────────────────
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/square.stl")
    async def stl():
        # optional: the panel model is not part of the repo (see README)
        f = STATIC_DIR / "square.stl"
        if not f.exists():
            raise HTTPException(404)
        return FileResponse(f, media_type="model/stl")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        # serve index.html for any unknown path (SPA fallback)
        idx = STATIC_DIR / "index.html"
        if idx.exists():
            return FileResponse(idx)
        raise HTTPException(404)
else:
    @app.get("/")
    async def missing():
        return JSONResponse(
            status_code=503,
            content={"error": "frontend not built — run `npm run build` in web/"},
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("LED_DASHBOARD_PORT", "8787"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
