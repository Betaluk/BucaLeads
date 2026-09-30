import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Path to database: leads.db in backend root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "leads.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

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

