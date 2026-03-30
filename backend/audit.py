from sqlalchemy.ext.asyncio import AsyncSession
from models import AuditLog
from uuid import UUID
from typing import Optional
from datetime import datetime, timezone

async def log_action(
    db: AsyncSession,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    user_id: Optional[UUID] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None
):
    """Log an action to the audit log"""
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {},
        ip_address=ip_address,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit_log)
    await db.commit()
    return audit_log
