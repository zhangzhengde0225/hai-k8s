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

    # Create default admin user
    _create_default_admin()


def _create_default_admin():
    """Create default admin user if not exists"""
    from db.crud import get_user_by_username, create_local_user
    from db.models import UserRole
    from auth.security import hash_password

    with Session(engine) as session:
        admin = get_user_by_username(session, Config.DEFAULT_ADMIN_USERNAME)
        if not admin:
            admin = create_local_user(
                session=session,
                username=Config.DEFAULT_ADMIN_USERNAME,
                email=Config.DEFAULT_ADMIN_EMAIL,
                password_hash=hash_password(Config.DEFAULT_ADMIN_PASSWORD),
                full_name="Administrator",
                role=UserRole.ADMIN,
            )
            print(f"✓ Default admin user created:")
            print(f"  Username: {Config.DEFAULT_ADMIN_USERNAME}")
            print(f"  Password: {Config.DEFAULT_ADMIN_PASSWORD}")
            print(f"  Email: {Config.DEFAULT_ADMIN_EMAIL}")
            print("  ⚠️  Please change the default password after first login!")
        else:
            print(f"✓ Admin user '{Config.DEFAULT_ADMIN_USERNAME}' already exists")


def get_session():
    """FastAPI dependency: yield a DB session"""
    with Session(engine) as session:
        yield session
