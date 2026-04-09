import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
import pymysql

from database import fiche_chantiers_col
from optim.queries import get_chantier_by_code, get_devis_by_vde_id

logger = logging.getLogger(__name__)

fiche_router = APIRouter(prefix="/api/fiches", tags=["Fiche Chef de File"])

# Valeurs autorisées pour le statut d'une étape
STATUTS_VALIDES = {"non_commence", "en_cours", "termine"}

# Nombre d'étapes de suivi de la Fiche Chef de File
NB_ETAPES = 12


def _build_etapes_initiales() -> list[dict]:
    """Génère les 13 étapes vierges pour un nouveau document."""
    return [
        {"numero": i, "statut": "non_commence", "taches": []}
        for i in range(1, NB_ETAPES + 1)
    ]


def _format_date(value) -> str | None:
    """Convertit une date/datetime PyMySQL en chaîne ISO. Retourne None si absent."""
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return value.isoformat()


def _doc_depuis_optim(chantier: dict, now: str) -> dict:
    """
    Construit un document fiche_chantiers complet à partir d'une ligne Optim.
    Utilisé lors de la création à la volée (chantier absent de MongoDB).
    """
    nom_ca = chantier.get("nom_ca") or ""
    if nom_ca.strip().lower() in ("none none", "none"):
        nom_ca = ""

    nom_cond = chantier.get("nom_conducteur") or ""
    if nom_cond.strip().lower() in ("none none", "none"):
        nom_cond = ""

    return {
        "optim_id":           chantier["id_optim"],
        "code_marche":        chantier.get("code_marche") or "",
        "ref_ext_marche":     chantier.get("ref_ext_marche") or "",
        "description_marche": chantier.get("description_marche") or "",
        "etat_marche":        chantier.get("etat_marche"),
        "date_accord":        _format_date(chantier.get("date_accord")),
        "chantier_id":        chantier.get("chantier_id"),
        "code":               chantier["code"],
        "nom":                chantier["nom"],
        "nom_complet":        chantier.get("nom_complet") or chantier["nom"],
        "etat":               chantier.get("etat"),
        "date_debut_prevue": _format_date(chantier.get("date_debut_prevue")),
        "date_fin_prevue":   _format_date(chantier.get("date_fin_prevue")),
        "date_debut_reelle": _format_date(chantier.get("date_debut_reelle")),
        "date_fin_reelle":   _format_date(chantier.get("date_fin_reelle")),
        "ca": {
            "nom_complet": nom_ca,
            "initiales":   chantier.get("initiales_ca") or "",
            "fonction":    chantier.get("fonction_ca") or "",
        },
        "conducteur": {
            "nom_complet": nom_cond,
            "fonction":    chantier.get("fonction_conducteur") or "",
        },
        "client": {
            "raison_sociale": chantier.get("client_raison_sociale") or "",
            "nom_reduit":     chantier.get("client_nom_reduit") or "",
        },
        "societe": {
            "raison_sociale": chantier.get("societe") or "",
            "libelle":        chantier.get("societe_libelle") or "",
        },
        "adresse": {
            "ligne1": chantier.get("adresse_ligne1") or "",
            "cp":     chantier.get("adresse_cp") or "",
            "ville":  chantier.get("adresse_ville") or "",
        },
        "cf":        {"nom_complet": "", "initiales": ""},
        "etapes":    _build_etapes_initiales(),
        "synced_at": now,
        "created_at": now,
    }


# ---------------------------------------------------------------------------
# GET /api/fiches/{code_chantier}
# ---------------------------------------------------------------------------

@fiche_router.get("")
async def list_fiches():
    """
    Retourne la liste de toutes les fiches synchronisées dans MongoDB.
    Utilisée par la page d'index pour afficher le tableau de bord des fiches.
    """
    cursor = fiche_chantiers_col.find({}, {"_id": 0})
    fiches = await cursor.to_list(length=None)
    return {"total": len(fiches), "fiches": fiches}


@fiche_router.get("/{code_chantier}")
async def get_fiche(code_chantier: str):
    """
    Retourne la Fiche Chef de File complète pour un chantier donné.
    Si le chantier n'existe pas encore dans MongoDB :
      - Interroge Optim BTP via get_chantier_by_code()
      - Crée le document avec les 13 étapes vierges et le CF vide
      - Retourne le document créé
    Retourne 404 si le chantier est introuvable dans Optim également.
    """
    # Recherche d'abord dans MongoDB (cas nominal)
    doc = await fiche_chantiers_col.find_one({"code": code_chantier}, {"_id": 0})
    if doc:
        return doc

    # Chantier absent de MongoDB → création à la volée depuis Optim
    logger.info(f"Fiche '{code_chantier}' absente de MongoDB, interrogation Optim...")
    try:
        chantier_optim = await asyncio.to_thread(get_chantier_by_code, code_chantier)
    except pymysql.Error as e:
        logger.error(f"Erreur Optim lors de la création à la volée de '{code_chantier}' : {e}")
        raise HTTPException(status_code=503, detail="Base Optim BTP inaccessible")

    if chantier_optim is None:
        raise HTTPException(
            status_code=404,
            detail=f"Chantier '{code_chantier}' introuvable dans Optim BTP"
        )

    now = datetime.now(timezone.utc).isoformat()
    nouveau_doc = _doc_depuis_optim(chantier_optim, now)

    await fiche_chantiers_col.insert_one(nouveau_doc)
    nouveau_doc.pop("_id", None)   # Retirer l'ObjectId MongoDB avant de sérialiser
    logger.info(f"Fiche '{code_chantier}' créée automatiquement depuis Optim")
    return nouveau_doc


# ---------------------------------------------------------------------------
# PATCH /api/fiches/{code_chantier}/cf
# ---------------------------------------------------------------------------

@fiche_router.patch("/{code_chantier}/cf")
async def update_cf(code_chantier: str, body: dict):
    """
    Met à jour uniquement le Chef de File (CF) d'une fiche.
    Body attendu : { "nom_complet": "...", "initiales": "..." }
    Ne touche à aucun autre champ.
    """
    nom_complet = str(body.get("nom_complet", "")).strip()
    initiales   = str(body.get("initiales", "")).strip()

    result = await fiche_chantiers_col.update_one(
        {"code": code_chantier},
        {"$set": {"cf": {"nom_complet": nom_complet, "initiales": initiales}}}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail=f"Chantier '{code_chantier}' introuvable dans ITS Origin"
        )

    return {"ok": True, "cf": {"nom_complet": nom_complet, "initiales": initiales}}


# ---------------------------------------------------------------------------
# PATCH /api/fiches/{code_chantier}/etapes/{numero_etape}
# ---------------------------------------------------------------------------

@fiche_router.patch("/{code_chantier}/etapes/{numero_etape}")
async def update_etape(code_chantier: str, numero_etape: int, body: dict):
    """
    Met à jour le statut d'une étape identifiée par son numéro (1 à 13).
    Valeurs autorisées : "non_commence", "en_cours", "termine".
    Utilise l'index tableau (numero - 1) pour cibler précisément l'étape.
    """
    if numero_etape < 1 or numero_etape > NB_ETAPES:
        raise HTTPException(
            status_code=400,
            detail=f"Numéro d'étape invalide — attendu entre 1 et {NB_ETAPES}"
        )

    statut = body.get("statut")
    if statut not in STATUTS_VALIDES:
        raise HTTPException(
            status_code=400,
            detail=f"Statut invalide. Valeurs autorisées : {sorted(STATUTS_VALIDES)}"
        )

    idx = numero_etape - 1  # index dans le tableau etapes[]

    result = await fiche_chantiers_col.update_one(
        # Double filtre : chantier + numéro d'étape pour garantir la cohérence
        {"code": code_chantier, f"etapes.{idx}.numero": numero_etape},
        {"$set": {f"etapes.{idx}.statut": statut}}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail=f"Chantier '{code_chantier}' ou étape {numero_etape} introuvable"
        )

    return {"ok": True, "etape": numero_etape, "statut": statut}


# ---------------------------------------------------------------------------
# Référentiels (conducteurs / chefs de file)
# ---------------------------------------------------------------------------

@fiche_router.get("/referentiels/conducteurs")
async def get_conducteurs():
    """Retourne la liste des conducteurs de travaux depuis les fiches chantier."""
    pipeline = [
        {"$match": {"conducteur.nom_complet": {"$ne": "", "$exists": True}}},
        {"$group": {"_id": "$conducteur.nom_complet"}},
        {"$sort": {"_id": 1}},
    ]
    results = await fiche_chantiers_col.aggregate(pipeline).to_list(None)
    conducteurs = [{"id": r["_id"], "nom": r["_id"]} for r in results if r["_id"]]
    return conducteurs


@fiche_router.get("/referentiels/chefs-de-file")
async def get_chefs_de_file():
    """Retourne la liste des chefs de file depuis les fiches chantier."""
    pipeline = [
        {"$match": {"cf.nom_complet": {"$ne": "", "$exists": True}}},
        {"$group": {"_id": "$cf.nom_complet"}},
        {"$sort": {"_id": 1}},
    ]
    results = await fiche_chantiers_col.aggregate(pipeline).to_list(None)
    chefs = [{"id": r["_id"], "nom": r["_id"]} for r in results if r["_id"]]
    return chefs


# ---------------------------------------------------------------------------
# Devis Optim (lecture seule — étape 2)
# ---------------------------------------------------------------------------

@fiche_router.get("/{code_chantier}/devis")
async def get_devis(code_chantier: str):
    """
    Retourne les lignes du devis Optim pour un marché (lecture seule).
    Requête directe sur vte_doc_ligne via l'optim_id stocké en MongoDB.
    """
    fiche = await fiche_chantiers_col.find_one({"code": code_chantier}, {"optim_id": 1})
    if not fiche:
        raise HTTPException(status_code=404, detail=f"Chantier '{code_chantier}' introuvable")

    optim_id = fiche.get("optim_id")
    if not optim_id:
        return {"lignes": [], "total_ht": 0, "tva": 0, "total_ttc": 0}

    try:
        devis = await asyncio.to_thread(get_devis_by_vde_id, optim_id)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Optim BTP inaccessible : {e}")

    return devis


# ---------------------------------------------------------------------------
# Planification (étape 1)
# ---------------------------------------------------------------------------

@fiche_router.put("/{code_chantier}/planification")
async def update_planification(code_chantier: str, body: dict):
    """
    Enregistre la planification initiale : équipe, dossier admin, statut planifié.
    """
    fiche = await fiche_chantiers_col.find_one({"code": code_chantier})
    if not fiche:
        raise HTTPException(status_code=404, detail=f"Chantier '{code_chantier}' introuvable")

    conducteur_nom   = body.get("conducteur") or ""
    chef_de_file_nom = body.get("chef_de_file") or ""

    planification = {
        "planifie":     bool(body.get("planifie", False)),
        "conducteur":   conducteur_nom,
        "chef_de_file": chef_de_file_nom,
        "dossier": {
            "acompte": bool(body.get("dossier", {}).get("acompte", False)),
            "os":      bool(body.get("dossier", {}).get("os", False)),
            "contrat": bool(body.get("dossier", {}).get("contrat", False)),
        },
    }

    # Met à jour la planification ET les champs conducteur/cf affichés sur la fiche
    # Ces champs sont dans $setOnInsert (jamais écrasés par la sync Optim)
    await fiche_chantiers_col.update_one(
        {"code": code_chantier},
        {"$set": {
            "planification": planification,
            "conducteur.nom_complet": conducteur_nom,
            "cf.nom_complet":         chef_de_file_nom,
        }}
    )
    return {"ok": True, "planification": planification}


# ---------------------------------------------------------------------------
# Contre-étude (étape 2)
# ---------------------------------------------------------------------------

@fiche_router.put("/{code_chantier}/contre-etude")
async def update_contre_etude(code_chantier: str, body: dict):
    """
    Enregistre la contre-étude technique : lignes, totaux, commentaire global.
    """
    fiche = await fiche_chantiers_col.find_one({"code": code_chantier})
    if not fiche:
        raise HTTPException(status_code=404, detail=f"Chantier '{code_chantier}' introuvable")

    contre_etude = {
        "lignes":            body.get("lignes", []),
        "total_ht":          float(body.get("total_ht", 0)),
        "ecart_devis":       float(body.get("ecart_devis", 0)),
        "commentaire_global": body.get("commentaire_global") or "",
    }

    await fiche_chantiers_col.update_one(
        {"code": code_chantier},
        {"$set": {"contre_etude": contre_etude}}
    )
    return {"ok": True, "contre_etude": contre_etude}
