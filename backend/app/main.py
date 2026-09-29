import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.models import Search, Lead, SiteAudit
from app.routers import search, leads, export

# Criar tabelas automaticamente se não existirem
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="BucaLeads API",
    description="Motor de busca de leads no Google, auditoria digital, lead scoring e mini-CRM",
    version="1.0.0"
)

# Habilitar CORS para o frontend (local e futuro Cloudflare Pages)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar Routers
app.include_router(search.router)
app.include_router(leads.router)
app.include_router(export.router)

@app.get("/")
def root():
    return {
        "status": "online",
        "app": "BucaLeads API",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
