"""Summary & Standup routes — AI-generated daily summaries."""

import asyncio

from fastapi import APIRouter, Query

from config import settings
from api.dependencies import db

router = APIRouter(prefix="/api", tags=["summary"])


@router.get("/summary")
async def get_summary(
    date: str = Query(default=None),
):
    target = date or str(__import__("datetime").date.today())
    summary = db.get_daily_summary(target)
    return {"date": target, "generated": summary is not None, "summary": summary, "standup": (summary or {}).get("standup", "")}


@router.post("/summary/generate")
async def generate_summary(
    date: str = Query(default=None),
):
    """Generate a daily summary using Gemma 4."""
    from engine import llm_client
    from storage.models import DailySummary

    target = date or str(__import__("datetime").date.today())
    activities = db.get_activities_by_date(target, limit=200)

    if not activities:
        return {"date": target, "summary": {"summary": "No activities recorded on this date."}}

    # Build rich context
    MAX_RICH = 20
    act_entries = []
    rich_count = 0
    for a in activities:
        if not a.get("analyzed"):
            continue
        time_str = a.get("timestamp", "")
        app = a.get("app_name", "?")
        cat = a.get("category", "?")
        summary = a.get("summary", "")
        entry = f"[{time_str}] {app} ({cat}): {summary}"
        if rich_count < MAX_RICH:
            org_text = (a.get("organized_text") or "").strip()
            if org_text:
                if len(org_text) > 300:
                    org_text = org_text[:300] + "..."
                entry += f"\n  Screen content: {org_text}"
                rich_count += 1
        act_entries.append(entry)

    acts_text = "\n".join(act_entries)
    act_count = len(act_entries)

    prompt = f"""Summarize this user's day based on their screen activities.

Rules:
- Be SPECIFIC: mention actual names, email subjects, chat contacts, repo names — not vague descriptions
- Scale your response to the data: {act_count} activities = {1 if act_count <= 5 else 2 if act_count <= 15 else 3}-{2 if act_count <= 5 else 3 if act_count <= 15 else 5} short paragraphs
- Don't pad with filler. If there's little data, write a short summary
- Use the "Screen content" fields for specific details (who messaged, what emails, etc.)

Activities:
{acts_text}

Write the summary:"""

    try:
        summary_text = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: llm_client.generate(
                prompt=prompt,
                temperature=0.3,
                max_tokens=2048,
            ),
        )
    except Exception as e:
        summary_text = f"Summary generation failed: {e}"

    summary_obj = DailySummary(
        date=target,
        summary=summary_text,
        total_activities=len(activities),
    )
    db.upsert_daily_summary(summary_obj)

    # Fire integrations
    _fire_summary_integrations(target, summary_text, "", act_count)

    return {"date": target, "summary": {"summary": summary_text}}


@router.post("/standup/generate")
async def generate_standup(
    date: str = Query(default=None),
):
    """Generate standup notes."""
    from engine import llm_client

    target = date or str(__import__("datetime").date.today())
    activities = db.get_activities_by_date(target, limit=200)

    if not activities:
        return {"date": target, "standup": "No activities to summarize."}

    MAX_RICH = 15
    act_entries = []
    rich_count = 0
    for a in activities:
        if not a.get("analyzed"):
            continue
        app = a.get("app_name", "?")
        summary = a.get("summary", "")
        entry = f"- {app}: {summary}"
        if rich_count < MAX_RICH:
            org_text = (a.get("organized_text") or "").strip()
            if org_text:
                if len(org_text) > 200:
                    org_text = org_text[:200] + "..."
                entry += f"\n  Content: {org_text}"
                rich_count += 1
        act_entries.append(entry)

    acts_text = "\n".join(act_entries)

    prompt = f"""Generate standup notes from these screen activities.

Rules:
- Be SPECIFIC: use actual names, subjects, contacts from the "Content" fields
- Keep each bullet point to 1 line — no vague descriptions
- If few activities, keep it short (2-3 bullets per section max)
- "Blockers" should be real issues visible in the data, or say "None identified"

Format:
## Yesterday / Today
- Specific things done (e.g. "Replied to aachii on Discord", "Checked Gmail inbox — portfolio/main")
## Blockers
- Real issues or "None identified"
## Plan
- Concrete next steps based on what was seen

Activities:
{acts_text}"""

    try:
        standup = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: llm_client.generate(
                prompt=prompt,
                temperature=0.3,
                max_tokens=1024,
            ),
        )
    except Exception as e:
        standup = f"Standup generation failed: {e}"

    # Save standup to DB alongside summary
    from storage.models import DailySummary
    standup_summary = DailySummary(
        date=target,
        summary="",  # Don't overwrite existing summary
        total_activities=len(activities),
    )
    db.upsert_daily_summary(standup_summary, standup=standup)

    # Fire integrations
    _fire_summary_integrations(target, "", standup, len(activities))

    return {"date": target, "standup": standup}


def _fire_summary_integrations(date_str: str, summary: str, standup: str, activity_count: int):
    """Fire all enabled integrations after summary/standup generation."""
    try:
        if settings.obsidian_enabled and settings.obsidian_vault_path:
            from integrations.obsidian import export_summary
            export_summary(settings.obsidian_vault_path, date_str, summary, standup, activity_count)
    except Exception as e:
        print(f"[Integration] Obsidian error: {e}")

    try:
        if settings.notion_enabled and settings.notion_token:
            from integrations.notion import export_summary
            export_summary(settings.notion_token, settings.notion_database_id, date_str, summary, standup, activity_count)
    except Exception as e:
        print(f"[Integration] Notion error: {e}")

    try:
        if settings.webhook_enabled and settings.webhook_url:
            from integrations.webhooks import fire
            fire("daily_summary", {
                "date": date_str,
                "summary": summary,
                "standup": standup,
                "activity_count": activity_count,
            }, settings.webhook_url, settings.webhook_secret, settings.webhook_events, settings.webhook_headers)
    except Exception as e:
        print(f"[Integration] Webhook error: {e}")
