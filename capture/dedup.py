"""
Screenshot Deduplication Module
Uses perceptual hashing (pHash) to detect when the screen hasn't meaningfully changed.
Skips near-identical frames to save disk space and avoid redundant Gemma 4 calls.
"""

from typing import Optional

import imagehash
from PIL import Image


class ScreenDeduplicator:
    """
    Compares consecutive screenshots using perceptual hashing.
    Only allows frames through if they differ by more than the threshold.
    """

    def __init__(self, threshold: int = 8):
        """
        Args:
            threshold: Hamming distance threshold. Lower = stricter dedup.
                       8 works well for detecting meaningful screen changes
                       while ignoring cursor blinks, clock updates, etc.
        """
        self._threshold = threshold
        self._last_hash: Optional[imagehash.ImageHash] = None
        self._current_hash: Optional[imagehash.ImageHash] = None

    def is_duplicate(self, image: Image.Image) -> bool:
        """
        Check if the given image is too similar to the previous one.

        Args:
            image: PIL Image of the current screenshot.

        Returns:
            True if the image should be skipped (duplicate), False if it's new.
        """
        self._current_hash = imagehash.phash(image)

        if self._last_hash is None:
            # First frame — always process
            self._last_hash = self._current_hash
            return False

        # Hamming distance: 0 = identical, higher = more different
        distance = self._last_hash - self._current_hash

        if distance <= self._threshold:
            # Too similar — skip
            return True

        # Meaningfully different — update hash and process
        self._last_hash = self._current_hash
        return False

    @property
    def last_computed_hash(self):
        """The pHash of the most recently checked image (available after is_duplicate())."""
        return self._current_hash

    def reset(self):
        """Clear the stored hash (e.g., after pause/resume)."""
        self._last_hash = None
        self._current_hash = None
