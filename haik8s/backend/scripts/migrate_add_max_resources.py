"""
Migration script to add max_cpu, max_memory, max_gpu columns to application_definitions table

Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text
from sqlmodel import create_engine, Session
from config import Config
import logging

logger = logging.getLogger(__name__)


def migrate(session: Session):
    conn = session.connection()

    # 查询现有列
    result = conn.execute(text("PRAGMA table_info(application_definitions)"))
    existing_columns = {row[1] for row in result.fetchall()}

    added = []
    if "max_cpu" not in existing_columns:
        conn.execute(text("ALTER TABLE application_definitions ADD COLUMN max_cpu FLOAT"))
        added.append("max_cpu")

    if "max_memory" not in existing_columns:
        conn.execute(text("ALTER TABLE application_definitions ADD COLUMN max_memory FLOAT"))
        added.append("max_memory")

    if "max_gpu" not in existing_columns:
        conn.execute(text("ALTER TABLE application_definitions ADD COLUMN max_gpu INTEGER"))
        added.append("max_gpu")

    if added:
        session.commit()
        logger.info(f"Added columns: {', '.join(added)}")
    else:
        logger.info("All columns already exist, skipping.")


def main():
    engine = create_engine(str(Config.DATABASE_URL))
    with Session(engine) as session:
        migrate(session)
    logger.info("Migration completed successfully!")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
