"""
Webhook Integration (v2)
- Multiple URLs (comma-separated)
- Delivery log (in-memory, last 20)
- Retry once on failure (after 5s)
- Custom headers support
- HMAC signing
"""

import hashlib
import hmac
import json
import threading
import time
import urllib.request
import urllib.error
from collections import deque
from datetime import datetime


# ── Delivery Log ────────────────────────────────────────────────────────
# In-memory ring buffer of last 20 deliveries
_delivery_log = deque(maxlen=20)
_log_lock = threading.Lock()


def get_delivery_log() -> list:
    """Return the delivery log as a list of dicts (newest first)."""
    with _log_lock:
        return list(reversed(_delivery_log))


def _log_delivery(url: str, event: str, status: str, status_code: int = 0, error: str = "", attempt: int = 1):
    """Record a delivery attempt."""
    with _log_lock:
        _delivery_log.append({
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "url": url[:80],  # Truncate for display
            "event": event,
            "status": status,  # "ok", "failed", "retry"
            "status_code": status_code,
            "error": error[:120] if error else "",
            "attempt": attempt,
        })


# ── Core ────────────────────────────────────────────────────────────────

def fire(event: str, data: dict, urls: str, secret: str = "", enabled_events: str = "", headers: str = "") -> bool:
    """
    Fire webhooks for an event. Non-blocking (runs in a thread).
    Supports multiple URLs (comma-separated).
    
    Args:
        event: Event type (daily_summary, bookmark, meeting_end, capture_milestone).
        data: Event-specific payload data.
        urls: Comma-separated webhook target URLs.
        secret: Optional HMAC-SHA256 secret for payload signing.
        enabled_events: Comma-separated list of enabled event types.
        headers: Optional custom headers as "Key: Value" lines (newline-separated).
    
    Returns:
        True if at least one webhook was queued.
    """
    if not urls:
        return False

    # Check if this event type is enabled
    if enabled_events:
        allowed = [e.strip() for e in enabled_events.split(",")]
        if event not in allowed:
            return False

    payload = {
        "event": event,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "source": "screenmind",
        "data": data,
    }

    # Parse custom headers
    custom_headers = _parse_headers(headers)

    # Fire to each URL in background
    url_list = [u.strip() for u in urls.split(",") if u.strip()]
    for url in url_list:
        thread = threading.Thread(
            target=_send_with_retry, args=(url, payload, secret, custom_headers, event), daemon=True
        )
        thread.start()

    return True


def _parse_headers(headers_str: str) -> dict:
    """Parse "Key: Value" newline-separated string into a dict."""
    result = {}
    if not headers_str:
        return result
    for line in headers_str.split("\n"):
        line = line.strip()
        if ":" in line:
            key, _, value = line.partition(":")
            result[key.strip()] = value.strip()
    return result


def _send_with_retry(url: str, payload: dict, secret: str, custom_headers: dict, event: str):
    """Send webhook with one retry on failure."""
    success = _send(url, payload, secret, custom_headers, event, attempt=1)
    if not success:
        # Wait 5s and retry once
        time.sleep(5)
        _send(url, payload, secret, custom_headers, event, attempt=2)


def _send(url: str, payload: dict, secret: str, custom_headers: dict, event: str, attempt: int = 1) -> bool:
    """Actually send the webhook. Returns True on success."""
    try:
        body = json.dumps(payload).encode("utf-8")

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "ScreenMind-Webhook/2.0",
        }

        # HMAC signing if secret is provided
        if secret:
            signature = hmac.HMAC(
                secret.encode("utf-8"),
                body,
                hashlib.sha256,
            ).hexdigest()
            headers["X-ScreenMind-Signature"] = f"sha256={signature}"

        # Merge custom headers
        headers.update(custom_headers)

        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            status_code = resp.status
            _log_delivery(url, event, "ok", status_code=status_code, attempt=attempt)
            label = f"(retry #{attempt})" if attempt > 1 else ""
            print(f"[Webhook] {event} → {url[:50]} → {status_code} {label}")
            return True

    except urllib.error.HTTPError as e:
        _log_delivery(url, event, "failed", status_code=e.code, error=str(e), attempt=attempt)
        print(f"[Webhook] Failed ({event} → {url[:50]}): HTTP {e.code}")
        return False
    except urllib.error.URLError as e:
        _log_delivery(url, event, "failed", error=str(e.reason), attempt=attempt)
        print(f"[Webhook] Failed ({event} → {url[:50]}): {e.reason}")
        return False
    except Exception as e:
        _log_delivery(url, event, "failed", error=str(e), attempt=attempt)
        print(f"[Webhook] Error ({event} → {url[:50]}): {e}")
        return False


def test_webhook(url: str, secret: str = "", headers: str = "") -> dict:
    """Send a test ping to the webhook URL. Returns status dict."""
    if not url:
        return {"ok": False, "error": "No URL provided"}

    payload = {
        "event": "test",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "source": "screenmind",
        "data": {"message": "This is a test webhook from ScreenMind."},
    }

    custom_headers = _parse_headers(headers)

    try:
        body = json.dumps(payload).encode("utf-8")
        req_headers = {
            "Content-Type": "application/json",
            "User-Agent": "ScreenMind-Webhook/2.0",
        }
        if secret:
            signature = hmac.HMAC(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
            req_headers["X-ScreenMind-Signature"] = f"sha256={signature}"
        req_headers.update(custom_headers)

        req = urllib.request.Request(url, data=body, headers=req_headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            _log_delivery(url, "test", "ok", status_code=resp.status)
            return {"ok": True, "status": resp.status}
    except Exception as e:
        _log_delivery(url, "test", "failed", error=str(e))
        return {"ok": False, "error": str(e)}
