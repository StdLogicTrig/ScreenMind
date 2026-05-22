"""Test OCR accuracy on existing screenshots."""
import sys, os, glob, time
sys.path.insert(0, r"c:\Users\Ayush\Desktop\OS contri\openrecall")

from PIL import Image
from engine.ocr import OCRExtractor

# Find latest screenshots
screenshot_dir = r"C:\Users\Ayush\.openrecall\screenshots"
files = sorted(glob.glob(os.path.join(screenshot_dir, "**", "*.jpg"), recursive=True), key=os.path.getmtime, reverse=True)

if not files:
    print("No screenshots found!")
    sys.exit(1)

ocr = OCRExtractor()
# Test on the most recent screenshot
img_path = files[0]
print(f"Testing on: {os.path.basename(img_path)}")
print(f"Image size: {Image.open(img_path).size}")
print()

img = Image.open(img_path)
start = time.time()
text = ocr.extract_text(img)
elapsed = time.time() - start

print(f"Time: {elapsed:.1f}s")
print(f"Text length: {len(text or '')} chars")
print(f"\n{'='*60}")
print("EXTRACTED TEXT:")
print("="*60)
print(text or "(nothing)")
