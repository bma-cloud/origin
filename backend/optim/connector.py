import pymysql
import pymysql.cursors
from contextlib import contextmanager
import logging

from core.config import OPTIM_HOST, OPTIM_PORT, OPTIM_USER, OPTIM_PASSWORD, OPTIM_DB

logger = logging.getLogger(__name__)


@contextmanager
def get_optim_connection():
    """
    Gestionnaire de contexte pour la connexion à la base Optim BTP.
    Connexion ouverte en lecture seule (autocommit désactivé, pas d'écriture possible).
    Utilise DictCursor pour retourner les lignes sous forme de dictionnaires.
    La connexion est toujours fermée proprement, même en cas d'erreur.
    """
    conn = pymysql.connect(
        host=OPTIM_HOST,
        port=OPTIM_PORT,
        user=OPTIM_USER,
        password=OPTIM_PASSWORD,
        database=OPTIM_DB,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
        connect_timeout=5,
        read_timeout=10,
    )
    try:
        logger.debug("Connexion Optim BTP établie")
        yield conn
    except pymysql.Error as e:
        logger.error(f"Erreur base Optim BTP : {e}")
        raise
    finally:
        conn.close()
        logger.debug("Connexion Optim BTP fermée")
