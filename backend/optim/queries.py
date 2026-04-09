from optim.connector import get_optim_connection

# ---------------------------------------------------------------------------
# Requête SQL principale — marchés de travaux (1 ligne = 1 marché)
#
# Source principale : vte_doc_entete (VDE) — 1 ligne par marché
#
# Jointures :
#   afc_chantier c          → code chantier, dates, conducteur, société, adresse
#   afc_affaire a           → CA, client
#   bib_personne p_ca       → Chargé d'Affaire (via AFF_ChargeAff)
#   bib_personne p_cond     → Conducteur de Travaux (via CHT_ConducTvx)
#   bib_tiers t_client      → Client du marché (VDE_TRS_ID_Client prioritaire)
#   bib_tiers t_aff         → Client de l'affaire (fallback)
#   ref_societe sct         → Société ITS exécutante
#   z_adresse adr           → Adresse chantier
#
# Filtre :
#   VDE_IsMarche = 1                       → marchés de travaux uniquement
#   VDE_EtatMarche IN (640, 642)           → Accepté ou À établir
#   YEAR(VDE_DateAccord) IN (2025, 2026)   → années en cours / précédente
# ---------------------------------------------------------------------------

_SQL_MARCHES = """
SELECT
    -- Identifiants marché (clé primaire = VDE_ID)
    vde.VDE_ID            AS id_optim,
    vde.VDE_Reference     AS code_marche,
    vde.VDE_RefExtMarche  AS ref_ext_marche,
    vde.VDE_Libelle       AS description_marche,
    vde.VDE_EtatMarche    AS etat_marche,
    vde.VDE_DateAccord    AS date_accord,
    vde.VDE_DateDoc       AS date_document,
    vde.VDE_DateDeb       AS date_debut,
    vde.VDE_DateFin       AS date_fin,
    vde.VDE_MtHTNet       AS montant_ht_net,
    vde.VDE_MtTTCNet      AS montant_ttc_net,

    -- Chantier lié
    c.CHT_ID              AS chantier_id,
    c.CHT_Code            AS code,
    c.CHT_Libelle         AS nom,
    c.CHT_LibelleEdition  AS nom_complet,
    c.CHT_ETAT            AS etat,
    c.CHT_DateDebPrev     AS date_debut_prevue,
    c.CHT_DateFinPrev     AS date_fin_prevue,
    c.CHT_DateDebutReel   AS date_debut_reelle,
    c.CHT_DateFinReel     AS date_fin_reelle,

    -- Chargé d'Affaire (depuis afc_affaire.AFF_ChargeAff)
    CONCAT(p_ca.PRS_Prenom, ' ', p_ca.PRS_Nom) AS nom_ca,
    p_ca.PRS_LibFct       AS fonction_ca,
    p_ca.PRS_Initial      AS initiales_ca,

    -- Conducteur de Travaux (depuis afc_chantier.CHT_ConducTvx)
    CONCAT(p_cond.PRS_Prenom, ' ', p_cond.PRS_Nom) AS nom_conducteur,
    p_cond.PRS_LibFct     AS fonction_conducteur,

    -- Client (priorité au client du marché, sinon client de l'affaire)
    COALESCE(t_client.TRS_RaisonSociale, t_aff.TRS_RaisonSociale) AS client_raison_sociale,
    COALESCE(t_client.TRS_NomReduit,     t_aff.TRS_NomReduit)     AS client_nom_reduit,

    -- Société ITS exécutante
    sct.SCT_RaisonSociale AS societe,
    sct.SCT_LibelleCourt  AS societe_libelle,

    -- Adresse chantier
    adr.ADR_Ligne1        AS adresse_ligne1,
    adr.ADR_CP            AS adresse_cp,
    adr.ADR_Ville         AS adresse_ville

FROM vte_doc_entete vde
INNER JOIN afc_chantier c
        ON c.CHT_ID = vde.VDE_CHT_ID
INNER JOIN afc_affaire a
        ON c.CHT_AFF_ID = a.AFF_ID
LEFT JOIN bib_personne p_ca
       ON a.AFF_ChargeAff = p_ca.PRS_ID
LEFT JOIN bib_personne p_cond
       ON c.CHT_ConducTvx = p_cond.PRS_ID
LEFT JOIN bib_tiers t_client
       ON vde.VDE_TRS_ID_Client = t_client.TRS_ID
LEFT JOIN bib_tiers t_aff
       ON a.AFF_TRS_ID = t_aff.TRS_ID
LEFT JOIN ref_societe sct
       ON c.CHT_SCT_ID = sct.SCT_ID
LEFT JOIN z_adresse adr
       ON adr.ADR_TypeEntite = 'CHT'
      AND adr.ADR_Entite_Id  = c.CHT_ID
WHERE vde.VDE_IsMarche = 1
  AND vde.VDE_EtatMarche IN (640, 642)
  AND YEAR(vde.VDE_DateAccord) IN (2025, 2026)
  AND c.CHT_IsDesactive = 0
"""


def get_chantiers_actifs() -> list[dict]:
    """
    Retourne tous les marchés de travaux actifs (Accepté ou À établir)
    pour les années 2025 et 2026, triés par date d'accord décroissante.
    1 ligne = 1 marché (plusieurs marchés possibles par chantier).
    """
    sql = _SQL_MARCHES + " ORDER BY vde.VDE_DateAccord DESC"
    with get_optim_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql)
            return cursor.fetchall()


def get_chantier_by_code(code: str) -> dict | None:
    """
    Retourne le premier marché actif identifié par le code CHT_Code du chantier.
    Retourne None si introuvable.
    """
    sql = _SQL_MARCHES + " AND c.CHT_Code = %s LIMIT 1"
    with get_optim_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql, (code,))
            return cursor.fetchone()


_SQL_DEVIS_LIGNES = """
SELECT
    VDL_ID          AS id,
    VDL_NumLigne    AS numero_ligne,
    VDL_Libelle     AS designation,
    VDL_LibUnite    AS unite,
    VDL_Qte         AS quantite,
    VDL_PVU         AS prix_unitaire,
    VDL_MtHT        AS montant
FROM vte_doc_ligne
WHERE VDL_VDE_ID   = %s
  AND VDL_IsDesactive = 0
  AND VDL_IsVideTexte = 0
ORDER BY VDL_Ordre
"""

_SQL_DEVIS_TOTAUX = """
SELECT
    VDE_MtHTNet  AS total_ht,
    VDE_MtTTCNet AS total_ttc
FROM vte_doc_entete
WHERE VDE_ID = %s
"""


def get_devis_by_vde_id(vde_id: int) -> dict:
    """
    Retourne les lignes et totaux du devis pour un marché (VDE_ID = optim_id).
    """
    with get_optim_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(_SQL_DEVIS_LIGNES, (vde_id,))
            lignes = cursor.fetchall()

            cursor.execute(_SQL_DEVIS_TOTAUX, (vde_id,))
            totaux = cursor.fetchone() or {"total_ht": 0, "total_ttc": 0}

    total_ht  = float(totaux.get("total_ht") or 0)
    total_ttc = float(totaux.get("total_ttc") or 0)
    tva       = total_ttc - total_ht

    return {
        "lignes": [
            {
                "id":           str(l["id"]),
                "numero_ligne": l.get("numero_ligne") or "",
                "designation":  l.get("designation") or "",
                "unite":        l.get("unite") or "",
                "quantite":     float(l.get("quantite") or 0),
                "prix_unitaire": float(l.get("prix_unitaire") or 0),
                "montant":      float(l.get("montant") or 0),
            }
            for l in lignes
        ],
        "total_ht":  total_ht,
        "tva":       tva,
        "total_ttc": total_ttc,
    }
