"""Test all API endpoints."""
import urllib.request
import json
import sys

BASE = "http://127.0.0.1:7777"

def get(path):
    try:
        r = urllib.request.urlopen(f"{BASE}{path}")
        return json.loads(r.read())
    except Exception as e:
        print(f"  ERROR: {e}")
        return None

print("=" * 60)
print("ScreenMind API Test Suite")
print("=" * 60)

# 1. Status
print("\n--- 1. GET /api/status ---")
data = get("/api/status")
if data:
    print(f"  Capture running: {data['capture']['running']}")
    print(f"  Total captures: {data['capture']['total_captures']}")
    print(f"  Skipped dupes: {data['capture']['skipped_duplicates']}")
    print(f"  Analysis processed: {data['analysis']['processed']}")
    print(f"  Analysis errors: {data['analysis']['errors']}")
    print(f"  Embedder available: {data['analysis']['embedder_available']}")
    print(f"  Total activities in DB: {data['disk']['total_activities']}")
    print(f"  Model: {data['model']}")
    print(f"  RESULT: PASS ✓")

# 2. Timeline
print("\n--- 2. GET /api/timeline ---")
data = get("/api/timeline?date=2026-05-08")
if data:
    print(f"  Total activities: {data['total']}")
    for a in data["activities"][:5]:
        ts = a["timestamp"][11:19] if len(a["timestamp"]) > 19 else a["timestamp"]
        summary = a.get("summary", "")[:60]
        print(f"    [{ts}] {a.get('app_name','?')} | {a.get('category','?')} | {summary}")
    print(f"  RESULT: PASS ✓" if data["total"] > 0 else "  RESULT: FAIL (no activities)")

# 3. Search
print("\n--- 3. GET /api/search ---")
data = get("/api/search?q=coding")
if data:
    print(f"  Results for 'coding': {len(data.get('results', []))}")
    for s in data.get("results", [])[:3]:
        print(f"    [{s.get('relevance', 0):.2f}] {s.get('app_name','?')} | {s.get('summary','')[:60]}")
    print(f"  RESULT: PASS ✓" if data.get("results") else "  RESULT: WARN (no results)")

# 4. Stats
print("\n--- 4. GET /api/stats ---")
data = get("/api/stats?range=day")
if data:
    print(f"  Total activities: {data.get('total_activities', 0)}")
    print(f"  Categories: {data.get('categories', {})}")
    print(f"  Top apps: {data.get('top_apps', {})}")
    print(f"  RESULT: PASS ✓" if data.get("total_activities", 0) > 0 else "  RESULT: FAIL")

# 5. Heatmap
print("\n--- 5. GET /api/heatmap ---")
data = get("/api/heatmap")
if data:
    print(f"  Heatmap entries: {len(data.get('heatmap', []))}")
    print(f"  RESULT: PASS ✓")

# 6. Bookmarks
print("\n--- 6. GET /api/bookmarks ---")
data = get("/api/bookmarks")
if data is not None:
    print(f"  Bookmarks: {len(data.get('bookmarks', data if isinstance(data, list) else []))}")
    print(f"  RESULT: PASS ✓")

# 7. Rewind
print("\n--- 7. GET /api/rewind ---")
data = get("/api/rewind?date=2026-05-08")
if data:
    frames = data.get("frames", [])
    print(f"  Rewind frames: {len(frames)}")
    if frames:
        print(f"    First: {frames[0].get('timestamp', '?')}")
        print(f"    Last:  {frames[-1].get('timestamp', '?')}")
    print(f"  RESULT: PASS ✓" if frames else "  RESULT: WARN (no frames)")

# 8. Dashboard HTML
print("\n--- 8. GET / (Dashboard) ---")
try:
    r = urllib.request.urlopen(f"{BASE}/")
    html = r.read().decode()
    print(f"  HTML size: {len(html)} bytes")
    has_title = "ScreenMind" in html
    print(f"  Contains 'ScreenMind': {has_title}")
    print(f"  RESULT: PASS ✓" if has_title else "  RESULT: WARN")
except Exception as e:
    print(f"  ERROR: {e}")

print("\n" + "=" * 60)
print("All API tests complete!")
print("=" * 60)
