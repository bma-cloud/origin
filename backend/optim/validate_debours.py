"""
Validation rapide : get_debours_from_devis() == get_devis_f11_full() ?

Usage : python -m optim.validate_debours
"""
import os
from pathlib import Path

env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

from optim.queries import validate_debours_sources, get_chantiers_actifs  # noqa

def run():
    # Prendre les 10 premiers devis actifs pour validation croisée
    chantiers = get_chantiers_actifs()[:10]
    vde_ids = list({c["id_optim"] for c in chantiers if c.get("id_optim")})[:10]

    print(f"{'VDE_ID':>8}  {'OK':>4}  {'Devis':>12}  {'F11':>12}  {'Écart':>10}  {'MO d':>10}  {'MO f':>10}  Réf")
    print("-" * 100)

    all_ok = True
    for vde_id in vde_ids:
        r = validate_debours_sources(vde_id)
        ok_str = "OK" if r["ok"] else "FAIL"
        mo_d = r["par_categorie"].get("MO", {}).get("devis", 0)
        mo_f = r["par_categorie"].get("MO", {}).get("f11", 0)

        # trouver la ref
        ref = next((c["code_marche"] for c in chantiers if c.get("id_optim") == vde_id), "")
        print(
            f"{vde_id:>8}  {ok_str:>4}  "
            f"{r['total_devis']:>12.2f}  "
            f"{r['total_f11']:>12.2f}  "
            f"{r['ecart_total']:>+10.2f}  "
            f"{mo_d:>10.2f}  {mo_f:>10.2f}  {ref}"
        )
        if not r["ok"]:
            all_ok = False
            for cat, d in r["par_categorie"].items():
                if abs(d["ecart"]) > 0.02:
                    print(f"          {cat}: devis={d['devis']:.2f}  f11={d['f11']:.2f}  ecart={d['ecart']:+.2f}")

    print()
    print("Résultat global :", "TOUS OK" if all_ok else "ECHECS DETECTES")

if __name__ == "__main__":
    run()
