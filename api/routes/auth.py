"""Auth routes — PIN lock, session management."""

import hashlib

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from config import settings
from api.dependencies import verify_session, create_session, delete_session

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/status")
async def auth_status(request: Request):
    """Check if PIN is set and if current session is valid."""
    has_pin = bool(settings.dashboard_pin_hash)
    token = request.cookies.get("screenmind_session")
    authenticated = verify_session(token) if has_pin else True
    # First-run detection: setup_complete flag in settings.json
    import json
    setup_complete = False
    try:
        if settings.settings_json_path.exists():
            data = json.loads(settings.settings_json_path.read_text())
            setup_complete = data.get("setup_complete", False)
    except Exception:
        pass
    return {"has_pin": has_pin, "authenticated": authenticated, "first_run": not setup_complete}


@router.post("/setup-complete")
async def mark_setup_complete(request: Request):
    """Mark first-run setup as complete (called after welcome screen)."""
    body = await request.json()
    pin = body.get("pin", "")
    updates = {"setup_complete": True}
    if pin:
        pin_hash = hashlib.sha256(pin.encode()).hexdigest()
        updates["dashboard_pin_hash"] = pin_hash
    settings.save_runtime_overrides(updates)
    if pin:
        token = create_session()
        response = JSONResponse({"ok": True, "pin_set": True})
        response.set_cookie(
            "screenmind_session", token,
            httponly=True, samesite="lax",
            max_age=settings.dashboard_lock_timeout * 60,
        )
        return response
    return JSONResponse({"ok": True, "pin_set": False})


@router.post("/verify")
async def verify_pin(request: Request):
    """Verify PIN and create session."""
    body = await request.json()
    pin = str(body.get("pin", ""))
    pin_hash = hashlib.sha256(pin.encode()).hexdigest()

    if pin_hash == settings.dashboard_pin_hash:
        token = create_session()
        response = JSONResponse({"ok": True})
        response.set_cookie(
            "screenmind_session", token,
            httponly=True, samesite="lax",
            max_age=settings.dashboard_lock_timeout * 60,
        )
        return response
    return JSONResponse({"ok": False, "error": "Invalid PIN"}, status_code=401)


@router.post("/set-pin")
async def set_pin(request: Request):
    """Set or change dashboard PIN."""
    body = await request.json()
    pin = str(body.get("pin", ""))
    current = str(body.get("current_pin", ""))

    # If PIN already set, verify current PIN first
    if settings.dashboard_pin_hash:
        current_hash = hashlib.sha256(current.encode()).hexdigest()
        if current_hash != settings.dashboard_pin_hash:
            return JSONResponse({"ok": False, "error": "Current PIN incorrect"}, status_code=401)

    if pin:
        new_hash = hashlib.sha256(pin.encode()).hexdigest()
    else:
        new_hash = ""  # Clear PIN

    settings.save_runtime_overrides({"dashboard_pin_hash": new_hash})
    object.__setattr__(settings, "dashboard_pin_hash", new_hash)

    # Create session for the user who just set the PIN
    token = create_session()
    response = JSONResponse({"ok": True, "pin_set": bool(pin)})
    if pin:
        response.set_cookie(
            "screenmind_session", token,
            httponly=True, samesite="lax",
            max_age=settings.dashboard_lock_timeout * 60,
        )
    return response


@router.post("/logout")
async def logout(request: Request):
    """Clear session."""
    token = request.cookies.get("screenmind_session")
    if token:
        delete_session(token)
    response = JSONResponse({"ok": True})
    response.delete_cookie("screenmind_session")
    return response
