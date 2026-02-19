"""Modèles de données spatiales avec PostGIS"""
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from app.database import Base


class SpatialFeature(Base):
    """Entités géographiques génériques"""
    __tablename__ = "spatial_features"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100))
    description = Column(String)
    
    # Géométrie (peut être Point, LineString, Polygon, etc.)
    geom = Column(Geometry(geometry_type='GEOMETRY', srid=4326))
    
    # Métadonnées
    properties = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Building(Base):
    """Bâtiments avec hauteur pour 3D"""
    __tablename__ = "buildings"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))
    building_type = Column(String(100))
    height = Column(Float)  # Hauteur en mètres
    floors = Column(Integer)
    
    # Géométrie 2D (empreinte au sol)
    geom = Column(Geometry(geometry_type='POLYGON', srid=4326))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LidarData(Base):
    """Métadonnées des fichiers LIDAR"""
    __tablename__ = "lidar_data"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    filepath = Column(String(500), nullable=False)
    
    # Informations LIDAR
    point_count = Column(Integer)
    min_elevation = Column(Float)
    max_elevation = Column(Float)
    
    # Emprise géographique
    bounds = Column(Geometry(geometry_type='POLYGON', srid=4326))
    
    # Métadonnées
    crs = Column(String(100))
    point_format = Column(String(50))
    metadata = Column(JSON)
    
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    processed = Column(Integer, default=0)  # 0: non traité, 1: traité


class AnalysisResult(Base):
    """Résultats d'analyses spatiales"""
    __tablename__ = "analysis_results"
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_type = Column(String(100), nullable=False)  # buffer, intersection, etc.
    input_features = Column(JSON)
    parameters = Column(JSON)
    
    # Résultat géométrique
    result_geom = Column(Geometry(geometry_type='GEOMETRY', srid=4326))
    
    # Statistiques
    result_data = Column(JSON)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SimulationResult(Base):
    """Résultats de simulations"""
    __tablename__ = "simulation_results"
    
    id = Column(Integer, primary_key=True, index=True)
    simulation_type = Column(String(100), nullable=False)  # flood, viewshed, shadow
    name = Column(String(255))
    
    # Zone d'étude
    area_geom = Column(Geometry(geometry_type='POLYGON', srid=4326))
    
    # Paramètres de simulation
    parameters = Column(JSON)
    
    # Résultats
    result_raster = Column(String)  # Chemin vers le fichier raster
    result_vector = Column(Geometry(geometry_type='GEOMETRY', srid=4326))
    statistics = Column(JSON)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
