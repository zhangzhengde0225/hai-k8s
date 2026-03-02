"""
Delete a user (and all related records) from haik8s.db for testing purposes.

Usage:
    python delete_user_from_db.py [email_or_username]
    e.g. python delete_user_from_db.py zdzhang@ihep.ac.cn
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import Session, select
import db.database as database
from db.models import User, Container, ApplicationConfig, IPAllocation


def delete_user(email_or_username: str):
    with Session(database.engine) as session:
        # Find user by email or username
        user = session.exec(
            select(User).where(User.email == email_or_username)
        ).first()
        if not user:
            user = session.exec(
                select(User).where(User.username == email_or_username)
            ).first()

        if not user:
            print(f"User not found: {email_or_username}")
            return

        print(f"Found user: id={user.id}, username={user.username}, email={user.email}")

        # Delete related ApplicationConfigs
        configs = session.exec(
            select(ApplicationConfig).where(ApplicationConfig.user_id == user.id)
        ).all()
        for cfg in configs:
            session.delete(cfg)
        print(f"  Deleted {len(configs)} application_config(s)")

        # Delete related Containers
        containers = session.exec(
            select(Container).where(Container.user_id == user.id)
        ).all()
        for c in containers:
            session.delete(c)
        print(f"  Deleted {len(containers)} container(s)")

        # Delete related IPAllocation
        allocs = session.exec(
            select(IPAllocation).where(IPAllocation.user_id == user.id)
        ).all()
        for a in allocs:
            session.delete(a)
        print(f"  Deleted {len(allocs)} ip_allocation(s)")

        # Delete user
        session.delete(user)
        session.commit()
        print(f"  Deleted user: {user.username}")


if __name__ == "__main__":
    database.init_db()
    target = sys.argv[1] if len(sys.argv) > 1 else "zdzhang@ihep.ac.cn"
    print(f"Deleting user: {target}")
    delete_user(target)
    print("Done.")
