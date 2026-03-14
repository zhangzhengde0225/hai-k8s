"""
Migration script to create application_definitions table and insert default data

Author: Zhengde ZHANG
"""
import json
import sys
from pathlib import Path

# Add backend to path
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlmodel import Session, SQLModel, create_engine, select
from db.models import ApplicationDefinition
from config import Config
import logging

logger = logging.getLogger(__name__)


def migrate_applications(session: Session):
    """
    Migrate application definitions table with default data
    """

    # Check if table already has data
    existing = session.exec(select(ApplicationDefinition).limit(1)).first()
    if existing:
        logger.info("Application definitions table already has data. Skipping migration.")
        return

    # Default OpenClaw configuration with startup scripts
    openclaw_startup_config = {
        "enable_onboard": True,
        "enable_insecure_http": True,
        "enable_config_models": True,
        "enable_start_gateway": True,
        "allow_port_18789": True,
    }

    openclaw_models_template = {
        "providers": [
            {
                "baseUrl": "https://api.hepai.ai/v1",
                "api": "openai",
                "models": [
                    {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "maxTokens": 200000},
                    {"id": "gpt-4o", "name": "GPT-4o", "maxTokens": 128000},
                ]
            }
        ],
        "primary": "claude-3-5-sonnet-20241022",
        "fallbacks": ["gpt-4o"]
    }

    openclaw_default_firewall_rules = [
        {"port": 22, "protocol": "tcp", "source": "0.0.0.0/0", "action": "allow"},
        {"port": 18789, "protocol": "tcp", "source": "0.0.0.0/0", "action": "allow"},
    ]

    openclaw = ApplicationDefinition(
        app_id="openclaw",
        name="OpenClaw",
        description="AI agent platform for building autonomous agents",
        version="v1.0.0",
        image_prefix="hai-openclaw",
        default_replicas=1,
        is_visible=True,
        recommended_cpu=2.0,
        recommended_memory=4.0,
        recommended_gpu=0,
        default_firewall_rules=json.dumps(openclaw_default_firewall_rules),
        startup_scripts_config=json.dumps(openclaw_startup_config),
        models_config_template=json.dumps(openclaw_models_template),
    )

    # Default OpenDrSai configuration (hidden by default)
    opendrsai_startup_config = {
        "enable_onboard": False,
        "enable_insecure_http": False,
        "enable_config_models": False,
        "enable_start_gateway": False,
        "allow_port_18789": False,
    }

    opendrsai_default_firewall_rules = [
        {"port": 22, "protocol": "tcp", "source": "0.0.0.0/0", "action": "allow"},
    ]

    opendrsai = ApplicationDefinition(
        app_id="opendrsai",
        name="OpenDrSai",
        description="Doctor AI assistant platform",
        version="v1.0.0",
        image_prefix="hai-opendrsai",
        default_replicas=2,
        is_visible=False,  # Hidden by default
        recommended_cpu=2.0,
        recommended_memory=4.0,
        recommended_gpu=0,
        default_firewall_rules=json.dumps(opendrsai_default_firewall_rules),
        startup_scripts_config=json.dumps(opendrsai_startup_config),
        models_config_template=json.dumps({}),
    )

    session.add(openclaw)
    session.add(opendrsai)
    session.commit()
    session.refresh(openclaw)
    session.refresh(opendrsai)

    logger.info(f"Created application definition: {openclaw.app_id} - {openclaw.name}")
    logger.info(f"Created application definition: {opendrsai.app_id} - {opendrsai.name} (hidden)")


def main():
    """Main migration function"""
    engine = create_engine(str(Config.DATABASE_URL))
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        migrate_applications(session)

    logger.info("Application definitions migration completed successfully!")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
