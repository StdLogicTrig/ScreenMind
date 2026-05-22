"""
Screen Capture Module
Captures screenshots using mss (fastest cross-platform method).
Saves as JPEG with configurable quality to date-organized directories.
"""

import io
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

import mss
import mss.tools
from PIL import Image

from config import settings


class ScreenCapture:
    """Handles screenshot capture, compression, and storage."""

    def __init__(self):
        self._sct = mss.mss()

    def capture(self) -> Optional[Tuple[Path, Image.Image]]:
        """
        Capture the primary monitor and save as a compressed JPEG.

        Returns:
            Tuple of (saved file path, PIL Image) or None if capture fails.
        """
        try:
            # Grab the primary monitor (index 1; index 0 is the "all monitors" virtual screen)
            monitor = self._sct.monitors[1]
            raw = self._sct.grab(monitor)

            # Convert to PIL Image (mss returns BGRA, PIL expects RGB)
            img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")

            # Save to date-organized directory
            now = datetime.now()
            date_dir = settings.screenshots_dir / now.strftime("%Y-%m-%d")
            date_dir.mkdir(parents=True, exist_ok=True)

            filename = f"{now.strftime('%H-%M-%S')}_{int(now.timestamp() * 1000) % 1000:03d}.jpg"
            filepath = date_dir / filename

            img.save(
                str(filepath),
                "JPEG",
                quality=settings.screenshot_quality,
                optimize=True,
            )

            # Encrypt at rest if enabled (no-op when encryption_enabled=False)
            try:
                from privacy.encryption import encrypt_image
                encrypt_image(filepath)
            except Exception:
                pass  # Never fail capture due to encryption

            return filepath, img

        except Exception as e:
            print(f"[ScreenCapture] Error capturing screenshot: {e}")
            return None

    def capture_to_bytes(self) -> Optional[Tuple[bytes, Image.Image]]:
        """
        Capture screenshot and return as JPEG bytes (for immediate processing
        without saving to disk first).

        Returns:
            Tuple of (JPEG bytes, PIL Image) or None if capture fails.
        """
        try:
            monitor = self._sct.monitors[1]
            raw = self._sct.grab(monitor)
            img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")

            buffer = io.BytesIO()
            img.save(
                buffer,
                "JPEG",
                quality=settings.screenshot_quality,
                optimize=True,
            )
            return buffer.getvalue(), img

        except Exception as e:
            print(f"[ScreenCapture] Error capturing to bytes: {e}")
            return None

    def close(self):
        """Release mss resources."""
        self._sct.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
