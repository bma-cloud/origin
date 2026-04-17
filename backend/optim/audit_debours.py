"""
Audit de la structure du déboursé OPTIM — à exécuter une fois.

Usage (depuis le répertoire backend/) :
    python -m optim.audit_debours

Résultats écrits dans optim/audit_debours_result.txt
"""

import json
import os
import sys
from pathlib import Path

# Charger le .env
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

from optim.connector import get_optim_connection  # noqa: E402

OUT = Path(__file__).parent / "audit_debours_result.txt"
lines_out: list[str] = []


def h(title: str) -> None:
    lines_out.append("\n" + "=" * 70)
    lines_out.append(f"  {title}")
    lines_out.append("=" * 70)


def p(text: str) -> None:
    lines_out.append(str(text))


def run() -> None:
    with get_optim_connection() as conn:
        cur = conn.cursor()

        # --------------------------------------------------------------------
        # 1a. Types de lignes distincts dans vte_doc_ligne (déboursé)
        # --------------------------------------------------------------------
        h("1a — Types de lignes dans vte_doc_ligne (déboursé commercial)")
        cur.execute("""
            SELECT VDL_TypeLigne AS type_ligne, COUNT(*) AS nb
            FROM vte_doc_ligne
            GROUP BY VDL_TypeLigne
            ORDER BY nb DESC
        """)
        for r in cur.fetchall():
            p(f"  TypeLigne={r['type_ligne']}  →  {r['nb']} lignes")

        # --------------------------------------------------------------------
        # 1b. Types de lignes dans afc_etude_prix_detail (F11 étude de prix)
        # --------------------------------------------------------------------
        h("1b — Types de lignes dans afc_etude_prix_detail (F11)")
        cur.execute("""
            SELECT ETP_TypeLigne AS type_ligne, COUNT(*) AS nb
            FROM afc_etude_prix_detail
            GROUP BY ETP_TypeLigne
            ORDER BY nb DESC
        """)
        for r in cur.fetchall():
            p(f"  TypeLigne={r['type_ligne']}  →  {r['nb']} lignes")

        # --------------------------------------------------------------------
        # 1c. Pour un vrai VDE_ID : lignes vte_doc_ligne avec montants
        # --------------------------------------------------------------------
        h("1c — Récupérer un VDE_ID réel pour les tests")
        cur.execute("""
            SELECT VDE_ID, VDE_Reference, VDE_Libelle, VDE_MtHTNet
            FROM vte_doc_entete
            WHERE VDE_IsMarche = 1
              AND VDE_EtatMarche IN (640, 642)
              AND VDE_MtHTNet > 0
            ORDER BY VDE_DateAccord DESC
            LIMIT 5
        """)
        vde_rows = cur.fetchall()
        for r in vde_rows:
            p(f"  VDE_ID={r['VDE_ID']}  ref={r['VDE_Reference']}  ht={r['VDE_MtHTNet']}  →  {str(r['VDE_Libelle'])[:60]}")

        if not vde_rows:
            p("  Aucun devis trouvé — impossible de continuer.")
            return

        vde_id = vde_rows[0]["VDE_ID"]
        p(f"\n  → VDE_ID retenu pour les analyses : {vde_id}")

        # --------------------------------------------------------------------
        # 1d. Toutes les lignes vte_doc_ligne pour ce VDE_ID
        # --------------------------------------------------------------------
        h(f"1d — Lignes vte_doc_ligne pour VDE_ID={vde_id}")
        cur.execute("""
            SELECT
                VDL_ID,
                VDL_TypeLigne,
                VDL_Niveau,
                VDL_OrdreVDL,
                VDL_Code,
                VDL_Libelle,
                VDL_LibUnite   AS unite,
                VDL_Qte        AS quantite,
                VDL_PAU        AS pau,
                VDL_PctVte     AS coef_vte,
                VDL_PVU        AS pvu,
                VDL_MtHT       AS mt_ht,
                VDL_IsMtFixe   AS fixe,
                VDL_VDL_ID     AS parent_id
            FROM vte_doc_ligne
            WHERE VDL_VDE_ID = %s
              AND VDL_IsDesactive = 0
            ORDER BY VDL_OrdreVDL ASC
        """, (vde_id,))
        vdl_rows = cur.fetchall()
        p(f"  Total : {len(vdl_rows)} lignes")
        p("")
        p(f"  {'Type':>4}  {'Niv':>3}  {'PAU':>12}  {'MtHT':>14}  {'Fixe':>4}  Libellé")
        p(f"  {'----':>4}  {'---':>3}  {'---':>12}  {'----':>14}  {'----':>4}  -------")
        for r in vdl_rows:
            indent = "  " * (r.get("VDL_Niveau") or 0)
            p(
                f"  {r['VDL_TypeLigne']:>4}  "
                f"{(r.get('VDL_Niveau') or 0):>3}  "
                f"{float(r.get('pau') or 0):>12.2f}  "
                f"{float(r.get('mt_ht') or 0):>14.2f}  "
                f"{r.get('fixe') or 0:>4}  "
                f"{indent}{str(r.get('VDL_Libelle') or '')[:50]}"
            )

        # Résumé par type
        p("")
        h(f"1e — Résumé par TypeLigne pour VDE_ID={vde_id} (PAU et MtHT)")
        from collections import defaultdict
        by_type: dict = defaultdict(lambda: {"n": 0, "pau": 0.0, "mt_ht": 0.0})
        for r in vdl_rows:
            t = r["VDL_TypeLigne"]
            by_type[t]["n"] += 1
            by_type[t]["pau"] += float(r.get("pau") or 0)
            by_type[t]["mt_ht"] += float(r.get("mt_ht") or 0)
        for t in sorted(by_type):
            d = by_type[t]
            p(f"  TypeLigne={t:>2}  n={d['n']:>4}  Σ(PAU)={d['pau']:>14.2f}  Σ(MtHT)={d['mt_ht']:>14.2f}")

        # --------------------------------------------------------------------
        # 1f. Même analyse sur l'étude de prix F11
        # --------------------------------------------------------------------
        h(f"1f — Lignes afc_etude_prix_detail (F11) pour VDE_ID={vde_id}")
        cur.execute("""
            SELECT
                etp.ETP_ID,
                etp.ETP_TypeLigne,
                etp.ETP_Niveau,
                etp.ETP_Code,
                etp.ETP_Libelle,
                etp.ETP_Qte        AS quantite,
                etp.ETP_PAU        AS pau,
                etp.ETP_PAT        AS pat,
                etp.ETP_NbHeures   AS nb_heures,
                etp.ETP_FTY_ID     AS fty_id,
                COALESCE(fty.FTY_Libelle, '')          AS famille,
                COALESCE(fty_par.FTY_Libelle, '')      AS famille_parent
            FROM afc_etude etu
            INNER JOIN afc_etude_prix_detail etp
                    ON etp.ETP_ETU_ID = etu.ETU_ID
                   AND etp.ETP_IsDesactive = 0
            LEFT JOIN ref_famille_type fty
                   ON fty.FTY_ID = etp.ETP_FTY_ID AND etp.ETP_FTY_ID > 0
            LEFT JOIN ref_famille_type fty_par
                   ON fty_par.FTY_ID = fty.FTY_FTY_ID
            WHERE etu.ETU_VDE_ID = %s
              AND etu.ETU_Type = 111
            ORDER BY etp.ETP_OrdreETP
        """, (vde_id,))
        f11_rows = cur.fetchall()
        p(f"  Total : {len(f11_rows)} lignes")
        p("")
        p(f"  {'Type':>4}  {'Niv':>3}  {'PAU':>12}  {'PAT':>14}  {'Famille':>20}  Libellé")
        p(f"  {'----':>4}  {'---':>3}  {'---':>12}  {'---':>14}  {'-------':>20}  -------")
        for r in f11_rows:
            famille = (r.get("famille_parent") or r.get("famille") or "").strip()
            indent = "  " * min((r.get("ETP_Niveau") or 0), 4)
            p(
                f"  {r['ETP_TypeLigne']:>4}  "
                f"{(r.get('ETP_Niveau') or 0):>3}  "
                f"{float(r.get('pau') or 0):>12.4f}  "
                f"{float(r.get('pat') or 0):>14.2f}  "
                f"{famille:>20}  "
                f"{indent}{str(r.get('ETP_Libelle') or '')[:50]}"
            )

        # Résumé F11 par type
        p("")
        h(f"1g — Résumé F11 par TypeLigne pour VDE_ID={vde_id}")
        by_type_f11: dict = defaultdict(lambda: {"n": 0, "pat": 0.0})
        for r in f11_rows:
            t = r["ETP_TypeLigne"]
            by_type_f11[t]["n"] += 1
            by_type_f11[t]["pat"] += float(r.get("pat") or 0)
        for t in sorted(by_type_f11):
            d = by_type_f11[t]
            p(f"  TypeLigne={t:>2}  n={d['n']:>4}  Σ(PAT)={d['pat']:>14.2f}")

        # --------------------------------------------------------------------
        # 1h. Tables avec "debours", "cout", "ressource" dans leur nom
        # --------------------------------------------------------------------
        h("1h — Tables OPTIM contenant 'debours' / 'cout' / 'ressource'")
        cur.execute("""
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND (
                  TABLE_NAME LIKE '%debours%'
                  OR TABLE_NAME LIKE '%cout%'
                  OR TABLE_NAME LIKE '%ressource%'
                  OR TABLE_NAME LIKE '%etude%'
              )
            ORDER BY TABLE_NAME
        """)
        for r in cur.fetchall():
            p(f"  {r['TABLE_NAME']}")

        # --------------------------------------------------------------------
        # 1i. Vérifier si VDL_PAU des lignes detail (type=1) == ETP_PAU dans F11
        # --------------------------------------------------------------------
        h(f"1i — Rapprochement VDL_PAU (devis) vs ETP_PAU (F11) pour VDE_ID={vde_id}")
        vdl_detail = [r for r in vdl_rows if r["VDL_TypeLigne"] == 1]
        f11_detail  = [r for r in f11_rows if r["ETP_TypeLigne"] == 1]
        sum_vdl_pau  = sum(float(r.get("pau") or 0) * float(r.get("quantite") or 0) for r in vdl_detail)
        sum_vdl_mth  = sum(float(r.get("mt_ht") or 0) for r in vdl_detail)
        sum_f11_pat  = sum(float(r.get("pat") or 0) for r in f11_detail)
        p(f"  vte_doc_ligne type=1 : {len(vdl_detail)} lignes")
        p(f"    Σ(PAU×Qté)          = {sum_vdl_pau:.2f}")
        p(f"    Σ(MtHT)             = {sum_vdl_mth:.2f}")
        p(f"  afc_etude_prix_detail type=1 : {len(f11_detail)} lignes")
        p(f"    Σ(PAT)              = {sum_f11_pat:.2f}")

        # VDE total
        cur.execute("SELECT VDE_MtHTNet AS ht FROM vte_doc_entete WHERE VDE_ID = %s", (vde_id,))
        meta = cur.fetchone()
        p(f"  VDE_MtHTNet (total vente HT)    = {float(meta['ht'] or 0):.2f}")

        cur.close()

    OUT.write_text("\n".join(lines_out), encoding="utf-8")
    print(f"\nRésultats écrits dans : {OUT}")
    print("\n--- Aperçu ---")
    for line in lines_out[:30]:
        print(line)


if __name__ == "__main__":
    run()
