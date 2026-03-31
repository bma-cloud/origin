from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from datetime import datetime, timezone
from uuid import uuid4

from database import (
    init_indexes, users_col, domaines_col, outils_col,
    user_domaines_col, user_outils_col, audit_logs_col,
    documents_col, chat_messages_col
)
from auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    get_current_user, require_direction, require_encadrant_or_direction
)
from audit import log_action

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="BTP Manager API")
api_router = APIRouter(prefix="/api")

NO_ID = {"_id": 0}

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register")
async def register(request: Request, response: Response):
    body = await request.json()
    email = body.get("email", "").lower().strip()
    nom = body.get("nom", "").strip()
    prenom = body.get("prenom", "").strip()
    password = body.get("password", "")

    if not email or not nom or not prenom or len(password) < 6:
        raise HTTPException(status_code=400, detail="Invalid input")

    if await users_col.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    user_count = await users_col.count_documents({})
    role = "direction" if user_count == 0 else "user"

    user = {
        "id": str(uuid4()),
        "email": email,
        "nom": nom,
        "prenom": prenom,
        "password_hash": hash_password(password),
        "role_global": role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await users_col.insert_one(user)

    access_token = create_access_token(user["id"], email, role)
    refresh_token = create_refresh_token(user["id"])
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

    await log_action("register", "user", user["id"], user["id"], {"email": email, "role": role}, request.client.host if request.client else None)

    return {k: user[k] for k in ("id", "email", "nom", "prenom", "role_global", "is_active", "created_at")}

@api_router.post("/auth/login")
async def login(request: Request, response: Response):
    body = await request.json()
    email = body.get("email", "").lower().strip()
    password = body.get("password", "")

    user = await users_col.find_one({"email": email}, NO_ID)
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="User account is inactive")

    access_token = create_access_token(user["id"], email, user["role_global"])
    refresh_token = create_refresh_token(user["id"])
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

    await log_action("login", "user", user["id"], user["id"], {"email": email}, request.client.host if request.client else None)

    return {
        "id": user["id"], "email": user["email"], "nom": user["nom"],
        "prenom": user["prenom"], "role_global": user["role_global"],
        "is_active": user["is_active"], "access_token": access_token, "token_type": "bearer"
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    domaines_links = await user_domaines_col.find({"user_id": uid}, NO_ID).to_list(100)
    outils_links = await user_outils_col.find({"user_id": uid}, NO_ID).to_list(100)

    domaines = []
    for link in domaines_links:
        d = await domaines_col.find_one({"id": link["domaine_id"]}, NO_ID)
        domaines.append({"domaine_id": link["domaine_id"], "domaine_nom": d["nom"] if d else None})

    outils = []
    for link in outils_links:
        o = await outils_col.find_one({"id": link["outil_id"]}, NO_ID)
        outils.append({"outil_id": link["outil_id"], "outil_nom": o["nom"] if o else None, "role": link["role"]})

    return {
        "id": uid, "email": current_user["email"], "nom": current_user["nom"],
        "prenom": current_user["prenom"], "role_global": current_user["role_global"],
        "is_active": current_user["is_active"], "created_at": current_user["created_at"],
        "domaines": domaines, "outils": outils
    }

@api_router.post("/auth/logout")
async def logout(response: Response, current_user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out successfully"}

# ============== USERS ROUTES ==============

@api_router.get("/users")
async def get_users(current_user: dict = Depends(require_encadrant_or_direction)):
    query = {} if current_user["role_global"] == "direction" else {"role_global": "user"}
    users = await users_col.find(query, NO_ID).sort("created_at", -1).to_list(500)
    return [{k: u[k] for k in ("id", "email", "nom", "prenom", "role_global", "is_active", "created_at")} for u in users]

@api_router.post("/users")
async def create_user(request: Request, current_user: dict = Depends(require_encadrant_or_direction)):
    body = await request.json()
    email = body.get("email", "").lower().strip()
    role_global = body.get("role_global", "user")

    if not email or not body.get("nom") or not body.get("prenom") or len(body.get("password", "")) < 6:
        raise HTTPException(status_code=400, detail="Invalid input")

    if await users_col.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")

    if current_user["role_global"] == "encadrant" and role_global != "user":
        raise HTTPException(status_code=403, detail="Encadrants can only create users")

    user = {
        "id": str(uuid4()), "email": email, "nom": body["nom"], "prenom": body["prenom"],
        "password_hash": hash_password(body["password"]), "role_global": role_global,
        "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()
    }
    await users_col.insert_one(user)
    await log_action("create_user", "user", user["id"], current_user["id"], {"email": email, "role": role_global}, request.client.host if request.client else None)
    return {k: user[k] for k in ("id", "email", "nom", "prenom", "role_global", "is_active", "created_at")}

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, request: Request, current_user: dict = Depends(require_encadrant_or_direction)):
    user = await users_col.find_one({"id": user_id}, NO_ID)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user["role_global"] == "encadrant" and user["role_global"] in ["direction", "encadrant"]:
        raise HTTPException(status_code=403, detail="Cannot modify this user")

    body = await request.json()
    update = {}
    for key in ("email", "nom", "prenom", "role_global", "is_active"):
        if key in body and body[key] is not None:
            update[key] = body[key]

    if "email" in update:
        update["email"] = update["email"].lower().strip()
        if await users_col.find_one({"email": update["email"], "id": {"$ne": user_id}}):
            raise HTTPException(status_code=400, detail="Email already exists")

    if update:
        await users_col.update_one({"id": user_id}, {"$set": update})

    await log_action("update_user", "user", user_id, current_user["id"], update, request.client.host if request.client else None)
    updated = await users_col.find_one({"id": user_id}, NO_ID)
    return {k: updated[k] for k in ("id", "email", "nom", "prenom", "role_global", "is_active", "created_at")}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request, current_user: dict = Depends(require_direction)):
    user = await users_col.find_one({"id": user_id}, NO_ID)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    await users_col.delete_one({"id": user_id})
    await user_domaines_col.delete_many({"user_id": user_id})
    await user_outils_col.delete_many({"user_id": user_id})
    await log_action("delete_user", "user", user_id, current_user["id"], {"email": user["email"]}, request.client.host if request.client else None)
    return {"message": "User deleted successfully"}

# ============== DOMAINES (POLES) ROUTES ==============

@api_router.get("/domaines")
async def get_domaines(current_user: dict = Depends(get_current_user)):
    domaines = await domaines_col.find({}, NO_ID).sort("created_at", -1).to_list(500)
    result = []
    for d in domaines:
        outils = await outils_col.find({"domaine_id": d["id"]}, NO_ID).to_list(100)
        result.append({
            "id": d["id"], "nom": d["nom"], "description": d.get("description"),
            "created_at": d["created_at"],
            "outils": [{"id": o["id"], "nom": o["nom"], "roles_disponibles": o.get("roles_disponibles", [])} for o in outils]
        })
    return result

@api_router.post("/domaines")
async def create_domaine(request: Request, current_user: dict = Depends(require_direction)):
    body = await request.json()
    nom = body.get("nom", "").strip()
    if not nom:
        raise HTTPException(status_code=400, detail="Nom is required")

    if await domaines_col.find_one({"nom": nom}):
        raise HTTPException(status_code=400, detail="Domaine name already exists")

    domaine = {
        "id": str(uuid4()), "nom": nom, "description": body.get("description"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await domaines_col.insert_one(domaine)
    await log_action("create_domaine", "domaine", domaine["id"], current_user["id"], {"nom": nom}, request.client.host if request.client else None)
    return {"id": domaine["id"], "nom": domaine["nom"], "description": domaine.get("description"), "created_at": domaine["created_at"]}

@api_router.put("/domaines/{domaine_id}")
async def update_domaine(domaine_id: str, request: Request, current_user: dict = Depends(require_direction)):
    domaine = await domaines_col.find_one({"id": domaine_id}, NO_ID)
    if not domaine:
        raise HTTPException(status_code=404, detail="Domaine not found")

    body = await request.json()
    update = {}
    if "nom" in body and body["nom"]:
        if await domaines_col.find_one({"nom": body["nom"], "id": {"$ne": domaine_id}}):
            raise HTTPException(status_code=400, detail="Domaine name already exists")
        update["nom"] = body["nom"]
    if "description" in body:
        update["description"] = body["description"]

    if update:
        await domaines_col.update_one({"id": domaine_id}, {"$set": update})

    await log_action("update_domaine", "domaine", domaine_id, current_user["id"], update, request.client.host if request.client else None)
    updated = await domaines_col.find_one({"id": domaine_id}, NO_ID)
    return {"id": updated["id"], "nom": updated["nom"], "description": updated.get("description"), "created_at": updated["created_at"]}

@api_router.delete("/domaines/{domaine_id}")
async def delete_domaine(domaine_id: str, request: Request, current_user: dict = Depends(require_direction)):
    domaine = await domaines_col.find_one({"id": domaine_id}, NO_ID)
    if not domaine:
        raise HTTPException(status_code=404, detail="Domaine not found")

    # Delete related outils and assignments
    outils = await outils_col.find({"domaine_id": domaine_id}, {"id": 1, "_id": 0}).to_list(100)
    for o in outils:
        await user_outils_col.delete_many({"outil_id": o["id"]})
    await outils_col.delete_many({"domaine_id": domaine_id})
    await user_domaines_col.delete_many({"domaine_id": domaine_id})
    await domaines_col.delete_one({"id": domaine_id})

    await log_action("delete_domaine", "domaine", domaine_id, current_user["id"], {"nom": domaine["nom"]}, request.client.host if request.client else None)
    return {"message": "Domaine deleted successfully"}

@api_router.post("/domaines/{domaine_id}/assign")
async def assign_user_to_domaine(domaine_id: str, request: Request, current_user: dict = Depends(require_encadrant_or_direction)):
    body = await request.json()
    user_id = body.get("user_id")

    domaine = await domaines_col.find_one({"id": domaine_id}, NO_ID)
    if not domaine:
        raise HTTPException(status_code=404, detail="Domaine not found")

    user = await users_col.find_one({"id": user_id}, NO_ID)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if await user_domaines_col.find_one({"user_id": user_id, "domaine_id": domaine_id}):
        raise HTTPException(status_code=400, detail="User already assigned to this domaine")

    await user_domaines_col.insert_one({
        "user_id": user_id, "domaine_id": domaine_id,
        "assigned_at": datetime.now(timezone.utc).isoformat()
    })

    # Auto-assign user to ALL tools in this domaine
    tools_assigned = []
    outils = await outils_col.find({"domaine_id": domaine_id}, NO_ID).to_list(100)
    for outil in outils:
        if not await user_outils_col.find_one({"user_id": user_id, "outil_id": outil["id"]}):
            role_names = [r.get("name") if isinstance(r, dict) else r for r in (outil.get("roles_disponibles") or [])]
            role = "conduc" if "conduc" in role_names else (role_names[0] if role_names else "viewer")
            await user_outils_col.insert_one({
                "user_id": user_id, "outil_id": outil["id"], "role": role,
                "assigned_at": datetime.now(timezone.utc).isoformat()
            })
            tools_assigned.append({"outil": outil["nom"], "role": role})

    await log_action("assign_user_domaine", "user_domaine", f"{user_id}:{domaine_id}", current_user["id"],
                     {"user_id": user_id, "domaine": domaine["nom"], "auto_tools_assigned": tools_assigned},
                     request.client.host if request.client else None)
    return {"message": "User assigned to domaine successfully", "auto_tools_assigned": tools_assigned or None}

@api_router.delete("/domaines/{domaine_id}/unassign/{user_id}")
async def unassign_user_from_domaine(domaine_id: str, user_id: str, request: Request, current_user: dict = Depends(require_encadrant_or_direction)):
    result = await user_domaines_col.delete_one({"user_id": user_id, "domaine_id": domaine_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")

    await log_action("unassign_user_domaine", "user_domaine", f"{user_id}:{domaine_id}", current_user["id"],
                     {"user_id": user_id, "domaine_id": domaine_id}, request.client.host if request.client else None)
    return {"message": "User removed from domaine successfully"}

@api_router.get("/domaines/{domaine_id}/users")
async def get_domaine_users(domaine_id: str, current_user: dict = Depends(require_encadrant_or_direction)):
    domaine = await domaines_col.find_one({"id": domaine_id}, NO_ID)
    if not domaine:
        raise HTTPException(status_code=404, detail="Domaine not found")

    links = await user_domaines_col.find({"domaine_id": domaine_id}, NO_ID).to_list(500)
    result = []
    for link in links:
        u = await users_col.find_one({"id": link["user_id"]}, NO_ID)
        if u:
            result.append({
                "user_id": u["id"], "email": u["email"], "nom": u["nom"],
                "prenom": u["prenom"], "role_global": u["role_global"],
                "assigned_at": link.get("assigned_at")
            })
    return result

# ============== OUTILS ROUTES ==============

@api_router.get("/outils")
async def get_outils(current_user: dict = Depends(get_current_user)):
    outils = await outils_col.find({}, NO_ID).sort("created_at", -1).to_list(500)
    result = []
    for o in outils:
        d = await domaines_col.find_one({"id": o["domaine_id"]}, NO_ID)
        result.append({
            "id": o["id"], "nom": o["nom"], "domaine_id": o["domaine_id"],
            "domaine_nom": d["nom"] if d else None,
            "roles_disponibles": o.get("roles_disponibles", []),
            "created_at": o["created_at"]
        })
    return result

@api_router.post("/outils")
async def create_outil(request: Request, current_user: dict = Depends(require_direction)):
    body = await request.json()
    nom = body.get("nom", "").strip()
    domaine_id = body.get("domaine_id")
    roles_disponibles = body.get("roles_disponibles", [{"name": "viewer", "permissions": ["read"], "description": "Consultation uniquement"}])

    if not nom or not domaine_id:
        raise HTTPException(status_code=400, detail="Nom and domaine_id are required")

    domaine = await domaines_col.find_one({"id": domaine_id}, NO_ID)
    if not domaine:
        raise HTTPException(status_code=404, detail="Domaine not found")

    outil = {
        "id": str(uuid4()), "nom": nom, "domaine_id": domaine_id,
        "roles_disponibles": roles_disponibles,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await outils_col.insert_one(outil)
    await log_action("create_outil", "outil", outil["id"], current_user["id"],
                     {"nom": nom, "domaine": domaine["nom"]}, request.client.host if request.client else None)
    return {
        "id": outil["id"], "nom": outil["nom"], "domaine_id": domaine_id,
        "domaine_nom": domaine["nom"], "roles_disponibles": roles_disponibles,
        "created_at": outil["created_at"]
    }

@api_router.put("/outils/{outil_id}")
async def update_outil(outil_id: str, request: Request, current_user: dict = Depends(require_direction)):
    outil = await outils_col.find_one({"id": outil_id}, NO_ID)
    if not outil:
        raise HTTPException(status_code=404, detail="Outil not found")

    body = await request.json()
    update = {}
    if "nom" in body and body["nom"]:
        update["nom"] = body["nom"]
    if "roles_disponibles" in body:
        update["roles_disponibles"] = body["roles_disponibles"]

    if update:
        await outils_col.update_one({"id": outil_id}, {"$set": update})

    await log_action("update_outil", "outil", outil_id, current_user["id"], update, request.client.host if request.client else None)
    updated = await outils_col.find_one({"id": outil_id}, NO_ID)
    d = await domaines_col.find_one({"id": updated["domaine_id"]}, NO_ID)
    return {
        "id": updated["id"], "nom": updated["nom"], "domaine_id": updated["domaine_id"],
        "domaine_nom": d["nom"] if d else None, "roles_disponibles": updated.get("roles_disponibles", []),
        "created_at": updated["created_at"]
    }

@api_router.delete("/outils/{outil_id}")
async def delete_outil(outil_id: str, request: Request, current_user: dict = Depends(require_direction)):
    outil = await outils_col.find_one({"id": outil_id}, NO_ID)
    if not outil:
        raise HTTPException(status_code=404, detail="Outil not found")

    await user_outils_col.delete_many({"outil_id": outil_id})
    await outils_col.delete_one({"id": outil_id})
    await log_action("delete_outil", "outil", outil_id, current_user["id"], {"nom": outil["nom"]}, request.client.host if request.client else None)
    return {"message": "Outil deleted successfully"}

@api_router.get("/outils/{outil_id}/users")
async def get_outil_users(outil_id: str, current_user: dict = Depends(require_encadrant_or_direction)):
    outil = await outils_col.find_one({"id": outil_id}, NO_ID)
    if not outil:
        raise HTTPException(status_code=404, detail="Outil not found")

    if current_user["role_global"] == "encadrant":
        user_domaines = await user_domaines_col.find({"user_id": current_user["id"]}, NO_ID).to_list(100)
        user_domaine_ids = [ud["domaine_id"] for ud in user_domaines]
        if outil["domaine_id"] not in user_domaine_ids:
            raise HTTPException(status_code=403, detail="Access denied to this outil's users")

    links = await user_outils_col.find({"outil_id": outil_id}, NO_ID).to_list(500)
    result = []
    for link in links:
        u = await users_col.find_one({"id": link["user_id"]}, NO_ID)
        if u:
            result.append({
                "user_id": u["id"], "email": u["email"], "nom": u["nom"],
                "prenom": u["prenom"], "role_global": u["role_global"],
                "outil_role": link["role"], "assigned_at": link.get("assigned_at")
            })
    return result

@api_router.post("/outils/{outil_id}/assign")
async def assign_user_to_outil(outil_id: str, request: Request, current_user: dict = Depends(require_encadrant_or_direction)):
    body = await request.json()
    user_id = body.get("user_id")
    role = body.get("role", "viewer")

    outil = await outils_col.find_one({"id": outil_id}, NO_ID)
    if not outil:
        raise HTTPException(status_code=404, detail="Outil not found")

    user = await users_col.find_one({"id": user_id}, NO_ID)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    valid_roles = [r.get("name") if isinstance(r, dict) else r for r in (outil.get("roles_disponibles") or [])]
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Available roles: {', '.join(valid_roles)}")

    existing = await user_outils_col.find_one({"user_id": user_id, "outil_id": outil_id})
    if existing:
        await user_outils_col.update_one({"user_id": user_id, "outil_id": outil_id}, {"$set": {"role": role}})
        action = "update_user_outil_role"
    else:
        await user_outils_col.insert_one({
            "user_id": user_id, "outil_id": outil_id, "role": role,
            "assigned_at": datetime.now(timezone.utc).isoformat()
        })
        action = "assign_user_outil"

    await log_action(action, "user_outil", f"{user_id}:{outil_id}", current_user["id"],
                     {"user_id": user_id, "outil": outil["nom"], "role": role}, request.client.host if request.client else None)
    return {"message": "User assigned to outil successfully", "role": role}

@api_router.delete("/outils/{outil_id}/unassign/{user_id}")
async def unassign_user_from_outil(outil_id: str, user_id: str, request: Request, current_user: dict = Depends(require_encadrant_or_direction)):
    result = await user_outils_col.delete_one({"user_id": user_id, "outil_id": outil_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")

    await log_action("unassign_user_outil", "user_outil", f"{user_id}:{outil_id}", current_user["id"],
                     {"user_id": user_id, "outil_id": outil_id}, request.client.host if request.client else None)
    return {"message": "User removed from outil successfully"}

# ============== AUDIT LOGS ROUTES ==============

@api_router.get("/audit-logs")
async def get_audit_logs(limit: int = 100, current_user: dict = Depends(require_direction)):
    logs = await audit_logs_col.find({}, NO_ID).sort("timestamp", -1).limit(limit).to_list(limit)
    result = []
    for log in logs:
        u = await users_col.find_one({"id": log.get("user_id")}, NO_ID) if log.get("user_id") else None
        result.append({
            "id": log["id"], "user_id": log.get("user_id"), "action": log["action"],
            "entity_type": log["entity_type"], "entity_id": log.get("entity_id"),
            "details": log.get("details", {}), "ip_address": log.get("ip_address"),
            "timestamp": log["timestamp"],
            "user_email": u["email"] if u else None,
            "user_nom": f"{u['prenom']} {u['nom']}" if u else None
        })
    return result

# ============== DASHBOARD STATS ==============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    users_count = await users_col.count_documents({})
    domaines_count = await domaines_col.count_documents({})
    outils_count = await outils_col.count_documents({})
    documents_count = await documents_col.count_documents({})

    logs = await audit_logs_col.find({}, NO_ID).sort("timestamp", -1).limit(5).to_list(5)
    recent = []
    for log in logs:
        u = await users_col.find_one({"id": log.get("user_id")}, NO_ID) if log.get("user_id") else None
        recent.append({
            "id": log["id"], "action": log["action"], "entity_type": log["entity_type"],
            "timestamp": log["timestamp"],
            "user_nom": f"{u['prenom']} {u['nom']}" if u else "System"
        })

    return {
        "total_users": users_count, "total_domaines": domaines_count,
        "total_outils": outils_count, "total_documents": documents_count,
        "recent_activity": recent
    }

# ============== AI CHAT ROUTES ==============

@api_router.post("/ai/chat")
async def ai_chat(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    message = body.get("message", "").strip()
    session_id = body.get("session_id", current_user["id"])

    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    users_count = await users_col.count_documents({})
    domaines_count = await domaines_col.count_documents({})
    outils_count = await outils_col.count_documents({})

    domaines_list = await domaines_col.find({}, NO_ID).sort("nom", 1).to_list(100)
    domaines_info = []
    for d in domaines_list:
        outils = await outils_col.find({"domaine_id": d["id"]}, NO_ID).to_list(50)
        outils_lines = []
        for o in outils:
            rn = [r.get("name") if isinstance(r, dict) else r for r in (o.get("roles_disponibles") or [])]
            outils_lines.append(f"  - {o['nom']} (roles: {', '.join(rn)})")
        domaines_info.append(f"- {d['nom']}: {d.get('description') or 'Pas de description'}\n" + "\n".join(outils_lines))

    users_list = await users_col.find({}, NO_ID).sort("created_at", -1).to_list(100)
    users_summary = [f"- {u['prenom']} {u['nom']} ({u['email']}) - Role: {u['role_global']} - Actif: {u.get('is_active', True)}" for u in users_list]

    logs = await audit_logs_col.find({}, NO_ID).sort("timestamp", -1).limit(10).to_list(10)
    logs_info = []
    for log in logs:
        u = await users_col.find_one({"id": log.get("user_id")}, NO_ID) if log.get("user_id") else None
        name = f"{u['prenom']} {u['nom']}" if u else "Systeme"
        logs_info.append(f"- {log['action']} par {name} ({log['timestamp'][:16]})")

    platform_context = f"""DONNEES ACTUELLES DE LA PLATEFORME:
- {users_count} utilisateurs, {domaines_count} poles, {outils_count} outils

POLES ET OUTILS:
{chr(10).join(domaines_info) if domaines_info else "Aucun pole cree"}

UTILISATEURS:
{chr(10).join(users_summary)}

ACTIVITE RECENTE:
{chr(10).join(logs_info) if logs_info else "Aucune activite"}

CONTEXTE UTILISATEUR ACTUEL:
- Nom: {current_user['prenom']} {current_user['nom']}
- Role: {current_user['role_global']}
"""

    system_message = f"""Tu es l'assistant IA de BTP Manager, une plateforme de gestion de chantier BTP.

COMMENT FONCTIONNE LA PLATEFORME:
- La plateforme organise le travail en Poles (groupes de travail) et Outils (applications/modules).
- Il y a 3 niveaux d'acces: Direction (admin total), Encadrant (gestion limitee), User (acces outils).
- Quand un utilisateur est assigne a un Pole, il obtient automatiquement acces a TOUS les outils de ce pole.
- Chaque outil a des roles specifiques avec des permissions differentes.
- Les permissions possibles sont: lecture, ecriture, suppression, validation, gestion equipe, export, admin.
- La Direction peut tout faire: creer des poles, outils, utilisateurs, assigner des roles.
- Les Encadrants peuvent creer des Users et assigner des roles dans leurs poles.
- Les Users peuvent uniquement utiliser les outils auxquels ils sont assignes.
- Un audit log trace toutes les actions sur la plateforme.

{platform_context}

Reponds toujours en francais. Sois concis mais precis."""

    history = await chat_messages_col.find({"session_id": session_id}).sort("created_at", -1).limit(20).to_list(20)
    history = list(reversed(history))

    from emergentintegrations.llm.chat import LlmChat, UserMessage

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI not configured")

    chat = LlmChat(
        api_key=api_key, session_id=f"btp-{session_id}",
        system_message=system_message
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    for msg in history:
        if msg.get("role") == "user":
            await chat.send_message(UserMessage(text=msg["content"]))

    response_text = await chat.send_message(UserMessage(text=message))

    now = datetime.now(timezone.utc).isoformat()
    await chat_messages_col.insert_one({"user_id": current_user["id"], "session_id": session_id, "role": "user", "content": message, "created_at": now})
    await chat_messages_col.insert_one({"user_id": current_user["id"], "session_id": session_id, "role": "assistant", "content": response_text, "created_at": now})

    return {"response": response_text, "session_id": session_id}

@api_router.get("/ai/history")
async def get_ai_history(session_id: str = None, current_user: dict = Depends(get_current_user)):
    sid = session_id or current_user["id"]
    messages = await chat_messages_col.find(
        {"session_id": sid, "user_id": current_user["id"]}, NO_ID
    ).sort("created_at", 1).limit(50).to_list(50)
    return [{"role": m["role"], "content": m["content"], "created_at": m["created_at"]} for m in messages]

@api_router.delete("/ai/history")
async def clear_ai_history(current_user: dict = Depends(get_current_user)):
    await chat_messages_col.delete_many({"user_id": current_user["id"]})
    return {"message": "Chat history cleared"}

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

@app.on_event("startup")
async def startup():
    logger.info("Starting BTP Manager API (MongoDB)...")
    await init_indexes()
    logger.info("MongoDB indexes created")

    admin_email = os.environ.get("ADMIN_EMAIL", "superdadmin@gmail.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Superadmin123!")

    existing = await users_col.find_one({"email": admin_email})
    if not existing:
        admin = {
            "id": str(uuid4()), "email": admin_email, "nom": "Admin", "prenom": "Super",
            "password_hash": hash_password(admin_password), "role_global": "direction",
            "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()
        }
        await users_col.insert_one(admin)
        logger.info(f"Admin user created: {admin_email}")
    else:
        if not verify_password(admin_password, existing["password_hash"]):
            await users_col.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
            logger.info("Admin password updated")

    logger.info("BTP Manager API ready")
