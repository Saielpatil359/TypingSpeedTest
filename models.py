from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class Text(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    duration: int  # e.g., 60, 90, 120
    content: str
    active: bool = True

    # Optional: Relationship if you want to query results belonging to a Text
    results: list["Result"] = Relationship(back_populates="text")


class Result(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = None
    duration: int
    wpm: int
    accuracy: int
    correct_chars: int
    raw_keystrokes: int
    text_id: int = Field(foreign_key="text.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
