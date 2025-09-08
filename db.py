# db.py

import os
from sqlmodel import SQLModel, create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

DATABASE_URL = os.getenv("DATABASE_URL")

# Create SQLAlchemy engine for PostgreSQL
engine = create_engine(
    DATABASE_URL,
    echo=True  # Enable logging for debugging; disable in production
)


def init_db():
    from models import Text, Result  # Import models to ensure tables creation
    SQLModel.metadata.create_all(engine)
