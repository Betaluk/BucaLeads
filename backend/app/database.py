import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Carregar variáveis de ambiente dos arquivos .env
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env"))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DB_PATH = os.path.join(BASE_DIR, "leads.db")

# Configurações do Cloudflare D1
USE_D1 = os.getenv("USE_CLOUDFLARE_D1", "false").lower() in ("true", "1", "yes")
CF_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
CF_DB_ID = os.getenv("CLOUDFLARE_D1_DATABASE_ID", "").strip()
CF_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "").strip()

if USE_D1 and CF_ACCOUNT_ID and CF_DB_ID and CF_API_TOKEN:
    DATABASE_URL = f"cloudflare_d1://{CF_ACCOUNT_ID}:{CF_API_TOKEN}@{CF_DB_ID}"
    print(f"[Database] Modo: Cloudflare D1 Conectado (DB: {CF_DB_ID[:8]}...)")
    engine = create_engine(DATABASE_URL)
else:
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    print(f"[Database] Modo: SQLite Local ({DB_PATH})")
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


Base = declarative_base()

def run_migrations():
    """Garante que novas colunas adicionadas aos modelos existam no banco SQLite."""
    try:
        with engine.connect() as conn:
            cursor = conn.connection.cursor()
            cursor.execute("PRAGMA table_info(searches)")
            cols = [row[1] for row in cursor.fetchall()]
            if "new_leads" not in cols:
                cursor.execute("ALTER TABLE searches ADD COLUMN new_leads INTEGER DEFAULT 0")
            if "existing_leads" not in cols:
                cursor.execute("ALTER TABLE searches ADD COLUMN existing_leads INTEGER DEFAULT 0")
            conn.connection.commit()
    except Exception as e:
        print(f"[Database Migration Notice] {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

