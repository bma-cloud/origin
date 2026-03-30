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
2. **Encadrant** - Accès limité aux domaines assignés, peut créer des Users, auto-assigné aux outils de ses domaines
3. **User** - Accès uniquement aux outils assignés

## Core Requirements (Static)
- [x] JWT Authentication (24h expiry)
- [x] Bcrypt password hashing
- [x] Role-based access control (Direction/Encadrant/User)
- [x] Audit logging for all actions
- [x] PostgreSQL database
- [ ] AWS S3 file storage (DEFERRED)

## What's Been Implemented

### Phase 1 - March 30, 2026 (MVP)
- FastAPI server with SQLAlchemy async + asyncpg
- PostgreSQL database with all tables
- Complete CRUD APIs for all entities
- JWT authentication with 24h token expiry
- Role-based middleware and access control
- Audit logging for all actions
- React frontend with Aura dark UI design
- Complete pages: Login, Register, Dashboard, Users, Domaines, Outils, Audit Logs

### Phase 2 - March 30, 2026 (Nouvelles fonctionnalités)
- **Page Profil** : Affiche domaines/outils assignés pour tous les rôles
- **Rôle viewer ajouté** à PREPA CHANTIER
- **Voir utilisateurs assignés aux outils** : Direction et Encadrant peuvent voir qui est assigné à chaque outil
- **Auto-assignation Encadrant** : Quand un encadrant est assigné à un domaine, il reçoit automatiquement accès à tous les outils du domaine (rôle conduc)
- **Toggle Dark/Light Mode** : Bouton dans le header pour basculer entre les modes

## Prioritized Backlog

### P0 (Implemented)
- [x] Authentication system
- [x] User management
- [x] Domaine management
- [x] Outil management
- [x] Role assignment
- [x] Audit logs
- [x] Profile page
- [x] Assigned users view
- [x] Auto-assignment for encadrants
- [x] Dark/Light mode toggle

### P1 (Next Phase)
- [ ] AWS S3 file storage integration
- [ ] Document upload/management within outils
- [ ] Password change functionality

### P2 (Future)
- [ ] Email notifications
- [ ] Advanced reporting/analytics
- [ ] Export audit logs

## Test Accounts
- Direction: superdadmin@gmail.com / Superadmin123!
- Encadrant: encadrant@test.com / Encadrant123!
- User: testuser@test.com / Test123!

## Technical Stack
- Backend: FastAPI + SQLAlchemy + asyncpg
- Frontend: React 19 + Tailwind CSS + Shadcn/UI
- Database: PostgreSQL
- Auth: JWT + bcrypt
- Storage: AWS S3 (pending)

