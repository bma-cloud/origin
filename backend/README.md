# ITS Origin — Backend

API REST FastAPI connectée à MongoDB (données applicatives) et MySQL Optim BTP (lecture seule).

---

## Lancement

```bash
cd "C:\Users\ia\Desktop\ORIGIN ITS\origin\backend"
venv\Scripts\activate
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

- API : http://localhost:8001
- Swagger : http://localhost:8001/docs

---

## Installation (première fois)

```bash
cd "C:\Users\ia\Desktop\ORIGIN ITS\origin\backend"
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

---

## Variables d'environnement — `.env`

```env
# MongoDB
MONGO_URL=mongodb://localhost:27017
DB_NAME=btp_manager

# Auth JWT
JWT_SECRET=monsecretjwt123

# Compte admin par défaut (créé au premier démarrage)
ADMIN_EMAIL=superdadmin@gmail.com
ADMIN_PASSWORD=Superadmin123!

# CORS
FRONTEND_URL=http://localhost:3000

# Optim BTP (lecture seule)
OPTIM_HOST=VM-04-ITS
OPTIM_PORT=3307
OPTIM_USER=optimbtp
OPTIM_PASSWORD=optimbtp
OPTIM_DB=optimbtp
```

---

## Structure des fichiers

```
backend/
├── server.py                   # Point d'entrée, config FastAPI, routes principales
├── auth.py                     # Authentification JWT (login, register, middleware)
├── models.py                   # Modèles Pydantic (User, Outil, Domaine...)
├── schemas.py                  # Schémas de validation des requêtes/réponses
├── database.py                 # Connexion MongoDB (Motor async)
├── audit.py                    # Logs d'audit des actions utilisateurs
├── requirements.txt            # Dépendances Python
├── .env                        # Variables d'environnement (ne pas committer)
├── venv/                       # Environnement virtuel Python
│
├── optim/
│   ├── router.py               # Routes /api/optim + sync automatique au démarrage
│   └── queries.py              # Requête SQL marchés de travaux (vte_doc_entete)
│
├── fiche_chef_de_file/
│   └── router.py               # CRUD fiches chantier + étapes (MongoDB)
│
└── core/
    └── ...                     # Utilitaires partagés
```

---

## Endpoints principaux

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/login` | Connexion utilisateur |
| GET | `/api/dashboard/stats` | Stats pour le tableau de bord |
| GET | `/api/fiche-chantier/` | Liste des fiches chantier |
| PUT | `/api/fiche-chantier/{id}` | Mise à jour d'une fiche |
| POST | `/api/optim/sync` | Déclencher une sync Optim manuelle |
| GET | `/api/outils` | Liste des outils disponibles |

---

## Synchronisation Optim BTP

La sync se lance **automatiquement au démarrage** du serveur.

Elle :
1. Interroge `vte_doc_entete` (marchés de travaux 2025/2026, états "établi" ou "accepté")
2. Upsert chaque marché dans MongoDB (`fiche_chantiers`)
3. Supprime les marchés qui ne sont plus dans Optim

Pour forcer une sync manuelle :
```bash
curl -X POST http://localhost:8001/api/optim/sync
```

---

## Base de données MongoDB

Collections utilisées :

| Collection | Contenu |
|------------|---------|
| `users` | Comptes utilisateurs |
| `outils` | Outils métier disponibles |
| `domaines` | Domaines métier |
| `fiche_chantiers` | Fiches chantier (sync depuis Optim + données CF) |
| `audit_logs` | Historique des actions |
