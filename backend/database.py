import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Collections
users_col = db["users"]
domaines_col = db["domaines"]
outils_col = db["outils"]
user_domaines_col = db["user_domaines"]
user_outils_col = db["user_outils"]
audit_logs_col = db["audit_logs"]
documents_col = db["documents"]
chat_messages_col = db["chat_messages"]

# FlowChantier collections
chantiers_col = db["chantiers"]
conducteurs_col = db["conducteurs"]

async def init_indexes():
    """Create indexes for performance"""
    await users_col.create_index("email", unique=True)
    await users_col.create_index("id", unique=True)
    await domaines_col.create_index("id", unique=True)
    await domaines_col.create_index("nom", unique=True)
    await outils_col.create_index("id", unique=True)
    await user_domaines_col.create_index([("user_id", 1), ("domaine_id", 1)], unique=True)
    await user_outils_col.create_index([("user_id", 1), ("outil_id", 1)], unique=True)
    await audit_logs_col.create_index("timestamp")
    await chat_messages_col.create_index("session_id")
    await chat_messages_col.create_index("user_id")
    # FlowChantier indexes
    await chantiers_col.create_index("id", unique=True)
    await chantiers_col.create_index("reference", unique=True)
    await chantiers_col.create_index("updated_at")
    await conducteurs_col.create_index("id", unique=True)
