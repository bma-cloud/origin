# BTP Manager - Product Requirements Document

## Overview
Application web de gestion de chantier BTP avec auth hierarchique, gestion des poles/outils, assistant IA, et audit logging.

## Tech Stack
- Backend: FastAPI + Motor (async MongoDB)
- Frontend: React 19 + Tailwind CSS + Shadcn/UI
- Database: MongoDB (persistent)
- Auth: JWT + bcrypt
- AI: Claude Sonnet 4.5 via emergentintegrations
- Storage: AWS S3 (pending)

## What's Been Implemented
- [x] JWT Authentication hierarchique (Direction/Encadrant/User)
- [x] CRUD complet: Utilisateurs, Poles, Outils
- [x] Roles dynamiques avec permissions par outil
- [x] Auto-assignation: utilisateur assigne a un pole = acces a tous les outils
- [x] Voir/desassigner les utilisateurs d'un pole
- [x] Assistant IA (Claude Sonnet) avec analyse des donnees plateforme
- [x] Audit logging de toutes les actions
- [x] Dark/Light mode toggle
- [x] Glassmorphism UI, palette monochrome (Rouge, Noir, Blanc, Gris)
- [x] Migration PostgreSQL -> MongoDB (donnees persistantes)
- [x] Page Profil avec poles/outils assignes

## Prioritized Backlog
### P1 (Next)
- [ ] AWS S3 file storage / upload documents
- [ ] Changement de mot de passe (page Profil)

### P2 (Future)
- [ ] Notifications email
- [ ] Rapports/analytics avances
- [ ] Export audit logs

## DB Collections (MongoDB)
- users, domaines, outils, user_domaines, user_outils, audit_logs, documents, chat_messages

## Test Accounts
- Direction: superdadmin@gmail.com / Superadmin123!
