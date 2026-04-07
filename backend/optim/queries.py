from optim.connector import get_optim_connection

# ---------------------------------------------------------------------------
# Requête SQL principale — chantiers actifs avec toutes les informations
# enrichies via les tables liées d'Optim BTP.
#
# Jointures :
#   afc_affaire         → nom complet, CA, client, société
#   bib_personne p_ca   → Chargé d'Affaire (via AFF_ChargeAff)
#   bib_personne p_cond → Conducteur de Travaux (via CHT_ConducTvx)
#   bib_tiers           → Raison sociale du client
#   ref_societe         → Société ITS exécutante
#   z_adresse           → Adresse chantier (TypeEntite='CHT')
# ---------------------------------------------------------------------------

_SQL_CHANTIERS = """
SELECT
    c.CHT_ID              AS id_optim,
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

    -- Client
    t.TRS_RaisonSociale   AS client_raison_sociale,
    t.TRS_NomReduit       AS client_nom_reduit,

    -- Société ITS exécutante
    sct.SCT_RaisonSociale AS societe,
    sct.SCT_LibelleCourt  AS societe_libelle,

    -- Adresse chantier (z_adresse de type CHT liée au CHT_ID)
    adr.ADR_Ligne1        AS adresse_ligne1,
    adr.ADR_CP            AS adresse_cp,
    adr.ADR_Ville         AS adresse_ville

FROM afc_chantier c
INNER JOIN afc_affaire a
        ON c.CHT_AFF_ID = a.AFF_ID
INNER JOIN (
    -- Sélectionne les affaires ayant au moins un marché de travaux
    -- dont l'état est 'À établir' (642) ou 'Accepté' (640)
    SELECT DISTINCT VDE_AFF_ID
    FROM vte_doc_entete
    WHERE VDE_IsMarche = 1
      AND VDE_EtatMarche IN (640, 642)
) m ON m.VDE_AFF_ID = a.AFF_ID
LEFT JOIN bib_personne p_ca
       ON a.AFF_ChargeAff = p_ca.PRS_ID
LEFT JOIN bib_personne p_cond
       ON c.CHT_ConducTvx = p_cond.PRS_ID
LEFT JOIN bib_tiers t
       ON a.AFF_TRS_ID = t.TRS_ID
LEFT JOIN ref_societe sct
       ON c.CHT_SCT_ID = sct.SCT_ID
LEFT JOIN z_adresse adr
       ON adr.ADR_TypeEntite = 'CHT'
      AND adr.ADR_Entite_Id  = c.CHT_ID
WHERE c.CHT_IsDesactive = 0
  AND YEAR(c.CHT_DateDebPrev) IN (2025, 2026)
"""


def get_chantiers_actifs() -> list[dict]:
    """
    Retourne tous les chantiers actifs (CHT_IsDesactive = 0) avec les données
    enrichies : CA réel, conducteur, client, société et adresse chantier.
    Triés par date de début prévue décroissante.
    Le filtrage par période est géré côté frontend.
    """
    sql = _SQL_CHANTIERS + " ORDER BY c.CHT_DateDebPrev DESC"
    with get_optim_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql)
            return cursor.fetchall()


def get_chantier_by_code(code: str) -> dict | None:
    """
    Retourne un seul chantier actif identifié par son code CHT_Code,
    avec toutes les données enrichies.
    Retourne None si le chantier est introuvable ou désactivé.
    """
    sql = _SQL_CHANTIERS + " AND c.CHT_Code = %s"
    with get_optim_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql, (code,))
            return cursor.fetchone()
