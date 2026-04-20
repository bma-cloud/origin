# ITS Origin — Frontend

Interface React de la plateforme ITS Origin (React + TailwindCSS + shadcn/ui).

---

## Lancement

```bash
cd "C:\Users\ia\Desktop\ORIGIN ITS\origin\frontend"
npm start
```

Application disponible sur : http://localhost:3000

> Le backend doit être démarré sur le port 8001 avant de lancer le frontend.

---

## Installation (première fois)

```bash
cd "C:\Users\ia\Desktop\ORIGIN ITS\origin\frontend"
npm install
```

---

## Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm start` | Lance en mode développement (port 3000, hot reload) |
| `npm run build` | Compile pour la production dans `/build` |

---

## Structure des fichiers

```
frontend/src/
├── App.js                      # Routeur principal (React Router)
├── index.js                    # Point d'entrée React
├── index.css                   # Variables CSS globales (couleurs ITS, thème clair)
│
├── pages/
│   ├── Login.js                # Page de connexion
│   ├── Dashboard.js            # Tableau de bord (KPIs, activité récente)
│   ├── FlowChantier.js         # Outil fiches chantier (liste → fiche → étape)
│   ├── Outils.js               # Liste des outils métier
│   ├── OutilPage.js            # Détail d'un outil + accès
│   ├── FicheChefDeFile.js      # Gestion fiches chef de file
│   ├── Fiches.js               # Vue fiches
│   ├── Users.js                # Gestion des utilisateurs (direction)
│   ├── Domaines.js             # Gestion des domaines (direction)
│   ├── AuditLogs.js            # Logs d'audit
│   ├── Profile.js              # Profil utilisateur
│   ├── Register.js             # Inscription
│   └── OutilPage.js            # Page d'un outil avec redirection vers l'outil
│
├── components/
│   ├── Layout.js               # Sidebar + structure de page
│   ├── AiAssistant.js          # Assistant IA intégré
│   └── ui/                     # Composants shadcn/ui (Button, Card, Badge...)
│
├── contexts/
│   └── AuthContext.js          # Context auth (user, token, rôles)
│
└── lib/
    ├── api.js                  # Appels API (axios, endpoints)
    └── utils.js                # Utilitaires (cn, formatDate...)
```

---

## Couleurs ITS (thème clair)

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--color-primary` | `#D32F2F` | Rouge ITS — boutons, accents |
| `--color-bg` | `#f4f4f5` | Fond général |
| `--color-surface` | `#ffffff` | Cartes, panels |
| `--color-text` | `#09090b` | Texte principal |
| `--color-text-secondary` | `#71717a` | Texte secondaire |

---

## Navigation FlowChantier

L'outil principal fonctionne en 3 niveaux de vue :

```
Liste des marchés
    └── Fiche d'un marché (équipe, infos, 13 étapes)
            └── Détail d'une étape (statut, notes, fil d'Ariane)
```

---

## Proxy API

Les appels API sont proxifiés vers `http://localhost:8001` via la config dans [package.json](package.json) :

```json
"proxy": "http://localhost:8001"
```

---

## Si le port 3000 est déjà occupé

```powershell
# Via PowerShell (le plus fiable)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force
```
