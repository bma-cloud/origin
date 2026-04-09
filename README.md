# ITS Origin — Plateforme BTP

Application interne de gestion des opérations BTP (suivi marchés, fiches chef de file, outils métier).

## Structure du projet

```
origin/
├── backend/      # API FastAPI + MongoDB + Optim BTP (MySQL)
└── frontend/     # React + TailwindCSS + shadcn/ui
```

---

## Lancement rapide

### 1. Backend (Terminal 1)

```bash
cd "C:\Users\ia\Desktop\ORIGIN ITS\origin\backend"
venv\Scripts\activate
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

API disponible sur : http://localhost:8001  
Documentation Swagger : http://localhost:8001/docs

### 2. Frontend (Terminal 2)

```bash
cd "C:\Users\ia\Desktop\ORIGIN ITS\origin\frontend"
npm start
```

Application disponible sur : http://localhost:3000

---

## Prérequis

| Outil | Version |
|-------|---------|
| Python | 3.10+ |
| Node.js | 18+ |
| MongoDB | local sur port 27017 |
| MySQL Optim BTP | VM-04-ITS:3307 (lecture seule) |

---

## Compte administrateur par défaut

```
Email    : superdadmin@gmail.com
Password : Superadmin123!
```

---

## Synchronisation Optim BTP

La sync se déclenche automatiquement au démarrage du serveur.  
Pour forcer une sync manuelle :

```bash
curl -X POST http://localhost:8001/api/optim/sync
```

> Les données Optim sont en **lecture seule**. Les modifications dans Optim ne se reflètent qu'au prochain redémarrage du serveur ou après une sync manuelle.

---

## Si le port 3000 est déjà occupé

```powershell
# Trouver le PID
netstat -ano | findstr :3000

# Tuer le processus (remplacer XXXX par le PID)
taskkill /F /PID XXXX
```
