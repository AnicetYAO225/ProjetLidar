"""Configuration de la base de données PostGIS"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from geoalchemy2 import Geometry

from app.config import settings

# Création du moteur de base de données
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,  # Vérifie la connexion avant utilisation
    pool_size=10,
    max_overflow=20
)

# Session locale
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base pour les modèles
Base = declarative_base()


def get_db():
    """Générateur de session de base de données pour FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialise la base de données avec PostGIS"""
    from sqlalchemy import text
    
    with engine.connect() as conn:
        # Activation de l'extension PostGIS
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis_topology;"))
        conn.commit()
    
    # Création des tables
    Base.metadata.create_all(bind=engine)
    print("✅ Base de données initialisée avec PostGIS")
