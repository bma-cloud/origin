# BTP Manager - Product Requirements Document

## Overview
Application web professionnelle de gestion de chantier (BTP) avec systeme d'authentification hierarchique, gestion des poles et outils, assistant IA, et audit logging.

## Original Problem Statement
Creer une application web avec :
- Systeme d'authentification hierarchique JWT (Direction, Encadrant, User)
- Gestion avancee des roles par outil avec permissions dynamiques
- Architecture modulaire (poles -> outils)
- Design premium Aura (dark UI minimaliste, palette monochrome: Rouge, Noir, Blanc, Gris)
- PostgreSQL database
- Assistant IA (Claude Sonnet) pour analyser les donnees et expliquer la plateforme
- AWS S3 pour le stockage (differe)

## User Personas
1. **Direction (Super Admin)** - Acces total, gestion de tous les utilisateurs, poles, outils et audit logs
2. **Encadrant** - Acces limite aux poles assignes, peut creer des Users
3. **User** - Acces aux outils des poles auxquels il est assigne

## Core Requirements
- [x] JWT Authentication (24h expiry)
- [x] Bcrypt password hashing
- [x] Role-based access control (Direction/Encadrant/User)
- [x] Audit logging for all actions
- [x] PostgreSQL database
- [x] Dynamic roles with permissions per tool
- [x] Auto-assign all tools when user is assigned to a pole
- [x] AI Assistant (Claude Sonnet) for platform analysis
- [ ] AWS S3 file storage (DEFERRED)

## What's Been Implemented

### Phase 1 - MVP
- FastAPI server with SQLAlchemy async + asyncpg
- PostgreSQL database with all tables
- Complete CRUD APIs for all entities
- JWT authentication with 24h token expiry
- Role-based middleware and access control
- Audit logging for all actions
- React frontend with Aura dark UI design

### Phase 2 - Nouvelles fonctionnalites
- Page Profil avec domaines/outils assignes
- Auto-assignation: tout utilisateur assigne a un pole obtient acces a tous ses outils
- Toggle Dark/Light Mode

### Phase 3 - Roles dynamiques
- Roles dynamiques avec permissions: roles_disponibles stocke [{name, permissions, description}]
- Templates de roles predefinies
- Grille 3 colonnes pour Poles et Outils

### Phase 4 - Poles, Users, IA (March 30, 2026)
- Renommage "Domaine" -> "Pole" dans toute l'interface
- Voir les utilisateurs assignes a chaque pole (GET /api/domaines/{id}/users)
- Desassigner un utilisateur d'un pole
- Auto-assignation etendue a TOUS les utilisateurs (pas seulement encadrants)
- Assistant IA (Claude Sonnet via emergentintegrations) avec:
  - Analyse des donnees en temps reel de la plateforme
  - Explication du fonctionnement de la plateforme
  - Historique de conversation persistant
  - Interface chat flottante

## Prioritized Backlog

### P1 (Next)
- [ ] AWS S3 file storage integration
- [ ] Document upload/management within outils
- [ ] Password change functionality

### P2 (Future)
- [ ] Email notifications
- [ ] Advanced reporting/analytics
- [ ] Export audit logs

## Technical Stack
- Backend: FastAPI + SQLAlchemy + asyncpg
- Frontend: React 19 + Tailwind CSS + Shadcn/UI
- Database: PostgreSQL
- Auth: JWT + bcrypt
- AI: Claude Sonnet 4.5 via emergentintegrations (EMERGENT_LLM_KEY)
- Storage: AWS S3 (pending)

## Key DB Schema
- `users`: {id, email, password_hash, role_global, is_active, nom, prenom}
- `domaines`: {id, nom, description} (displayed as "Poles" in UI)
- `outils`: {id, nom, domaine_id, roles_disponibles (JSON: [{name, permissions, description}])}
- `user_outils`: {user_id, outil_id, role}
- `user_domaines`: {user_id, domaine_id}
- `chat_messages`: {id, user_id, session_id, role, content}
- `audit_logs`: {id, user_id, action, entity_type, entity_id, details, ip_address, timestamp}
