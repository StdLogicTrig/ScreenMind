"""
Shared state and helpers for API route modules.
All route files import from here instead of accessing globals.
"""

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from config import settings
from engine.embedder import Embedder
from storage.database import Database


# ── Session store (in-memory) ────────────────────────────────────────
_sessions = {}  # token -> expiry datetime


def verify_session(token: str) -> bool:
    """Check if a session token is valid and not expired."""
    if not token or token not in _sessions:
        return False
    if datetime.utcnow() > _sessions[token]:
        del _sessions[token]
        return False
    return True


def create_session() -> str:
    """Create a new session token."""
    token = secrets.token_hex(32)
    timeout = settings.dashboard_lock_timeout or 30
    _sessions[token] = datetime.utcnow() + timedelta(minutes=timeout)
    return token


def delete_session(token: str):
    """Remove a session token."""
    _sessions.pop(token, None)


# ── Shared instances (set by create_app) ─────────────────────────────
db: Optional[Database] = None
embedder: Optional[Embedder] = None
capture_worker = None
analysis_worker = None
audio_worker = None


# ── Model list ───────────────────────────────────────────────────────
GEMMA_MODELS = [
    {"tag": "gemma3:1b",   "name": "Gemma 3 1B",   "size": "1B",  "vram": "~1 GB",  "quality": "Basic",    "tier": 0},
    {"tag": "gemma4:e2b",  "name": "Gemma 4 E2B",  "size": "2B",  "vram": "~2 GB",  "quality": "Good",     "tier": 1},
    {"tag": "gemma4:e4b",  "name": "Gemma 4 E4B",  "size": "4B",  "vram": "~3 GB",  "quality": "Great",    "tier": 2},
    {"tag": "gemma4:12b",  "name": "Gemma 4 12B",  "size": "12B", "vram": "~8 GB",  "quality": "Excellent", "tier": 3},
    {"tag": "gemma4:27b",  "name": "Gemma 4 27B",  "size": "27B", "vram": "~18 GB", "quality": "Best",     "tier": 4},
]


def init(database: Database, emb: Optional[Embedder], cap_worker, ana_worker, aud_worker):
    """Initialize shared state. Called once from create_app."""
    global db, embedder, capture_worker, analysis_worker, audio_worker
    db = database
    embedder = emb
    capture_worker = cap_worker
    analysis_worker = ana_worker
    audio_worker = aud_worker
