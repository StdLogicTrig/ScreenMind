"""Model management routes — list, download, switch models via model_manager."""

import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from config import settings
from engine import model_manager

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
async def list_models():
    """List available models with download status."""
    models = model_manager.list_models()
    active = model_manager.get_active_model() or settings.active_model
    top_tier = max(m["tier"] for m in models) if models else 0
    active_tier = next((m["tier"] for m in models if m["key"] == active), 0)

    return {
        "models": models,
        "active": active,
        "is_top_model": active_tier >= top_tier,
    }


@router.post("/pull")
async def pull_model(request: Request):
    """Download a model GGUF from HuggingFace."""
    body = await request.json()
    key = body.get("tag", "") or body.get("key", "")

    info = model_manager.get_model_info(key)
    if not info:
        return JSONResponse({"error": "Unknown model"}, status_code=400)

    print(f"[Models] Downloading {info['name']}...")
    success = await asyncio.get_event_loop().run_in_executor(
        None, lambda: model_manager.download_model(key)
    )

    if success:
        print(f"[Models] Download complete: {info['name']}")
        return {"status": "downloaded", "key": key}
    else:
        return JSONResponse({"error": "Download failed"}, status_code=500)


@router.post("/switch")
async def switch_model(request: Request):
    """Switch the active model (restarts llama-server)."""
    body = await request.json()
    key = body.get("tag", "") or body.get("key", "")

    info = model_manager.get_model_info(key)
    if not info:
        return JSONResponse({"error": "Unknown model"}, status_code=400)

    success = await asyncio.get_event_loop().run_in_executor(
        None, lambda: model_manager.switch_model(key)
    )

    if success:
        print(f"[Models] Switched to: {info['name']}")
        return {"status": "switched", "active": key}
    else:
        return JSONResponse({"error": "Failed to switch model"}, status_code=500)
