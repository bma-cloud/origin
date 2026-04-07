from optim.connector import get_optim_connection

# ---------------------------------------------------------------------------
# Requête SQL commune : récupère les chantiers actifs avec leur Chargé d'Affaire
# Jointure LEFT JOIN sur bib_personne via CHT_conducTvx = PRS_ID
# ---------------------------------------------------------------------------

_SQL_CHANTIERS = """
SELECT
    c.CHT_ID            AS id_optim,
    c.CHT_Code          AS code,
    c.CHT_Libelle       AS nom,
    c.CHT_ETAT          AS etat,
    c.CHT_DateDebPrev   AS date_debut_prevue,
    c.CHT_DateFinPrev   AS date_fin_prevue,
    c.CHT_DateDebutReel AS date_debut_reelle,
    c.CHT_DateFinReel   AS date_fin_reelle,
    CONCAT(p.PRS_Prenom, ' ', p.PRS_Nom) AS nom_ca,
    p.PRS_LibFct        AS fonction_ca,
    p.PRS_Initial       AS initiales_ca
FROM afc_chantier c
LEFT JOIN bib_personne p ON p.PRS_ID = c.CHT_conducTvx
WHERE c.CHT_IsDesactive = 0
"""


def get_chantiers_actifs() -> list[dict]:
    """
    Retourne tous les chantiers actifs (CHT_IsDesactive = 0),
    triés par date de début prévue décroissante.
    Le filtrage par période est géré côté frontend (FlowChantier).
    """
    sql = _SQL_CHANTIERS + " ORDER BY c.CHT_DateDebPrev DESC"
    with get_optim_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql)
            return cursor.fetchall()


def get_chantier_by_code(code: str) -> dict | None:
    """
    Retourne un seul chantier actif identifié par son code (CHT_Code).
    Retourne None si le chantier n'existe pas ou est désactivé.
    """
    sql = _SQL_CHANTIERS + " AND c.CHT_Code = %s"
    with get_optim_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql, (code,))
            return cursor.fetchone()
