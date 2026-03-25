"""
Database engine and session management
Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
"""
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import NullPool
from config import Config

engine = None


def init_db():
    """Initialize database engine and create tables"""
    global engine
    is_sqlite = Config.DATABASE_URL.startswith("sqlite")
    if is_sqlite:
        # SQLite: use NullPool to avoid connection pool exhaustion under concurrent load
        connect_args = {"check_same_thread": False}
        engine = create_engine(
            Config.DATABASE_URL,
            connect_args=connect_args,
            poolclass=NullPool,
            echo=False,
        )
    else:
        # PostgreSQL/MySQL: increase pool size for concurrent users
        engine = create_engine(
            Config.DATABASE_URL,
            pool_size=20,
            max_overflow=40,
            pool_recycle=1800,
            pool_pre_ping=True,
            echo=False,
        )
    SQLModel.metadata.create_all(engine)

    # Migrate images table: replace unique(name) with unique(name, version)
    _migrate_images_unique_constraint()

    # Create default admin user
    _create_default_admin()


def _migrate_images_unique_constraint():
    """
    SQLite 不支持 DROP CONSTRAINT，需重建表。
    将 images.name 的单列唯一约束迁移为 (name, version) 联合唯一约束。
    """
    import sqlalchemy

    with engine.connect() as conn:
        indexes = conn.execute(
            sqlalchemy.text("PRAGMA index_list('images')")
        ).fetchall()

        # 已存在新联合约束则跳过
        if any(row[1] == "uq_image_name_version" for row in indexes):
            return

        # 找到覆盖单列 name 的唯一索引
        old_unique_index = None
        for row in indexes:
            if row[2] != 1:  # not unique
                continue
            cols = conn.execute(
                sqlalchemy.text(f"PRAGMA index_info('{row[1]}')")
            ).fetchall()
            if len(cols) == 1 and cols[0][2] == "name":
                old_unique_index = row[1]
                break

        if not old_unique_index:
            return

        print("⚙️  Migrating images table: replacing unique(name) with unique(name, version)...")
        conn.execute(sqlalchemy.text("""
            CREATE TABLE images_new (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                registry_url TEXT NOT NULL,
                description TEXT,
                default_cmd TEXT DEFAULT '/bin/bash',
                gpu_required INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME,
                updated_at DATETIME,
                version TEXT,
                tags TEXT,
                env_vars TEXT,
                ports TEXT,
                recommended_resources TEXT,
                UNIQUE (name, version)
            )
        """))
        conn.execute(sqlalchemy.text("INSERT INTO images_new SELECT * FROM images"))
        conn.execute(sqlalchemy.text("DROP TABLE images"))
        conn.execute(sqlalchemy.text("ALTER TABLE images_new RENAME TO images"))
        conn.execute(sqlalchemy.text("CREATE INDEX ix_images_name ON images (name)"))
        conn.commit()
        print("✓ images table migration done")


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
