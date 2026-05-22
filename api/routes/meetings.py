"""Meeting routes — transcripts, summaries, CRUD."""

import asyncio

from fastapi import APIRouter, HTTPException, Query

from api.dependencies import db, audio_worker

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


@router.get("")
async def get_meetings(date: str = Query(default=None)):
    """Get meeting transcripts and summaries for a date."""
    target_date = date or str(__import__("datetime").date.today())
    meetings = db.get_meetings_by_date(target_date)
    return {"meetings": meetings, "date": target_date}


# NOTE: /status must be defined BEFORE /{meeting_id} so FastAPI
# doesn't try to parse "status" as an integer meeting_id.
@router.get("/status")
async def meeting_status():
    """Get current meeting recording status."""
    if audio_worker:
        return audio_worker.stats
    return {"available": False, "enabled": False}


@router.get("/{meeting_id}")
async def get_meeting(meeting_id: int):
    """Get a single meeting by ID."""
    meeting = db.get_meeting_by_id(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.delete("/{meeting_id}")
async def delete_meeting(meeting_id: int):
    """Delete a meeting by ID."""
    deleted = db.delete_meeting(meeting_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"status": "deleted", "id": meeting_id}


@router.post("/{meeting_id}/reanalyze")
async def reanalyze_meeting(meeting_id: int):
    """Re-generate the Gemma summary from the stored transcript."""
    meeting = db.get_meeting_by_id(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    transcript = meeting.get("transcript", "")
    if not transcript or transcript.strip() == "(No speech detected)":
        return {"status": "skipped", "reason": "No transcript to analyze"}
    # Mark as re-analyzing
    db.update_meeting_summary(meeting_id, "⏳ Re-generating summary...")
    # Trigger async summary via audio worker
    if audio_worker:
        asyncio.ensure_future(
            audio_worker._generate_summary(meeting_id, transcript)
        )
    return {"status": "reanalyzing", "id": meeting_id}
