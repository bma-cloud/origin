import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pymongo import UpdateOne
import pymysql

from optim.queries import get_chantiers_actifs, get_chantier_by_code
from database import fiche_chantiers_col

logger = logging.getLogger(__name__)


async def _sync_task():
    """
    Wrapper sans HTTPException pour lancer la sync en background task (démarrage serveur).
    Les erreurs sont loggées sans interrompre le démarrage.
    """
    try:
        result = await sync_chantiers()
        logger.info(f"Sync auto Optim terminée : {result}")
    except Exception as e:
        logger.warning(f"Sync auto Optim échouée (Optim peut être indisponible) : {e}")

# Préfixe /api/optim pour rester cohérent avec le préfixe /api du projet
optim_router = APIRouter(prefix="/api/optim", tags=["Optim BTP"])

# Nombre d'étapes de suivi dans la Fiche Chef de File
NB_ETAPES = 13


def _build_etapes_initiales() -> list[dict]:
    """
    Génère la liste des 13 étapes de suivi vierges.
    Utilisé uniquement à la création d'un chantier (jamais en mise à jour).
    """
    return [
        {"numero": i, "statut": "non_commence", "taches": []}
        for i in range(1, NB_ETAPES + 1)
    ]


def _format_date(value) -> str | None:
    """
    Convertit une date/datetime Python (retournée par PyMySQL) en chaîne ISO.
    Retourne None si la valeur est absente.
    """
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return value.isoformat()


@optim_router.get("/chantiers")
def list_chantiers():
    """
    Retourne la liste de tous les chantiers actifs depuis Optim BTP.
    Les routes sont synchrones (def) car PyMySQL est un driver synchrone ;
    FastAPI les exécute automatiquement dans un thread pool.
    """
    try:
        chantiers = get_chantiers_actifs()
        return {"total": len(chantiers), "chantiers": chantiers}
    except pymysql.Error as e:
        logger.error(f"Erreur lors de la récupération des chantiers Optim : {e}")
        raise HTTPException(status_code=503, detail="Base Optim BTP inaccessible")


@optim_router.get("/chantiers/{code}")
def get_chantier(code: str):
    """
    Retourne le détail d'un chantier identifié par son code CHT_Code.
    Retourne 404 si le chantier est introuvable ou désactivé.
    """
    try:
        chantier = get_chantier_by_code(code)
    except pymysql.Error as e:
        logger.error(f"Erreur lors de la récupération du chantier '{code}' : {e}")
        raise HTTPException(status_code=503, detail="Base Optim BTP inaccessible")

    if chantier is None:
        raise HTTPException(status_code=404, detail=f"Chantier '{code}' introuvable")

    return chantier


@optim_router.post("/sync")
async def sync_chantiers():
    """
    Synchronise tous les chantiers actifs Optim BTP dans la collection MongoDB
    'fiche_chantiers'.

    Stratégie d'upsert :
    - $set      : met à jour les champs Optim (code, nom, dates, ca, synced_at)
                  à chaque synchronisation.
    - $setOnInsert : initialise les champs ITS Origin (cf, etapes, created_at)
                  UNIQUEMENT à la création — jamais écrasés ensuite.

    Retourne le nombre de chantiers créés et mis à jour.
    """
    # 1. Récupérer les chantiers depuis Optim (appel synchrone → thread pool)
    try:
        chantiers_optim = await asyncio.to_thread(get_chantiers_actifs)
    except pymysql.Error as e:
        logger.error(f"Sync Optim — erreur lecture MySQL : {e}")
        raise HTTPException(status_code=503, detail="Base Optim BTP inaccessible")

    if not chantiers_optim:
        return {"created": 0, "updated": 0, "total_optim": 0}

    now = datetime.now(timezone.utc).isoformat()

    # 2. Construire les opérations bulk upsert
    operations = []
    for c in chantiers_optim:
        # Champs CA : CONCAT peut retourner "None None" si la personne est absente
        nom_ca = c.get("nom_ca") or ""
        if nom_ca.strip().lower() in ("none none", "none"):
            nom_ca = ""

        operations.append(
            UpdateOne(
                # Filtre : clé de déduplication sur l'identifiant Optim
                {"optim_id": c["id_optim"]},
                {
                    # Champs Optim — toujours mis à jour
                    "$set": {
                        "optim_id":           c["id_optim"],
                        "code":               c["code"],
                        "nom":                c["nom"],
                        "etat":               c.get("etat"),
                        "date_debut_prevue":  _format_date(c.get("date_debut_prevue")),
                        "date_fin_prevue":    _format_date(c.get("date_fin_prevue")),
                        "date_debut_reelle":  _format_date(c.get("date_debut_reelle")),
                        "date_fin_reelle":    _format_date(c.get("date_fin_reelle")),
                        "ca": {
                            "nom_complet": nom_ca,
                            "initiales":   c.get("initiales_ca") or "",
                            "fonction":    c.get("fonction_ca") or "",
                        },
                        "synced_at": now,
                    },
                    # Champs ITS Origin — initialisés une seule fois à la création
                    "$setOnInsert": {
                        "cf": {
                            "nom_complet": "",
                            "initiales":   "",
                        },
                        "etapes":     _build_etapes_initiales(),
                        "created_at": now,
                    },
                },
                upsert=True,
            )
        )

    # 3. Exécuter le bulk write en une seule requête MongoDB
    result = await fiche_chantiers_col.bulk_write(operations, ordered=False)

    created = result.upserted_count
    updated = result.modified_count

    logger.info(
        f"Sync Optim terminée — créés : {created}, mis à jour : {updated}, "
        f"total Optim : {len(chantiers_optim)}"
    )

    return {
        "created":     created,
        "updated":     updated,
        "total_optim": len(chantiers_optim),
    }
