"""Settings routes — get/update config, integration tests, webhook log."""

from fastapi import APIRouter, Request

from config import settings

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings")
async def get_settings():
    """Return current resource management settings."""
    return {
        "capture_interval": settings.capture_interval,
        "performance_mode": settings.performance_mode,
        "context_window": settings.context_window,
        "kv_cache_quant": settings.kv_cache_quant,
        "flash_attention": settings.flash_attention,
        "analysis_mode": settings.analysis_mode,
        "auto_pause_heavy_apps": settings.auto_pause_heavy_apps,
        "heavy_apps": settings.heavy_apps,
        "defer_analysis": settings.defer_analysis,
        "meeting_transcription": settings.meeting_transcription,
        "meeting_apps": settings.meeting_apps,
        "retention_days": settings.retention_days,
        "ollama_model": settings.ollama_model,
        "whisper_model": settings.whisper_model,
        "obsidian_enabled": settings.obsidian_enabled,
        "obsidian_vault_path": settings.obsidian_vault_path,
        "notion_enabled": settings.notion_enabled,
        "notion_token": settings.notion_token,
        "notion_database_id": settings.notion_database_id,
        "webhook_enabled": settings.webhook_enabled,
        "webhook_url": settings.webhook_url,
        "webhook_events": settings.webhook_events,
        "webhook_secret": settings.webhook_secret,
        "webhook_headers": settings.webhook_headers,
        "smart_notifications": settings.smart_notifications,
        "distraction_minutes": settings.distraction_minutes,
        "break_reminder_minutes": settings.break_reminder_minutes,
        "auto_bookmark": settings.auto_bookmark,
        "auto_bookmark_keywords": settings.auto_bookmark_keywords,
        "agents_enabled": settings.agents_enabled,
        "agents_auto_run_python": settings.agents_auto_run_python,
        "sensitive_filter_enabled": settings.sensitive_filter_enabled,
        "sensitive_filter_types": settings.sensitive_filter_types,
        "dashboard_pin_set": bool(settings.dashboard_pin_hash),
        "dashboard_lock_timeout": settings.dashboard_lock_timeout,
        "encryption_enabled": settings.encryption_enabled,
        "bookmark_hotkey": settings.bookmark_hotkey,
        "pause_hotkey": settings.pause_hotkey,
        "voice_hotkey": settings.voice_hotkey,
    }


@router.post("/settings")
async def update_settings(request: Request):
    """Update resource management settings (persists to settings.json)."""
    body = await request.json()
    settings.save_runtime_overrides(body)
    return {
        "status": "saved",
        "capture_interval": settings.capture_interval,
        "performance_mode": settings.performance_mode,
        "context_window": settings.context_window,
        "kv_cache_quant": settings.kv_cache_quant,
        "flash_attention": settings.flash_attention,
        "analysis_mode": settings.analysis_mode,
        "auto_pause_heavy_apps": settings.auto_pause_heavy_apps,
        "heavy_apps": settings.heavy_apps,
        "defer_analysis": settings.defer_analysis,
        "meeting_transcription": settings.meeting_transcription,
        "meeting_apps": settings.meeting_apps,
        "retention_days": settings.retention_days,
        "ollama_model": settings.ollama_model,
        "whisper_model": settings.whisper_model,
        "obsidian_enabled": settings.obsidian_enabled,
        "obsidian_vault_path": settings.obsidian_vault_path,
        "notion_enabled": settings.notion_enabled,
        "notion_token": settings.notion_token,
        "notion_database_id": settings.notion_database_id,
        "webhook_enabled": settings.webhook_enabled,
        "webhook_url": settings.webhook_url,
        "webhook_events": settings.webhook_events,
        "webhook_secret": settings.webhook_secret,
        "webhook_headers": settings.webhook_headers,
        "smart_notifications": settings.smart_notifications,
        "distraction_minutes": settings.distraction_minutes,
        "break_reminder_minutes": settings.break_reminder_minutes,
        "auto_bookmark": settings.auto_bookmark,
        "auto_bookmark_keywords": settings.auto_bookmark_keywords,
        "agents_enabled": settings.agents_enabled,
        "agents_auto_run_python": settings.agents_auto_run_python,
        "sensitive_filter_enabled": settings.sensitive_filter_enabled,
        "sensitive_filter_types": settings.sensitive_filter_types,
        "dashboard_pin_set": bool(settings.dashboard_pin_hash),
        "dashboard_lock_timeout": settings.dashboard_lock_timeout,
        "encryption_enabled": settings.encryption_enabled,
        "bookmark_hotkey": settings.bookmark_hotkey,
        "pause_hotkey": settings.pause_hotkey,
        "voice_hotkey": settings.voice_hotkey,
    }


@router.post("/integrations/test")
async def test_integration(request: Request):
    """Test an integration connection (Notion or Webhook)."""
    body = await request.json()
    integration = body.get("type")

    if integration == "notion":
        from integrations.notion import test_connection
        result = test_connection(
            body.get("token", settings.notion_token),
            body.get("database_id", settings.notion_database_id),
        )
        return result

    elif integration == "webhook":
        from integrations.webhooks import test_webhook
        result = test_webhook(
            body.get("url", settings.webhook_url),
            body.get("secret", settings.webhook_secret),
            body.get("headers", settings.webhook_headers),
        )
        return result

    return {"ok": False, "error": "Unknown integration type"}


@router.get("/webhooks/log")
async def get_webhook_log():
    """Return the last 20 webhook deliveries."""
    from integrations.webhooks import get_delivery_log
    return {"deliveries": get_delivery_log()}
