# BTP Manager - Product Requirements Document

## Overview
Application web professionnelle de gestion de chantier (BTP) avec systeme d'authentification hierarchique, gestion des domaines et outils, et audit logging.

## Original Problem Statement
Creer une application web avec :
- Systeme d'authentification hierarchique JWT (Direction, Encadrant, User)
- Gestion avancee des roles par outil
- Architecture modulaire (domaines -> outils)
- Design premium Aura (dark UI minimaliste, palette monochrome: Rouge, Noir, Blanc, Gris)
- PostgreSQL database
- AWS S3 pour le stockage (differe)

## User Personas
1. **Direction (Super Admin)** - Acces total, gestion de tous les utilisateurs, domaines, outils et audit logs
2. **Encadrant** - Acces limite aux domaines assignes, peut creer des Users, auto-assigne aux outils de ses domaines
3. **User** - Acces uniquement aux outils assignes

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

### Phase 2 - March 30, 2026 (Nouvelles fonctionnalites)
- **Page Profil** : Affiche domaines/outils assignes pour tous les roles
- **Role viewer ajoute** a PREPA CHANTIER
- **Voir utilisateurs assignes aux outils** : Direction et Encadrant peuvent voir qui est assigne a chaque outil
- **Auto-assignation Encadrant** : Quand un encadrant est assigne a un domaine, il recoit automatiquement acces a tous les outils du domaine (role conduc)
- **Toggle Dark/Light Mode** : Bouton dans le header pour basculer entre les modes

### Phase 3 - March 30, 2026 (Roles dynamiques)
- **Roles dynamiques avec permissions** : Chaque outil peut avoir des roles personnalises avec des permissions specifiques (lecture, ecriture, suppression, validation, gestion equipe, export, admin)
- **Structure enrichie** : roles_disponibles stocke maintenant [{name, permissions, description}] au lieu de simples strings
- **Templates de roles** : Modeles predefinies (viewer, conduc, mag, chef_de_file, etc.) applicables lors de la creation
- **Modale de visualisation** : Affiche les permissions stockees en base pour chaque role
- **Grille 3 colonnes** : Domaines et Outils affiches en grille responsive 3 colonnes
- **Retro-compatibilite** : Support des anciens formats string dans le frontend

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
- [x] Dynamic roles with permissions
- [x] 3-column grid layout for Domaines and Outils

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

## Technical Stack
- Backend: FastAPI + SQLAlchemy + asyncpg
- Frontend: React 19 + Tailwind CSS + Shadcn/UI
- Database: PostgreSQL
- Auth: JWT + bcrypt
- Storage: AWS S3 (pending)

## Key DB Schema
- `users`: {id, email, password_hash, role_global, is_active, nom, prenom}
- `domaines`: {id, nom, description}
- `outils`: {id, nom, domaine_id, roles_disponibles (JSON: [{name, permissions, description}])}
- `user_outils`: {user_id, outil_id, role}
- `user_domaines`: {user_id, domaine_id}
- `audit_logs`: {id, user_id, action, entity_type, entity_id, details, ip_address, timestamp}
