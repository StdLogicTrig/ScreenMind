"""Test pHash deduplication logic with synthetic images."""
import pytest
from PIL import Image
import imagehash


def _make_image(color: tuple, size=(200, 200)) -> Image.Image:
    """Create a solid-color test image."""
    return Image.new("RGB", size, color=color)


def test_identical_images_have_zero_distance():
    """Two identical images should have pHash distance 0."""
    img = _make_image((128, 128, 128))
    h1 = imagehash.phash(img)
    h2 = imagehash.phash(img)
    assert h1 - h2 == 0


def test_similar_images_have_low_distance():
    """Slightly different colors should produce low pHash distance."""
    img_a = _make_image((128, 128, 128))
    img_b = _make_image((130, 128, 128))  # barely different
    dist = imagehash.phash(img_a) - imagehash.phash(img_b)
    assert dist <= 10, f"Expected low distance for similar images, got {dist}"


def test_different_images_have_high_distance():
    """Very different images should produce high pHash distance."""
    img_white = _make_image((255, 255, 255))
    img_dark_pattern = Image.new("RGB", (200, 200))
    # Draw a checkerboard-like pattern to create structural difference
    pixels = img_dark_pattern.load()
    for x in range(200):
        for y in range(200):
            pixels[x, y] = (0, 0, 0) if (x // 25 + y // 25) % 2 == 0 else (255, 255, 255)

    dist = imagehash.phash(img_white) - imagehash.phash(img_dark_pattern)
    assert dist > 5, f"Expected high distance for different images, got {dist}"


def test_deduplicator_skips_identical():
    """ScreenDeduplicator.is_duplicate correctly detects identical frames."""
    from capture.dedup import ScreenDeduplicator
    dedup = ScreenDeduplicator(threshold=8)
    img = _make_image((100, 100, 100))
    # First image is never a duplicate
    assert dedup.is_duplicate(img) is False
    # Same image again should be duplicate
    assert dedup.is_duplicate(img) is True


def test_deduplicator_passes_different():
    """ScreenDeduplicator allows significantly different frames through."""
    from capture.dedup import ScreenDeduplicator
    dedup = ScreenDeduplicator(threshold=8)

    img_a = _make_image((255, 255, 255))
    img_b = Image.new("RGB", (200, 200))
    pixels = img_b.load()
    for x in range(200):
        for y in range(200):
            pixels[x, y] = (0, 0, 0) if (x // 25 + y // 25) % 2 == 0 else (255, 255, 255)

    assert dedup.is_duplicate(img_a) is False
    assert dedup.is_duplicate(img_b) is False  # different enough to pass
