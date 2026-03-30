from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# Auth Schemas
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    email: EmailStr
    nom: str = Field(min_length=1, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=6)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    nom: str
    prenom: str

class UserCreate(BaseModel):
    email: EmailStr
    nom: str = Field(min_length=1, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=6)
    role_global: str = Field(default="user")

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    nom: Optional[str] = None
    prenom: Optional[str] = None
    role_global: Optional[str] = None
    is_active: Optional[bool] = None

class UserDomaineInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    domaine_id: UUID
    domaine_nom: Optional[str] = None

class UserOutilInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    outil_id: UUID
    outil_nom: Optional[str] = None
    role: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: str
    nom: str
    prenom: str
    role_global: str
    is_active: bool
    created_at: datetime
    domaines: List[UserDomaineInfo] = []
    outils: List[UserOutilInfo] = []

class UserSimpleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: str
    nom: str
    prenom: str
    role_global: str
    is_active: bool
    created_at: datetime

# Domaine Schemas
class DomaineCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None

class DomaineUpdate(BaseModel):
    nom: Optional[str] = None
    description: Optional[str] = None

class DomaineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    nom: str
    description: Optional[str]
    created_at: datetime

class DomaineWithOutils(DomaineResponse):
    outils: List["OutilSimpleResponse"] = []

# Outil Schemas
class OutilCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    domaine_id: UUID
    roles_disponibles: List[str] = Field(default=["viewer"])

class OutilUpdate(BaseModel):
    nom: Optional[str] = None
    roles_disponibles: Optional[List[str]] = None

class OutilSimpleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    nom: str
    domaine_id: UUID
    roles_disponibles: List[str]
    created_at: datetime

class OutilResponse(OutilSimpleResponse):
    domaine_nom: Optional[str] = None

# Assignment Schemas
class AssignUserToDomaine(BaseModel):
    user_id: UUID

class AssignUserToOutil(BaseModel):
    user_id: UUID
    role: str = "viewer"

# Audit Log Schemas
class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: Optional[UUID]
    action: str
    entity_type: str
    entity_id: Optional[str]
    details: dict
    ip_address: Optional[str]
    timestamp: datetime
    user_email: Optional[str] = None
    user_nom: Optional[str] = None

# Document Schemas
class DocumentCreate(BaseModel):
    outil_id: Optional[UUID] = None
    url: str
    filename: str
    file_type: Optional[str] = None

class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    outil_id: Optional[UUID]
    url: str
    filename: str
    file_type: Optional[str]
    created_at: datetime

# Stats
class DashboardStats(BaseModel):
    total_users: int
    total_domaines: int
    total_outils: int
    total_documents: int
    recent_activity: List[AuditLogResponse]

DomaineWithOutils.model_rebuild()
