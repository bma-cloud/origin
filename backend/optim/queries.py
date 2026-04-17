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
    l.VDL_ID          AS id,
    l.VDL_NumLigne    AS numero_ligne,
    l.VDL_Libelle     AS designation,
    l.VDL_LibUnite    AS unite,
    l.VDL_Qte         AS quantite,
    l.VDL_PAU         AS prix_unitaire,
    l.VDL_PAT         AS montant,
    l.VDL_NbHU        AS nb_heures_unitaire,
    l.VDL_NbHTot      AS nb_heures_total,
    l.VDL_Commentaire AS commentaire,
    COALESCE(t.TRS_NomReduit, t.TRS_RaisonSociale) AS fournisseur,
    CASE COALESCE(fty_par.FTY_ID, fty.FTY_ID)
        WHEN 4  THEN 'MO'   -- Main d'Oeuvre
        WHEN 6  THEN 'MAT'  -- Matériaux
        WHEN 22 THEN 'MAT'  -- Consommables → Matériaux
        WHEN 8  THEN 'ST'   -- Sous-Traitance
        WHEN 7  THEN 'LOC'  -- Engin/Matériel
        WHEN 29 THEN 'LOC'  -- Location
        WHEN 9  THEN 'FR'   -- Frais
        WHEN 18 THEN 'VTE'  -- Vente
        ELSE ''
    END AS categorie,
    COALESCE(fty.FTY_Libelle, '') AS famille
FROM vte_doc_ligne l
LEFT JOIN bib_tiers t ON t.TRS_ID = l.VDL_TRS_ID AND l.VDL_TRS_ID > 0
LEFT JOIN ref_famille_type fty     ON fty.FTY_ID     = l.VDL_FTY_ID  AND l.VDL_FTY_ID > 0
LEFT JOIN ref_famille_type fty_par ON fty_par.FTY_ID = fty.FTY_FTY_ID
WHERE l.VDL_VDE_ID    = %s
  AND l.VDL_IsDesactive = 0
  AND l.VDL_IsVideTexte = 0
ORDER BY l.VDL_Ordre
"""

_SQL_DEVIS_TOTAUX = """
SELECT
    VDE_ID          AS vde_id,
    VDE_Reference   AS reference,
    VDE_Libelle     AS libelle,
    VDE_DateDoc     AS date_doc,
    VDE_EtatMarche  AS etat,
    VDE_MtHTNet     AS total_ht,
    VDE_MtTTCNet    AS total_ttc
FROM vte_doc_entete
WHERE VDE_ID = %s
"""

_SQL_DEVIS_LIST = """
SELECT
    vde.VDE_ID          AS vde_id,
    vde.VDE_Reference   AS reference,
    vde.VDE_Libelle     AS libelle,
    vde.VDE_DateDoc     AS date_doc,
    vde.VDE_EtatMarche  AS etat,
    vde.VDE_MtHTNet     AS total_ht,
    vde.VDE_MtTTCNet    AS total_ttc
FROM vte_doc_entete vde
WHERE vde.VDE_CHT_ID = %s
  AND vde.VDE_IsMarche = 1
  AND vde.VDE_EtatMarche IN (640, 311, 715)
ORDER BY vde.VDE_DateDoc ASC
"""

_ETAT_LABELS = {
    311: "Facture totale", 640: "Accepté", 642: "À établir",
    643: "Refusé", 644: "En attente", 645: "Annulé", 715: "Facture partielle",
}


def get_devis_by_vde_id(vde_id: int) -> dict:
    """
    Retourne les lignes (détail déboursé PAU/PAT) et totaux du devis pour un VDE_ID.
    Inclut fournisseur via jointure bib_tiers.
    """
    with get_optim_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(_SQL_DEVIS_LIGNES, (vde_id,))
            lignes = cursor.fetchall()

            cursor.execute(_SQL_DEVIS_TOTAUX, (vde_id,))
            meta = cursor.fetchone() or {}

    total_ht  = float(meta.get("total_ht") or 0)
    total_ttc = float(meta.get("total_ttc") or 0)
    tva       = total_ttc - total_ht

    return {
        "vde_id":    vde_id,
        "reference": meta.get("reference") or "",
        "libelle":   meta.get("libelle") or "",
        "date_doc":  meta.get("date_doc").isoformat() if meta.get("date_doc") else None,
        "etat":      _ETAT_LABELS.get(meta.get("etat"), str(meta.get("etat") or "")),
        "lignes": [
            {
                "id":                  str(l["id"]),
                "numero_ligne":        l.get("numero_ligne") or "",
                "designation":         l.get("designation") or "",
                "unite":               l.get("unite") or "",
                "quantite":            float(l.get("quantite") or 0),
                "prix_unitaire":       float(l.get("prix_unitaire") or 0),
                "montant":             float(l.get("montant") or 0),
                "nb_heures_unitaire":  float(l.get("nb_heures_unitaire") or 0),
                "nb_heures_total":     float(l.get("nb_heures_total") or 0),
                "commentaire":         l.get("commentaire") or "",
                "fournisseur":         l.get("fournisseur") or "",
                "categorie":           l.get("categorie") or "",
                "famille":             l.get("famille") or "",
            }
            for l in lignes
        ],
        "total_ht":  total_ht,
        "tva":       tva,
        "total_ttc": total_ttc,
    }


# ---------------------------------------------------------------------------
# Devis commercial — lignes vte_doc_ligne avec prix de vente
# Champs validés via DESCRIBE vte_doc_ligne sur la base Optim :
#   VDL_TypeLigne  → type de ligne (int) : 0=entête, 1=detail, 2=sous-titre, 3=sous-titre2, 4=titre
#   VDL_Niveau     → profondeur dans l'arborescence (0=racine)
#   VDL_Libelle    → libellé de la ligne
#   VDL_LibUnite   → unité
#   VDL_Qte        → quantité
#   VDL_PAU        → Prix d'Achat Unitaire (déboursé interne)
#   VDL_PctVte     → coefficient de marge (%)
#   VDL_PVU        → Prix de Vente Unitaire HT
#   VDL_MtHT       → Montant HT total de la ligne (prix vente)
#   VDL_IsMtFixe   → ligne à montant fixé (1 = oui)
#   VDL_VDL_ID     → ID de la ligne parente (0 = pas de parent)
# ---------------------------------------------------------------------------
_SQL_DEVIS_COMMERCIAL = """
SELECT
    vdl.VDL_ID          AS id,
    vdl.VDL_OrdreVDL    AS ordre,
    vdl.VDL_NumLigne    AS numero_ligne,
    vdl.VDL_TypeLigne   AS type_ligne,
    vdl.VDL_Niveau      AS niveau,
    vdl.VDL_Code        AS code,
    vdl.VDL_Libelle     AS designation,
    vdl.VDL_LibUnite    AS unite,
    vdl.VDL_Qte         AS quantite,
    vdl.VDL_PAU         AS pau,
    vdl.VDL_PctVte      AS coef_vente,
    vdl.VDL_PVU         AS prix_unitaire,
    vdl.VDL_MtHT        AS montant,
    vdl.VDL_IsMtFixe    AS is_fixe,
    vdl.VDL_VDL_ID      AS parent_id
FROM vte_doc_ligne vdl
WHERE vdl.VDL_VDE_ID = %s
  AND vdl.VDL_IsDesactive = 0
ORDER BY vdl.VDL_OrdreVDL ASC
"""


def get_devis_commercial_lines(vde_id: int) -> dict:
    """
    Retourne les lignes commerciales du devis (vte_doc_ligne) avec les PRIX DE VENTE.
    Structure : titre → sous-titre → detail, reconstituée via VDL_ParentID.
    """
    with get_optim_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(_SQL_DEVIS_COMMERCIAL, (vde_id,))
            lignes = cursor.fetchall()

            cursor.execute(_SQL_DEVIS_TOTAUX, (vde_id,))
            meta = cursor.fetchone() or {}

    total_ht  = float(meta.get("total_ht") or 0)
    total_ttc = float(meta.get("total_ttc") or 0)
    tva       = total_ttc - total_ht

    return {
        "vde_id":    vde_id,
        "reference": meta.get("reference") or "",
        "libelle":   meta.get("libelle") or "",
        "date_doc":  meta.get("date_doc").isoformat() if meta.get("date_doc") else None,
        "etat":      _ETAT_LABELS.get(meta.get("etat"), str(meta.get("etat") or "")),
        "lignes": [
            {
                "id":           str(l["id"]),
                "ordre":        int(l.get("ordre") or 0),
                "numero_ligne": l.get("numero_ligne") or "",
                "type_ligne":   int(l.get("type_ligne") or 0),  # 0=entête, 1=detail, 2=sous-titre, 3=sous-titre2, 4=titre
                "niveau":       int(l.get("niveau") or 0),
                "code":         l.get("code") or "",
                "designation":  l.get("designation") or "",
                "unite":        l.get("unite") or "",
                "quantite":     float(l.get("quantite") or 0),
                "pau":          float(l.get("pau") or 0),
                "coef_vente":   float(l.get("coef_vente") or 0),
                "prix_unitaire": float(l.get("prix_unitaire") or 0),
                "montant":      float(l.get("montant") or 0),
                "is_fixe":      bool(l.get("is_fixe")),
                # VDL_VDL_ID = 0 means no parent (root level)
                "parent_id":    str(l["parent_id"]) if l.get("parent_id") else None,
            }
            for l in lignes
        ],
        "total_ht":  total_ht,
        "tva":       tva,
        "total_ttc": total_ttc,
    }


_SQL_F11_LIGNES = """
SELECT
    etp.ETP_ID          AS id,
    etp.ETP_Code        AS numero_ligne,
    etp.ETP_Libelle     AS designation,
    etp.ETP_LibUnite    AS unite,
    etp.ETP_Qte         AS quantite,
    etp.ETP_PAU         AS prix_unitaire,
    etp.ETP_PAT         AS montant,
    etp.ETP_NbHeures    AS nb_heures,
    etp.ETP_TypeLigne   AS type_ligne,
    etp.ETP_Niveau      AS niveau,
    etp.ETP_Hierarchie  AS hierarchie,
    etp.ETP_OrdreETP    AS ordre_affichage,
    COALESCE(fty.FTY_Libelle, '')                           AS sous_famille,
    COALESCE(fty_par.FTY_Libelle, fty.FTY_Libelle, '')     AS type_famille,
    CASE COALESCE(fty_par.FTY_ID, fty.FTY_ID)
        WHEN 4  THEN 'MO'
        WHEN 6  THEN 'MAT'
        WHEN 22 THEN 'MAT'
        WHEN 8  THEN 'ST'
        WHEN 7  THEN 'LOC'
        WHEN 29 THEN 'LOC'
        WHEN 9  THEN 'FR'
        WHEN 18 THEN 'VTE'
        ELSE ''
    END AS categorie
FROM afc_etude etu
INNER JOIN afc_etude_prix_detail etp
        ON etp.ETP_ETU_ID = etu.ETU_ID
       AND etp.ETP_IsDesactive = 0
       AND etp.ETP_TypeLigne IN (1, 2)
LEFT JOIN ref_famille_type fty
       ON fty.FTY_ID = etp.ETP_FTY_ID
      AND etp.ETP_FTY_ID > 0
LEFT JOIN ref_famille_type fty_par
       ON fty_par.FTY_ID = fty.FTY_FTY_ID
WHERE etu.ETU_VDE_ID = %s
  AND etu.ETU_Type = 111
ORDER BY etp.ETP_OrdreETP
"""


def _assign_ouvrage_categories(rows: list[dict]) -> list[dict]:
    """
    Les ouvrages (TypeLigne=2) n'ont pas de FTY_ID → categorie=''.
    On leur assigne la catégorie + sous_famille du prochain TL=1 qui suit.
    """
    for i, row in enumerate(rows):
        if row["type_ligne"] == 2 and not row["categorie"]:
            for j in range(i + 1, len(rows)):
                if rows[j]["type_ligne"] == 1 and rows[j]["categorie"]:
                    row["categorie"]   = rows[j]["categorie"]
                    row["sous_famille"] = rows[j]["sous_famille"]
                    break
    return rows


def get_devis_f11_full(vde_id: int) -> dict:
    """
    Retourne les lignes F11 (afc_etude_prix_detail) + totaux (vte_doc_entete)
    pour un VDE_ID.
    TypeLigne=2 = ouvrage composé (bold, sans Qté/PAU)
    TypeLigne=1 = ressource individuelle (indentée, toutes colonnes)
    """
    with get_optim_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(_SQL_F11_LIGNES, (vde_id,))
            raw_rows = cursor.fetchall()

            cursor.execute(_SQL_DEVIS_TOTAUX, (vde_id,))
            meta = cursor.fetchone() or {}

    rows = _assign_ouvrage_categories([
        {
            "id":            str(r["id"]),
            "numero_ligne":  r.get("numero_ligne") or "",
            "designation":   r.get("designation") or "",
            "unite":         r.get("unite") or "",
            "quantite":      float(r.get("quantite") or 0),
            "prix_unitaire": float(r.get("prix_unitaire") or 0),
            "montant":       float(r.get("montant") or 0),
            "nb_heures":     float(r.get("nb_heures") or 0),
            "type_ligne":    int(r.get("type_ligne") or 0),
            "niveau":        int(r.get("niveau") or 0),
            "hierarchie":    r.get("hierarchie") or "",
            "sous_famille":  r.get("sous_famille") or "",
            "categorie":     r.get("categorie") or "",
            "type_famille":  r.get("type_famille") or "",
            # compat contre-étude copy
            "fournisseur":   "",
            "commentaire":   "",
            "famille":       r.get("sous_famille") or "",
        }
        for r in raw_rows
    ])

    total_ht  = float(meta.get("total_ht") or 0)
    total_ttc = float(meta.get("total_ttc") or 0)
    tva       = total_ttc - total_ht

    return {
        "vde_id":    vde_id,
        "reference": meta.get("reference") or "",
        "libelle":   meta.get("libelle") or "",
        "date_doc":  meta.get("date_doc").isoformat() if meta.get("date_doc") else None,
        "etat":      _ETAT_LABELS.get(meta.get("etat"), str(meta.get("etat") or "")),
        "lignes":    rows,
        "total_ht":  total_ht,
        "tva":       tva,
        "total_ttc": total_ttc,
    }


# ---------------------------------------------------------------------------
# Déboursé depuis le devis commercial (vte_doc_ligne)
#
# LOGIQUE VALIDÉE PAR AUDIT (audit_debours_result.txt) :
#   - TypeLigne=1  → ressource individuelle (seules lignes portant PAU réel)
#   - TypeLigne=2  → sous-titre / ouvrage composé (agrégat de ses enfants)
#   - TypeLigne=0,3,4,5,9 → agrégats ou textes — IGNORÉS pour éviter double-comptage
#
# Équivalence exacte avec F11 (afc_etude_prix_detail) vérifiée sur VDE_ID=6218 :
#   Σ(VDL_PAT, TL=1) == Σ(ETP_PAT, TL=1) = total déboursé
#   VDL_PAT  = VDL_PAU × VDL_Qte  (coût brut, avant coef vente)
#   VDL_MtHT = prix de vente final (avec coef marge) — NE PAS utiliser pour le déboursé
#
# Catégories via VDL_FTY_ID → ref_famille_type : même mapping que F11.
# ---------------------------------------------------------------------------
_SQL_DEBOURS_FROM_DEVIS = """
SELECT
    l.VDL_ID          AS id,
    l.VDL_TypeLigne   AS type_ligne,
    l.VDL_Niveau      AS niveau,
    l.VDL_OrdreVDL    AS ordre_affichage,
    l.VDL_NumLigne    AS numero_ligne,
    l.VDL_Libelle     AS designation,
    l.VDL_LibUnite    AS unite,
    l.VDL_Qte         AS quantite,
    l.VDL_PAU         AS prix_unitaire,
    l.VDL_PAT         AS montant,
    l.VDL_NbHTot      AS nb_heures,
    l.VDL_Commentaire AS commentaire,
    COALESCE(t.TRS_NomReduit, t.TRS_RaisonSociale, '') AS fournisseur,
    COALESCE(fty.FTY_Libelle, '')                           AS sous_famille,
    COALESCE(fty_par.FTY_Libelle, fty.FTY_Libelle, '')     AS type_famille,
    CASE COALESCE(fty_par.FTY_ID, fty.FTY_ID)
        WHEN 4  THEN 'MO'
        WHEN 6  THEN 'MAT'
        WHEN 22 THEN 'MAT'
        WHEN 8  THEN 'ST'
        WHEN 7  THEN 'LOC'
        WHEN 29 THEN 'LOC'
        WHEN 9  THEN 'FR'
        WHEN 18 THEN 'VTE'
        ELSE ''
    END AS categorie
FROM vte_doc_ligne l
LEFT JOIN bib_tiers t
       ON t.TRS_ID = l.VDL_TRS_ID AND l.VDL_TRS_ID > 0
LEFT JOIN ref_famille_type fty
       ON fty.FTY_ID = l.VDL_FTY_ID AND l.VDL_FTY_ID > 0
LEFT JOIN ref_famille_type fty_par
       ON fty_par.FTY_ID = fty.FTY_FTY_ID
WHERE l.VDL_VDE_ID    = %s
  AND l.VDL_IsDesactive = 0
  AND l.VDL_TypeLigne IN (1, 2)
ORDER BY l.VDL_OrdreVDL ASC
"""


def get_debours_from_devis(vde_id: int) -> dict:
    """
    Génère le déboursé (structure contre-étude) directement depuis vte_doc_ligne,
    sans passer par afc_etude_prix_detail (F11).

    Retourne le même format que get_devis_f11_full() : compatible avec
    groupF11ByOuvrage() et ContreEtudeStructuree côté frontend.

    Règle de calcul :
      montant (type=1) = VDL_PAT = VDL_PAU × VDL_Qte  (déboursé brut)
      montant (type=2) = VDL_PAT = Σ PAT des enfants   (sous-total ouvrage)
    """
    with get_optim_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(_SQL_DEBOURS_FROM_DEVIS, (vde_id,))
            raw_rows = cursor.fetchall()

            cursor.execute(_SQL_DEVIS_TOTAUX, (vde_id,))
            meta = cursor.fetchone() or {}

    rows = _assign_ouvrage_categories([
        {
            "id":            str(r["id"]),
            "numero_ligne":  r.get("numero_ligne") or "",
            "designation":   r.get("designation") or "",
            "unite":         r.get("unite") or "",
            "quantite":      float(r.get("quantite") or 0),
            "prix_unitaire": float(r.get("prix_unitaire") or 0),
            "montant":       float(r.get("montant") or 0),
            "nb_heures":     float(r.get("nb_heures") or 0),
            "type_ligne":    int(r.get("type_ligne") or 0),
            "niveau":        int(r.get("niveau") or 0),
            "hierarchie":    "",  # pas dans vte_doc_ligne, non utilisé côté frontend
            "sous_famille":  r.get("sous_famille") or "",
            "categorie":     r.get("categorie") or "",
            "type_famille":  r.get("type_famille") or "",
            "fournisseur":   r.get("fournisseur") or "",
            "commentaire":   r.get("commentaire") or "",
            "famille":       r.get("sous_famille") or "",
        }
        for r in raw_rows
    ])

    # total_ht ici = Σ(PAT, type=1) = total déboursé (pas le prix de vente VDE_MtHTNet)
    total_debours = sum(r["montant"] for r in rows if r["type_ligne"] == 1)
    total_ttc_vente = float(meta.get("total_ttc") or 0)

    return {
        "vde_id":    vde_id,
        "reference": meta.get("reference") or "",
        "libelle":   meta.get("libelle") or "",
        "date_doc":  meta.get("date_doc").isoformat() if meta.get("date_doc") else None,
        "etat":      _ETAT_LABELS.get(meta.get("etat"), str(meta.get("etat") or "")),
        "lignes":    rows,
        "total_ht":  total_debours,
        "tva":       0.0,
        "total_ttc": total_ttc_vente,
        "source":    "devis",  # tag pour validation : "devis" vs "f11"
    }


def validate_debours_sources(vde_id: int) -> dict:
    """
    Compare le déboursé généré depuis vte_doc_ligne avec celui issu de F11.
    Retourne un rapport de validation : totaux, nb lignes, écart absolu.
    Utiliser pour vérifier que get_debours_from_devis() == get_devis_f11_full().
    """
    from collections import defaultdict

    devis = get_debours_from_devis(vde_id)
    f11   = get_devis_f11_full(vde_id)

    def totals_by_cat(lignes: list[dict]) -> dict:
        t: dict = defaultdict(float)
        for l in lignes:
            if l["type_ligne"] == 1:
                t[l["categorie"] or ""] += l["montant"]
        return dict(t)

    devis_cat = totals_by_cat(devis["lignes"])
    f11_cat   = totals_by_cat(f11["lignes"])

    all_cats = sorted(set(devis_cat) | set(f11_cat))
    cat_diff = {
        c: {
            "devis": round(devis_cat.get(c, 0), 2),
            "f11":   round(f11_cat.get(c, 0), 2),
            "ecart": round(devis_cat.get(c, 0) - f11_cat.get(c, 0), 2),
        }
        for c in all_cats
    }

    total_devis = sum(devis_cat.values())
    total_f11   = sum(f11_cat.values())

    return {
        "vde_id":       vde_id,
        "total_devis":  round(total_devis, 2),
        "total_f11":    round(total_f11, 2),
        "ecart_total":  round(total_devis - total_f11, 2),
        "nb_lignes_devis": len([l for l in devis["lignes"] if l["type_ligne"] == 1]),
        "nb_lignes_f11":   len([l for l in f11["lignes"]   if l["type_ligne"] == 1]),
        "par_categorie": cat_diff,
        "ok": abs(total_devis - total_f11) < 0.02,  # tolérance 2 centimes
    }


def get_devis_list_for_chantier(cht_id: int) -> list[dict]:
    """
    Retourne la liste de tous les devis (VDE) pour un CHT_ID donné.
    """
    with get_optim_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(_SQL_DEVIS_LIST, (cht_id,))
            rows = cursor.fetchall()

    return [
        {
            "vde_id":    r["vde_id"],
            "reference": r.get("reference") or "",
            "libelle":   r.get("libelle") or "",
            "date_doc":  r["date_doc"].isoformat() if r.get("date_doc") else None,
            "etat":      _ETAT_LABELS.get(r.get("etat"), str(r.get("etat") or "")),
            "total_ht":  float(r.get("total_ht") or 0),
            "total_ttc": float(r.get("total_ttc") or 0),
        }
        for r in rows
    ]
