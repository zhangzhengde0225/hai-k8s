"""
Database engine and session management
"""
from sqlmodel import SQLModel, Session, create_engine
from config import Config

engine = None


def init_db():
    """Initialize database engine and create tables"""
    global engine
    # SQLite needs connect_args for async compatibility
    connect_args = {"check_same_thread": False} if Config.DATABASE_URL.startswith("sqlite") else {}
    engine = create_engine(Config.DATABASE_URL, connect_args=connect_args, echo=False)
    SQLModel.metadata.create_all(engine)


def get_session():
    """FastAPI dependency: yield a DB session"""
    with Session(engine) as session:
        yield session
