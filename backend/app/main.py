"""
WebSIG Portfolio - Application principale FastAPI
Auteur: Ton nom
Description: API REST pour analyses géospatiales et visualisation LIDAR
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager


from app.routers import spatial_analysis, lidar, simulation
from app.routers import lidar_advanced as lidar
from app.database import engine, Base
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestion du cycle de vie de l'application"""
    # Startup: Créer les tables
    print("🚀 Démarrage de l'application WebSIG...")
    Base.metadata.create_all(bind=engine)
    print("✅ Base de données initialisée")
    yield
    # Shutdown
    print("👋 Arrêt de l'application")


# Initialisation de l'application
app = FastAPI(
    title="WebSIG Portfolio API",
    description="""
    API REST complète pour analyses géospatiales, traitement LIDAR et simulations spatiales.
    
    ## Fonctionnalités principales
    
    * **Analyses spatiales** : Buffer, intersection, union, calculs de distances
    * **Traitement LIDAR** : Upload, visualisation 3D, extraction MNT/MNS
    * **Simulations** : Zones inondables, analyse de visibilité, ombrage solaire
    * **Visualisation** : Cartes 2D/3D interactives
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusion des routers
app.include_router(
    spatial_analysis.router,
    prefix="/api/spatial",
    tags=["Analyses Spatiales"]
)

# Ajouter le router
app.include_router(
    lidar_advanced.router,
    prefix="/api/lidar/advanced",
    tags=["LIDAR Advanced"]
)

app.include_router(
    simulation.router,
    prefix="/api/simulation",
    tags=["Simulations"]
)


@app.get("/", tags=["Health"])
async def root():
    """Endpoint de santé de l'API"""
    return {
        "status": "online",
        "message": "WebSIG Portfolio API",
        "version": "1.0.0",
        "documentation": "/api/docs"
    }


@app.get("/api/health", tags=["Health"])
async def health_check():
    """Vérification de l'état de l'API et de la base de données"""
    try:
        from app.database import SessionLocal
        db = SessionLocal()
        # Test simple de connexion
        db.execute("SELECT 1")
        db.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "api": "healthy",
        "database": db_status,
        "postgis": "enabled"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
