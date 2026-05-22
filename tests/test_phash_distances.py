"""
Test script: Compute pHash distances between consecutive screenshots
to determine safe dedup threshold.
"""
import sys
sys.path.insert(0, ".")

from pathlib import Path
from PIL import Image
import imagehash

from config import settings

def compute_phash(img_path):
    img = Image.open(img_path)
    return imagehash.phash(img)

def main():
    ss_dir = settings.screenshots_dir
    files = sorted(ss_dir.rglob("*.jpg"), key=lambda f: f.name)
    print(f"Found {len(files)} screenshots in {ss_dir}\n")

    if len(files) < 2:
        print("Need at least 2 screenshots to compare")
        return

    # Compute all hashes
    hashes = []
    for f in files:
        try:
            h = compute_phash(f)
            hashes.append((f, h))
        except Exception as e:
            print(f"  Error: {f.name}: {e}")

    # Compute consecutive distances
    distances = []
    print(f"{'#':>3}  {'Distance':>8}  {'File A':>40}  ->  {'File B'}")
    print("-" * 110)
    for i in range(len(hashes) - 1):
        fa, ha = hashes[i]
        fb, hb = hashes[i + 1]
        dist = ha - hb
        distances.append(dist)
        marker = ""
        if dist <= 2:
            marker = "  <- IDENTICAL (tier 0-2)"
        elif dist <= 7:
            marker = "  <- MINOR (tier 3-7)"
        elif dist <= 10:
            marker = "  <- THRESHOLD ZONE (8-10)"
        else:
            marker = "  <- MAJOR (11+)"
        print(f"{i+1:>3}  {dist:>8}  {fa.name:>40}  ->  {fb.name}{marker}")

    # Distribution
    print(f"\n{'=' * 60}")
    print("DISTRIBUTION")
    print(f"{'=' * 60}")
    buckets = {
        "0-2 (identical)": len([d for d in distances if d <= 2]),
        "3-7 (minor change)": len([d for d in distances if 3 <= d <= 7]),
        "8-10 (threshold zone)": len([d for d in distances if 8 <= d <= 10]),
        "11+ (major change)": len([d for d in distances if d >= 11]),
    }
    for label, count in buckets.items():
        pct = count / len(distances) * 100
        bar = "#" * int(pct / 2)
        print(f"  {label:>25}: {count:>3} ({pct:>5.1f}%)  {bar}")

    print(f"\n  Total pairs: {len(distances)}")
    print(f"  Min distance: {min(distances)}")
    print(f"  Max distance: {max(distances)}")
    print(f"  Mean: {sum(distances)/len(distances):.1f}")
    print(f"  Median: {sorted(distances)[len(distances)//2]}")

    # Threshold analysis
    print(f"\n{'=' * 60}")
    print("THRESHOLD ANALYSIS")
    print(f"{'=' * 60}")
    for t in [8, 9, 10, 11, 12]:
        skipped = len([d for d in distances if d < t])
        pct = skipped / len(distances) * 100
        print(f"  Threshold {t:>2}: would skip {skipped}/{len(distances)} ({pct:.0f}%) captures")

if __name__ == "__main__":
    main()
