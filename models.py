# models.py

from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship


class Text(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    duration: int  # Duration in seconds: 60, 90, or 120
    content: str
    active: bool = True

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

    text: Optional[Text] = Relationship(back_populates="results")
