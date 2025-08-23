from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
from fastapi import Path

import random

from .db import engine, init_db
from .models import Text, Result

app = FastAPI(title="Typing Test API")

# CORS: allow all during development. Use your real domain in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    with Session(engine) as session:
        yield session

@app.on_event("startup")
def on_startup():
    # Create tables and seed demo texts if empty
    init_db()
    with Session(engine) as db:
        if not db.exec(select(Text)).first():
            db.add_all([
                Text(duration=60, content="Short 60s paragraph. Warm up and find rhythm."),
                Text(duration=90, content="Medium 90s paragraph. Balance speed and accuracy."),
                Text(duration=120, content="Long 120s paragraph. Maintain form and consistency."),
            ])
            db.commit()

@app.get("/api/health")
def health():
    return {"ok": True}

@app.get("/api/texts")
def get_text(duration: int, db: Session = Depends(get_db)):
    if duration not in (60, 90, 120):
        raise HTTPException(status_code=400, detail="Invalid duration. Use 60, 90, or 120.")
    pool = db.exec(select(Text).where(Text.duration == duration, Text.active == True)).all()
    if not pool:
        raise HTTPException(status_code=404, detail="No texts for this duration")
    chosen = random.choice(pool)
    return {"id": chosen.id, "content": chosen.content, "duration": chosen.duration}

# ----- For adding paragraphs (already working) -----
class TextIn(BaseModel):
    duration: int
    content: str
    active: bool = True

@app.post("/api/texts")
def add_text(payload: TextIn, db: Session = Depends(get_db)):
    if payload.duration not in (60, 90, 120):
        raise HTTPException(status_code=400, detail="Invalid duration. Use 60, 90, or 120.")
    t = Text(duration=payload.duration, content=payload.content, active=payload.active)
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id}

    
@app.delete("/api/texts/{text_id}")
def delete_text(text_id: int = Path(..., description="ID of the text to delete"), db: Session = Depends(get_db)):
    t = db.get(Text, text_id)
    if not t:
        raise HTTPException(status_code=404, detail="Text not found")
    db.delete(t)
    db.commit()
    return {"ok": True, "deleted_id": text_id}


# ====== MISSION 5: SAVE RESULTS =========
class ResultIn(BaseModel):
    user_id: Optional[str] = None  # null/anonymous for now
    duration: int
    wpm: int
    accuracy: int
    correct_chars: int
    raw_keystrokes: int
    text_id: int

@app.post("/api/results")
def post_result(payload: ResultIn, db: Session = Depends(get_db)):
    if payload.duration not in (60, 90, 120):
        raise HTTPException(status_code=400, detail="Invalid duration")
    if not (0 <= payload.accuracy <= 100):
        raise HTTPException(status_code=400, detail="Invalid accuracy")
    if payload.wpm < 0 or payload.wpm > 300:
        raise HTTPException(status_code=400, detail="Unrealistic WPM")

    text = db.get(Text, payload.text_id)
    if not text:
        raise HTTPException(status_code=404, detail="Text not found")

    r = Result(
        user_id=payload.user_id,
        duration=payload.duration,
        wpm=payload.wpm,
        accuracy=payload.accuracy,
        correct_chars=payload.correct_chars,
        raw_keystrokes=payload.raw_keystrokes,
        text_id=payload.text_id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return {"ok": True, "id": r.id}

# ----- Optional: Quick leaderboard check -----
@app.get("/api/leaderboard")
def leaderboard(duration: int, limit: int = 10, db: Session = Depends(get_db)):
    rows = db.exec(
        select(Result)
        .where(Result.duration == duration)
        .order_by(Result.wpm.desc())
        .limit(limit)
    ).all()

    def get_achievement(wpm):
        if wpm >= 70:
            return "Advanced"
        elif wpm >= 40:
            return "Pro"
        else:
            return "Beginner"

    return [
        {
            "user_id": r.user_id or "anon",
            "wpm": r.wpm,
            "accuracy": r.accuracy,
            "achievement": get_achievement(r.wpm),
            "created_at": r.created_at.isoformat(),
        } for r in rows
    ]

@app.get("/api/texts/all")
def get_all_texts(db: Session = Depends(get_db)):
    texts = db.exec(select(Text)).all()
    return [{"id": t.id, "duration": t.duration, "content": t.content, "active": t.active} for t in texts]

