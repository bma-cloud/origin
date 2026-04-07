import os

# ---------------------------------------------------------------------------
# Paramètres de connexion à la base Optim BTP (lecture seule)
# Lus depuis les variables d'environnement définies dans backend/.env
# ---------------------------------------------------------------------------

OPTIM_HOST: str = os.environ.get("OPTIM_HOST", "VM-04-ITS")
OPTIM_PORT: int = int(os.environ.get("OPTIM_PORT", "3307"))
OPTIM_USER: str = os.environ.get("OPTIM_USER", "")
OPTIM_PASSWORD: str = os.environ.get("OPTIM_PASSWORD", "")
OPTIM_DB: str = os.environ.get("OPTIM_DB", "optimbtp")
