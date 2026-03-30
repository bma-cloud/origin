from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
import os
import logging
from datetime import datetime, timezone
from typing import List
from uuid import UUID

from database import engine, Base, get_db
from models import User, Domaine, Outil, UserDomaine, UserOutil, AuditLog, Document
from schemas import (
    UserLogin, UserRegister, UserCreate, UserUpdate, UserResponse, UserSimpleResponse,
    DomaineCreate, DomaineUpdate, DomaineResponse, DomaineWithOutils,
    OutilCreate, OutilUpdate, OutilResponse, OutilSimpleResponse,
    AssignUserToDomaine, AssignUserToOutil,
    AuditLogResponse, DashboardStats, TokenResponse,
    UserDomaineInfo, UserOutilInfo
)
from auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    get_current_user, require_direction, require_encadrant_or_direction
)
from audit import log_action

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="BTP Manager API")
api_router = APIRouter(prefix="/api")

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=UserSimpleResponse)
async def register(
    user_data: UserRegister,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user. First user becomes Direction."""
    email = user_data.email.lower()
    
    # Check if email exists
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if this is the first user
    count_result = await db.execute(select(func.count()).select_from(User))
    user_count = count_result.scalar()
    
    role = "direction" if user_count == 0 else "user"
    
    user = User(
        email=email,
        nom=user_data.nom,
        prenom=user_data.prenom,
        password_hash=hash_password(user_data.password),
        role_global=role
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Create tokens
    access_token = create_access_token(str(user.id), user.email, user.role_global)
    refresh_token = create_refresh_token(str(user.id))
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    # Log action
    await log_action(db, "register", "user", str(user.id), user.id, 
                     {"email": user.email, "role": role}, request.client.host if request.client else None)
    
    return user

@api_router.post("/auth/login")
async def login(
    user_data: UserLogin,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """Login and get JWT tokens"""
    email = user_data.email.lower()
    
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=401, detail="User account is inactive")
    
    # Create tokens
    access_token = create_access_token(str(user.id), user.email, user.role_global)
    refresh_token = create_refresh_token(str(user.id))
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    # Log action
    await log_action(db, "login", "user", str(user.id), user.id, 
                     {"email": user.email}, request.client.host if request.client else None)
    
    return {
        "id": str(user.id),
        "email": user.email,
        "nom": user.nom,
        "prenom": user.prenom,
        "role_global": user.role_global,
        "is_active": user.is_active,
        "access_token": access_token,
        "token_type": "bearer"
    }

@api_router.get("/auth/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user info with domaines and outils"""
    # Reload user with relationships
    result = await db.execute(
        select(User)
        .options(selectinload(User.domaines).selectinload(UserDomaine.domaine))
        .options(selectinload(User.outils).selectinload(UserOutil.outil))
        .where(User.id == current_user.id)
    )
    user = result.scalar_one()
    
    domaines = [
        {"domaine_id": str(ud.domaine_id), "domaine_nom": ud.domaine.nom if ud.domaine else None}
        for ud in user.domaines
    ]
    outils = [
        {"outil_id": str(uo.outil_id), "outil_nom": uo.outil.nom if uo.outil else None, "role": uo.role}
        for uo in user.outils
    ]
    
    return {
        "id": str(user.id),
        "email": user.email,
        "nom": user.nom,
        "prenom": user.prenom,
        "role_global": user.role_global,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat(),
        "domaines": domaines,
        "outils": outils
    }

@api_router.post("/auth/logout")
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    """Logout and clear cookies"""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out successfully"}

# ============== USERS ROUTES ==============

@api_router.get("/users")
async def get_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_encadrant_or_direction)
):
    """Get all users (Direction sees all, Encadrant sees users only)"""
    if current_user.role_global == "direction":
        result = await db.execute(select(User).order_by(User.created_at.desc()))
    else:
        # Encadrant can only see users
        result = await db.execute(
            select(User)
            .where(User.role_global == "user")
            .order_by(User.created_at.desc())
        )
    
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "nom": u.nom,
            "prenom": u.prenom,
            "role_global": u.role_global,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat()
        }
        for u in users
    ]

@api_router.post("/users")
async def create_user(
    user_data: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_encadrant_or_direction)
):
    """Create a new user"""
    email = user_data.email.lower()
    
    # Check email uniqueness
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Encadrant can only create users
    if current_user.role_global == "encadrant" and user_data.role_global != "user":
        raise HTTPException(status_code=403, detail="Encadrants can only create users")
    
    user = User(
        email=email,
        nom=user_data.nom,
        prenom=user_data.prenom,
        password_hash=hash_password(user_data.password),
        role_global=user_data.role_global
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    await log_action(db, "create_user", "user", str(user.id), current_user.id,
                     {"email": user.email, "role": user.role_global}, request.client.host if request.client else None)
    
    return {
        "id": str(user.id),
        "email": user.email,
        "nom": user.nom,
        "prenom": user.prenom,
        "role_global": user.role_global,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat()
    }

@api_router.put("/users/{user_id}")
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_encadrant_or_direction)
):
    """Update a user"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Encadrant cannot modify direction or other encadrants
    if current_user.role_global == "encadrant" and user.role_global in ["direction", "encadrant"]:
        raise HTTPException(status_code=403, detail="Cannot modify this user")
    
    update_data = user_data.model_dump(exclude_unset=True)
    
    if "email" in update_data:
        update_data["email"] = update_data["email"].lower()
        # Check email uniqueness
        existing = await db.execute(
            select(User).where(User.email == update_data["email"], User.id != user_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already exists")
    
    for key, value in update_data.items():
        setattr(user, key, value)
    
    await db.commit()
    await db.refresh(user)
    
    await log_action(db, "update_user", "user", str(user.id), current_user.id,
                     update_data, request.client.host if request.client else None)
    
    return {
        "id": str(user.id),
        "email": user.email,
        "nom": user.nom,
        "prenom": user.prenom,
        "role_global": user.role_global,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat()
    }

@api_router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_direction)
):
    """Delete a user (Direction only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    email = user.email
    await db.delete(user)
    await db.commit()
    
    await log_action(db, "delete_user", "user", str(user_id), current_user.id,
                     {"email": email}, request.client.host if request.client else None)
    
    return {"message": "User deleted successfully"}

# ============== DOMAINES ROUTES ==============

@api_router.get("/domaines")
async def get_domaines(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all domaines"""
    result = await db.execute(
        select(Domaine)
        .options(selectinload(Domaine.outils))
        .order_by(Domaine.created_at.desc())
    )
    domaines = result.scalars().all()
    
    return [
        {
            "id": str(d.id),
            "nom": d.nom,
            "description": d.description,
            "created_at": d.created_at.isoformat(),
            "outils": [
                {
                    "id": str(o.id),
                    "nom": o.nom,
                    "roles_disponibles": o.roles_disponibles
                }
                for o in d.outils
            ]
        }
        for d in domaines
    ]

@api_router.post("/domaines")
async def create_domaine(
    domaine_data: DomaineCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_direction)
):
    """Create a new domaine (Direction only)"""
    # Check name uniqueness
    result = await db.execute(select(Domaine).where(Domaine.nom == domaine_data.nom))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Domaine name already exists")
    
    domaine = Domaine(
        nom=domaine_data.nom,
        description=domaine_data.description
    )
    db.add(domaine)
    await db.commit()
    await db.refresh(domaine)
    
    await log_action(db, "create_domaine", "domaine", str(domaine.id), current_user.id,
                     {"nom": domaine.nom}, request.client.host if request.client else None)
    
    return {
        "id": str(domaine.id),
        "nom": domaine.nom,
        "description": domaine.description,
        "created_at": domaine.created_at.isoformat()
    }

@api_router.put("/domaines/{domaine_id}")
async def update_domaine(
    domaine_id: UUID,
    domaine_data: DomaineUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_direction)
):
    """Update a domaine"""
    result = await db.execute(select(Domaine).where(Domaine.id == domaine_id))
    domaine = result.scalar_one_or_none()
    
    if not domaine:
        raise HTTPException(status_code=404, detail="Domaine not found")
    
    update_data = domaine_data.model_dump(exclude_unset=True)
    
    if "nom" in update_data:
        existing = await db.execute(
            select(Domaine).where(Domaine.nom == update_data["nom"], Domaine.id != domaine_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Domaine name already exists")
    
    for key, value in update_data.items():
        setattr(domaine, key, value)
    
    await db.commit()
    await db.refresh(domaine)
    
    await log_action(db, "update_domaine", "domaine", str(domaine.id), current_user.id,
                     update_data, request.client.host if request.client else None)
    
    return {
        "id": str(domaine.id),
        "nom": domaine.nom,
        "description": domaine.description,
        "created_at": domaine.created_at.isoformat()
    }

@api_router.delete("/domaines/{domaine_id}")
async def delete_domaine(
    domaine_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_direction)
):
    """Delete a domaine"""
    result = await db.execute(select(Domaine).where(Domaine.id == domaine_id))
    domaine = result.scalar_one_or_none()
    
    if not domaine:
        raise HTTPException(status_code=404, detail="Domaine not found")
    
    nom = domaine.nom
    await db.delete(domaine)
    await db.commit()
    
    await log_action(db, "delete_domaine", "domaine", str(domaine_id), current_user.id,
                     {"nom": nom}, request.client.host if request.client else None)
    
    return {"message": "Domaine deleted successfully"}

@api_router.post("/domaines/{domaine_id}/assign")
async def assign_user_to_domaine(
    domaine_id: UUID,
    assignment: AssignUserToDomaine,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_encadrant_or_direction)
):
    """Assign a user to a domaine"""
    # Check domaine exists
    domaine_result = await db.execute(select(Domaine).where(Domaine.id == domaine_id))
    domaine = domaine_result.scalar_one_or_none()
    if not domaine:
        raise HTTPException(status_code=404, detail="Domaine not found")
    
    # Check user exists
    user_result = await db.execute(select(User).where(User.id == assignment.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already assigned
    existing = await db.execute(
        select(UserDomaine).where(
            UserDomaine.user_id == assignment.user_id,
            UserDomaine.domaine_id == domaine_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already assigned to this domaine")
    
    user_domaine = UserDomaine(
        user_id=assignment.user_id,
        domaine_id=domaine_id
    )
    db.add(user_domaine)
    await db.commit()
    
    await log_action(db, "assign_user_domaine", "user_domaine", f"{assignment.user_id}:{domaine_id}",
                     current_user.id, {"user_id": str(assignment.user_id), "domaine": domaine.nom},
                     request.client.host if request.client else None)
    
    return {"message": "User assigned to domaine successfully"}

@api_router.delete("/domaines/{domaine_id}/unassign/{user_id}")
async def unassign_user_from_domaine(
    domaine_id: UUID,
    user_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_encadrant_or_direction)
):
    """Remove a user from a domaine"""
    result = await db.execute(
        select(UserDomaine).where(
            UserDomaine.user_id == user_id,
            UserDomaine.domaine_id == domaine_id
        )
    )
    user_domaine = result.scalar_one_or_none()
    
    if not user_domaine:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    await db.delete(user_domaine)
    await db.commit()
    
    await log_action(db, "unassign_user_domaine", "user_domaine", f"{user_id}:{domaine_id}",
                     current_user.id, {"user_id": str(user_id), "domaine_id": str(domaine_id)},
                     request.client.host if request.client else None)
    
    return {"message": "User removed from domaine successfully"}

# ============== OUTILS ROUTES ==============

@api_router.get("/outils")
async def get_outils(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all outils"""
    result = await db.execute(
        select(Outil)
        .options(selectinload(Outil.domaine))
        .order_by(Outil.created_at.desc())
    )
    outils = result.scalars().all()
    
    return [
        {
            "id": str(o.id),
            "nom": o.nom,
            "domaine_id": str(o.domaine_id),
            "domaine_nom": o.domaine.nom if o.domaine else None,
            "roles_disponibles": o.roles_disponibles,
            "created_at": o.created_at.isoformat()
        }
        for o in outils
    ]

@api_router.post("/outils")
async def create_outil(
    outil_data: OutilCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_direction)
):
    """Create a new outil (Direction only)"""
    # Check domaine exists
    domaine_result = await db.execute(select(Domaine).where(Domaine.id == outil_data.domaine_id))
    domaine = domaine_result.scalar_one_or_none()
    if not domaine:
        raise HTTPException(status_code=404, detail="Domaine not found")
    
    outil = Outil(
        nom=outil_data.nom,
        domaine_id=outil_data.domaine_id,
        roles_disponibles=outil_data.roles_disponibles
    )
    db.add(outil)
    await db.commit()
    await db.refresh(outil)
    
    await log_action(db, "create_outil", "outil", str(outil.id), current_user.id,
                     {"nom": outil.nom, "domaine": domaine.nom}, request.client.host if request.client else None)
    
    return {
        "id": str(outil.id),
        "nom": outil.nom,
        "domaine_id": str(outil.domaine_id),
        "domaine_nom": domaine.nom,
        "roles_disponibles": outil.roles_disponibles,
        "created_at": outil.created_at.isoformat()
    }

@api_router.put("/outils/{outil_id}")
async def update_outil(
    outil_id: UUID,
    outil_data: OutilUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_direction)
):
    """Update an outil"""
    result = await db.execute(
        select(Outil)
        .options(selectinload(Outil.domaine))
        .where(Outil.id == outil_id)
    )
    outil = result.scalar_one_or_none()
    
    if not outil:
        raise HTTPException(status_code=404, detail="Outil not found")
    
    update_data = outil_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(outil, key, value)
    
    await db.commit()
    await db.refresh(outil)
    
    await log_action(db, "update_outil", "outil", str(outil.id), current_user.id,
                     update_data, request.client.host if request.client else None)
    
    return {
        "id": str(outil.id),
        "nom": outil.nom,
        "domaine_id": str(outil.domaine_id),
        "domaine_nom": outil.domaine.nom if outil.domaine else None,
        "roles_disponibles": outil.roles_disponibles,
        "created_at": outil.created_at.isoformat()
    }

@api_router.delete("/outils/{outil_id}")
async def delete_outil(
    outil_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_direction)
):
    """Delete an outil"""
    result = await db.execute(select(Outil).where(Outil.id == outil_id))
    outil = result.scalar_one_or_none()
    
    if not outil:
        raise HTTPException(status_code=404, detail="Outil not found")
    
    nom = outil.nom
    await db.delete(outil)
    await db.commit()
    
    await log_action(db, "delete_outil", "outil", str(outil_id), current_user.id,
                     {"nom": nom}, request.client.host if request.client else None)
    
    return {"message": "Outil deleted successfully"}

@api_router.post("/outils/{outil_id}/assign")
async def assign_user_to_outil(
    outil_id: UUID,
    assignment: AssignUserToOutil,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_encadrant_or_direction)
):
    """Assign a user to an outil with a specific role"""
    # Check outil exists
    outil_result = await db.execute(select(Outil).where(Outil.id == outil_id))
    outil = outil_result.scalar_one_or_none()
    if not outil:
        raise HTTPException(status_code=404, detail="Outil not found")
    
    # Check user exists
    user_result = await db.execute(select(User).where(User.id == assignment.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if role is valid for this outil
    if assignment.role not in outil.roles_disponibles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Available roles: {', '.join(outil.roles_disponibles)}")
    
    # Check if already assigned
    existing = await db.execute(
        select(UserOutil).where(
            UserOutil.user_id == assignment.user_id,
            UserOutil.outil_id == outil_id
        )
    )
    existing_assignment = existing.scalar_one_or_none()
    
    if existing_assignment:
        # Update existing role
        existing_assignment.role = assignment.role
        await db.commit()
        action = "update_user_outil_role"
    else:
        # Create new assignment
        user_outil = UserOutil(
            user_id=assignment.user_id,
            outil_id=outil_id,
            role=assignment.role
        )
        db.add(user_outil)
        await db.commit()
        action = "assign_user_outil"
    
    await log_action(db, action, "user_outil", f"{assignment.user_id}:{outil_id}",
                     current_user.id, {"user_id": str(assignment.user_id), "outil": outil.nom, "role": assignment.role},
                     request.client.host if request.client else None)
    
    return {"message": "User assigned to outil successfully", "role": assignment.role}

@api_router.delete("/outils/{outil_id}/unassign/{user_id}")
async def unassign_user_from_outil(
    outil_id: UUID,
    user_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_encadrant_or_direction)
):
    """Remove a user from an outil"""
    result = await db.execute(
        select(UserOutil).where(
            UserOutil.user_id == user_id,
            UserOutil.outil_id == outil_id
        )
    )
    user_outil = result.scalar_one_or_none()
    
    if not user_outil:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    await db.delete(user_outil)
    await db.commit()
    
    await log_action(db, "unassign_user_outil", "user_outil", f"{user_id}:{outil_id}",
                     current_user.id, {"user_id": str(user_id), "outil_id": str(outil_id)},
                     request.client.host if request.client else None)
    
    return {"message": "User removed from outil successfully"}

# ============== AUDIT LOGS ROUTES ==============

@api_router.get("/audit-logs")
async def get_audit_logs(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_direction)
):
    """Get audit logs (Direction only)"""
    result = await db.execute(
        select(AuditLog)
        .options(selectinload(AuditLog.user))
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    
    return [
        {
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "details": log.details,
            "ip_address": log.ip_address,
            "timestamp": log.timestamp.isoformat(),
            "user_email": log.user.email if log.user else None,
            "user_nom": f"{log.user.prenom} {log.user.nom}" if log.user else None
        }
        for log in logs
    ]

# ============== DASHBOARD STATS ==============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get dashboard statistics"""
    users_count = await db.execute(select(func.count()).select_from(User))
    domaines_count = await db.execute(select(func.count()).select_from(Domaine))
    outils_count = await db.execute(select(func.count()).select_from(Outil))
    documents_count = await db.execute(select(func.count()).select_from(Document))
    
    # Recent activity
    recent_logs = await db.execute(
        select(AuditLog)
        .options(selectinload(AuditLog.user))
        .order_by(AuditLog.timestamp.desc())
        .limit(5)
    )
    logs = recent_logs.scalars().all()
    
    return {
        "total_users": users_count.scalar(),
        "total_domaines": domaines_count.scalar(),
        "total_outils": outils_count.scalar(),
        "total_documents": documents_count.scalar(),
        "recent_activity": [
            {
                "id": str(log.id),
                "action": log.action,
                "entity_type": log.entity_type,
                "timestamp": log.timestamp.isoformat(),
                "user_nom": f"{log.user.prenom} {log.user.nom}" if log.user else "System"
            }
            for log in logs
        ]
    }

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "BTP Manager API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get('FRONTEND_URL', 'http://localhost:3000')],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def startup():
    logger.info("Starting BTP Manager API...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created")
    
    # Seed admin user
    from database import async_session_maker
    async with async_session_maker() as db:
        admin_email = os.environ.get("ADMIN_EMAIL", "superdadmin@gmail.com").lower()
        admin_password = os.environ.get("ADMIN_PASSWORD", "Superadmin123!")
        
        result = await db.execute(select(User).where(User.email == admin_email))
        existing = result.scalar_one_or_none()
        
        if not existing:
            admin = User(
                email=admin_email,
                nom="Admin",
                prenom="Super",
                password_hash=hash_password(admin_password),
                role_global="direction"
            )
            db.add(admin)
            await db.commit()
            logger.info(f"Admin user created: {admin_email}")
            
            # Create test domain
            test_domaine = Domaine(
                nom="Test",
                description="Domaine de test"
            )
            db.add(test_domaine)
            await db.commit()
            logger.info("Test domaine created")
        else:
            # Update password if changed
            if not verify_password(admin_password, existing.password_hash):
                existing.password_hash = hash_password(admin_password)
                await db.commit()
                logger.info("Admin password updated")
    
    # Write test credentials (os already imported at top level)
    os_module = __import__('os')
    os_module.makedirs("/app/memory", exist_ok=True)
    admin_email_for_file = os.environ.get('ADMIN_EMAIL', 'superdadmin@gmail.com')
    admin_password_for_file = os.environ.get('ADMIN_PASSWORD', 'Superadmin123!')
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write("# Test Credentials\n\n")
        f.write("## Admin (Direction)\n")
        f.write(f"- Email: {admin_email_for_file}\n")
        f.write(f"- Password: {admin_password_for_file}\n")
        f.write("- Role: direction\n\n")
        f.write("## Auth Endpoints\n")
        f.write("- POST /api/auth/login\n")
        f.write("- POST /api/auth/register\n")
        f.write("- GET /api/auth/me\n")
        f.write("- POST /api/auth/logout\n")

@app.on_event("shutdown")
async def shutdown():
    await engine.dispose()
    logger.info("Database connection closed")
