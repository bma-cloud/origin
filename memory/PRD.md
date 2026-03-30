# BTP Manager - Product Requirements Document

## Overview
Application web professionnelle de gestion de chantier (BTP) avec système d'authentification hiérarchique, gestion des domaines et outils, et audit logging.

## Original Problem Statement
Créer une application web avec :
- Système d'authentification hiérarchique JWT (Direction, Encadrant, User)
- Gestion avancée des rôles par outil
- Architecture modulaire (domaines → outils)
- Design premium Aura (dark UI minimaliste)
- PostgreSQL database
- AWS S3 pour le stockage (différé)

## User Personas
1. **Direction (Super Admin)** - Accès total, gestion de tous les utilisateurs, domaines, outils et audit logs
2. **Encadrant** - Accès limité aux domaines assignés, peut créer des Users
3. **User** - Accès uniquement aux outils assignés

## Core Requirements (Static)
- [x] JWT Authentication (24h expiry)
- [x] Bcrypt password hashing
- [x] Role-based access control (Direction/Encadrant/User)
- [x] Audit logging for all actions
- [x] PostgreSQL database
- [ ] AWS S3 file storage (DEFERRED)

## What's Been Implemented (March 30, 2026)

### Backend
- FastAPI server with SQLAlchemy async + asyncpg
- PostgreSQL database with all tables (users, domaines, outils, user_domaines, user_outils, audit_logs, documents)
- Complete CRUD APIs for all entities
- JWT authentication with 24h token expiry
- Role-based middleware and access control
- Audit logging for all actions
- Auto-seed first user as Direction

### Frontend
- React 19 with Tailwind CSS
- Aura dark UI design (glassmorphism, #FF3B30 accent)
- AuthContext for JWT management
- Protected routes with role-based access
- Complete pages: Login, Register, Dashboard, Users, Domaines, Outils, Audit Logs
- Responsive sidebar navigation
- All CRUD operations with modals

### API Endpoints
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/logout
- GET/POST/PUT/DELETE /api/users
- GET/POST/PUT/DELETE /api/domaines
- POST /api/domaines/{id}/assign
- DELETE /api/domaines/{id}/unassign/{user_id}
- GET/POST/PUT/DELETE /api/outils
- POST /api/outils/{id}/assign
- DELETE /api/outils/{id}/unassign/{user_id}
- GET /api/audit-logs
- GET /api/dashboard/stats

## Prioritized Backlog

### P0 (Implemented)
- [x] Authentication system
- [x] User management
- [x] Domaine management
- [x] Outil management
- [x] Role assignment
- [x] Audit logs

### P1 (Next Phase)
- [ ] AWS S3 file storage integration
- [ ] Document upload/management
- [ ] User profile page with password change

### P2 (Future)
- [ ] Email notifications
- [ ] Advanced reporting/analytics
- [ ] Export audit logs

## Next Tasks List
1. Integrate AWS S3 for file storage when user provides credentials
2. Implement document management within outils
3. Add user profile page with password change functionality
4. Implement password reset flow
5. Add more detailed dashboard metrics

## Technical Stack
- Backend: FastAPI + SQLAlchemy + asyncpg
- Frontend: React 19 + Tailwind CSS + Shadcn/UI
- Database: PostgreSQL
- Auth: JWT + bcrypt
- Storage: AWS S3 (pending)
