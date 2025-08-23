from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class Text(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    duration: int  # 60, 90, 120
    content: str
    active: bool = True


class Result(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = None
    duration: int
    wpm: int
    accuracy: int
    correct_chars: int
    raw_keystrokes: int
    text_id: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
