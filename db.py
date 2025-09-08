from sqlmodel import SQLModel, create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql://typingpara_user:WIiK9P3q7dqCh1mr0uF3pNISugKZMLjc@dpg-d2veq0buibrs738hjarg-a/typingpara"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def init_db():
    from models import Text, Result  # ensure models are imported for table creation
    SQLModel.metadata.create_all(engine)


