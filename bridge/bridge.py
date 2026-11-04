"""LED-Panel Serial Bridge (PC-side).

Runs on the machine the D1 mini is USB-tethered to.  Exposes a tiny
FastAPI surface that the Pi dashboard talks to over LAN.

Endpoints:
  GET  /health            -> {"ok", "port", "connected"}
  POST /state             -> apply a full state dict (mode/bri/speed/hue/sat)
  POST /command           -> send a single raw `key:value` line
  GET  /state             -> last known state
"""
from __future__ import annotations

import asyncio
import glob
import logging
import os
import subprocess
import time
from contextlib import asynccontextmanager
from typing import Optional

import serial
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

log = logging.getLogger("bridge")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

BAUD = 115200
FTDI_VENDOR = "0403"
FTDI_PRODUCT = "6001"


# ── Serial layer ────────────────────────────────────────────────────────
class SerialLink:
    def __init__(self) -> None:
        self.ser: Optional[serial.Serial] = None
        self.port: Optional[str] = None
        self.lock = asyncio.Lock()
        self.last_state: dict = {
            "mode": "infinity",
            "bri": 170,
            "speed": 3000,
            "hue": 170,
            "sat": 210,
        }

    def _find_ftdi_port(self) -> Optional[str]:
        for dev in sorted(glob.glob("/dev/ttyUSB*")):
            try:
                out = subprocess.check_output(
                    ["udevadm", "info", "-q", "property", "-n", dev],
                    stderr=subprocess.DEVNULL, timeout=2,
                ).decode()
            except Exception:
                continue
            props = dict(
                line.split("=", 1) for line in out.splitlines() if "=" in line
            )
            if (props.get("ID_VENDOR_ID") == FTDI_VENDOR
                    and props.get("ID_MODEL_ID") == FTDI_PRODUCT):
                return dev
        return None

    def connect(self) -> bool:
        if self.ser and self.ser.is_open:
            return True
        port = self._find_ftdi_port()
        if not port:
            return False
        try:
            self.ser = serial.Serial(port, BAUD, timeout=0.1)
            self.port = port
            # Wait for chip to settle past the DTR-reset
            time.sleep(1.5)
            log.info("serial open: %s", port)
            return True
        except Exception as e:
            log.warning("open %s failed: %s", port, e)
            self.ser = None
            return False

    def disconnect(self) -> None:
        if self.ser:
            try:
                self.ser.close()
            except Exception:
                pass
        self.ser = None
        self.port = None

    async def send_line(self, line: str) -> None:
        if not self.ser or not self.ser.is_open:
            if not self.connect():
                raise HTTPException(503, "serial port not available")
        payload = (line.rstrip("\r\n") + "\n").encode("utf-8")
        async with self.lock:
            try:
                self.ser.write(payload)
                self.ser.flush()
            except (serial.SerialException, OSError) as e:
                log.warning("write failed: %s — dropping link", e)
                self.disconnect()
                raise HTTPException(503, f"serial write failed: {e}")

    async def push_state(self, st: dict) -> None:
        order = ["mode", "bri", "speed", "hue", "sat"]
        for key in order:
            if key in st and st[key] is not None:
                await self.send_line(f"{key}:{st[key]}")
        self.last_state.update({k: v for k, v in st.items() if k in order})


link = SerialLink()


# ── FastAPI ─────────────────────────────────────────────────────────────
class StatePatch(BaseModel):
    mode: Optional[str] = None
    bri: Optional[int] = Field(default=None, ge=0, le=255)
    speed: Optional[int] = Field(default=None, ge=100, le=60000)
    hue: Optional[int] = Field(default=None, ge=0, le=255)
    sat: Optional[int] = Field(default=None, ge=0, le=255)


class CommandLine(BaseModel):
    line: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    link.connect()  # best-effort; health endpoint exposes result
    yield
    link.disconnect()


app = FastAPI(title="LED-Panel Bridge", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    connected = link.ser is not None and link.ser.is_open
    if not connected:
        connected = link.connect()
    return {"ok": True, "connected": connected, "port": link.port}


@app.get("/state")
async def get_state():
    return link.last_state


@app.post("/state")
async def post_state(patch: StatePatch):
    await link.push_state(patch.model_dump(exclude_none=True))
    return link.last_state


@app.post("/command")
async def post_command(cmd: CommandLine):
    await link.send_line(cmd.line)
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("LED_BRIDGE_PORT", "8765"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
